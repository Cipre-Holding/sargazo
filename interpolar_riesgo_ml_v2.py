"""
Interpolación de riesgo costero con distribución TEMPORAL (315 días NOAA SIR).

En vez de usar solo la última fecha, calcula el riesgo promedio histórico
de cada segmento costero usando los 315 días disponibles.

Mejora: el mapa de riesgo refleja la frecuencia histórica, no solo una fecha.
"""

import json
import numpy as np
from pathlib import Path
from collections import Counter, defaultdict
from scipy.spatial.distance import cdist

ROOT = Path(__file__).parent


def wendland_c2(r, R=1.0):
    r = np.asarray(r, dtype=float)
    result = np.zeros_like(r)
    mask = r < R
    x = r[mask] / R
    result[mask] = (1 - x) ** 4 * (1 + 4 * x)
    return result


def build_temporal_risk():
    print("=" * 60)
    print("INTERPOLACIÓN ML TEMPORAL (315 días)")
    print("=" * 60)

    # ── 1. Cargar todos los datos NOAA SIR ────────────────────────────────
    with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
        sir = json.load(f)

    features = sir["features"]
    dates = sorted(set(f["properties"]["date"] for f in features))
    print(f"Datos: {len(features)} features, {len(dates)} fechas ({dates[0]} → {dates[-1]})")

    # ── 2. Crear grid de costa muestreado ──────────────────────────────────
    # Tomar todas las coordenadas de todos los días, muestreadas cada 0.04°
    risk_map = {"low": 0.2, "warning": 0.45, "medium": 0.7, "high": 0.95}

    # Agrupar por coordenada (redondeada a 0.02°)
    coord_risk_sum = defaultdict(float)
    coord_risk_count = defaultdict(int)

    for feat in features:
        risk_label = feat["properties"]["risk"]
        risk_val = risk_map.get(risk_label, 0)
        coords = feat["geometry"]["coordinates"]

        for lon, lat in coords:
            # Redondear a 0.01° para agrupar puntos cercanos
            key = (round(lon, 2), round(lat, 2))
            coord_risk_sum[key] += risk_val
            coord_risk_count[key] += 1

    # Calcular riesgo promedio por coordenada
    X_train = []
    y_train = []
    for (lon, lat), total in coord_risk_sum.items():
        n = coord_risk_count[(lon, lat)]
        avg_risk = total / n
        X_train.append([lon, lat])
        y_train.append(avg_risk)

    X_train = np.array(X_train)
    y_train = np.array(y_train)

    # Muestrear a espaciado regular (~0.04°) para reducir densidad
    mask = np.ones(len(X_train), dtype=bool)
    kept = []
    for i in range(len(X_train)):
        if mask[i]:
            kept.append(i)
            d = cdist(X_train[i:i+1], X_train)[0]
            mask[d < 0.04] = False

    X_train = X_train[kept]
    y_train = y_train[kept]
    print(f"Puntos de entrenamiento (temporal, 315 días): {len(X_train)}")

    # Estadísticas
    risk_levels = {"bajo": sum(1 for y in y_train if y < 0.35),
                   "medio": sum(1 for y in y_train if 0.35 <= y < 0.6),
                   "alto": sum(1 for y in y_train if y >= 0.6)}
    print(f"  Distribución temporal: {risk_levels}")

    # ── 3. Crear grid de interpolación ────────────────────────────────────
    grid_res = 0.04
    margin = 0.8
    min_lon = X_train[:, 0].min() - margin
    max_lon = X_train[:, 0].max() + margin
    min_lat = X_train[:, 1].min() - margin
    max_lat = X_train[:, 1].max() + margin

    lon_g = np.arange(min_lon, max_lon, grid_res)
    lat_g = np.arange(min_lat, max_lat, grid_res)
    lon_m, lat_m = np.meshgrid(lon_g, lat_g)
    grid_points = np.column_stack([lon_m.ravel(), lat_m.ravel()])
    print(f"Grid: {len(lon_g)}x{len(lat_g)} = {len(grid_points)} pts")

    # ── 4. Máscara océano ─────────────────────────────────────────────────
    island_zones = [
        (-87.1, -86.7, 20.3, 20.6),
        (-86.9, -86.7, 21.2, 21.3),
        (-86.85, -86.75, 21.1, 21.2),
    ]
    land_zones = [
        (-91.0, -87.0, 15.5, 22.5),
        (-87.5, -85.5, 15.0, 18.0),
        (-85.5, -84.5, 21.5, 23.0),
        (-83.0, -80.0, 24.5, 25.5),
        (-89.0, -87.5, 14.5, 15.5),
    ]

    ocean_m = np.ones(len(grid_points))
    for i, (lon, lat) in enumerate(grid_points):
        in_island = False
        for mlon, Mlon, mlat, Mlat in island_zones:
            if mlon <= lon <= Mlon and mlat <= lat <= Mlat:
                ocean_m[i] = 0.0
                in_island = True
                break
        if in_island:
            continue
        for mlon, Mlon, mlat, Mlat in land_zones:
            if mlon <= lon <= Mlon and mlat <= lat <= Mlat:
                ocean_m[i] = 0.0
                break

    # ── 5. Kernel anisotrópico ───────────────────────────────────────────
    sigma_lon, sigma_lat = 0.5, 0.25
    R_eff = 1.8

    grid_t = np.column_stack([grid_points[:, 0] / sigma_lon, grid_points[:, 1] / sigma_lat])
    X_train_t = np.column_stack([X_train[:, 0] / sigma_lon, X_train[:, 1] / sigma_lat])

    print(f"Radio: {R_eff * sigma_lon:.2f}° ({R_eff*sigma_lon*111:.0f}km) × {R_eff * sigma_lat:.2f}° ({R_eff*sigma_lat*111:.0f}km)")

    dists = cdist(grid_t, X_train_t)
    kernel_vals = wendland_c2(dists, R=R_eff)

    # Max-pooling del riesgo temporal
    weighted = kernel_vals * y_train[np.newaxis, :]
    risk_grid = np.max(weighted, axis=1)
    risk_grid = risk_grid * ocean_m
    risk_grid = np.clip(risk_grid, 0, 1)

    # ── 6. Build GeoJSON ─────────────────────────────────────────────────
    features_out = []
    for i in range(len(grid_points)):
        rv = float(risk_grid[i])
        if rv < 0.15:
            continue
        lon, lat = grid_points[i, 0], grid_points[i, 1]
        d = grid_res / 2

        if rv > 0.65:
            color, label = '#ff0000', 'high'
        elif rv > 0.45:
            color, label = '#ffa500', 'medium'
        elif rv > 0.25:
            color, label = '#ffff00', 'warning'
        else:
            color, label = '#0000ff', 'low'

        features_out.append({
            "type": "Feature",
            "properties": {"risk": label, "rv": round(rv, 3), "c": color},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[lon-d, lat-d], [lon+d, lat-d], [lon+d, lat+d], [lon-d, lat+d], [lon-d, lat-d]]]
            },
        })

    output = {"type": "FeatureCollection", "features": features_out}
    out_path = ROOT / "noaa_sir_riesgo_ml_corregido.geojson"
    with open(out_path, "w") as f:
        json.dump(output, f)

    dist = Counter(f["properties"]["risk"] for f in features_out)
    print(f"\n✅ Interpolación temporal: {len(features_out)} celdas")
    print(f"   Distribución: {dict(dist)}")

    coz = [f for f in features_out
           if abs(f["geometry"]["coordinates"][0][0][0] - (-86.95)) < 0.3
           and abs(f["geometry"]["coordinates"][0][0][1] - 20.51) < 0.3]
    print(f"   Cerca de Cozumel: {len(coz)}")
    if coz:
        print(f"   Riesgo medio Cozumel: {np.mean([f['properties']['rv'] for f in coz]):.3f}")

    return output


if __name__ == "__main__":
    build_temporal_risk()
