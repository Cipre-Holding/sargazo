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

    # ── 1. Cargar datos agregados (Caribe completo) ──────────────────────
    with open(ROOT / "noaa_sir_aggregated_grid.json") as f:
        grid_data = json.load(f)
    print(f"Datos agregados cargados: {len(grid_data)} puntos")

    # ── 2. Crear grid de costa muestreado ──────────────────────────────────
    X_train = []
    y_train = []
    for pt in grid_data:
        X_train.append([pt["lon"], pt["lat"]])
        y_train.append(pt["avg_risk"])

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
    print(f"Puntos de entrenamiento (temporal, Caribe): {len(X_train)}")

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
        (-91.0, -87.0, 15.5, 22.5),  # Yucatan / Belize / Guatemala
        (-87.5, -85.5, 15.0, 18.0),  # Honduras
        (-85.5, -84.5, 21.5, 23.0),  # Western Cuba tip
        (-83.0, -80.0, 24.5, 25.5),  # Florida
        (-89.0, -87.5, 14.5, 15.5),  # El Salvador / Honduras / Nicaragua south
        (-85.0, -74.0, 19.8, 23.5),  # Cuba main body
        (-78.5, -76.0, 17.6, 18.6),  # Jamaica
        (-74.5, -68.0, 17.4, 20.2),  # Hispaniola
        (-67.5, -65.5, 17.8, 18.6),  # Puerto Rico
        (-86.0, -77.0, 7.0, 15.0),   # Central America
        (-77.0, -55.0, 7.0, 12.3),   # South America
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

    # Chunked calculation to prevent OOM on large grids
    chunk_size = 10000
    risk_grid = np.zeros(len(grid_points))
    for start_idx in range(0, len(grid_points), chunk_size):
        end_idx = min(start_idx + chunk_size, len(grid_points))
        dists_chunk = cdist(grid_t[start_idx:end_idx], X_train_t)
        kernel_vals_chunk = wendland_c2(dists_chunk, R=R_eff)
        weighted_chunk = kernel_vals_chunk * y_train[np.newaxis, :]
        risk_grid[start_idx:end_idx] = np.max(weighted_chunk, axis=1)

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
