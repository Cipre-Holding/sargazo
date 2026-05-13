"""
Fase 2 — Integración de viento como predictor.

Basado en Allende-Arandía et al. 2023 (JGR Oceans):
- Windage 2% determina confluencia de partículas en Quintana Roo
- Viento del norte = onshore para Cozumel (costa este de QRoo)
- viento_norte_mid - viento_sur_mid = índice de acercamiento

Modelos:
  2.1  Regresión con viento:   log(CM) ~ log(ACO_lag1) + wind_onshore
  2.2  Interacción viento×ACO: log(CM) ~ log(ACO_lag1) * wind_onshore
  2.3  Regresión solo viento:  log(CM) ~ wind_onshore (benchmark)
  2.4  Ridge con viento:       log(CM) ~ [ACO_lag1, ACO_lag2, wind_onshore, month_sin/cos]

Backtest LOOCV comparativo: con/sin viento para el subconjunto con datos de viento.
"""

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime

from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from scipy import stats as scipy_stats

ROOT = Path(__file__).parent
OUTPUT = ROOT / "predicciones_fase2.json"

from modelos_fase0 import load_pairs, ci_adjusted, EPS, H
from modelos_fase1 import loocv_metrics, compute_metrics


# ── 1. Wind features ─────────────────────────────────────────────────────

def build_wind_features(d):
    """Añade wind_onshore (N-S) y sus lags/interacciones a los pairs.
    
    NOTA: La costa este de Cozumel requiere viento del E/NE para onshore.
    SEMAR solo reporta componentes N y S, no E/W.
    La métrica wind_onshore = N-S captura gradiente N-S pero NO
    es físicamente onshore para Cozumel. Sin datos E/W, no podemos
    calcular el verdadero onshore.
    Usar wind_onshore como proxy de intensidad de viento total (N+S)
    puede ser más apropiado que N-S.
    """
    w = d.copy()
    # Neto N-S (positivo = viento del norte = onshore Cozumel)
    w["wind_onshore"] = w["viento_norte_mid"] - w["viento_sur_mid"]
    w["wind_total"] = w["viento_norte_mid"] + w["viento_sur_mid"]
    w["wind_ratio"] = w["viento_norte_mid"] / (w["viento_sur_mid"] + 1)

    # Lags de wind_onshore
    w["wind_onshore_lag1"] = w["wind_onshore"].shift(1)

    # Interacción con ACO
    w["aco_x_wind"] = w["log_aco_lag1"] * w["wind_onshore"]

    # Viento como factor: onshore fuerte (>5 knots N), mixto (-5 a 5), offshore (<5 knots N)
    w["wind_factor"] = pd.cut(w["wind_onshore"],
                              bins=[-np.inf, -5, 5, np.inf],
                              labels=[-1, 0, 1]).astype(float)

    return w


def print_wind_table(w):
    """Muestra tabla de viento vs CM."""
    print(f"  {'Mes':<10} {'ACO(Mt)':>8} {'CM(Mt)':>8} {'N(kts)':>7} {'S(kts)':>7} {'onshore':>7} {'N-S':>7}")
    print(f"  {'-'*54}")
    sub = w.dropna(subset=["wind_onshore", "log_cm"]).sort_values("month_dt")
    for _, r in sub.iterrows():
        cm = np.exp(r["log_cm"]) if pd.notna(r["log_cm"]) else 0
        aco = np.exp(r.get("log_aco", np.nan)) if pd.notna(r.get("log_aco")) else 0
        print(f"  {r['month']:<10} {aco:>8.4f} {cm:>8.4f} {r['viento_norte_mid']:>7.1f} "
              f"{r['viento_sur_mid']:>7.1f} {r['wind_onshore']:>7.1f} {'ON' if r['wind_onshore']>0 else 'OFF' if r['wind_onshore']<0 else '--':>7}")


# ── 2. Modelos ───────────────────────────────────────────────────────────

def modelo_21_wind_linear(w):
    """log(CM) ~ log(ACO_lag1) + wind_onshore"""
    print("\n" + "═" * 60)
    print("2.1  REGRESIÓN + VIENTO  log(CM) ~ log(ACO_lag1) + wind_onshore")
    print("═" * 60)
    print_wind_table(w)

    sub = w.dropna(subset=["log_cm", "log_aco_lag1", "wind_onshore"]).copy()
    n = len(sub)
    if n < 6:
        print(f"  ⛔ Solo {n} filas con viento+ACO+CM.")
        return None

    X = sub[["log_aco_lag1", "wind_onshore"]].values
    y = sub["log_cm"].values
    metrics, yt, yp = loocv_metrics(LinearRegression, {}, X, y)

    final = LinearRegression().fit(X, y)
    sigma = np.std(y - final.predict(X), ddof=3)

    # Predicción junio: wind_onshore del último mes conocido (mayo 2026)
    last_wind = sub.iloc[-1]["wind_onshore"]
    X_jun = np.array([[np.log(0.512037 + EPS), last_wind]])
    log_cm_jun = final.predict(X_jun)[0]
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)

    print(f"  n={n}  LOOCV R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  SMAPE={metrics['smape_pct']:.1f}%")
    print(f"  Coefs: β₀={final.intercept_:.4f}  β₁(ACO)={final.coef_[0]:.4f}  β₂(wind)={final.coef_[1]:.4f}")
    print(f"  wind_onshore último (may 2026) = {last_wind:.1f} knots")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "2.1_wind_lineal",
        "n": n,
        **metrics,
        "coefs": {"intercept": round(float(final.intercept_), 4),
                  "log_aco_lag1": round(float(final.coef_[0]), 4),
                  "wind_onshore": round(float(final.coef_[1]), 4)},
        "wind_ultimo_knots": round(float(last_wind), 1),
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_22_wind_interaction(w):
    """log(CM) ~ log(ACO_lag1) * wind_onshore  (interacción completa)"""
    print("\n" + "═" * 60)
    print("2.2  INTERACCIÓN  log(CM) ~ log(ACO_lag1) × wind_onshore")
    print("═" * 60)

    sub = w.dropna(subset=["log_cm", "log_aco_lag1", "wind_onshore", "aco_x_wind"]).copy()
    n = len(sub)
    if n < 8:
        print(f"  ⛔ Solo {n} filas.")
        return None

    X = sub[["log_aco_lag1", "wind_onshore", "aco_x_wind"]].values
    y = sub["log_cm"].values
    metrics, yt, yp = loocv_metrics(LinearRegression, {}, X, y)

    final = LinearRegression().fit(X, y)
    sigma = np.std(y - final.predict(X), ddof=4)

    last = sub.iloc[-1]
    X_jun = np.array([[np.log(0.512037 + EPS), last["wind_onshore"],
                       np.log(0.512037 + EPS) * last["wind_onshore"]]])
    log_cm_jun = final.predict(X_jun)[0]
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)

    print(f"  n={n}  LOOCV R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  SMAPE={metrics['smape_pct']:.1f}%")
    print(f"  Coefs: β₀={final.intercept_:.4f}  β₁(ACO)={final.coef_[0]:.4f}  β₂(wind)={final.coef_[1]:.4f}  β₃(ACO×wind)={final.coef_[2]:.4f}")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "2.2_wind_interaccion",
        "n": n,
        **metrics,
        "coefs": {"intercept": round(float(final.intercept_), 4),
                  "log_aco_lag1": round(float(final.coef_[0]), 4),
                  "wind_onshore": round(float(final.coef_[1]), 4),
                  "aco_x_wind": round(float(final.coef_[2]), 4)},
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_23_wind_only(w):
    """log(CM) ~ wind_onshore  (¿el viento por sí solo predice algo?)"""
    print("\n" + "═" * 60)
    print("2.3  VIENTO SOLO  log(CM) ~ wind_onshore")
    print("═" * 60)

    sub = w.dropna(subset=["log_cm", "wind_onshore"]).copy()
    n = len(sub)
    if n < 6:
        return None

    X = sub[["wind_onshore"]].values
    y = sub["log_cm"].values
    metrics, yt, yp = loocv_metrics(LinearRegression, {}, X, y)

    final = LinearRegression().fit(X, y)

    last_wind = sub.iloc[-1]["wind_onshore"]
    log_cm_jun = final.intercept_ + final.coef_[0] * last_wind
    sigma = np.std(y - final.predict(X), ddof=2)
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)
    r_simple = np.corrcoef(y, yp)[0, 1] if len(y) > 2 else 0

    print(f"  n={n}  LOOCV R²={metrics['r2']:.4f}  LOOCV r={r_simple:.4f}")
    print(f"  log(CM) = {final.intercept_:.4f} + {final.coef_[0]:.4f}·wind_onshore")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "2.3_wind_only",
        "n": n,
        **metrics,
        "coefs": {"intercept": round(float(final.intercept_), 4),
                  "wind_onshore": round(float(final.coef_[0]), 4)},
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_24_ridge_wind(w):
    """Ridge con ACO_lag1 + ACO_lag2 + wind_onshore + month_sin/cos"""
    print("\n" + "═" * 60)
    print("2.4  RIDGE + VIENTO  log(CM) ~ [ACO, ACO_lag2, wind_onshore, month_sin/cos]")
    print("═" * 60)

    cols = ["log_aco_lag1", "log_aco_lag2", "wind_onshore", "month_sin", "month_cos"]
    sub = w[cols + ["log_cm"]].dropna()
    n = len(sub)
    if n < 8:
        print(f"  ⛔ Solo {n} filas.")
        return None

    X = sub[cols].values
    y = sub["log_cm"].values
    metrics, yt, yp = loocv_metrics(Ridge, {"alpha": 1.0}, X, y)

    final = Ridge(alpha=1.0).fit(X, y)
    sigma = np.std(y - final.predict(X), ddof=6)
    last = sub.iloc[-1]
    X_jun = np.array([[np.log(0.512037 + EPS), last["log_aco_lag1"],
                       last["wind_onshore"],
                       np.sin(2*np.pi*6/12), np.cos(2*np.pi*6/12)]])
    log_cm_jun = final.predict(X_jun)[0]
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)

    print(f"  n={n}  LOOCV R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  SMAPE={metrics['smape_pct']:.1f}%")
    print(f"  Coefs: {dict(zip(cols, [round(c,4) for c in final.coef_]))}")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "2.4_ridge_wind",
        "n": n,
        **metrics,
        "coefs": {col: round(float(final.coef_[i]), 4) for i, col in enumerate(cols)},
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


# ── 3. Backtest wind vs baseline ─────────────────────────────────────────

def backtest_wind_vs_baseline(w):
    """Comparación LOOCV en el mismo subconjunto: con viento vs sin viento."""
    print("\n" + "█" * 60)
    print("██  BACKTEST LOOCV — CON vs SIN VIENTO (mismo subconjunto)  ██")
    print("█" * 60)

    sub = w.dropna(subset=["log_cm", "log_aco_lag1", "wind_onshore"]).copy()
    n = len(sub)
    y = sub["log_cm"].values
    print(f"  Filas comunes con viento+ACO+CM: {n}")

    results = {}

    # Sin viento: solo ACO_lag1
    X1 = sub[["log_aco_lag1"]].values
    m1 = compute_metrics(*loocv_metrics(LinearRegression, {}, X1, y)[1:])
    results["0.1_solo_ACO"] = m1

    # Con viento: ACO_lag1 + wind_onshore
    X2 = sub[["log_aco_lag1", "wind_onshore"]].values
    m2 = compute_metrics(*loocv_metrics(LinearRegression, {}, X2, y)[1:])
    results["2.1_ACO+wind"] = m2

    # Interacción
    sub2 = sub.dropna(subset=["aco_x_wind"])
    y2 = sub2["log_cm"].values
    X3 = sub2[["log_aco_lag1", "wind_onshore", "aco_x_wind"]].values
    m3 = compute_metrics(*loocv_metrics(LinearRegression, {}, X3, y2)[1:])
    results["2.2_ACO×wind"] = m3

    # Solo wind
    X4 = sub[["wind_onshore"]].values
    m4 = compute_metrics(*loocv_metrics(LinearRegression, {}, X4, y)[1:])
    results["2.3_solo_wind"] = m4

    # Tabla
    rows = []
    for name, m in results.items():
        rows.append({
            "Modelo": name,
            "R²": m["r2"],
            "RMSE(log)": m["rmse_log"],
            "SMAPE(%)": m["smape_pct"],
        })
    df = pd.DataFrame(rows).sort_values("R²", ascending=False).reset_index(drop=True)
    df.index += 1
    print("\n" + df.to_string())

    # Correlaciones parciales wind→CM (controlando por ACO)
    sub_clean = sub[["log_cm", "log_aco_lag1", "wind_onshore"]].dropna()
    resid_acoonly = LinearRegression().fit(sub_clean[["log_aco_lag1"]],
                                            sub_clean["log_cm"]).predict(sub_clean[["log_aco_lag1"]])
    resid_cm = sub_clean["log_cm"] - resid_acoonly
    resid_wind = sub_clean["wind_onshore"]
    r_partial = np.corrcoef(resid_cm, resid_wind)[0, 1]
    print(f"\n  Correlación parcial wind→CM (controlando ACO): r={r_partial:.4f}")

    return df.to_dict(orient="records")


# ── 4. Main ──────────────────────────────────────────────────────────────

def main():
    print("█" * 60)
    print("██  FASE 2 — INTEGRACIÓN DE VIENTO COMO PREDICTOR  ██")
    print("█" * 60)

    d = load_pairs()
    w = build_wind_features(d)

    res = {}

    # Análisis de viento
    print(f"\n  Datos con viento: {w['wind_onshore'].notna().sum()} meses")
    print(f"  Rango wind_onshore: {w['wind_onshore'].min():.1f} a {w['wind_onshore'].max():.1f} knots")
    print(f"  n para LOOCV con viento+ACO+CM: {w[['log_cm','log_aco_lag1','wind_onshore']].dropna().shape[0]}")

    # Modelos
    res["2.1_wind_lineal"] = modelo_21_wind_linear(w)
    res["2.2_wind_interaccion"] = modelo_22_wind_interaction(w)
    res["2.3_wind_only"] = modelo_23_wind_only(w)
    res["2.4_ridge_wind"] = modelo_24_ridge_wind(w)

    # Backtest
    backtest = backtest_wind_vs_baseline(w)
    res["backtest_wind_vs_baseline"] = backtest

    # Guardar
    res["metadata"] = {
        "generado": datetime.now().isoformat(),
        "proyecto": "Predicción Sargazo Cozumel",
        "fase": "2_viento",
        "n_pares_con_viento": int(w[["log_cm", "log_aco_lag1", "wind_onshore"]].dropna().shape[0]),
    }

    with open(OUTPUT, "w") as f:
        json.dump(res, f, indent=2, default=str)
    print(f"\n  Resultados: {OUTPUT}")


if __name__ == "__main__":
    main()
