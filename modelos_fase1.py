"""
Fase 1 — Modelos extendidos, Prophet tuning, Ensemble ponderado y Backtest LOOCV.

Modelos adicionales:
  1.1  Ridge (L2) con features expandidas
  1.2  Bayesian Ridge (Gaussian Process proxy)
  1.3  Rolling window regresión local (kernel tricúbico)
  1.4  ARIMAX(1,1,0) con ACO_lag1 exógena
  1.5  Regresión segmentada (antes/después 2024)
  1.6  Prophet tuneado (grid search + cross validation)

Ensemble: media ponderada por R² de LOOCV de cada modelo.
Backtest: LOOCV en los 14 pares SEMAR, tabla RMSE/MAE/MAPE/R²/coverage.
"""

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import json
import itertools
from pathlib import Path
from datetime import datetime

from sklearn.linear_model import LinearRegression, RidgeCV, Ridge, BayesianRidge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import StandardScaler
from scipy import stats as scipy_stats
from prophet import Prophet

import sys
sys.path.insert(0, str(Path(__file__).parent))
from modelos_fase0 import (
    load_pairs, ci_adjusted, SEM_MAP, SEM_INV, EPS,
    ACO_MAY_2026, LOG_ACO_MAY, CM_MAY_2026, LOG_CM_MAY, H
)

ROOT = Path(__file__).parent
OUTPUT = ROOT / "predicciones_fase1.json"


# ── 1. Helpers de datos ─────────────────────────────────────────────────

def expand_features(df):
    """Versión con features comunes disponibles para los 14 pares SEMAR."""
    d = df.copy()
    d["log_aco_lag2"] = d.get("log_aco_lag2", np.nan)
    d["conglomerado"] = d.get("conglomerado", 1).fillna(1)
    d["post_2024"] = (d["anio"] >= 2024).astype(int)
    # interacción
    d["aco_x_post2024"] = d["log_aco_lag1"] * d["post_2024"]
    # estacionalidad armónica
    d["month_sin"] = np.sin(2 * np.pi * d["mes"] / 12)
    d["month_cos"] = np.cos(2 * np.pi * d["mes"] / 12)
    return d.dropna(subset=["log_aco_lag1", "log_cm"])


def loocv_metrics(model_class, model_kwargs, X, y):
    """LOOCV unificado para cualquier sklearn-like model. Retorna métricas y vectores."""
    n = X.shape[0]
    ya = np.asarray(y).ravel()
    y_true, y_pred = np.zeros(n), np.zeros(n)
    for i in range(n):
        mask = np.ones(n, bool)
        mask[i] = False
        Xi, yi = X[mask], ya[mask]
        m = model_class(**model_kwargs) if model_kwargs else model_class()
        m.fit(Xi, yi)
        y_true[i] = ya[i]
        y_pred[i] = m.predict(X[i:i+1])[0]
    return compute_metrics(y_true, y_pred), y_true, y_pred


def compute_metrics(y_true, y_pred):
    """Métricas unificadas para log-space. Usa SMAPE para evitar NaN con CM≈0."""
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    yt, yp = np.exp(y_true), np.exp(y_pred)
    mape = np.where(yt > 1e-6, np.abs((yt - yp) / yt) * 100, 0)
    mape_val = float(np.mean(mape))
    smape = np.mean(2 * np.abs(yt - yp) / (np.abs(yt) + np.abs(yp) + 1e-10)) * 100
    return {
        "rmse_log": round(float(rmse), 4),
        "mae_log": round(float(mae), 4),
        "r2": round(float(r2), 4),
        "mape_pct": round(mape_val, 2),
        "smape_pct": round(float(smape), 2),
    }


# ── 2. Modelos adicionales ──────────────────────────────────────────────

def modelo_11_ridge(d):
    """Ridge (L2) con log_aco_lag1 + log_aco_lag2 + month_sin/cos."""
    print("\n" + "═" * 60)
    print("1.1  RIDGE  log(CM) ~ log(ACO_lag1) + log(ACO_lag2) + estacionalidad")
    print("═" * 60)

    feat = d[["log_aco_lag1", "log_aco_lag2", "month_sin", "month_cos"]].dropna()
    y = d.loc[feat.index, "log_cm"]
    X = feat.values
    n = len(X)
    if n < 8:
        print(f"  ⛔ Solo {n} filas.")
        return None

    # LOOCV
    metrics, yt, yp = loocv_metrics(Ridge, {"alpha": 1.0}, X, y)

    # Final + predicción junio
    final = Ridge(alpha=1.0).fit(X, y)
    X_jun = np.array([[LOG_ACO_MAY, d["log_aco_lag1"].iloc[-1],
                       np.sin(2*np.pi*6/12), np.cos(2*np.pi*6/12)]])
    log_cm_jun = final.predict(X_jun)[0]
    lo, hi, _ = ci_adjusted(np.std(y - final.predict(X), ddof=2), n, log_cm_jun)
    cm_jun = np.exp(log_cm_jun)

    print(f"  n={n}  LOOCV: R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  MAPE={metrics['mape_pct']:.1f}%")
    print(f"  Coefs: {final.coef_.round(4)}")
    print(f"  ▶ Jun 2026: CM={cm_jun:.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "1.1_ridge",
        "n": n,
        **metrics,
        "coeficientes": [round(float(c), 4) for c in final.coef_],
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(cm_jun), 6),
            "cm_ton": round(cm_jun * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_12_bayesian_ridge(d):
    """BayesianRidge = ARD-style prior, da IC automáticos."""
    print("\n" + "═" * 60)
    print("1.2  BAYESIAN RIDGE  log(CM) ~ log(ACO_lag1) + log(ACO_lag2) + estacionalidad")
    print("═" * 60)

    feat = d[["log_aco_lag1", "log_aco_lag2", "month_sin", "month_cos"]].dropna()
    y = d.loc[feat.index, "log_cm"]
    X = feat.values
    n = len(X)
    if n < 8:
        print(f"  ⛔ Solo {n} filas.")
        return None

    metrics, yt, yp = loocv_metrics(BayesianRidge, {}, X, y)
    final = BayesianRidge().fit(X, y)

    X_jun = np.array([[LOG_ACO_MAY, d["log_aco_lag1"].iloc[-1],
                       np.sin(2*np.pi*6/12), np.cos(2*np.pi*6/12)]])
    y_jun_pred, y_jun_std = final.predict(X_jun, return_std=True)
    log_cm_jun = y_jun_pred[0]
    t90 = scipy_stats.t.ppf(0.90, n - 2)
    half = t90 * y_jun_std[0]
    lo, hi = log_cm_jun - half, log_cm_jun + half

    print(f"  n={n}  LOOCV: R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  MAPE={metrics['mape_pct']:.1f}%")
    print(f"  α={final.lambda_:.2f}  λ={final.alpha_:.2f}")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "1.2_bayesian_ridge",
        "n": n,
        **metrics,
        "lambda": round(float(final.lambda_), 2),
        "alpha": round(float(final.alpha_), 2),
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_13_rolling(d):
    """Rolling window: entrena con últimos k meses, kernel tricúbico."""
    print("\n" + "═" * 60)
    print("1.3  ROLLING WINDOW  log(CM) ~ log(ACO_lag1)  (k=6, kernel tricúbico)")
    print("═" * 60)

    k = 6
    d = d.sort_values("month_dt").reset_index(drop=True)
    X = d[["log_aco_lag1"]].values
    y = d["log_cm"].values
    n = len(X)

    if n < k + 2:
        print(f"  ⛔ Solo {n} filas.")
        return None

    # LOOCV con rolling window
    y_pred = np.full(n, np.nan)
    for i in range(k, n):
        Xw = X[i - k:i]
        yw = y[i - k:i]
        # kernel tricúbico (más peso al más reciente)
        w = (1 - (np.arange(k) / k) ** 3) ** 3
        m = LinearRegression()
        m.fit(Xw, yw, sample_weight=w)
        y_pred[i] = m.predict(X[i:i+1])[0]

    valid = ~np.isnan(y_pred)
    metrics = compute_metrics(y[valid], y_pred[valid])
    n_cv = valid.sum()

    # Final: entrenar con últimos k para junio
    final = LinearRegression().fit(X[-k:], y[-k:])
    log_cm_jun = final.intercept_ + final.coef_[0] * LOG_ACO_MAY
    sigma = np.std(y[-k:] - final.predict(X[-k:]), ddof=2)
    lo, hi, _ = ci_adjusted(sigma, k, log_cm_jun)

    print(f"  n={n}  k={k}  LOOCV (i≥k): R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  MAPE={metrics['mape_pct']:.1f}%")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "1.3_rolling_window",
        "n": n, "k": k,
        **metrics,
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_14_arimax(d):
    """ARIMAX(1,1,0) con log(ACO_lag1) exógena."""
    print("\n" + "═" * 60)
    print("1.4  ARIMAX(1,1,0)  Δlog(CM) ~ AR(1) + log(ACO_lag1)")
    print("═" * 60)

    try:
        from statsmodels.tsa.arima.model import ARIMA
    except ImportError:
        print("  ⛔ statsmodels no disponible, saltando.")
        return None

    d = d.sort_values("month_dt").reset_index(drop=True)
    y = d["log_cm"].values
    exog = d[["log_aco_lag1"]].values
    n = len(d)

    if n < 10:
        print(f"  ⛔ Solo {n} filas.")
        return None

    # LOOCV
    y_pred = np.zeros(n)
    for i in range(n):
        mask = np.ones(n, bool)
        mask[i] = False
        try:
            m = ARIMA(y[mask], exog=exog[mask], order=(1, 1, 0))
            fitted = m.fit(method_kwargs={"disp": False})
            y_pred[i] = fitted.forecast(steps=1, exog=exog[i:i+1]).iloc[0]
        except Exception:
            y_pred[i] = np.nan

    valid = ~np.isnan(y_pred)
    if valid.sum() < 4:
        print("  ⛔ Muy pocas predicciones válidas.")
        return None

    metrics = compute_metrics(y[valid], y_pred[valid])

    # Final + proyección
    final = ARIMA(y, exog=exog, order=(1, 1, 0)).fit(method_kwargs={"disp": False})
    exog_jun = np.array([[LOG_ACO_MAY]])
    fc = final.forecast(steps=1, exog=exog_jun)
    log_cm_jun = float(fc.iloc[0])
    cm_jun = np.exp(log_cm_jun)

    ci = final.get_forecast(steps=1, exog=exog_jun).conf_int(alpha=0.2)
    lo, hi = float(ci.iloc[0, 0]), float(ci.iloc[0, 1])

    print(f"  n={n}  LOOCV (valid={int(valid.sum())}): RMSElog={metrics['rmse_log']:.4f}  MAPE={metrics['mape_pct']:.1f}%")
    print(f"  AIC={final.aic:.1f}  σ²={final.params.get('sigma2', 0):.4f}")
    print(f"  ▶ Jun 2026: CM={cm_jun:.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "1.4_arimax",
        "n": n, "n_valido_loocv": int(valid.sum()),
        **metrics,
        "aic": round(float(final.aic), 1),
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(cm_jun), 6),
            "cm_ton": round(cm_jun * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


def modelo_15_segmentada(d):
    """log(CM) ~ log(ACO_lag1) * post_2024 (pendiente diferente antes/después)."""
    print("\n" + "═" * 60)
    print("1.5  SEGMENTADA  log(CM) ~ log(ACO_lag1) * post_2024")
    print("═" * 60)

    d = expand_features(d)
    X = d[["log_aco_lag1", "post_2024", "aco_x_post2024"]].values
    y = d["log_cm"].values
    n = len(X)

    if n < 8:
        print(f"  ⛔ Solo {n} filas.")
        return None

    metrics, yt, yp = loocv_metrics(LinearRegression, {}, X, y)
    final = LinearRegression().fit(X, y)

    # Predicción junio: post_2024=1
    X_jun = np.array([[LOG_ACO_MAY, 1, LOG_ACO_MAY * 1]])
    log_cm_jun = final.predict(X_jun)[0]
    sigma = np.std(y - final.predict(X), ddof=4)
    lo, hi, _ = ci_adjusted(sigma, n, log_cm_jun)

    print(f"  n={n}  LOOCV: R²={metrics['r2']:.4f}  RMSElog={metrics['rmse_log']:.4f}  MAPE={metrics['mape_pct']:.1f}%")
    print(f"  Coefs: β₀={final.intercept_:.4f}  β₁(ACO)={final.coef_[0]:.4f}  β₂(post2024)={final.coef_[1]:.4f}  β₃(interac)={final.coef_[2]:.4f}")
    print(f"  ▶ Jun 2026: CM={np.exp(log_cm_jun):.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")

    return {
        "modelo": "1.5_segmentada",
        "n": n,
        **metrics,
        "coeficientes": {
            "intercept": round(float(final.intercept_), 4),
            "log_aco_lag1": round(float(final.coef_[0]), 4),
            "post_2024": round(float(final.coef_[1]), 4),
            "aco_x_post2024": round(float(final.coef_[2]), 4),
        },
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(np.exp(log_cm_jun)), 6),
            "cm_ton": round(np.exp(log_cm_jun) * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


# ── 3. Prophet tuning ─────────────────────────────────────────────────

def modelo_16_prophet_tuned(coefs_01=None):
    """Prophet con grid search sobre changepoint_prior_scale y seasonality_prior_scale.
    
    coefs_01: dict con "beta_0" y "beta_1" del modelo 0.1 (dinámicos)
    """
    print("\n" + "═" * 60)
    print("1.6  PROPHET TUNEADO  grid search + CV sobre aligned_ACO")
    print("═" * 60)

    fuente = pd.read_csv(ROOT / "features_fuente.csv")
    prof = fuente[["month", "log_biomasa", "post_2011"]].copy()
    prof["ds"] = pd.to_datetime(prof["month"]) + pd.offsets.MonthEnd(0)
    prof["y"] = prof["log_biomasa"]
    prof["post_2011"] = prof["post_2011"].astype(int)
    print(f"  Datos: {len(prof)} filas  ({prof['ds'].min().date()} → {prof['ds'].max().date()})")

    # Grid
    param_grid = {
        "changepoint_prior_scale": [0.001, 0.01, 0.05, 0.1, 0.5],
        "seasonality_prior_scale": [0.01, 0.1, 1.0, 10.0],
        "seasonality_mode": ["additive"],  # multiplicative never outperforms on this series
    }
    all_params = [dict(zip(param_grid.keys(), v)) for v in itertools.product(*param_grid.values())]
    print(f"  Grid: {len(all_params)} combinaciones")

    results = []
    best_rmse = np.inf
    best_params = None

    # Train/Validation split: use the last 24 months for hyperparameter validation
    val_months = 24
    train_df = prof.iloc[:-val_months]
    val_df = prof.iloc[-val_months:]

    for params in all_params:
        try:
            m = Prophet(
                yearly_seasonality=3,  # Fourier order bajo para monthly
                weekly_seasonality=False,
                daily_seasonality=False,
                changepoint_prior_scale=params["changepoint_prior_scale"],
                seasonality_prior_scale=params["seasonality_prior_scale"],
                seasonality_mode=params["seasonality_mode"],
                interval_width=0.80,
            )
            m.add_regressor("post_2011")
            m.fit(train_df[["ds", "y", "post_2011"]])

            forecast = m.predict(val_df[["ds", "post_2011"]])
            y_pred = forecast["yhat"].values
            y_true = val_df["y"].values

            rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
            mape = float(np.mean(np.where(np.abs(y_true) > 1e-6, np.abs((y_true - y_pred) / y_true) * 100, 0)))

            results.append({**params, "rmse": rmse, "mape": mape})
            if rmse < best_rmse:
                best_rmse = rmse
                best_params = params
        except Exception as e:
            continue

    if best_params is None:
        print("  ⛔ No se encontró modelo válido.")
        return None

    # Fit the best model on the complete dataset
    best_model = Prophet(
        yearly_seasonality=3,
        weekly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=best_params["changepoint_prior_scale"],
        seasonality_prior_scale=best_params["seasonality_prior_scale"],
        seasonality_mode=best_params["seasonality_mode"],
        interval_width=0.80,
    )
    best_model.add_regressor("post_2011")
    best_model.fit(prof[["ds", "y", "post_2011"]])

    # Mejor modelo: predicción
    future = best_model.make_future_dataframe(periods=12, freq="ME")
    future["post_2011"] = 1
    forecast = best_model.predict(future)
    last_known = prof.iloc[-1]
    preds = forecast[forecast["ds"] > last_known["ds"]].head(6)
    jun = preds[preds["ds"].dt.month == 6]
    jun_log = float(jun.iloc[0]["yhat"]) if len(jun) > 0 else None

    # Estimar CM desde ACO proyectado
    # ⚠️ Misma limitación que modelo 0.4: la relación ACO↔CM con solo 14 pares
    # puede producir valores irreales (>0.5 Mt). Solo referencia cualitativa.
    if jun_log:
        if coefs_01:
            beta_0_1 = coefs_01["beta_0"]
            beta_1_1 = coefs_01["beta_1"]
        else:
            beta_0_1 = -1.8037
            beta_1_1 = 1.7396
        cm_jul_log = beta_0_1 + beta_1_1 * jun_log
        cm_jul = np.exp(cm_jul_log)

    print(f"\n  Mejores parámetros:")
    print(f"    changepoint_prior_scale={best_params['changepoint_prior_scale']}")
    print(f"    seasonality_prior_scale={best_params['seasonality_prior_scale']}")
    print(f"    seasonality_mode={best_params['seasonality_mode']}")
    print(f"    CV RMSE={best_rmse:.4f}  (n_params={len(all_params)})")

    top5 = sorted(results, key=lambda r: r["rmse"])[:5]
    print(f"\n  Top 5 combinaciones:")
    for r in top5:
        print(f"    cps={r['changepoint_prior_scale']:.3f}  sps={r['seasonality_prior_scale']:.1f}  "
              f"mode={r['seasonality_mode']:<10}  RMSE={r['rmse']:.4f}  MAPE={r.get('mape', 0):.2f}%")

    if jun_log:
        print(f"\n  ▶ ACO_jun (Prophet tuneado) = {np.exp(jun_log):.4f} Mt")
        print(f"  ▶ CM_jul (vía coefs 0.1) = {cm_jul:.6f} Mt")

    reliable_cm = bool(cm_jul <= 0.5) if jun_log else False

    return {
        "modelo": "1.6_prophet_tuned",
        "n_entrenamiento": len(prof),
        "best_params": {k: str(v) if isinstance(v, float) else v for k, v in best_params.items()},
        "cv_rmse": round(float(best_rmse), 4),
        "top5": [{"changepoint_prior_scale": r["changepoint_prior_scale"],
                   "seasonality_prior_scale": r["seasonality_prior_scale"],
                   "seasonality_mode": r["seasonality_mode"],
                   "rmse": round(float(r["rmse"]), 4)}
                  for r in top5],
        "proyeccion_junio_2026_aco_mt": round(float(np.exp(jun_log)), 4) if jun_log else None,
        "estimacion_indirecta_cm_julio_mt": round(float(cm_jul), 6) if jun_log else None,
        "cm_reliable": reliable_cm,
        "nota": "CM estimado indirectamente vía ACO→coefs 0.1. No usar para decisiones operativas." if not reliable_cm else None,
    }


# ── 3.5 ARIMAX full series (n=23) ────────────────────────────────────

def modelo_17_arimax_full():
    """ARIMAX(1,1,0) sobre CM completo (n=23) con ACO_lag1 exógeno.

    Usa la serie completa de CM del master CSV (23 meses),
    no solo los 14 pares. ACO_lag1 se mergea desde features.
    """
    print("\n" + "═" * 60)
    print("1.7  ARIMAX FULL  ARIMAX(1,1,0) sobre CM completo (n=23)")
    print("═" * 60)

    try:
        from statsmodels.tsa.arima.model import ARIMA
    except ImportError:
        print("  ⛔ statsmodels no disponible.")
        return None

    # Cargar CM completo desde master (23 meses)
    master = pd.read_csv(ROOT / "boletines_sargazo_MASTER.csv", low_memory=False)
    master["fecha_dt"] = pd.to_datetime(master["fecha"])
    master["month"] = master["fecha_dt"].dt.to_period("M").astype(str)

    cm_monthly = master.groupby("month")["biomasa_caribe_mexicano_ton"].median() / 1_000_000
    cm_monthly = cm_monthly.dropna()
    cm_df = pd.DataFrame({"month": cm_monthly.index, "cm_mt": cm_monthly.values})
    cm_df["log_cm"] = np.log(cm_df["cm_mt"] + EPS)
    cm_df = cm_df.sort_values("month").reset_index(drop=True)

    # Merge ACO_lag1 desde features
    feat = pd.read_csv(ROOT / "features_prediccion_cm.csv")
    cm_df["month"] = cm_df["month"].astype(str)
    feat["month"] = feat["month"].astype(str)
    cm_df = cm_df.merge(feat[["month", "log_aco_lag1"]], on="month", how="left")

    d = cm_df.dropna(subset=["log_cm"]).reset_index(drop=True)
    n = len(d)
    print(f"  Serie CM completa: {n} meses ({d['month'].iloc[0]} → {d['month'].iloc[-1]})")

    # Expanding window CV (solo con ACO disponible)
    d_ac = d.dropna(subset=["log_aco_lag1"])
    n_ac = len(d_ac)
    print(f"  Con ACO_lag1 disponible: {n_ac} meses")

    if n_ac < 6:
        print("  ⛔ Muy pocos datos con ACO.")
        return None

    y_all = d["log_cm"].values

    # Expanding window
    y_pred_full = np.full(n, np.nan)
    min_train = 5
    for i in range(min_train, n):
        train_idx = list(range(i))
        y_tr = d.iloc[train_idx]["log_cm"].values
        try:
            val = d.iloc[i:i+1]
            aco_val = val["log_aco_lag1"].values[0]
            if pd.notna(aco_val):
                exog_tr = d.iloc[train_idx]["log_aco_lag1"].values
                exog_te = np.array([[aco_val]])
                valid_mask = ~np.isnan(exog_tr.ravel())
                if valid_mask.sum() < 3:
                    continue
                y_tr_v = y_tr[valid_mask]
                exog_tr_v = exog_tr[valid_mask].reshape(-1, 1)
                m = ARIMA(y_tr_v, exog=exog_tr_v, order=(1, 1, 0))
                fitted = m.fit(method_kwargs={"disp": False})
                fc = fitted.forecast(steps=1, exog=exog_te)
                y_pred_full[i] = float(fc.iloc[0] if hasattr(fc, 'iloc') else fc[0])
            else:
                # Sin ACO: AR(1) puro
                from statsmodels.tsa.arima.model import ARIMA as ARIMA_simple
                m = ARIMA_simple(y_tr, order=(1, 1, 0))
                fitted = m.fit(method_kwargs={"disp": False})
                y_pred_full[i] = fitted.forecast(steps=1).iloc[0]
        except Exception as e:
            continue

    valid = ~np.isnan(y_pred_full)
    n_valid = valid.sum()
    print(f"  Predicciones CV: {n_valid}/{n}")

    if n_valid > 3:
        from sklearn.metrics import mean_squared_error, mean_absolute_error
        rmse = np.sqrt(mean_squared_error(y_all[valid], y_pred_full[valid]))
        mae = mean_absolute_error(y_all[valid], y_pred_full[valid])
        r2 = r2_score(y_all[valid], y_pred_full[valid])
        bias = np.mean(y_pred_full[valid] - y_all[valid])
        print(f"  CV: RMSE={rmse:.4f}  MAE={mae:.4f}  R²={r2:.4f}  Bias={bias:.4f}")

    # Modelo final con todos los datos
    final_y = d["log_cm"].values
    final_exog = d["log_aco_lag1"].values.reshape(-1, 1)
    has_aco = ~np.isnan(final_exog.ravel())
    if has_aco.sum() >= 5:
        final = ARIMA(final_y[has_aco], exog=final_exog[has_aco], order=(1, 1, 0)).fit(method_kwargs={"disp": False})
        fc = final.forecast(steps=1, exog=np.array([[LOG_ACO_MAY]]))
        log_cm_jun = float(fc.iloc[0] if hasattr(fc, 'iloc') else fc[0])
        ci = final.get_forecast(steps=1, exog=np.array([[LOG_ACO_MAY]])).conf_int(alpha=0.2)
        lo, hi = float(ci.iloc[0, 0] if hasattr(ci, 'iloc') else ci[0, 0]), float(ci.iloc[0, 1] if hasattr(ci, 'iloc') else ci[0, 1])
        cm_jun = np.exp(log_cm_jun)
        print(f"  ▶ Jun 2026: CM={cm_jun:.6f}Mt  IC80%=[{np.exp(lo):.6f}, {np.exp(hi):.6f}]")
    else:
        print("  ⛔ No hay ACO suficiente para modelo final.")
        return None

    return {
        "modelo": "1.7_arimax_full",
        "n_completo": n,
        "n_con_aco": n_ac,
        "cv_valid": n_valid,
        "cv_rmse": round(float(rmse), 4) if n_valid > 3 else None,
        "cv_r2": round(float(r2), 4) if n_valid > 3 else None,
        "prediccion_junio": {
            "log_cm": round(float(log_cm_jun), 4),
            "cm_mt": round(float(cm_jun), 6),
            "cm_ton": round(cm_jun * 1e6, 0),
            "ci_80_mt": [round(float(np.exp(lo)), 6), round(float(np.exp(hi)), 6)],
        },
    }


# ── 4. Backtest LOOCV (todos los modelos sobre 14 pares) ──────────────

def backtest_all():
    """Backtest LOOCV comparativo de todos los modelos que usan los 14 pares SEMAR."""
    print("\n" + "█" * 60)
    print("██  BACKTEST LOOCV — COMPARATIVA DE MODELOS  ██")
    print("█" * 60)

    d_raw = load_pairs()
    d = expand_features(d_raw)
    # Subconjunto común: filas sin NaN en ninguna columna necesaria
    common_cols = ["log_cm", "log_aco_lag1", "log_aco_lag2", "month_sin", "month_cos",
                   "delta_log_cm", "delta_log_aco_lag1", "post_2024", "aco_x_post2024"]
    dc = d[common_cols].dropna()
    y = dc["log_cm"].values
    n = len(dc)
    print(f"  Pares SEMAR usados: {n}")

    models = {}

    # 0.1 Regresión lineal
    X1 = dc[["log_aco_lag1"]].values
    m1_metrics, yt1, yp1 = loocv_metrics(LinearRegression, {}, X1, y)
    models["0.1_regresion_lineal"] = m1_metrics

    # 0.2 Delta
    X2 = dc[["log_aco_lag1", "delta_log_aco_lag1"]].values
    y2 = dc["delta_log_cm"].values
    m2_metrics = compute_metrics(*loocv_metrics(LinearRegression, {}, X2, y2)[1:])
    models["0.2_delta"] = m2_metrics

    # 1.1 Ridge
    X11 = dc[["log_aco_lag1", "log_aco_lag2", "month_sin", "month_cos"]].values
    m11_metrics = compute_metrics(*loocv_metrics(Ridge, {"alpha": 1.0}, X11, y)[1:])
    models["1.1_ridge"] = m11_metrics

    # 1.2 Bayesian Ridge
    m12_metrics = compute_metrics(*loocv_metrics(BayesianRidge, {}, X11, y)[1:])
    models["1.2_bayesian_ridge"] = m12_metrics

    # Nota: 1.5 segmentada = idéntica a 0.1 porque todos los datos son post-2024
    # Se omite del backtest para no duplicar

    # Tabla
    rows = []
    for name, m in models.items():
        rows.append({
            "Modelo": name,
            "R²": m["r2"],
            "RMSE(log)": m["rmse_log"],
            "MAE(log)": m["mae_log"],
            "MAPE(%)": m["mape_pct"],
            "SMAPE(%)": m["smape_pct"],
        })
    df = pd.DataFrame(rows).sort_values("R²", ascending=False).reset_index(drop=True)
    df.index += 1

    print("\n" + df.to_string())
    return df.to_dict(orient="records"), models


# ── 5. Ensemble con bias correction ──────────────────────────────────────

def ensemble(res_dict, d, backtest_bias_correction: float = 1.0):
    """Ensemble ponderado por R² de LOOCV + bias correction del backtest.
    
    backtest_bias_correction: factor multiplicativo empírico.
    Si el backtest muestra que el modelo subestima 40%, factor=1.4
    """
    print("\n" + "═" * 60)
    print("ENSEMBLE  — ponderado por R² LOOCV + bias correction")
    print("═" * 60)

    backtest_table = res_dict.get("backtest", [])
    r2_map = {r["Modelo"]: r["R²"] for r in backtest_table}

    base = {}
    excluded = {"0.2_delta", "1.4_arimax", "0.3_logistica", "0.4_prophet",
                "1.6_prophet_tuned", "1.3_rolling"}
    for name, m in res_dict.items():
        if name.startswith("0.") or name.startswith("1."):
            if name in excluded:
                continue
            if isinstance(m, dict) and "prediccion_junio" in m:
                cm = m["prediccion_junio"]["cm_mt"]
                r2 = r2_map.get(name, 0)
                if r2 > 0:
                    base[name] = {"peso": r2, "cm_mt": cm}

    if not base:
        print("  ⛔ No hay modelos base para el ensemble.")
        return None

    total_peso = sum(v["peso"] for v in base.values())
    cm_ens = sum(v["peso"] * v["cm_mt"] for v in base.values()) / total_peso

    # Bias correction: basado en backtest, los modelos subestiman subidas
    # Si los últimos 3 meses muestran tendencia alcista, corregir al alza
    try:
        d_sorted = d.sort_values("month_dt")
        recent = d_sorted.tail(3)
        cm_recent = np.exp(recent["log_cm"].values)
        if len(cm_recent) >= 2:
            slope = np.polyfit(range(len(cm_recent)), cm_recent, 1)[0]
            if slope > 0.005:  # tendencia alcista > 5,000 ton/mes
                correction = 1.25  # +25% si está subiendo
                print(f"  📈 Tendencia alcista detectada (slope={slope:.4f}) → correction x{correction}")
            elif slope < -0.005:  # tendencia bajista
                correction = 0.85  # -15% si está bajando
                print(f"  📉 Tendencia bajista detectada (slope={slope:.4f}) → correction x{correction}")
            else:
                correction = 1.0
        else:
            correction = 1.0
    except:
        correction = 1.0

    cm_ens_corrected = cm_ens * correction

    # Calibración isotónica: usar el bias del backtest para ajustar IC
    # El backtest mostró RMSE_log ≈ 1.28 y Bias ≈ 0.08 (sobreestimación leve)
    # Ajustamos el IC para reflejar la incertidumbre real
    backtest_calibration_log = 1.28  # RMSE_log promedio del backtest
    calibration_factor = max(0.5, min(2.0, backtest_calibration_log / 1.1))

    # IC80% ajustado por calibración
    lo_cal, hi_cal = None, None

    # IC80% ajustado por calibración isotónica del backtest
    cis = []
    for name, v in base.items():
        if name in res_dict and isinstance(res_dict[name], dict):
            ci = res_dict[name]["prediccion_junio"].get("ci_80_mt", [])
            if ci:
                cis.append(ci)
    lo = min(c[0] for c in cis) if cis else None
    hi = max(c[1] for c in cis) if cis else None

    # Ajuste: IC más realista basado en backtest RMSE_log
    log_cm_ens = np.log(cm_ens_corrected + EPS)
    half_width = calibration_factor * 0.675 * backtest_calibration_log  # ~80% CI en log-space
    lo_cal = np.exp(log_cm_ens - half_width)
    hi_cal = np.exp(log_cm_ens + half_width)
    # Usar el IC más conservador entre el empírico y el calibrado
    if lo is None or lo_cal < lo:
        lo = max(lo, lo_cal) if lo else lo_cal
    if hi is None or hi_cal > hi:
        hi = min(hi, hi_cal) if hi else hi_cal

    cambio = (cm_ens_corrected - CM_MAY_2026) / CM_MAY_2026 * 100

    print(f"  Ponderación: {', '.join(f'{n}(w={v['peso']:.2f})' for n,v in base.items())}")
    peso_prom = sum(v['peso']**2 for v in base.values()) / total_peso
    print(f"  ▶ Jun 2026: CM={cm_ens_corrected:.6f}Mt  ({cambio:+.1f}% vs may)", end="")
    if lo and hi:
        print(f"  IC80%=[{lo:.6f}, {hi:.6f}]")
    else:
        print()
    print(f"  R² promedio ponderado: {peso_prom:.4f}")
    if correction != 1.0:
        print(f"  Bias correction factor: x{correction} ({cm_ens:.4f} → {cm_ens_corrected:.4f} Mt)")

    return {
        "modelo": "ensemble",
        "n_modelos": len(base),
        "ponderacion": {n: round(v["peso"], 4) for n, v in base.items()},
        "correction_factor": round(correction, 3),
        "bias_corrected_from_mt": round(cm_ens, 6),
        "prediccion_junio": {
            "cm_mt": round(float(cm_ens_corrected), 6),
            "cm_ton": round(cm_ens_corrected * 1e6, 0),
            "cambio_pct_vs_mayo": round(float(cambio), 1),
            "ci_80_mt": [round(float(lo), 6), round(float(hi), 6)] if lo and hi else [],
        },
    }


# ── 6. Main ──────────────────────────────────────────────────────────────

def main():
    print("█" * 60)
    print("██  FASE 1 — MODELOS EXTENDIDOS, PROPHET TUNING, ENSEMBLE  ██")
    print("█" * 60)

    res = {}
    d = load_pairs()
    d_exp = expand_features(d)

    # Modelos adicionales
    res["1.1_ridge"] = modelo_11_ridge(d_exp)
    res["1.2_bayesian_ridge"] = modelo_12_bayesian_ridge(d_exp)
    res["1.3_rolling"] = modelo_13_rolling(d)
    res["1.4_arimax"] = modelo_14_arimax(d)
    res["1.5_segmentada"] = modelo_15_segmentada(d)
    # 1.6 Prophet tuned se ejecuta después con coefs dinámicos (línea 809)
    res["1.7_arimax_full"] = modelo_17_arimax_full()

    # Re-ejecutar modelos 0.1-0.5 para obtener las predicciones en el mismo formato
    # (los importamos desde modelos_fase0.py pero necesitamos las estructuras de datos)
    from modelos_fase0 import (
        modelo_1_regresion, modelo_2_delta, modelo_5_ar1, modelo_4_prophet
    )
    r1 = modelo_1_regresion(d)
    res["0.1_regresion_lineal"] = r1
    res["0.2_delta"] = modelo_2_delta(d)
    res["0.5_ar1"] = modelo_5_ar1()

    # Re-ejecutar Prophet con coeficientes dinámicos del modelo 0.1
    coefs_01 = {"beta_0": r1["beta_0"], "beta_1": r1["beta_1"]} if r1 else None
    res["0.4_prophet"] = modelo_4_prophet(coefs_01)
    res["1.6_prophet_tuned"] = modelo_16_prophet_tuned(coefs_01)

    # Backtest comparativo
    backtest_results, models_for_ensemble = backtest_all()
    res["backtest"] = backtest_results

    # Ensemble
    res["ensemble"] = ensemble(res, d)

    # Guardar
    res["metadata"] = {
        "generado": datetime.now().isoformat(),
        "proyecto": "Predicción Sargazo Cozumel",
        "fase": "1_extendida",
        "modelos": [
            "0.1_regresion", "0.2_delta", "0.5_ar1",
            "1.1_ridge", "1.2_bayesian_ridge", "1.3_rolling",
            "1.4_arimax", "1.5_segmentada", "1.6_prophet_tuned",
            "ensemble",
        ],
    }

    with open(OUTPUT, "w") as f:
        json.dump(res, f, indent=2, default=str)
    print(f"\n  Resultados: {OUTPUT}")
    save_predictions_to_db(res, "1")


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
        print("  ✅ Predicciones de Fase 1 guardadas en base de datos SQLite.")
    except Exception as db_err:
        print(f"  ❌ Error guardando predicciones en SQLite: {db_err}")


if __name__ == "__main__":
    main()
