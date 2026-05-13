# Model Cards — Sargazo Cozumel

Formato estándar para cada modelo: **Propósito** | **Inputs** | **Training Data** | **Performance** | **Limitaciones** | **Frecuencia**

---

## Fase 0 — Modelos Operativos

### 0.1 Regresión Lineal (Weighted)

| Campo | Valor |
|---|---|
| **Propósito** | Predicción principal de CM (biomasa Caribe Mexicano) |
| **Ecuación** | `log(CM) = β₀ + β₁·log(ACOₜ₋₁)` con pesos tricúbicos |
| **Inputs** | `log_aco_lag1` (ACO del mes anterior) |
| **Training data** | 14 pares SEMAR (2025-04 → 2026-05) |
| **R² (train)** | 0.8289 |
| **RMSE (backtest)** | 20,896 ton |
| **MAE (backtest)** | 14,832 ton |
| **Bias** | −6,538 ton (subestima) |
| **Correlación r** | 0.62 |
| **Holdout mayo 2026** | Real: 51,837 ton, Pred: 17,557 ton (−66.1%) |
| **Predicción junio 2026** | **38,248 ton** [IC80: 12,863 — 113,729] |
| **Limitaciones** | Subestima subidas fuertes. Solo 14 datos de entrenamiento. |
| **Frecuencia** | Semanal (cada nuevo boletín SEMAR) |

### 0.2 Regresión Delta

| Campo | Valor |
|---|---|
| **Propósito** | Capturar aceleraciones en CM (cambio vs cambio) |
| **Ecuación** | `Δlog(CM) = β₀ + β₁·log(ACOₜ₋₁) + β₂·Δlog(ACOₜ₋₁)` |
| **Inputs** | `log_aco_lag1`, `delta_log_aco_lag1` |
| **Training data** | 12 pares |
| **R²** | 0.3766 |
| **Predicción junio 2026** | **90,145 ton** [+73.9% vs may] |
| **Limitaciones** | IC extremadamente amplio [12k — 659k ton]. R² bajo. |
| **Frecuencia** | Semanal |

### 0.3 Logística Ordinal

| Campo | Valor |
|---|---|
| **Propósito** | Clasificar el nivel de alerta (semáforo 1-6) |
| **Ecuación** | `logit(P(semáforo ≤ k)) = α_k + β·log(ACOₜ₋₁)` |
| **Inputs** | `log_aco_lag1` |
| **Training data** | 21 meses con semáforo |
| **LOOCV accuracy** | 0.357 (±1 nivel: 0.643) |
| **Predicción junio 2026** | **MODERADO** (28.7%) — seguido de ALTO (26.6%) |
| **Limitaciones** | 6 clases con solo 21 datos. Desbalance: ESCASO(7), BAJO(6), MODERADO(3), ALTO(2), MUY ALTO(2), MUY BAJO(1) |
| **Frecuencia** | Semanal |

### 0.4 Prophet

| Campo | Valor |
|---|---|
| **Propósito** | Proyección de tendencia atlántica (GASB/ACO) a 6 meses |
| **Arquitectura** | `y(t) = g(t) + s(t) + β·post_2011 + ε` |
| **Inputs** | Serie aligned_ACO (303 meses) |
| **Training data** | 303 meses (2000-03 → 2026-05) |
| **Proyección ACO jun 2026** | **3.65 Mt** [IC80: 0.56 — 21.80] |
| **CM indirecto (jul)** | 1.57 Mt (vía coefs 0.1) |
| **Changepoints** | 25 detectados, principales: 2001, 2005, 2009, 2013, 2017 |
| **Limitaciones** | Intervalos de confianza muy amplios. Asume residuos iid (H=0.5 implícito), pero el proceso tiene H=0.80. |
| **Frecuencia** | Semanal |

### 0.5 AR(1) Fallback

| Campo | Valor |
|---|---|
| **Propósito** | Predicción de emergencia cuando ACO no está disponible |
| **Ecuación** | `log(CMₜ) = β₀ + β₁·log(CMₜ₋₁)` |
| **Inputs** | `log_cm_lag1` |
| **Training data** | 22 meses (2024-04 → 2026-05) |
| **R²** | 0.3026 |
| **r de Pearson** | 0.5501 |
| **Predicción junio 2026** | **16,115 ton** [−68.9% vs may] |
| **Limitaciones** | R² muy bajo. Subestima sistemáticamente (−76.1% en holdout). |
| **Frecuencia** | Semanal (solo como respaldo) |

---

## Fase 1 — Modelos Extendidos

### 1.1 Ridge (L2)

| Campo | Valor |
|---|---|
| **Propósito** | Regresión con regularización L2 para evitar overfitting |
| **Ecuación** | `min ||y − Xβ||² + α||β||²` con α=1.0 |
| **Inputs** | `log_aco_lag1`, `log_aco_lag2`, `month_sin`, `month_cos` |
| **Training data** | 13 pares (con ACO_lag2) |
| **LOOCV R²** | 0.7846 |
| **Predicción junio 2026** | **43,930 ton** [IC80: 17,608 — 109,603] |
| **Limitaciones** | 4 features con n=13 → n/k ≈ 3.25 (marginal). month_sin/cos pueden colinearse con ACO estacional. |
| **Frecuencia** | Semanal |

### 1.2 Bayesian Ridge

| Campo | Valor |
|---|---|
| **Propósito** | Regresión bayesiana con intervalos de confianza automáticos |
| **Inputs** | Mismos que 1.1 Ridge |
| **Training data** | 13 pares |
| **LOOCV R²** | 0.7789 |
| **Hiperparámetros** | λ=1.07, α=1.05 |
| **Predicción junio 2026** | **43,995 ton** [IC80: 6,596 — 293,445] |
| **Limitaciones** | IC extremadamente amplio (44× entre extremos). |
| **Frecuencia** | Semanal |

### 1.3 Rolling Window

| Campo | Valor |
|---|---|
| **Propósito** | Regresión local con ventana de 6 meses (kernel tricúbico) |
| **Inputs** | `log_aco_lag1` con pesos wⱼ = (1 − (j/k)³)³ |
| **Training data** | Últimos 6 meses |
| **LOOCV R²** | 0.7079 |
| **Predicción junio 2026** | **201,021 ton** [IC80: 61,887 — 652,953] |
| **Limitaciones** | Solo 8 puntos LOOCV válidos. Muy sensible al último mes. |
| **Frecuencia** | Semanal |

### 1.4 ARIMAX(1,1,0)

| Campo | Valor |
|---|---|
| **Estado** | ❌ **No converge** con n=13. Retorna `null`. |
| **Frecuencia** | No operativo. Requiere n ≥ 24. |

### 1.5 Segmentada

| Campo | Valor |
|---|---|
| **Estado** | ⚠️ **Redundante**. post_2024 = True para todos los datos → idéntica a 0.1. |

### 1.6 Prophet Tuneado

| Campo | Valor |
|---|---|
| **Propósito** | Prophet con grid search sobre 40 combinaciones de hiperparámetros |
| **Best params** | changepoint_prior_scale=0.01, seasonality_prior_scale=0.1, additive |
| **CV RMSE** | 1.8005 |
| **Training data** | 303 meses aligned_ACO |
| **Frecuencia** | Semanal |

### 1.7 ARIMAX Full Series

| Campo | Valor |
|---|---|
| **Propósito** | ARIMAX sobre serie CM completa (n=23) con ACO_lag1 exógeno |
| **Ecuación** | `(1−φB)(1−B)log(CM) = β·log(ACOₜ₋₁) + ε` |
| **Training data** | 23 meses CM, 14 con ACO |
| **CV R²** | 0.7610 |
| **Predicción junio 2026** | **222,753 ton** [IC80: 70,468 — 704,135] |
| **Limitaciones** | Predice muy alto por el componente AR(1). Sirve como límite superior. |
| **Frecuencia** | Semanal |

---

## Ensemble

| Campo | Valor |
|---|---|
| **Propósito** | Combinación ponderada de modelos para predicción robusta |
| **Método** | Media ponderada por R² LOOCV + bias correction por tendencia |
| **Modelos** | 1.1 Ridge (w=0.33), 1.2 Bayesian Ridge (w=0.33), 0.1 Regresión (w=0.33) |
| **Bias correction** | Factor ×1.25 si tendencia alcista, ×0.85 si bajista |
| **Backtest RMSE** | 31,043 ton |
| **Backtest bias** | **+686 ton** (casi cero — mejor que cualquier modelo individual) |
| **Confianza** | 83/100 (ALTA) |
| **Predicción junio 2026** | **52,571 ton** [+1.4% vs may, IC80: 6,596 — 293,445] |
| **Limitaciones** | Solo 3 modelos con pesos casi idénticos. RMSE alto porque los modelos se dispersan. |
| **Frecuencia** | Semanal |

---

## Modelo Lagrangiano fBm

| Campo | Valor |
|---|---|
| **Propósito** | Simular transporte oceánico de sargazo desde el Atlántico hasta QRoo |
| **Método** | OpenDrift + fBm independiente por partícula |
| **Parámetros** | 500 partículas, H=0.8047, windage 2%, 180 días |
| **Corrientes** | Paramétricas del Caribe (−0.3 m/s zonal + jet + giro + Yucatán) |
| **Output** | `lagrangian_fbm_trayectorias.csv` (5,655 pts) + `_finales.csv` (173 pts) |
| **Uso** | Peso Lagrangiano en interpolación ML risk |
| **Limitaciones** | Corrientes paramétricas (no HI🔥🔥COM). Windage constante (no GFS). |
| **Frecuencia** | Bajo demanda |

---

## Forecast 7→14 Días (RTOFS+GFS)

| Campo | Valor |
|---|---|
| **Propósito** | Pronóstico de corto plazo con OpenDrift + RTOFS + GFS |
| **Método** | OceanDrift con 2,000 partículas, paso 30 min |
| **Forzamiento** | RTOFS superficie ×1.5 + GFS 10m + windage 2% |
| **Horizontes** | 25 horizontes KDE (cada 12h, 12→336h) |
| **KDE** | Grid fijo 60×55 (−89.5° a −86° lon, 18° a 22.5° lat), bandwidth 0.08° |
| **Precisión vs NOAA SIR** | 11% cobertura a 48h (direccional, no exacta) |
| **Correlación vs histórico** | r=0.55 (positiva, p=0.13) |
| **Output** | `forecast_kde_acumulaciones.json`, `forecast_7d_trayectorias.csv` |
| **Limitaciones** | Cobertura baja (partículas salen del área). RTOFS solo 6 días. Sin datos >96h en área Cozumel. |
| **Frecuencia** | Bajo demanda (~5-10 min de ejecución) |

---

## ML Risk Interpolation

| Campo | Valor |
|---|---|
| **Propósito** | Interpolar riesgo costero NOAA SIR a una cuadrícula regular |
| **Método** | Kernel Wendland C2 anisotrópico con max-pooling |
| **Training points** | 4,250 puntos muestreados cada ~4km desde 183 segmentos SIR |
| **Kernel** | σ_lon=0.5°, σ_lat=0.25°, R_eff=1.8 → radio 100×50 km |
| **Grid** | 98×129 = 12,642 pts, resolución 0.04° (~4km) |
| **BC** | SATsum background (~0.15) con decaimiento exponencial |
| **Output** | 582 celdas: LOW(122), WARNING(164), MEDIUM(218), HIGH(78) |
| **Cozumel** | 86 celdas, riesgo medio 0.524 |
| **Islas enmascaradas** | Cozumel (0 celdas), Isla Mujeres, Cancún hotel zone |
| **Temporal** | Promedio sobre 315 días (Jul 2025 → May 2026) |
| **Limitaciones** | Kernel puede propagar riesgo a tierra si la máscara no es perfecta. Cozumel Sur enmascarado como tierra. |
| **Frecuencia** | Semanal |

---

## Beach Risk Profile

| Campo | Valor |
|---|---|
| **Propósito** | Probabilidad histórica de riesgo HIGH/MEDIUM por playa |
| **Método** | Frecuencia de riesgo NOAA SIR sobre 315 días por segmento costero |
| **Segmentos** | 10 (Cancún, Isla Mujeres, Puerto Morelos, Playa del Carmen, Cozumel Norte/Sur, Tulum, Sian Ka'an, Costa Central, Chetumal) |
| **Top 3** | Isla Mujeres 71%, Cancún 66%, Cozumel Norte 65% |
| **Output** | `risk_by_beach.json` (~4 KB) |
| **API endpoint** | `GET /api/forecast/risk-by-beach` |
| **Limitaciones** | Cozumel Sur sin datos (enmascarado como tierra). Basado en frecuencia, no en magnitud. |
| **Frecuencia** | Semanal |

---

## Confidence Score

| Campo | Valor |
|---|---|
| **Propósito** | Score global de confianza del sistema (0-100%) |
| **Componentes** | 5 criterios con pesos |
| **Resultado** | **83/100 (ALTA)** |
| **Desglose** | Actualidad(30/30), Pares ACO(20/20), Concordancia(10/20), Histórico(13/20), Temporada(10/10) |
| **Dónde se guarda** | `predicciones_fase1.json` → `ensemble.confidence_score` |
| **Frecuencia** | Semanal (después de modelos) |
