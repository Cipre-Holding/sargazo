"""
Descarga datos de NOAA Sargassum Inundation Risk (SIR) v1.5.
- KMZ con segmentos de riesgo costero (diario desde Jul 2025)
- Extrae riesgo cerca de Quintana Roo / Cozumel
- Genera GeoJSON y CSV resumen

URLs:
  KMZ:  https://cwcgom.aoml.noaa.gov/SIR/KMZ/sargassum_risk_YYYYMMDD.kmz
  PDF:  https://cwcgom.aoml.noaa.gov/SIR/PDF/SIR_YYYYMMDD.pdf
"""

import requests
import zipfile
import io
import os
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
KMZ_DIR = ROOT / "noaa_sir_kmz"
os.makedirs(KMZ_DIR, exist_ok=True)

QR_BBOX = {"min_lat": 17.5, "max_lat": 22.0, "min_lon": -89.0, "max_lon": -86.0}
RISK_MAP_INT = {'0': 'low', '1': 'warning', '2': 'medium', '3': 'high'}
RISK_COLORS = {'low': '#0000ff', 'warning': '#ffff00', 'medium': '#ffa500', 'high': '#ff0000'}


def download_kmz(date_str):
    url = f"https://cwcgom.aoml.noaa.gov/SIR/KMZ/sargassum_risk_{date_str}.kmz"
    out_path = KMZ_DIR / f"sargassum_risk_{date_str}.kmz"
    if out_path.exists():
        return str(out_path)
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            with open(out_path, 'wb') as f:
                f.write(r.content)
            print(f"  ✅ {date_str} ({len(r.content)//1024} KB)")
            return str(out_path)
        else:
            print(f"  ❌ {date_str} HTTP {r.status_code}")
            return None
    except Exception as e:
        print(f"  ❌ {date_str} {e}")
        return None


def parse_kml_risk(kml_path):
    """
    Extrae segmentos de riesgo costero del KML.
    NOAA SIR usa LineStrings con riesgo en SimpleData.
    """
    segments = []

    try:
        with zipfile.ZipFile(kml_path, 'r') as zf:
            kml_files = [f for f in zf.namelist() if f.endswith('.kml')]
            if not kml_files:
                return segments
            with zf.open(kml_files[0]) as f:
                content = f.read().decode('utf-8', errors='replace')
    except Exception:
        return segments

    # Regex-based parsing (much faster than ET for 20MB files)
    placemark_pattern = re.compile(
        r'<Placemark[^>]*>.*?</Placemark>', re.DOTALL
    )
    risk_pattern = re.compile(r'<SimpleData name="risk">(\d)</SimpleData>')
    coords_pattern = re.compile(r'<coordinates>(.*?)</coordinates>', re.DOTALL)

    for pm in placemark_pattern.finditer(content):
        pm_text = pm.group()
        risk_match = risk_pattern.search(pm_text)
        if not risk_match:
            continue
        risk_int = risk_match.group(1)
        risk_label = RISK_MAP_INT.get(risk_int, 'low')

        coords_match = coords_pattern.search(pm_text)
        if not coords_match:
            continue

        coord_text = coords_match.group(1).strip()
        coords_list = []
        for part in coord_text.split():
            parts = part.split(',')
            if len(parts) >= 2:
                try:
                    lon, lat = float(parts[0]), float(parts[1])
                except ValueError:
                    continue
                if (QR_BBOX['min_lat'] <= lat <= QR_BBOX['max_lat'] and
                    QR_BBOX['min_lon'] <= lon <= QR_BBOX['max_lon']):
                    coords_list.append([lon, lat])

        if len(coords_list) >= 2:
            segments.append({
                'risk': risk_label,
                'coordinates': coords_list,
            })

    return segments


def segments_to_geojson(segments, date_str):
    """Convierte segmentos de línea a GeoJSON LineString FeatureCollection."""
    features = []
    for seg in segments:
        features.append({
            "type": "Feature",
            "properties": {
                "risk": seg['risk'],
                "date": date_str,
                "color": RISK_COLORS.get(seg['risk'], '#888888'),
            },
            "geometry": {
                "type": "LineString",
                "coordinates": seg['coordinates'],
            },
        })
    return {"type": "FeatureCollection", "features": features}


def main():
    print("=" * 60)
    print("NOAA SIR — Descarga y extracción de riesgo costero")
    print("=" * 60)

    start = datetime(2025, 7, 1)
    end = datetime.utcnow()
    all_dates = []
    d = start
    while d <= end:
        all_dates.append(d.strftime('%Y%m%d'))
        d += timedelta(days=1)
    print(f"Rango: {start.date()} → {end.date()} ({len(all_dates)} días)")

    # Download missing KMZs
    existing = set(f.stem.replace('sargassum_risk_', '') for f in KMZ_DIR.glob("sargassum_risk_*.kmz"))
    to_download = [d for d in all_dates if d not in existing]
    print(f"\nKMZs existentes: {len(existing)}, por descargar: {len(to_download)}")
    for date_str in to_download:
        download_kmz(date_str)

    # Parse all KMZs
    print(f"\nExtrayendo segmentos de riesgo para Quintana Roo...")
    all_features = []
    daily_summary = []

    kmz_files = sorted(KMZ_DIR.glob("sargassum_risk_*.kmz"))
    for kmz_path in kmz_files:
        date_str = kmz_path.stem.replace('sargassum_risk_', '')
        segments = parse_kml_risk(str(kmz_path))
        if segments:
            risk_counts = {}
            for seg in segments:
                risk_counts[seg['risk']] = risk_counts.get(seg['risk'], 0) + 1
            geojson = segments_to_geojson(segments, date_str)
            all_features.extend(geojson['features'])
            daily_summary.append({
                'date': date_str,
                'total_segments': len(segments),
                **{f'count_{k}': risk_counts.get(k, 0) for k in ['low', 'warning', 'medium', 'high']},
            })

    # Save combined GeoJSON
    combined = {"type": "FeatureCollection", "features": all_features}
    combined_path = ROOT / "noaa_sir_riesgo_costero_qroo.geojson"
    with open(combined_path, 'w') as f:
        json.dump(combined, f)
    print(f"\n✅ GeoJSON combinado: {combined_path} ({len(all_features)} features)")

    # Save reduced GeoJSON containing only the last 3 dates' features
    if all_features:
        recent_dates = sorted(list(set(f["properties"]["date"] for f in all_features)))[-3:]
        reduced_features = [f for f in all_features if f["properties"]["date"] in recent_dates]
        reduced_combined = {"type": "FeatureCollection", "features": reduced_features}
        reduced_path = ROOT / "noaa_sir_riesgo_costero_qroo_reduced.geojson"
        with open(reduced_path, 'w') as f:
            json.dump(reduced_combined, f)
        print(f"✅ GeoJSON reducido: {reduced_path} ({len(reduced_features)} features, fechas: {recent_dates})")

    # Save daily summary
    import csv
    summary_path = ROOT / "noaa_sir_resumen_diario.csv"
    with open(summary_path, 'w', newline='') as f:
        if daily_summary:
            writer = csv.DictWriter(f, fieldnames=daily_summary[0].keys())
            writer.writeheader()
            writer.writerows(daily_summary)
    print(f"✅ Resumen diario: {summary_path} ({len(daily_summary)} días)")

    # Stats
    print(f"\n=== ESTADÍSTICAS ===")
    high_days = sum(1 for d in daily_summary if d.get('count_high', 0) > 0)
    med_days = sum(1 for d in daily_summary if d.get('count_medium', 0) > 0)
    print(f"Días con riesgo ALTO en QRoo: {high_days}")
    print(f"Días con riesgo MEDIO en QRoo: {med_days}")
    print(f"Total features extraídas: {len(all_features)}")

    if all_features:
        from collections import Counter
        risk_total = Counter(f['properties']['risk'] for f in all_features)
        print(f"Distribución total: {dict(risk_total)}")


if __name__ == "__main__":
    main()
