"""
Fase 0 — Modelos operativos de predicción de sargazo en Cozumel.

Basado en análisis de datos SEMAR 2024-2026:
- 21 meses de CM, 15 meses de ACO, 14 pares SEMAR puros
- Mejor predictor: ACO_lag1 → CM (r=0.918 Pearson, n=14)
- ΔACO captura aceleraciones que el nivel absoluto no detecta
- AR(1) fallback cuando ACO no está disponible

Modelos:
  0.1  Regresión lineal:      log(CM) ~ log(ACOₜ₋₁)
  0.2  Regresión delta:       Δlog(CM) ~ Δlog(ACO) + log(ACOₜ₋₁)
  0.3  Logística ordinal:     semáforo ~ log(ACOₜ₋₁)
  0.4  Prophet:               aligned_ACO ~ tendencia + estacionalidad
  0.5  AR(1) fallback:        log(CM) ~ log(CMₜ₋₁)

Requiere: pandas, numpy, scipy, sklearn, prophet
"""

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime

from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score
from scipy import stats as scipy_stats
from prophet import Prophet

SEM_MAP = {"ESCASO":1,"MUY BAJO":2,"BAJO":3,"MODERADO":4,"ALTO":5,"MUY ALTO":6}
SEM_INV = {v:k for k,v in SEM_MAP.items()}
ROOT = Path(__file__).parent
OUTPUT = ROOT / "predicciones_fase0.json"
EPS = 1e-9
ACO_MAY_2026 = 0.512037  # último ACO conocido
LOG_ACO_MAY = np.log(ACO_MAY_2026 + EPS)
CM_MAY_2026 = 0.051837    # último CM conocido
LOG_CM_MAY = np.log(CM_MAY_2026 + EPS)
H = 0.8047  # Hurst exponent (para ajuste de IC)


def load_pairs():
    """14 pares SEMAR puros: log(ACO_lag1) + log(CM)."""
    df = pd.read_csv(ROOT / "features_prediccion_cm.csv")
    df["month_dt"] = pd.to_datetime(df["month"])
    clean = df.dropna(subset=["log_cm", "log_aco_lag1", "log_aco"]).copy()
    clean = clean.sort_values("month_dt").reset_index(drop=True)

    # Δlog(ACO) y Δlog(CM)
    clean["delta_log_aco"] = clean["log_aco"].diff()
    clean["delta_log_cm"] = clean["log_cm"].diff()
    clean["delta_log_aco_lag1"] = clean["delta_log_aco"].shift(1)
    return clean


def ci_adjusted(sigma, n, point_estimate, H_value=H):
    """Intervalo de confianza 80% ajustado por Hurst H.

    H=0.5 → sin ajuste (random walk).
    H>0.5 → memoria larga, n_efectiva menor → IC más amplio.
    H<0.5 → antipersistente, n_efectiva mayor → IC más angosto.

    n_eff ~ n^((2-2H)/(2-H))  (Beran, 1994)
    """
    n_eff = n ** ((2 - 2 * H_value) / (2 - H_value)) if H_value != 0.5 else n
    n_eff = max(n_eff, 2)
    t_val = scipy_stats.t.ppf(0.90, max(n_eff - 2, 2))
    half = t_val * sigma * np.sqrt(1 + 1/n_eff)
    return point_estimate - half, point_estimate + half, half


def modelo_1_regresion(df):
    """0.1  log(CM) = β₀ + β₁·log(ACOₜ₋₁) — con weighting temporal (más peso a reciente)"""
    print("\n" + "═" * 60)
    print("0.1  REGRESIÓN LINEAL  log(CM) ~ log(ACO_lag1) [weighted]")
    print("═" * 60)

    X = df[["log_aco_lag1"]].values
    y = df["log_cm"].values
    n = len(X)

    X_tr, X_te = X[:-1], X[-1:]
    y_tr, y_te = y[:-1], y[-1:]

    # Peso temporal: más peso a meses recientes (kernel tricúbico)
    k = len(X_tr)
    w = (1 - (np.arange(k) / k) ** 3) ** 3  # tricúbico: últimos pesos ~1, primeros ~0.7

    m = LinearRegression().fit(X_tr, y_tr, sample_weight=w)
    y_pred = m.predict(X_tr)
    y_te_pred = m.predict(X_te)

    r2 = r2_score(y_tr, y_pred)
    rmse = np.sqrt(mean_squared_error(y_tr, y_pred))
    mae = mean_absolute_error(y_tr, y_pred)
    sigma = np.std(y_tr - y_pred, ddof=2)

    # Holdout
    actual_may = np.exp(y_te[0])
    pred_may = np.exp(y_te_pred[0])
    err_holdout = (pred_may - actual_may) / actual_may * 100

    # Predicción junio 2026
    log_cm_jun = m.intercept_ + m.coef_[0] * LOG_ACO_MAY
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)
    cm_jun = np.exp(log_cm_jun)

    print(f"  n={n} (train={n-1})  R²={r2:.4f}  RMSE={rmse:.4f}  MAE={mae:.4f}")
    print(f"  log(CM) = {m.intercept_:.4f} + {m.coef_[0]:.4f}·log(ACO_lag1)")
    print(f"  σ_res = {sigma:.4f}")
    print(f"  Holdout (may 2026): real={actual_may:.6f}Mt  pred={pred_may:.6f}Mt  err={err_holdout:+.1f}%")
    print(f"  ▶ Jun 2026: CM={cm_jun:.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "0.1_regresion_lineal",
        "n": n, "r2": round(r2, 4), "rmse_log": round(rmse, 4), "mae_log": round(mae, 4),
        "beta_0": round(float(m.intercept_), 4), "beta_1": round(float(m.coef_[0]), 4),
        "sigma_residual": round(float(sigma), 4),
        "holdout_mayo": {"real_mt": round(actual_may, 6), "predicho_mt": round(pred_may, 6), "error_pct": round(err_holdout, 1)},
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(cm_jun), 6),
            "cm_ton": round(cm_jun * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_2_delta(df):
    """
    0.2  Δlog(CM) = β₀ + β₁·log(ACOₜ₋₁) + β₂·Δlog(ACOₜ₋₁)
         Captura aceleraciones (cambio en ACO predice cambio en CM).
    """
    print("\n" + "═" * 60)
    print("0.2  REGRESIÓN DELTA  Δlog(CM) ~ log(ACO_lag1) + Δlog(ACO_lag1)")
    print("═" * 60)

    d = df.dropna(subset=["delta_log_cm", "log_aco_lag1", "delta_log_aco_lag1"]).copy()
    n = len(d)
    if n < 6:
        print(f"  ⛔ Solo {n} filas, mínimo 6.")
        return None

    X = d[["log_aco_lag1", "delta_log_aco_lag1"]].values
    y = d["delta_log_cm"].values

    if n >= 6:
        X_tr, X_te = X[:-1], X[-1:]
        y_tr, y_te = y[:-1], y[-1:]
    else:
        X_tr, X_te = X, X
        y_tr, y_te = y, y

    m = LinearRegression().fit(X_tr, y_tr)
    y_pred = m.predict(X_tr)
    r2 = r2_score(y_tr, y_pred)
    sigma = np.std(y_tr - y_pred, ddof=3)

    # Predicción junio: Δlog(CM) = β₀ + β₁·log(ACO_may) + β₂·Δlog(ACO_abr→may)
    delta_aco_abr_may = LOG_ACO_MAY - np.log(0.339890 + EPS)  # ACO abr 2026
    pred_delta = m.intercept_ + m.coef_[0] * LOG_ACO_MAY + m.coef_[1] * delta_aco_abr_may
    log_cm_jun = LOG_CM_MAY + pred_delta
    cm_jun = np.exp(log_cm_jun)

    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)
    cambio_pct = (cm_jun - CM_MAY_2026) / CM_MAY_2026 * 100

    actual_delta = None
    err_holdout = None
    if n >= 6:
        delta_pred = m.predict(X_te)[0]
        actual_delta = y_te[0]
        err_holdout = (np.exp(LOG_CM_MAY + delta_pred) - np.exp(LOG_CM_MAY + actual_delta)) / np.exp(LOG_CM_MAY + actual_delta) * 100

    print(f"  n={n} (train={n-1})  R²={r2:.4f}")
    if n >= 6:
        print(f"  Holdout: Δreal={actual_delta:.4f}  Δpred={delta_pred:.4f}  err={err_holdout:+.1f}%")
    print(f"  Δlog(CM) = {m.intercept_:.4f} + {m.coef_[0]:.4f}·log(ACO_lag1) + {m.coef_[1]:.4f}·Δlog(ACO_lag1)")
    print(f"  σ_res = {sigma:.4f}")
    print(f"  Δlog(ACO_abr→may) = {delta_aco_abr_may:.4f}")
    print(f"  ▶ Jun 2026: CM={cm_jun:.6f}Mt  ({cambio_pct:+.1f}% vs may)  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "0.2_regresion_delta",
        "n": n, "r2": round(r2, 4), "sigma_residual": round(float(sigma), 4),
        "beta_0": round(float(m.intercept_), 4),
        "beta_1_log_aco_lag1": round(float(m.coef_[0]), 4),
        "beta_2_delta_aco": round(float(m.coef_[1]), 4),
        "holdout_mayo": {"real_delta": round(float(actual_delta), 4), "predicho_delta": round(float(delta_pred), 4), "error_pct": round(float(err_holdout), 1)} if n >= 6 else None,
        "prediccion_junio": {
            "delta_log_cm": round(float(pred_delta), 4),
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(cm_jun), 6),
            "cm_ton": round(cm_jun * 1e6, 0),
            "cambio_pct_vs_mayo": round(float(cambio_pct), 1),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_3_logistica():
    """
    0.3  Logística ordinal: semáforo ~ log(ACOₜ₋₁)
         Feature única: ACO_lag1 (evita overfitting con n pequeña)
    """
    print("\n" + "═" * 60)
    print("0.3  LOGÍSTICA ORDINAL  semáforo ~ log(ACO_lag1)")
    print("═" * 60)

    sd = pd.read_csv(ROOT / "features_semaforo.csv")
    sd = sd.dropna(subset=["semaforo_ord", "aligned_aco_lag1"]).copy()
    n = len(sd)

    if n < 8:
        print(f"  ⛔ Solo {n} filas.")
        return None

    X = sd[["aligned_aco_lag1"]].values
    y = sd["semaforo_ord"].values.astype(int)

    # Leave-one-out cross-validation
    preds = np.zeros(n)
    for i in range(n):
        mask = np.ones(n, bool)
        mask[i] = False
        loo = LogisticRegression(solver="lbfgs", max_iter=1000, random_state=42)
        loo.fit(X[mask], y[mask])
        preds[i] = loo.predict(X[i:i+1])[0]

    acc = accuracy_score(y, preds)
    acc1 = np.mean(np.abs(y - preds) <= 1)

    # Modelo final con todos los datos para predicción
    final = LogisticRegression(solver="lbfgs", max_iter=1000, random_state=42)
    final.fit(X, y)

    probas = final.predict_proba([[LOG_ACO_MAY]])[0]
    pred_class = final.predict([[LOG_ACO_MAY]])[0]

    print(f"  n={n}  LOOCV accuracy={acc:.3f}  ±1 nivel={acc1:.3f}")
    print(f"  Clases entrenadas: {sorted(final.classes_)}")
    print(f"  ▶ Jun 2026: {pred_class} ({SEM_INV.get(pred_class, '?')})")
    for i, p in enumerate(probas):
        c = final.classes_[i]
        print(f"    {c} ({SEM_INV.get(c, '?'):<10}): {p*100:.1f}%")

    return {
        "modelo": "0.3_logistica_ordinal",
        "n": n,
        "loocv_accuracy": round(float(acc), 3),
        "loocv_accuracy_mas1": round(float(acc1), 3),
        "clases_entrenadas": sorted(int(c) for c in final.classes_),
        "prediccion_junio": {
            "clase": int(pred_class),
            "etiqueta": SEM_INV.get(pred_class, "?"),
            "probabilidades": {SEM_INV.get(int(final.classes_[i]), str(c)): round(float(p), 4)
                               for i, (c, p) in enumerate(zip(final.classes_, probas))},
        },
    }


def modelo_4_prophet(coefs_01=None):
    """
    0.4  Prophet sobre aligned_ACO (303 meses).
         Proyección del stock atlántico (GASB histórico + ACO SEMAR).

    coefs_01: dict con "beta_0" y "beta_1" del modelo 0.1 (dinámicos)
    """
    print("\n" + "═" * 60)
    print("0.4  PROPHET sobre aligned_ACO (tendencia atlántica)")
    print("═" * 60)

    fuente = pd.read_csv(ROOT / "features_fuente.csv")
    prof = fuente[["month", "log_biomasa", "post_2011"]].copy()
    prof["ds"] = pd.to_datetime(prof["month"]) + pd.offsets.MonthEnd(0)
    prof["y"] = prof["log_biomasa"]
    prof["post_2011"] = prof["post_2011"].astype(int)

    print(f"  Filas: {len(prof)}  ({prof['ds'].min().date()} → {prof['ds'].max().date()})")

    model = Prophet(yearly_seasonality=True, weekly_seasonality=False,
                    daily_seasonality=False, changepoint_prior_scale=0.05,
                    seasonality_prior_scale=10, interval_width=0.80)
    model.add_regressor("post_2011")
    model.fit(prof[["ds", "y", "post_2011"]])

    future = model.make_future_dataframe(periods=12, freq="ME")
    future["post_2011"] = 1
    forecast = model.predict(future)

    last_known = prof.iloc[-1]
    preds = forecast[forecast["ds"] > last_known["ds"]].head(6)

    print(f"  Proyección aligned_ACO 6 meses:")
    print(f"  {'Mes':<10} {'log':>8} {'Mt':>8} {'lo80':>8} {'hi80':>8}")
    for _, r in preds.iterrows():
        print(f"  {r['ds'].strftime('%Y-%m'):<10} {r['yhat']:>8.3f} {np.exp(r['yhat']):>8.3f} {np.exp(r['yhat_lower']):>8.3f} {np.exp(r['yhat_upper']):>8.3f}")

    jun = preds[preds["ds"].dt.month == 6]
    jun_log = float(jun.iloc[0]["yhat"]) if len(jun) > 0 else None
    jun_log_lo = float(jun.iloc[0]["yhat_lower"]) if len(jun) > 0 else None

    # Estimar CM desde ACO junio proyectado × coeficiente de regresión del modelo 0.1
    # ⚠️ La estimación indirecta ACO→CM es poco fiable: Prophet proyecta sobre
    # la serie larga GASB (2000-2024), mientras que la relación ACO↔CM se estimó
    # con solo 14 pares SEMAR (2025-2026). La extrapolación puede producir valores
    # irreales (ej. >0.5 Mt CM). Se incluye solo como referencia cualitativa.
    print(f"\n  ▶ Estimación indirecta CM (referencia, no fiable para magnitud):")
    if jun_log:
        if coefs_01:
            beta_0_1 = coefs_01["beta_0"]
            beta_1_1 = coefs_01["beta_1"]
        else:
            beta_0_1 = -1.8037
            beta_1_1 = 1.7396
        cm_jul_log = beta_0_1 + beta_1_1 * jun_log
        cm_jul = np.exp(cm_jul_log)
        print(f"    ACO_jun (Prophet) = {np.exp(jun_log):.4f} Mt")
        print(f"    CM_jul (vía coefs 0.1) = {cm_jul:.6f} Mt")
        if cm_jul > 0.5:
            print(f"    ⚠️  CM > 0.5 Mt — valor probablemente no realista (ver nota arriba)")

    cp = model.changepoints
    print(f"  Changepoints: {len(cp)}")
    for c in cp[::5]:
        print(f"    {c.date()}")

    reliable_cm = bool(cm_jul <= 0.5) if jun_log else False

    return {
        "modelo": "0.4_prophet",
        "n_entrenamiento": len(prof),
        "changepoints": len(cp),
        "proyeccion_junio_2026_aco_mt": round(float(np.exp(jun_log)), 4) if jun_log else None,
        "estimacion_indirecta_cm_julio_mt": round(float(cm_jul), 6) if jun_log else None,
        "cm_reliable": reliable_cm,
        "nota": "CM estimado indirectamente vía ACO→coefs 0.1. No usar para decisiones operativas." if not reliable_cm else None,
    }


def modelo_5_ar1():
    """
    0.5  AR(1) fallback: log(CMₜ) = β₀ + β₁·log(CMₜ₋₁)
         Usa 20 pares (toda la serie CM disponible).
         Útil cuando ACO no está disponible.
    """
    print("\n" + "═" * 60)
    print("0.5  AR(1) FALLBACK  log(CM) ~ log(CM_lag1)")
    print("═" * 60)

    # Construir serie mensual de CM desde los datos crudos
    master = pd.read_csv(ROOT / "boletines_sargazo_MASTER.csv", low_memory=False)
    master["fecha_dt"] = pd.to_datetime(master["fecha"])
    master["month"] = master["fecha_dt"].dt.to_period("M")

    cm_monthly = master.groupby("month")["biomasa_caribe_mexicano_ton"].median() / 1_000_000
    cm_monthly = cm_monthly.dropna()
    s = pd.DataFrame({"cm_mt": cm_monthly})
    s["log_cm"] = np.log(s["cm_mt"] + EPS)
    s["log_cm_lag1"] = s["log_cm"].shift(1)
    s = s.dropna()
    n = len(s)

    print(f"  Filas: {n}  ({s.index[0]} → {s.index[-1]})")
    print(f"  Distribución CM: min={s['cm_mt'].min():.6f}  max={s['cm_mt'].max():.6f}  media={s['cm_mt'].mean():.6f}")

    X = s[["log_cm_lag1"]].values
    y = s["log_cm"].values

    X_tr, X_te = X[:-1], X[-1:]
    y_tr, y_te = y[:-1], y[-1:]

    m = LinearRegression().fit(X_tr, y_tr)
    y_pred = m.predict(X_tr)
    r2 = r2_score(y_tr, y_pred)
    sigma = np.std(y_tr - y_pred, ddof=2)
    r_pearson = float(np.corrcoef(y_tr, y_pred)[0, 1])

    # Holdout
    actual_may = np.exp(y_te[0])
    pred_may = np.exp(m.predict(X_te)[0])
    err = (pred_may - actual_may) / actual_may * 100

    # Predicción junio
    log_cm_jun = m.intercept_ + m.coef_[0] * LOG_CM_MAY
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)
    cm_jun = np.exp(log_cm_jun)
    cambio = (cm_jun - CM_MAY_2026) / CM_MAY_2026 * 100

    print(f"  r={r_pearson:.4f}  R²={r2:.4f}  σ_res={sigma:.4f}")
    print(f"  log(CMₜ) = {m.intercept_:.4f} + {m.coef_[0]:.4f}·log(CMₜ₋₁)")
    print(f"  Holdout (may 2026): real={actual_may:.6f}Mt  pred={pred_may:.6f}Mt  err={err:+.1f}%")
    print(f"  ▶ Jun 2026: CM={cm_jun:.6f}Mt  ({cambio:+.1f}% vs may)")

    return {
        "modelo": "0.5_ar1_fallback",
        "n": n, "r2": round(r2, 4), "r_pearson": round(r_pearson, 4),
        "sigma_residual": round(float(sigma), 4),
        "beta_0": round(float(m.intercept_), 4), "beta_1": round(float(m.coef_[0]), 4),
        "holdout_mayo": {"real_mt": round(actual_may, 6), "predicho_mt": round(pred_may, 6), "error_pct": round(err, 1)},
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(cm_jun), 6),
            "cm_ton": round(cm_jun * 1e6, 0),
            "cambio_pct_vs_mayo": round(float(cambio), 1),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def main():
    print("█" * 60)
    print("██  FASE 0 — MODELOS OPERATIVOS  ██")
    print("█" * 60)

    res = {}
    pairs = load_pairs()

    r1 = modelo_1_regresion(pairs)
    res["0.1_regresion"] = r1
    res["0.2_delta"] = modelo_2_delta(pairs)
    res["0.3_logistica"] = modelo_3_logistica()
    coefs_01 = {"beta_0": r1["beta_0"], "beta_1": r1["beta_1"]} if r1 else None
    res["0.4_prophet"] = modelo_4_prophet(coefs_01)
    res["0.5_ar1"] = modelo_5_ar1()

    res["metadata"] = {
        "generado": datetime.now().isoformat(),
        "proyecto": "Predicción Sargazo Cozumel",
        "fase": "0_refinada",
        "modelos": ["regresion", "delta", "logistica", "prophet", "ar1"],
        "datos_usados": {
            "pares_semar_puros": 14,
            "meses_cm_disponibles": 21,
            "meses_aco_disponibles": 15,
            "ultimo_aco_mayo_2026_mt": ACO_MAY_2026,
            "ultimo_cm_mayo_2026_mt": CM_MAY_2026,
        },
    }

    with open(OUTPUT, "w") as f:
        json.dump(res, f, indent=2, default=str)

    print(f"\n  Resultados: {OUTPUT}")
    save_predictions_to_db(res, "0")


def save_predictions_to_db(res_dict, phase_name):
    try:
        from backend.database import SessionLocal
        from backend.models import ModelPrediction, DownloadLog
        db = SessionLocal()
        
        latest_log = db.query(DownloadLog).order_by(DownloadLog.id.desc()).first()
        log_id = latest_log.id if latest_log else None
        
        for key, val in res_dict.items():
            if key == "metadata" or key == "backtest":
                continue
            if not isinstance(val, dict):
                continue
                
            model_name = val.get("modelo", key)
            target_month = "2026-06"
            for k_val in val.keys():
                if k_val.startswith("prediccion_"):
                    month_name = k_val.replace("prediccion_", "")
                    months_map = {
                        "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
                        "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
                        "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
                    }
                    target_month = f"2026-{months_map.get(month_name, '06')}"
            
            db.query(ModelPrediction).filter(
                ModelPrediction.model_name == model_name,
                ModelPrediction.date_month == target_month
            ).delete()
            
            pred = ModelPrediction(
                run_log_id=log_id,
                model_name=model_name,
                date_month=target_month,
                prediction_json=json.dumps(val, default=str),
            )
            db.add(pred)
        db.commit()
        db.close()
        print("  ✅ Predicciones de Fase 0 guardadas en base de datos SQLite.")
    except Exception as db_err:
        print(f"  ❌ Error guardando predicciones en SQLite: {db_err}")


if __name__ == "__main__":
    main()
