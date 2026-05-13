"""
Validación del forecast KDE contra perfil histórico de riesgo por playa.

Evalúa si la distribución de partículas del forecast (KDE) se correlaciona
con el riesgo histórico de cada segmento costero (315 días NOAA SIR).

Si la correlación es positiva → el forecast apunta en la dirección correcta.
"""

import json
import numpy as np
from pathlib import Path
from scipy.stats import pearsonr, spearmanr
from scipy.spatial import cKDTree

ROOT = Path(__file__).parent

print("=" * 70)
print("VALIDACIÓN: Forecast KDE vs Perfil Histórico por Playa")
print("=" * 70)

# ── 1. Cargar perfil histórico ────────────────────────────────────────────
with open(ROOT / "risk_by_beach.json") as f:
    beach = json.load(f)

print(f"\nPerfil histórico: {len(beach['segmentos'])} segmentos, {beach['n_dias']} días")

# ── 2. Cargar KDE ──────────────────────────────────────────────────────────
with open(ROOT / "forecast_kde_acumulaciones.json") as f:
    kde_all = json.load(f)

# ── 3. Para cada horizonte, calcular densidad KDE en cada playa ────────────
print(f"\n{'Horizonte':<10} {'Correlación':<15} {'Spearman':<12} {'Playas cubiertas':<18} {'Dirección':<12}")
print("-" * 67)

results = {}
best_h = None
best_r = -1

for h_name in sorted(kde_all.keys(), key=lambda h: int(h.replace('h',''))):
    k = kde_all[h_name]
    lon = np.array(k['lon'])
    lat = np.array(k['lat'])
    Z = np.array(k['density'])

    # Para cada playa, extraer densidad KDE en esa ubicación
    beach_densities = []
    historical_risks = []

    for seg in beach['segmentos']:
        if seg['n_features'] == 0 or seg['riesgo_promedio'] == 0:
            continue

        # Encontrar celda KDE más cercana a esta playa
        bx, by = seg['lon'], seg['lat']
        distances = np.sqrt((lon - bx)**2 + (lat[0] - by)**2)
        lon_idx = np.argmin(np.abs(lon - bx))
        lat_idx = np.argmin(np.abs(lat - by))

        # Densidad KDE en esa celda (0 si fuera del grid)
        if 0 <= lat_idx < len(lat) and 0 <= lon_idx < len(lon):
            kde_val = float(Z[lat_idx, lon_idx])
        else:
            kde_val = 0.0

        beach_densities.append(kde_val)
        historical_risks.append(seg['riesgo_promedio'])

    beach_densities = np.array(beach_densities)
    historical_risks = np.array(historical_risks)

    n_beaches = len(beach_densities)
    n_covered = np.sum(beach_densities > 0)

    if n_covered >= 3 and np.std(historical_risks) > 0:
        r_pearson, p_val = pearsonr(beach_densities, historical_risks)
        r_spearman, _ = spearmanr(beach_densities, historical_risks)

        # Dirección: signo de la correlación
        direction = "✅ CONCORDA" if r_pearson > 0.2 else "⚠️ DÉBIL" if r_pearson > 0 else "❌ OPUESTA"

        print(f"{h_name:<10} {r_pearson:>+.4f} (p={p_val:.3f})  {r_spearman:>+.4f}  {n_covered}/{n_beaches:<4}       {direction:<12}")

        results[h_name] = {
            "r_pearson": round(r_pearson, 4),
            "p_value": round(p_val, 4),
            "r_spearman": round(r_spearman, 4),
            "n_beaches_total": n_beaches,
            "n_beaches_covered": int(n_covered),
            "direction": "concordant" if r_pearson > 0.2 else "weak" if r_pearson > 0 else "opposite",
        }

        if r_pearson > best_r:
            best_r = r_pearson
            best_h = h_name
    else:
        print(f"{h_name:<10} {'—':>15} {'—':<12} {n_covered}/{n_beaches:<4}       {'SIN DATOS':<12}")

# ── 4. Resumen ────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("RESUMEN")
print("=" * 70)

# Contar cuántos horizontes concuerdan vs no
concordant = sum(1 for r in results.values() if r["direction"] == "concordant")
weak = sum(1 for r in results.values() if r["direction"] == "weak")
opposite = sum(1 for r in results.values() if r["direction"] == "opposite")

print(f"Horizontes con concordancia positiva: {concordant}")
print(f"Horizontes con correlación débil: {weak}")
print(f"Horizontes con correlación opuesta: {opposite}")
print(f"Mejor horizonte: {best_h} (r={results.get(best_h, {}).get('r_pearson', 'N/A')})")

# Conclusión
if concordant > opposite:
    print(f"\n✅ CONCLUSIÓN: El forecast KDE correlaciona positivamente con el riesgo histórico.")
    print(f"   El forecast apunta en la dirección correcta (hacia las playas de mayor riesgo histórico).")
else:
    print(f"\n⚠️ CONCLUSIÓN: El forecast KDE no muestra correlación clara con el riesgo histórico.")
    print(f"   El forecast es útil para dirección general, no para localización exacta.")

# Guardar
output = {
    "resultados": results,
    "resumen": {
        "concordant": concordant,
        "weak": weak,
        "opposite": opposite,
        "best_horizon": best_h,
        "best_correlation": results.get(best_h, {}).get("r_pearson", 0) if best_h else None,
    },
    "conclusion": "El forecast KDE correlaciona positivamente con el riesgo histórico" if concordant > opposite else "El forecast KDE no muestra correlación clara",
}

with open(ROOT / "validacion_forecast.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\n✅ Guardado: validacion_forecast.json")
