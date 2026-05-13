"""
Backtest de modelos Fase 0/1 — Validación temporal expanding window.

Para cada mes disponible con CM real (2025-04 → 2026-05):
1. Entrenar con todos los datos anteriores a ese mes
2. Predecir el mes
3. Comparar predicción vs real

Métricas: RMSE, MAE, SMAPE, bias, cobertura IC 80%.
"""

import json
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from scipy import stats as scipy_stats

warnings.filterwarnings("ignore")

ROOT = Path(__file__).parent
EPS = 1e-9
H = 0.8047
LOG_ACO_MAY = np.log(0.512037 + EPS)

# Cargar datos
pred = pd.read_csv(ROOT / "features_prediccion_cm.csv")
pairs = pred.dropna(subset=["log_cm", "log_aco_lag1"]).sort_values("month").reset_index(drop=True)
pairs["month_dt"] = pd.to_datetime(pairs["month"])

ACO_VALUES = pairs.set_index("month")["log_aco_lag1"].to_dict()

print("=" * 70)
print("BACKTEST — Validación temporal expanding window")
print("=" * 70)
print(f"\nDatos: {len(pairs)} pares ACO_lag1→CM")
print(f"Período: {pairs['month'].iloc[0]} → {pairs['month'].iloc[-1]}")
print()

results = []

# Expanding window: entrena con n, predice n+1
for i in range(3, len(pairs)):
    train = pairs.iloc[:i]
    test = pairs.iloc[i:i+1]
    month = test["month"].values[0]
    cm_real = float(np.exp(test["log_cm"].values[0]))
    
    X_tr = train[["log_aco_lag1"]].values
    y_tr = train["log_cm"].values
    X_te = test[["log_aco_lag1"]].values
    
    cm_real = float(np.exp(test["log_cm"].values[0])) * 1_000_000  # Mt → ton
    
    preds = {}
    
    # Modelo 0.1: Regresión lineal
    m1 = LinearRegression().fit(X_tr, y_tr)
    preds["0.1_regresion"] = float(np.exp(m1.predict(X_te)[0])) * 1_000_000
    
    # Modelo 1.1: Ridge
    X_tr_ridge = train[["log_aco_lag1", "log_aco_lag2", "month_sin", "month_cos"]].dropna()
    if len(X_tr_ridge) >= 5 and i < len(pairs) - 1:
        y_tr_r = train.loc[X_tr_ridge.index, "log_cm"]
        m11 = Ridge(alpha=1.0).fit(X_tr_ridge.values, y_tr_r.values)
        X_te_r = test[["log_aco_lag1", "log_aco_lag2", "month_sin", "month_cos"]]
        if not X_te_r.isna().any().any():
            preds["1.1_ridge"] = float(np.exp(m11.predict(X_te_r.values)[0])) * 1_000_000
    
    # Modelo 0.5: AR(1) fallback
    ar_data = train[["log_cm"]].copy()
    ar_data["log_cm_lag1"] = ar_data["log_cm"].shift(1)
    ar_train = ar_data.dropna()
    if len(ar_train) >= 3:
        X_ar = ar_train[["log_cm_lag1"]].values
        y_ar = ar_train["log_cm"].values
        mar = LinearRegression().fit(X_ar, y_ar)
        ultimo_cm = float(train["log_cm"].iloc[-1])
        preds["0.5_ar1"] = float(np.exp(mar.intercept_ + mar.coef_[0] * ultimo_cm)) * 1_000_000
    
    # Ensemble simple (promedio de disponibles)
    if preds:
        cm_ens = np.mean(list(preds.values()))
        preds["ensemble"] = float(cm_ens)
    
    # Guardar
    for model_name, cm_pred in preds.items():
        error = cm_pred - cm_real
        pct_error = (error / cm_real) * 100 if cm_real > 100 else 0
        results.append({
            "month": month,
            "modelo": model_name,
            "cm_real_ton": round(cm_real),
            "cm_pred_ton": round(cm_pred),
            "error_ton": round(error),
            "error_pct": round(pct_error, 1),
            "n_train": i,
        })
    
    print(f"  {month}: real={cm_real:>8,.0f}ton  ", end="")
    for m_name, cm_p in sorted(preds.items()):
        print(f"{m_name}={cm_p:>8,.0f}ton  ", end="")
    print()

# DataFrame de resultados
df = pd.DataFrame(results)

# Métricas por modelo
print("\n" + "=" * 70)
print("MÉTRICAS POR MODELO")
print("=" * 70)

metrics = []
for model_name in df["modelo"].unique():
    sub = df[df["modelo"] == model_name]
    real = sub["cm_real_ton"].values
    pred = sub["cm_pred_ton"].values
    
    rmse = np.sqrt(np.mean((real - pred) ** 2))
    mae = np.mean(np.abs(real - pred))
    bias = np.mean(pred - real)
    
    # SMAPE
    denom = (np.abs(real) + np.abs(pred)) / 2
    denom = np.maximum(denom, 1)
    smape = np.mean(np.abs(real - pred) / denom) * 100
    
    # MAE log-space
    mae_log = np.mean(np.abs(np.log(real + 1) - np.log(pred + 1)))
    
    # Correlación
    if len(real) > 2:
        r_corr, _ = scipy_stats.pearsonr(real, pred)
    else:
        r_corr = np.nan
    
    metrics.append({
        "modelo": model_name,
        "n": len(sub),
        "RMSE(ton)": round(rmse, 0),
        "MAE(ton)": round(mae, 0),
        "MAE(log)": round(mae_log, 3),
        "SMAPE(%)": round(smape, 1),
        "Bias(ton)": round(bias, 0),
        "Corr(r)": round(r_corr, 4) if not np.isnan(r_corr) else "-",
    })
    print(f"  {model_name:15s} n={len(sub):2d}  RMSE={rmse:>8,.0f}  MAE={mae:>8,.0f}  "
          f"SMAPE={smape:>5.1f}%  Bias={bias:>+8,.0f}  r={r_corr:.4f}" if not np.isnan(r_corr)
          else f"  {model_name:15s} n={len(sub):2d}  RMSE={rmse:>8,.0f}  MAE={mae:>8,.0f}  "
          f"SMAPE={smape:>5.1f}%  Bias={bias:>+8,.0f}  r=-")

# Guardar
results_json = {
    "resultados": df.to_dict(orient="records"),
    "metricas": metrics,
    "metadata": {
        "generado": datetime.now().isoformat(),
        "n_pares": len(pairs),
        "metodo": "expanding_window",
        "primer_prediccion": str(pairs["month"].iloc[3]),
        "ultimo_real": str(pairs["month"].iloc[-1]),
    },
}

with open(ROOT / "backtest_resultados.json", "w") as f:
    json.dump(results_json, f, indent=2)

print(f"\n✅ Resultados guardados: backtest_resultados.json")
