# Plan de Modelado Predictivo — Sargazo Cozumel

**Objetivo operativo:** Predecir el nivel de biomasa / semáforo de sargazo en el Caribe Mexicano (Cozumel) con 4-8 semanas de anticipación.

---

## 1. Diagnóstico del dato: qué tenemos y qué implica

### 1.1 Inventario de series

| Serie | n (meses) | Período | Fuente |
|---|---|---|---|
| GASB (Gran Cinturón Atlántico) | 288 | 2000-03 → 2024-02 | Mendeley / Hu et al. 2023 |
| ACR (Corriente Antillana) | 288 | 2000-03 → 2024-02 | Mendeley |
| ACO (Atlántico Central Occidental) | 10 | 2025-08 → 2026-05 | SEMAR boletines |
| CM (Caribe Mexicano) | 10 | 2025-08 → 2026-05 | SEMAR boletines |
| Semáforo Cozumel (ordinal 1-6) | 21 | 2024-05 → 2026-05 | SEMAR boletines |
| Corrientes (6 estaciones, nudos) | ~9 | 2025-09 → 2026-05 | SEMAR boletines |
| Vientos (2 zonas) | ~9 | 2025-08 → 2026-05 | SEMAR boletines |
| Conglomerado Cozumel (SI/NO) | ~9 | 2025-08 → 2026-05 | SEMAR boletines |

**El dato más escaso es CM biomasa: 23 observaciones mensuales.**
Esta es la restricción fundamental que dicta qué modelo es viable.

---

## 2. Análisis estadístico inicial (pruebas a ejecutar)

### 2.1 Normalidad

| Prueba | Para qué | Resultado previo |
|---|---|---|
| **Shapiro-Wilk** | n < 50 | GASB p≈0 → NO normal; CM p=0.28 → no rechaza (pero n=10 es insuficiente para concluir) |
| **Jarque-Bera** | n > 30 | Aplicar a GASB/ACR; combina sesgo y curtosis |
| **Q-Q plot** | Diagnóstico visual | Cola derecha muy pesada en GASB y ACR |

**Hallazgo**: GASB skew=2.57, kurt=7.78. ACR skew=4.76, kurt=24.79. Ambas series son **lognormales** (distribución de biomasa típica en ecología). La implicación directa es que todos los modelos deben trabajar sobre **log(biomasa)** o usar modelos con distribución no-gaussiana.

**Acción inmediata**: aplicar transformación log(x + ε) antes de cualquier modelado cuantitativo.

### 2.2 Estacionariedad

| Prueba | Hipótesis nula | Resultado GASB |
|---|---|---|
| **ADF (Augmented Dickey-Fuller)** | Hay raíz unitaria (no estacionaria) | p=0.36 → NO se rechaza → **no estacionaria** |
| **KPSS** | La serie es estacionaria | p=0.01 → SE rechaza → **no estacionaria** |
| **PP (Phillips-Perron)** | Complemento robusto a ADF | Pendiente |

**Resultado**: la serie GASB tiene tendencia + ciclo estacional. No es estacionaria.
Ambas pruebas coinciden: se necesita **diferenciación** (d≥1) o **descomposición** antes de modelar.

### 2.3 Estructura temporal (ACF/PACF)

ACF de GASB (lags 1-14):
```
lag 1: 0.889  lag 2: 0.720  lag 3: 0.546  ...  lag 9: 0.510  lag 10: 0.592  lag 11: 0.655  lag 12: 0.631
```

- Decaimiento lento → proceso AR (no media móvil dominante) + tendencia
- Repunte en lags 9-12 → **ciclo anual de 12 meses** claramente presente
- Esto indica estructura **SARMA**: componente AR + componente estacional de período 12

**Pendiente**: calcular PACF para determinar el orden `p` del AR y `P` del AR estacional.

### 2.4 Pruebas adicionales a ejecutar

| Prueba | Objetivo | Cuándo usarla |
|---|---|---|
| **Mann-Kendall** | Tendencia monotónica no-paramétrica | GASB, ACO — no asume distribución |
| **Seasonal Mann-Kendall** | Tendencia controlando estacionalidad | Antes de modelar |
| **STL decomposition** | Separar tendencia / estacional / residuo | Como paso previo a cualquier modelo |
| **Ljung-Box** | Autocorrelación residual | Validar que los residuos del modelo sean ruido blanco |
| **Engle ARCH** | Heterocedasticidad condicional | Si la varianza de los residuos no es constante |
| **Granger causality** | ACO → CM, ACR → CM, GASB → ACR | Validar predictores causales |
| **Bai-Perron / PELT** | Detección de puntos de quiebre (changepoints) | El GASB tiene un quiebre claro ~2011 (surgimiento del Great Atlantic Sargassum Belt) |
| **DTW (Dynamic Time Warping)** | Correlación con lag flexible | Alternativa robusta al lag fijo de Pearson |
| **Spearman** | Correlación no-paramétrica | Reemplaza Pearson cuando distribución no es normal |
| **VIF** | Multicolinealidad entre predictores | Si se usan corrientes + vientos + ACO simultáneamente |

---

## 3. Variables del modelo

### 3.1 Variable objetivo (target)

Se pueden definir tres targets distintos con sus propias implicaciones:

| Target | Tipo | n disponible | Problema |
|---|---|---|---|
| `log(CM_Mt)` | Continua | 10 | Demasiado poco para entrenar |
| `semaforo_mensual` | Ordinal 1-6 | 21 | Poco pero usable para clasificador |
| `conglomerado_cozumel` | Binaria SI/NO | ~9 | Muy poco |

**Recomendación**: usar `semaforo_mensual` como target principal (mayor n), con `log(CM_Mt)` como validación cuantitativa cuando esté disponible.

### 3.2 Variables predictoras (features)

#### Grupo A — Series de biomasa con lag

| Feature | Lag | Correlación con CM | Disponibilidad |
|---|---|---|---|
| `ACO_lag1` | 1 mes | r=0.938 (n=9) | 10 meses |
| `ACO_lag2` | 2 meses | r=0.822 | 10 meses |
| `ACO_lag3` | 3 meses | r=0.793 | 10 meses |
| `GASB_lag1` | 1 mes | r=0.721 (n=287, proxy) | 288 meses |
| `ACR_lag1` | 1 mes | r=0.716 (serie combinada) | 288 meses |
| `ACR_lag2` | 2 meses | r=0.709 | 288 meses |

#### Grupo B — Estacionalidad

| Feature | Descripción |
|---|---|
| `month_sin` = sin(2π·mes/12) | Codificación cíclica del mes |
| `month_cos` = cos(2π·mes/12) | Necesaria para cierre del ciclo |
| `trimestre` | Proxy discreto del semestre de pico (Q2-Q3) |

#### Grupo C — Variables operacionales (Lagrangianas)

Solo disponibles desde ago 2025. Su inclusión es valiosa para capturar el efecto "windage" de la deriva del sargazo (de Amorim et al. 2025).

| Feature | Tipo | Descripción |
|---|---|---|
| `corriente_playa_carmen_nudos` | float | Corriente dominante en destino final |
| `corriente_cancun_nudos` | float | Corriente norte del corredor |
| `corriente_dir_encoded` | one-hot | Dirección categórica codificada |
| `viento_norte_nudos_mid` | float | Punto medio del rango ("3-6" → 4.5) |
| `viento_sur_nudos_mid` | float | Ídem zona sur |
| `viento_dir_encoded` | one-hot | Dirección del viento |

#### Grupo D — Indicador de anomalía histórica

| Feature | Descripción |
|---|---|
| `gasb_z_score` | z-score de GASB vs media histórica mensual |
| `post_2011` | Dummy: 0 antes de 2011, 1 después (cambio de régimen documentado) |

---

## 4. Comparativa de métodos

### 4.1 Prophet (Meta / Facebook)

**Estructura matemática:**

```
y(t) = g(t) + s(t) + h(t) + β·X(t) + εₜ
```

- `g(t)`: tendencia — piecewise linear con changepoints detectados automáticamente, o curva logística con capacidad máxima K
- `s(t)`: estacionalidad — serie de Fourier: Σₙ [aₙ·sin(2πnt/P) + bₙ·cos(2πnt/P)] con P=12 para ciclo anual
- `h(t)`: efectos de calendario / eventos especiales
- `β·X(t)`: regresores externos (ACO_lag1, corrientes, etc.)
- `εₜ ~ N(0, σ²)`: error aditivo gaussiano

**Inferencia**: Bayesiana con Stan (MCMC o MAP). Produce intervalos de credibilidad.

**Ventajas para este caso:**
- Maneja bien los **gaps de datos** (2024-03 a 2025-07 sin biomasa)
- Detecta changepoints automáticamente (el quiebre de 2011 en GASB)
- Admite regresores externos → incorporar ACO_lag1
- Interpreta bien la estacionalidad anual del sargazo
- No requiere estacionariedad previa

**Limitaciones:**
- Asume estructura **aditiva** (si la relación ACO→CM es multiplicativa o no lineal, puede fallar)
- Con 23 meses de CM biomasa, la estimación de tendencia es prácticamente imposible
- Asume residuos normales: con distribución lognormal real se necesita transformación previa

**Caso de uso óptimo aquí:** entrenar Prophet sobre `aligned_ACO` (298 meses: Mendeley GASB 2000-2024 + SEMAR ACO 2025-2026), proyectar 6 meses, luego aplicar el lag empírico ACO→CM (1 mes, r=0.938) para obtener la estimación de CM.

---

### 4.2 TimesFM (Google DeepMind, 2024)

**Estructura matemática:**

Transformer con arquitectura de *patching* (PatchTST-style):

```
Input: serie histórica dividida en patches de longitud L
Encoder: multi-head self-attention sobre patches
Decoder: proyección a horizonte de predicción h
Output: cuantiles (q10, q50, q90) via multiple heads
```

- Preentrenado en ~100 mil millones de puntos temporales reales (Google Trends, Wikipedia, datos financieros, sensores industriales)
- **Zero-shot**: no necesita fine-tuning — puede predecir series nunca vistas
- Contexto máximo: 512 pasos temporales
- Maneja gaps implícitamente por la arquitectura de atención

**Ventajas para este caso:**
- **Zero-shot sobre series cortas**: con 23 meses de CM, otros modelos no pueden entrenar; TimesFM puede predecir directamente
- Captura patrones complejos sin especificar estacionalidad manualmente
- Salida probabilística (cuantiles)

**Limitaciones:**
- **No integra regresores externos nativamente** (a diferencia de Prophet): no puede recibir ACO_lag1 como input directo en la versión base
- Caja negra: difícil de interpretar para comunicar a operadores
- El preentrenamiento no incluye datos de sargazo → las relaciones físico-oceanográficas no están codificadas
- Requiere instalación de JAX / GPU para velocidad óptima

**Caso de uso óptimo aquí:** predicción zero-shot del semáforo como serie ordinal (21 meses), usando la serie `aligned_ACO` como contexto de entrada. Comparar contra Prophet como baseline.

---

### 4.3 SVR / SVR-RBF (Support Vector Regression)

**Estructura matemática:**

```
min  ½||w||²  +  C·Σᵢ(ξᵢ + ξᵢ*)
s.t. yᵢ - (w·φ(xᵢ) + b) ≤ ε + ξᵢ
     (w·φ(xᵢ) + b) - yᵢ ≤ ε + ξᵢ*
```

Con kernel RBF: `k(x, x') = exp(-γ||x-x'||²)`

El problema dual se resuelve con QP (programación cuadrática). La predicción solo depende de los vectores de soporte (subconjunto de puntos de entrenamiento).

**SVR no es un modelo de series temporales**: no tiene noción intrínseca de secuencia ni lag. Para usarlo aquí se necesita **ingeniería de features** explícita:

```
Feature vector por mes t:
  x(t) = [month_sin(t), month_cos(t), ACO(t-1), ACO(t-2), ACO(t-3),
           corriente_playa_carmen(t), viento_norte_mid(t), gasb_z(t-1)]
```

**Ventajas:**
- Excelente para relaciones no-lineales con muchas variables
- Regularización L2 evita overfitting cuando las features son relevantes
- Robusto a outliers (el ε-tubo los ignora)

**Limitaciones críticas para nuestro caso:**
- Con n=10 (CM biomasa) → SVR en modo regresión tendrá 0 grados de libertad. **Inviable** directamente sobre CM
- Con n=21 (semáforo) y ~8 features → funcionaría solo como SVR de clasificación ordinal, pero está en el límite
- No produce intervalos de confianza nativamente
- No modela estructura temporal interna (dependencia entre meses consecutivos)

**Caso de uso óptimo aquí:** usar sobre la serie larga (aligned_ACO, n=298) con ventana deslizante, o reservar para cuando CM tenga ≥36 meses.

---

### 4.4 SARIMAX (baseline estadístico clásico)

```
(1 - Σφᵢ·Bⁱ)(1 - ΣΦᵢ·B¹²ⁱ)(1-B)^d·(1-B¹²)^D·yₜ = 
(1 + Σθⱼ·Bʲ)(1 + ΣΘⱼ·B¹²ʲ)·εₜ + β·Xₜ
```

donde B es el operador de retardo (Bⁿ·yₜ = yₜ₋ₙ).

- Notación: SARIMA(p,d,q)(P,D,Q)[12] + X de exógenas
- AIC/BIC para seleccionar el orden óptimo
- Supone residuos `εₜ ~ iid N(0,σ²)`

**Para GASB (288 meses):** viable y potencialmente el mejor baseline por tamaño muestral.
**Para CM (10 meses):** inviable. Regla empírica: necesitas ≥3 ciclos completos = 36 meses para estimar la componente estacional (P,D,Q).

---

### 4.5 Tabla comparativa resumen

| Criterio | Prophet | TimesFM | SVR | SARIMAX |
|---|---|---|---|---|
| Datos mínimos viables | ~30 obs | 1 obs (zero-shot) | ~50 obs | ~36 obs |
| Regresores exógenos | Sí, nativo | Limitado | Sí (features) | Sí (ARIMAX) |
| Estacionalidad | Automática (Fourier) | Aprendida (preentrenado) | Manual (features) | Explícita (P,D,Q) |
| Manejo de gaps | Excelente | Bueno | No nativo | Malo |
| Changepoints | Automático | Implícito | No | Manual |
| Intervalo de confianza | Sí (bayesiano) | Sí (cuantiles) | No | Sí (asintótico) |
| Interpretabilidad | Alta | Baja | Media | Alta |
| CM biomasa (n=10) | No directo | Sí (zero-shot) | No | No |
| Semáforo (n=21) | Viable | Sí | Límite | No |
| aligned_ACO (n=298) | Excelente | Bueno | Viable | Excelente |
| Requiere normalidad | No | No | No | Sí (residuos) |
| Complejidad implementación | Baja | Media | Baja | Baja |

---

## 5. Estrategia recomendada por etapas

### Etapa 1 — Modelo inmediato (datos disponibles hoy)

**Target:** `log(aligned_ACO)` → proyectar 6 meses → aplicar lag empírico 1 mes → estimar `log(CM)`

**Método:** Prophet con regresores `month_sin`, `month_cos`, dummy `post_2011`
- Serie de entrenamiento: `aligned_ACO` (298 meses, 2000-03 → 2026-05)
- Changepoint esperado: ~2011 (surgimiento del GASB moderno)
- Comparar con TimesFM zero-shot sobre la misma serie

**Validación:** comparar predicción con semáforo observado (correlación ordinal de Kendall)

### Etapa 2 — Modelo semáforo (clasificador ordinal)

**Target:** `semaforo_mensual` (ordinal 1-6, n=21)

**Features:**
```
X = [ACO_lag1, ACO_lag2, month_sin, month_cos, corriente_playa_carmen_nudos]
```

**Método:** regresión logística ordinal (proporcional-odds) — matemáticamente más apropiada que clasificación nominal porque respeta el orden de los niveles.

**Alternativa**: RandomForest de clasificación con importancia de features (para detectar cuáles predictores importan más).

### Etapa 3 — Modelo completo (cuando CM tenga ≥36 meses, ~2028)

- SARIMAX(p,1,q)(P,1,Q)[12] con ACO como exógena
- SVR-RBF con feature vector completo
- Evaluar con RMSE, MAE, MASE (Mean Absolute Scaled Error — apropiado para series temporales)

---

## 6. Transformaciones previas necesarias

| Variable | Transformación | Razón |
|---|---|---|
| GASB, ACR, ACO, CM (biomasa) | `log(x + 1e-6)` | Distribución lognormal (skew > 2) |
| `viento_norte_nudos` (rango "3-6") | `(min + max) / 2` → float | Convertir rango a punto medio |
| `corriente_*_dir`, `viento_*_dir` | One-hot o sin/cos encoding | Variable categórica circular |
| `semaforo_mensual` | Mapa ESCASO=1 … MUY ALTO=6 | Ordinal numérico |
| `conglomerado_cozumel` | SI=1, NO=0 | Binaria |
| `month` | `sin(2π·mes/12)` y `cos(2π·mes/12)` | Ciclo anual sin discontinuidad |

---

## 7. Métricas de evaluación

| Métrica | Fórmula | Cuándo usar |
|---|---|---|
| **RMSE** | √(mean((ŷ-y)²)) | Regresión biomasa; penaliza outliers |
| **MAE** | mean(\|ŷ-y\|) | Más robusto a outliers que RMSE |
| **MASE** | MAE / MAE_naïve | Escala independiente; compara contra predictor naïve |
| **CRPS** | Scoring de distribuciones probabilísticas | Para Prophet/TimesFM que dan intervalos |
| **Kendall-τ** | Correlación de rangos | Para semáforo ordinal |
| **Accuracy ±1 nivel** | % predicciones dentro de ±1 nivel del real | Métrica operativa para semáforo |

---

## 8. Limitación fundamental y cómo mitigarla

**El problema central:** CM biomasa tiene 23 meses (mejorado desde 10 al recuperar Formatos A/B/C). Ningún modelo supervisado puede aprender una relación generalizable con tan pocos datos.

**Las tres rutas de mitigación:**

1. **Cadena causal con lag**: No predecir CM directamente. Predecir ACO (más datos, buena correlación histórica) y aplicar el lag empírico r=0.938 a 1 mes. La predicción de CM se deriva, no se entrena sobre CM.

2. **Semáforo como target proxy**: 21 meses de etiqueta ordinal es suficiente para un clasificador simple. El semáforo ya codifica el juicio experto de SEMAR sobre la situación real.

3. **Actualización continua**: cada mes que llega un nuevo boletín SEMAR, el modelo mejora. En 12-18 meses adicionales el SARIMAX sobre CM se vuelve viable.

---

## 9. Checklist de tareas antes de entrenar

- [ ] Aplicar log-transform a biomasa y verificar normalidad de residuos (Shapiro, Q-Q)
- [ ] STL decomposition de GASB (trend + seasonal + residual)
- [ ] ADF + KPSS sobre log(GASB) diferenciado para confirmar estacionariedad
- [ ] PACF de GASB para determinar orden p del AR
- [ ] Bai-Perron o PELT para detectar changepoints en GASB (candidato: 2011)
- [ ] Granger causality: log(ACO_lag1) → log(CM)
- [ ] Spearman correlation matrix de todas las features
- [ ] VIF entre corrientes (probable multicolinealidad entre estaciones adyacentes)
- [ ] Codificar viento_nudos_mid, one-hot de direcciones
- [ ] Split temporal: train 2000-2025, test 2026 (nunca random split en series temporales)
- [ ] Evaluar Prophet sobre aligned_ACO (Etapa 1)
- [ ] Evaluar TimesFM zero-shot sobre aligned_ACO (comparación)
- [ ] Evaluar logística ordinal sobre semáforo (Etapa 2)
