"""
Backtest del Forecast Lagrangiano vs NOAA SIR.

Evalúa si la acumulación KDE de partículas (pronóstico 7 días)
coincide con las zonas de riesgo identificadas por NOAA SIR.

Para cada horizonte (24h-168h):
  - Cargar KDE de acumulación
  - Cargar NOAA SIR de la fecha más reciente
  - Calcular qué % de celdas SIR HIGH/MEDIUM están en zona KDE
  - Calcular el hit rate del forecast
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime
from scipy.spatial import cKDTree
from collections import Counter

ROOT = Path(__file__).parent

print("=" * 70)
print("BACKTEST — Forecast Lagrangiano vs NOAA SIR")
print("=" * 70)

# ── 1. Cargar KDE ────────────────────────────────────────────────────────
with open(ROOT / "forecast_kde_acumulaciones.json") as f:
    kde = json.load(f)

# ── 2. Cargar NOAA SIR (última fecha) ────────────────────────────────────
with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
    sir = json.load(f)

dates = sorted(set(f['properties']['date'] for f in sir['features']))
latest = dates[-1]
sir_latest = [f for f in sir['features'] if f['properties']['date'] == latest]

print(f"\nNOAA SIR última fecha: {latest}")
risk_counts = Counter(f['properties']['risk'] for f in sir_latest)
print(f"  Segmentos: {dict(risk_counts)}")

# ── 3. Evaluar cada horizonte KDE ────────────────────────────────────────
print(f"\n{'Horizonte':<12} {'Celdas':>8} {'HIGH/MED':>10} {'KDE cubre':>12} {'Cobertura':>10} {'Hit Rate':>10}")
print("-" * 62)

results = {}
for h_name in ['24h', '48h', '72h', '96h', '120h', '144h', '168h']:
    if h_name not in kde:
        print(f"{h_name:<12} {'—':>8} {'—':>10} {'—':>12} {'—':>10} {'—':>10}")
        continue
    
    d = kde[h_name]
    lon = np.array(d['lon'])
    lat = np.array(d['lat'])
    Z = np.array(d['density'])
    
    # Puntos del grid KDE con densidad > 0.1 (significativa)
    kde_points = []
    for i in range(len(lon)):
        for j in range(len(lat)):
            if Z[j, i] > 0.1:  # umbral significativo
                kde_points.append([lon[i], lat[j]])
    
    n_kde = len(kde_points)
    
    if n_kde < 5:
        print(f"{h_name:<12} {n_kde:>8} {'—':>10} {'—':>12} {'—':>10} {'—':>10}")
        continue
    
    # Puntos SIR HIGH + MEDIUM en el área KDE
    sir_segments = []
    for f in sir_latest:
        risk = f['properties']['risk']
        if risk in ('high', 'medium'):
            coords = f['geometry']['coordinates']
            # Tomar punto medio del segmento
            cx = np.mean([c[0] for c in coords])
            cy = np.mean([c[1] for c in coords])
            sir_segments.append([cx, cy])
    
    n_sir = len(sir_segments)
    
    if n_sir == 0:
        print(f"{h_name:<12} {n_kde:>8} {n_sir:>10} {'0':>12} {'0%':>10} {'0%':>10}")
        continue
    
    # KDTree para buscar puntos SIR cerca de puntos KDE
    if len(kde_points) > 0 and len(sir_segments) > 0:
        kde_tree = cKDTree(kde_points)
        sir_tree = cKDTree(sir_segments)
        
        # ¿Cuántos puntos SIR están a menos de 0.5° de un punto KDE?
        hits_sir = 0
        for s_pt in sir_segments:
            d_kde, _ = kde_tree.query(s_pt, k=1)
            if d_kde < 0.5:  # dentro de 0.5° ≈ 55km
                hits_sir += 1
        
        # ¿Cuántos puntos KDE están cerca de SIR?
        hits_kde = 0
        for k_pt in kde_points:
            d_sir, _ = sir_tree.query(k_pt, k=1)
            if d_sir < 0.5:
                hits_kde += 1
        
        cobertura = hits_sir / n_sir * 100
        hit_rate = hits_kde / n_kde * 100
        
        results[h_name] = {
            "n_celdas_kde": n_kde,
            "n_sir_high_med": n_sir,
            "sir_cubiertos": hits_sir,
            "cobertura_pct": round(cobertura, 1),
            "hit_rate_pct": round(hit_rate, 1),
        }
        
        print(f"{h_name:<12} {n_kde:>8} {n_sir:>10} {hits_sir:>8}/{n_sir:<3} {cobertura:>8.1f}% {hit_rate:>8.1f}%")
    else:
        print(f"{h_name:<12} {n_kde:>8} {n_sir:>10} {'0':>12} {'0%':>10} {'0%':>10}")

# ── 4. Resumen ────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("RESUMEN")
print("=" * 70)
if results:
    best_h = max(results, key=lambda h: results[h]["cobertura_pct"])
    print(f"Mejor horizonte: {best_h} (cobertura {results[best_h]['cobertura_pct']:.1f}%)")
    avg_cov = np.mean([r['cobertura_pct'] for r in results.values()])
    avg_hit = np.mean([r['hit_rate_pct'] for r in results.values()])
    print(f"Cobertura promedio: {avg_cov:.1f}%")
    print(f"Hit rate promedio: {avg_hit:.1f}%")

# Guardar
output = {
    "fecha_sir": latest,
    "resultados": results,
    "resumen": {
        "mejor_horizonte": best_h if results else None,
        "cobertura_promedio": round(avg_cov, 1) if results else 0,
    },
    "metadata": {
        "generado": datetime.now().isoformat(),
    },
}

with open(ROOT / "backtest_forecast_resultados.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\n✅ Resultados guardados: backtest_forecast_resultados.json")
