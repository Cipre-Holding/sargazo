"""
Descarga datos de NOAA Sargassum Inundation Risk (SIR) v1.5.
- KMZ con segmentos de riesgo costero (diario desde Jul 2025)
- Extrae riesgo completo para Quintana Roo (histórico)
- Agrega riesgo para todo el Caribe en una malla ligera
- Genera GeoJSON de las últimas 3 fechas para todo el Caribe
"""

import requests
import zipfile
import io
import os
import json
import re
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
KMZ_DIR = ROOT / "noaa_sir_kmz"
os.makedirs(KMZ_DIR, exist_ok=True)

# Bboxes
QR_BBOX = {"min_lat": 17.0, "max_lat": 22.5, "min_lon": -90.0, "max_lon": -86.0}
CARIB_BBOX = {"min_lat": 8.0, "max_lat": 24.5, "min_lon": -93.0, "max_lon": -55.0}

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
            return None
    except Exception:
        return None


def parse_kml_risk(kml_path):
    """Extrae segmentos de riesgo costero del KML filtrando por QRoo y Caribe."""
    qr_segments = []
    carib_segments = []

    try:
        with zipfile.ZipFile(kml_path, 'r') as zf:
            kml_files = [f for f in zf.namelist() if f.endswith('.kml')]
            if not kml_files:
                return qr_segments, carib_segments
            with zf.open(kml_files[0]) as f:
                content = f.read().decode('utf-8', errors='replace')
    except Exception:
        return qr_segments, carib_segments

    # Regex-based parsing
    placemark_pattern = re.compile(r'<Placemark[^>]*>.*?</Placemark>', re.DOTALL)
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
        qr_coords = []
        carib_coords = []
        
        for part in coord_text.split():
            parts = part.split(',')
            if len(parts) >= 2:
                try:
                    lon, lat = float(parts[0]), float(parts[1])
                except ValueError:
                    continue
                
                # Check Quintana Roo Box
                if (QR_BBOX['min_lat'] <= lat <= QR_BBOX['max_lat'] and
                    QR_BBOX['min_lon'] <= lon <= QR_BBOX['max_lon']):
                    qr_coords.append([lon, lat])
                
                # Check Caribbean Box
                if (CARIB_BBOX['min_lat'] <= lat <= CARIB_BBOX['max_lat'] and
                    CARIB_BBOX['min_lon'] <= lon <= CARIB_BBOX['max_lon']):
                    carib_coords.append([lon, lat])

        if len(qr_coords) >= 2:
            qr_segments.append({'risk': risk_label, 'coordinates': qr_coords})
        if len(carib_coords) >= 2:
            carib_segments.append({'risk': risk_label, 'coordinates': carib_coords})

    return qr_segments, carib_segments


def segments_to_geojson(segments, date_str):
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
    print("NOAA SIR — Descarga y extracción de riesgo costero (Caribe + QRoo)")
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
    to_download = [dt for dt in all_dates if dt not in existing]
    print(f"\nKMZs existentes: {len(existing)}, por descargar: {len(to_download)}")
    for date_str in to_download:
        download_kmz(date_str)

    # Parse all KMZs
    print(f"\nProcesando archivos KMZ...")
    qr_features = []
    recent_carib_features = []
    daily_summary = []

    # Aggregator for full Caribbean history
    coord_risk_sum = defaultdict(float)
    coord_risk_count = defaultdict(int)
    risk_map = {'low': 0.2, 'warning': 0.45, 'medium': 0.7, 'high': 0.95}

    kmz_files = sorted(KMZ_DIR.glob("sargassum_risk_*.kmz"))
    recent_dates = [f.stem.replace('sargassum_risk_', '') for f in kmz_files][-3:]
    print(f"Fechas recientes a conservar completas (Caribe): {recent_dates}")

    for kmz_path in kmz_files:
        date_str = kmz_path.stem.replace('sargassum_risk_', '')
        qr_segs, carib_segs = parse_kml_risk(str(kmz_path))
        
        # 1. QRoo History (Keep all features in memory for risk_by_beach compatibility)
        if qr_segs:
            geojson_qr = segments_to_geojson(qr_segs, date_str)
            qr_features.extend(geojson_qr['features'])

        # 2. Caribbean Aggregation & Recent Features
        if carib_segs:
            risk_counts = {}
            for seg in carib_segs:
                risk_counts[seg['risk']] = risk_counts.get(seg['risk'], 0) + 1
                
                # Aggregate to grid (0.02 deg resolution)
                r_val = risk_map.get(seg['risk'], 0)
                for lon, lat in seg['coordinates']:
                    key = (round(lon, 2), round(lat, 2))
                    coord_risk_sum[key] += r_val
                    coord_risk_count[key] += 1
            
            # Save raw features only for the last 3 dates
            if date_str in recent_dates:
                geojson_carib = segments_to_geojson(carib_segs, date_str)
                recent_carib_features.extend(geojson_carib['features'])

            daily_summary.append({
                'date': date_str,
                'total_segments': len(carib_segs),
                **{f'count_{k}': risk_counts.get(k, 0) for k in ['low', 'warning', 'medium', 'high']},
            })

    # Save QRoo combined (compatibility with risk_by_beach.py)
    qr_combined = {"type": "FeatureCollection", "features": qr_features}
    qr_path = ROOT / "noaa_sir_riesgo_costero_qroo.geojson"
    with open(qr_path, 'w') as f:
        json.dump(qr_combined, f)
    print(f"\n✅ GeoJSON QRoo histórico: {qr_path} ({len(qr_features)} features)")

    # Save Caribbean reduced (last 3 dates)
    reduced_combined = {"type": "FeatureCollection", "features": recent_carib_features}
    reduced_path = ROOT / "noaa_sir_riesgo_costero_qroo_reduced.geojson"
    with open(reduced_path, 'w') as f:
        json.dump(reduced_combined, f)
    print(f"✅ GeoJSON Caribe reducido (3 fechas): {reduced_path} ({len(recent_carib_features)} features)")

    # Save Caribbean aggregated grid
    aggregated_grid = []
    for (lon, lat), total in coord_risk_sum.items():
        n = coord_risk_count[(lon, lat)]
        avg_risk = total / n
        aggregated_grid.append({"lon": lon, "lat": lat, "avg_risk": round(avg_risk, 4)})
    
    grid_path = ROOT / "noaa_sir_aggregated_grid.json"
    with open(grid_path, 'w') as f:
        json.dump(aggregated_grid, f)
    print(f"✅ Grid Caribe histórico agregado: {grid_path} ({len(aggregated_grid)} puntos)")

    # Save daily summary
    import csv
    summary_path = ROOT / "noaa_sir_resumen_diario.csv"
    with open(summary_path, 'w', newline='') as f:
        if daily_summary:
            writer = csv.DictWriter(f, fieldnames=daily_summary[0].keys())
            writer.writeheader()
            writer.writerows(daily_summary)
    print(f"✅ Resumen diario: {summary_path} ({len(daily_summary)} días)")


if __name__ == "__main__":
    main()
