"""
Perfil de riesgo histórico por segmento costero de Quintana Roo.

Divide la costa de QRoo en 10 segmentos. Para cada segmento, calcula:
- Probabilidad de riesgo HIGH/MEDIUM basada en 315 días de NOAA SIR
- Distribución histórica de niveles de riesgo

Output: risk_by_beach.json
"""

import json
import numpy as np
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).parent

# 10 segmentos costeros de QRoo (norte→sur)
SEGMENTS = [
    {"id": "cancun", "name": "Cancún / Puerto Juárez", "lat_center": 21.15, "lon_center": -86.82, "lat_range": [21.05, 21.25], "lon_range": [-86.90, -86.78]},
    {"id": "isla_mujeres", "name": "Isla Mujeres", "lat_center": 21.23, "lon_center": -86.73, "lat_range": [21.20, 21.28], "lon_range": [-86.76, -86.70]},
    {"id": "puerto_morelos", "name": "Puerto Morelos", "lat_center": 20.85, "lon_center": -87.00, "lat_range": [20.70, 21.00], "lon_range": [-87.10, -86.90]},
    {"id": "playa_carmen", "name": "Playa del Carmen", "lat_center": 20.63, "lon_center": -87.07, "lat_range": [20.55, 20.70], "lon_range": [-87.10, -87.00]},
    {"id": "cozumel_norte", "name": "Cozumel Norte", "lat_center": 20.51, "lon_center": -86.95, "lat_range": [20.40, 20.60], "lon_range": [-87.00, -86.85]},
    {"id": "cozumel_sur", "name": "Cozumel Sur", "lat_center": 20.35, "lon_center": -86.95, "lat_range": [20.27, 20.40], "lon_range": [-87.00, -86.88]},
    {"id": "tulum", "name": "Tulum", "lat_center": 20.21, "lon_center": -87.46, "lat_range": [20.10, 20.30], "lon_range": [-87.50, -87.40]},
    {"id": "sian_kaan", "name": "Sian Ka'an / Punta Allen", "lat_center": 19.80, "lon_center": -87.55, "lat_range": [19.50, 20.10], "lon_range": [-87.60, -87.45]},
    {"id": "muyil", "name": "Costa Central / Muyil", "lat_center": 19.30, "lon_center": -87.60, "lat_range": [19.00, 19.50], "lon_range": [-87.65, -87.50]},
    {"id": "chetumal", "name": "Chetumal / Xcalak", "lat_center": 18.50, "lon_center": -88.30, "lat_range": [17.50, 19.00], "lon_range": [-88.50, -87.50]},
]

RISK_SCORE = {"low": 0, "warning": 1, "medium": 2, "high": 3}

def build_risk_profile():
    print("=" * 60)
    print("PERFIL DE RIESGO POR SEGMENTO COSTERO")
    print("=" * 60)

    # Cargar NOAA SIR
    with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
        sir = json.load(f)

    features = sir["features"]
    dates = sorted(set(f["properties"]["date"] for f in features))
    print(f"Datos NOAA SIR: {len(features)} features, {len(dates)} fechas")

    # Inicializar contadores por segmento
    segment_stats = {}
    for seg in SEGMENTS:
        segment_stats[seg["id"]] = {
            "name": seg["name"],
            "daily_risk": defaultdict(list),  # date → list of risk scores
            "total_segments": 0,
        }

    # Clasificar cada feature SIR en un segmento
    for feat in features:
        coords = feat["geometry"]["coordinates"]
        risk = feat["properties"]["risk"]
        date = feat["properties"]["date"]
        score = RISK_SCORE.get(risk, 0)

        # Encontrar el centroide del feature
        lons, lats = zip(*coords)
        cx, cy = np.mean(lons), np.mean(lats)

        # Determinar segmento
        for seg in SEGMENTS:
            if (seg["lat_range"][0] <= cy <= seg["lat_range"][1] and
                seg["lon_range"][0] <= cx <= seg["lon_range"][1] or
                # También verificar proximidad al centro
                np.sqrt((cx - seg["lon_center"])**2 + (cy - seg["lat_center"])**2) * 111 < 30):
                segment_stats[seg["id"]]["daily_risk"][date].append(score)
                segment_stats[seg["id"]]["total_segments"] += 1
                break

    # Calcular métricas por segmento
    results = []
    for seg in SEGMENTS:
        stats = segment_stats[seg["id"]]
        daily_risks = stats["daily_risk"]

        # Riesgo promedio diario
        daily_avg = {d: np.mean(scores) for d, scores in daily_risks.items()}

        # Probabilidad de HIGH/MEDIUM
        n_days_high = sum(1 for d, s in daily_avg.items() if s >= 2)  # MEDIUM+
        n_days_total = max(len(daily_avg), 1)

        pct_high = n_days_high / n_days_total * 100
        pct_high_severe = sum(1 for d, s in daily_avg.items() if s >= 2.5) / n_days_total * 100  # HIGH+

        # Distribución de niveles
        all_scores = []
        for scores in daily_risks.values():
            all_scores.extend(scores)
        level_dist = Counter(all_scores)
        level_pct = {["low", "warning", "medium", "high"][k]: round(v / max(len(all_scores), 1) * 100, 1) for k, v in level_dist.items()}

        results.append({
            "id": seg["id"],
            "name": seg["name"],
            "lat": seg["lat_center"],
            "lon": seg["lon_center"],
            "n_features": stats["total_segments"],
            "n_dias_con_datos": n_days_total,
            "pct_high_medium": round(pct_high, 1),
            "pct_high": round(pct_high_severe, 1),
            "risk_levels_pct": level_pct,
            "riesgo_promedio": round(np.mean(list(daily_avg.values())) if daily_avg else 0, 2),
        })

    # Ordenar por riesgo (más alto primero)
    results.sort(key=lambda r: r["riesgo_promedio"], reverse=True)

    print(f"\n{'#':<3} {'Segmento':<25} {'Features':>8} {'Días':>5} {'HIGH+MED':>9} {'HIGH':>6} {'Riesgo':>7}")
    print("-" * 65)
    for i, r in enumerate(results):
        print(f"{i+1:<3} {r['name']:<25} {r['n_features']:>8} {r['n_dias_con_datos']:>5} "
              f"{r['pct_high_medium']:>7.1f}% {r['pct_high']:>5.1f}% {r['riesgo_promedio']:>6.2f}")

    # Guardar
    output = {
        "fecha_generacion": "2026-05-13",
        "n_dias": len(dates),
        "segmentos": results,
        "top_5_riesgo": [r["id"] for r in results[:5]],
    }

    with open(ROOT / "risk_by_beach.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Guardado: risk_by_beach.json ({len(results)} segmentos)")
    return output


if __name__ == "__main__":
    build_risk_profile()
