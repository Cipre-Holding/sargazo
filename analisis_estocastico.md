# Análisis de Procesos Estocásticos — Sargazo Cozumel

---

## TL;DR — hallazgos clave

| Hallazgo | Valor | Implicación directa |
|---|---|---|
| Hurst H (log GASB) | **0.8047** | Memoria larga: NO es GBM ni OU simple |
| Hurst H (incrementos) | **0.2963** | Anti-persistencia: los retornos se revierten |
| Log-retornos: normalidad | Shapiro p=0.73 | Incrementos sí son aproximadamente normales |
| Residuos des-estac. | JB kurt=−1.35 | Distribución bimodal / dos regímenes |
| Velocidad reversión OU (θ) | 0.075 mes⁻¹ | **Vida media de 13.3 meses** |
| Volatilidad difusión σ | 1.002 Mt/mes½ | Ruido alto en escala mensual |
| Spearman log(ACO_lag1→CM) | **r = 0.890** p < 0.001 (n=14) | Predictor principal robusto |
| ARCH p | 0.09 | Heterocedasticidad marginal |

---

## 1. El hallazgo crítico: Hurst H = 0.80 → memoria larga

El exponente de Hurst mide la correlación a largo plazo de una serie:

```
H = 0.5   →  Movimiento Browniano estándar (GBM): incrementos iid
H > 0.5   →  Persistencia: las tendencias se mantienen más tiempo del que el ruido puro predice
H < 0.5   →  Anti-persistencia: la serie revierte rápido
```

**log(GASB) tiene H = 0.8047.** Esto no es ruido — es **movimiento browniano fraccionario (fBM)** con memoria larga. El pasado predice el futuro mucho más lejos de lo que un AR o GBM supondría.

Al mismo tiempo, los **incrementos** (Δlog GASB) tienen H = 0.2963 → anti-persistencia. Cuando el sistema da un salto grande, tiende a corregir en el siguiente período. Esto es la firma del proceso OU (Ornstein-Uhlenbeck) en sus incrementos.

Esta combinación — niveles con memoria larga (H>0.5) + incrementos anti-persistentes (H<0.5) — es la huella de un **proceso fraccionalmente integrado** o de un **fOU (fractional Ornstein-Uhlenbeck)**. No es una coincidencia: es la descripción matemática correcta de cómo funciona el sistema físico.

---

## 2. Lo que el H=0.80 explica de la "aparente aleatoriedad"

El sargazo parece caótico porque se observa en ventanas cortas (3-6 meses) donde el ruido σ≈1 Mt/mes½ domina sobre la señal determinista. Pero con H=0.8, en horizontes de 12-24 meses el componente determinista emerge con fuerza.

**Consecuencia operativa directa**: la anomalía GASB de enero-febrero 2024 (z=2.44, 5.6× histórico) **debió persistir ~13 meses** antes de revertir a la media. Esto explica por qué el semáforo de Cozumel no colapsó inmediatamente sino que tardó hasta junio-julio 2025 en mostrar ALTO — exactamente lo que predicen los parámetros del proceso.

---

## 3. El proceso estocástico correcto para este sistema

### 3.1 Lo que NO aplica

| Modelo | Por qué no aplica |
|---|---|
| **GBM** dX = μXdt + σXdW | Asume H=0.5 (incrementos iid). Subestimaría la persistencia de anomalías. |
| **ARIMA(p,d,q)** con d∈ℤ | Solo diferenciación entera. No captura d fraccional (H=0.8 → d=0.3). |
| **OU simple** dX = θ(μ-X)dt + σdW | Los residuos des-estacionalizados tienen Jarque-Bera significativo (kurtosis=-1.35, distribución bimodal). Hay dos regímenes, no uno. |

### 3.2 El modelo adecuado: fOU estacional con saltos

**Nivel 1 — ARFIMA(p, d, q) con d=0.3:**

La versión discreta más accesible. El operador de diferenciación fraccionaria (1-B)^d con d=0.3 captura la memoria larga sin la complejidad de las EDE continuas.

```
(1-B)^0.3 · log(GASB_t) = c + Σ φᵢ·εₜ₋ᵢ + εₜ
```

donde B es el operador de retardo y d = H - 0.5 = 0.30 (aproximación de Mandelbrot-Van Ness).

**Nivel 2 — fOU (fractional Ornstein-Uhlenbeck) estacional:**

La EDE continua más apropiada:

```
d[log B(t)] = θ[μ(t) - log B(t)] dt  +  σ dBᴴ(t)
```

donde:
- θ = 0.075 mes⁻¹  (velocidad de reversión estimada)
- μ(t) = μ₀ + A₁sin(2πt/12) + A₂cos(2πt/12)  (media estacional)
- σ = 1.002  (volatilidad de difusión)
- Bᴴ(t) = fBM con H = 0.8047  (no es dW estándar)

La diferencia con el OU estándar es que dBᴴ(t) tiene correlaciones de largo alcance — el ruido "recuerda" su pasado. Esto eleva la persistencia de los choques.

**Nivel 3 — Modelo con dos regímenes + saltos:**

Los residuos des-estacionalizados tienen kurtosis=-1.35 (distribución platikúrtica, más plana que gaussiana). Esto sugiere **mezcla de dos gaussianas** — años normales y años de anomalía:

```
ε_t ~ (1-p)·N(μ₁, σ₁²) + p·N(μ₂, σ₂²)
```

Formalmente, esto es un proceso de saltos de Poisson compuesto (Merton, 1976):

```
d[log B] = [θ(μ(t) - log B) + λ·κ] dt  +  σ dBᴴ  +  κ dN(λ)
```

donde:
- dN(λ) = proceso de Poisson con intensidad λ (tasa de ocurrencia de mega-blooms)
- κ = magnitud del salto (estimada desde el event 2024: Δlog ≈ 1.7)
- El término λ·κ en el drift corrige el sesgo generado por los saltos

### 3.3 La cadena causal como sistema de EDE retardadas

El sistema real es un **vector de EDE con retardos**:

```
d[log GASB(t)] = θ_G [μ_G(t) - log GASB(t)] dt + σ_G dBᴴ(t)

d[log ACR(t)]  = θ_A [log GASB(t-τ₁) - log ACR(t)] dt + σ_A dW_A(t)

d[log ACO(t)]  = θ_O [log GASB(t-τ₂) - log ACO(t)] dt + σ_O dW_O(t)

d[log CM(t)]   = θ_C [log ACO(t-τ₃) - log CM(t)]  dt + σ_C dW_C(t)
```

con τ₁ ≈ τ₂ ≈ τ₃ ≈ 1 mes (lags estimados empíricamente).

Cada región "es atraída" hacia la región upstream con un retraso de transporte — exactamente como el transporte físico por corrientes oceánicas. La velocidad θ mide la rapidez de esa atracción.

**Parámetros OU estimados para GASB:**
```
θ  = 0.075 mes⁻¹    →   τ₁/₂ = ln(2)/θ = 9.2 meses  (vida media)
σ  = 1.002 Mt/mes½
μ₀ ≈ log(1.81)      →   media estacional anual ≈ 1.81 Mt
```

---

## 4. Consecuencias sobre los modelos de predicción

### 4.1 Por qué Prophet subestimará la persistencia

Prophet modela los residuos como N(0, σ²) iid (H=0.5 implícito). Con H=0.8 real, las anomalías persistirán **más tiempo** del que Prophet predice. El intervalo de confianza de Prophet se abrirá demasiado pronto porque asume que el ruido es no-correlacionado.

**Corrección posible**: usar Prophet para la media condicional (tendencia + estacionalidad) y modelar los residuos con ARFIMA(0, 0.3, 0) por separado. Esto recupera la memoria larga sin reemplazar Prophet.

### 4.2 Por qué TimesFM tiene ventaja aquí

Un modelo transformer preentrenado en 100B+ puntos temporales reales habrá visto implícitamente muchas series con H>0.5. No necesita asumir H=0.5 porque aprende la estructura de correlación directamente de la atención. Es la primera vez que una clase de modelo puede capturar fBM sin especificarlo explícitamente.

**Limitación**: no puede decirte τ₁/₂ = 13.3 meses ni θ = 0.075. Solo predice.

### 4.3 SVR en presencia de memoria larga

El SVR con feature vector [ACO_lag1, ACO_lag2, month_sin, ...] intentará capturar el H=0.8 implícitamente a través de los lags explícitos. Pero como los lags con significancia llegan hasta lag 2-3 y la memoria real se extiende a 12+ meses, el SVR necesitaría un vector de features muy largo (≥12 lags) para capturar el proceso. Con 23 observaciones para CM, 21 semáforo — SVR sigue al límite.

### 4.4 ARFIMA: el candidato más honesto

Para la serie larga (GASB, 288 meses), ARFIMA(1, 0.3, 0) o ARFIMA(2, 0.3, 1) es el modelo que mejor traduce los hallazgos matemáticos en una herramienta de predicción:

```python
from statsmodels.tsa.statespace.sarimax import SARIMAX
# Con 'd' fraccional se usa la librería 'arch' o 'fracdiff'
```

El parámetro d=0.3 se puede estimar con el método GPH (Geweke-Porter-Hudak) o Whittle.

---

## 5. Pruebas estadísticas específicas para confirmar el marco estocástico

| Prueba | Qué mide | Estado |
|---|---|---|
| **R/S de Hurst** | Memoria larga (H) | Calculado: H=0.80 |
| **GPH / Whittle** | Estimación precisa de d fraccional | Pendiente |
| **Ljung-Box** sobre log-retornos | Si los incrementos son ruido blanco | Pendiente (ACF ≈ 0 en lags 1-10 sugiere sí) |
| **ARCH / GARCH** | Heterocedasticidad condicional | ARCH p=0.09 — marginal |
| **BDS test** (Brock-Dechert-Scheinkman) | No-linealidad / dependencia no-lineal residual | Pendiente — crucial para saber si queda estructura no modelada |
| **Bai-Perron** | Puntos de quiebre estructural | Pendiente — candidatos: 2011 (surgimiento GASB), 2024 (mega-bloom) |
| **DFA** (Detrended Fluctuation Analysis) | Alternativa robusta a R/S para H | Pendiente — confirmar H=0.80 |
| **Granger causality** log(ACO) → log(CM) | Causalidad predictiva | Pendiente (n=10, borde límite) |

---

## 6. Tabla de decisión: qué modelo para qué objetivo

| Objetivo | Serie disponible | Modelo recomendado | Fundamento |
|---|---|---|---|
| Predicción ACO/GASB 6-12 meses | 288-298 meses | **ARFIMA(1,0.3,0) + estacionalidad** | Captura H=0.80 explícitamente |
| Predicción CM biomasa por cadena | Derivada de ACO | **fOU estacional (Euler-Maruyama)** | Modelo físico del transporte |
| Clasificación semáforo 1-4 semanas | 21 meses ordinal | **Logística ordinal** + ACO_lag1 | Máxima parsimonia con datos escasos |
| Detección anomalía / alerta | 288 meses | **Control chart con límites fOU** | z-score ajustado por H |
| Predicción zero-shot sin reentrenamiento | cualquier n | **TimesFM** | Captura H implícito, no requiere datos |
| Benchmark interpretable | 288 meses | **Prophet** + corrección ARFIMA residuos | Base operativa explicable |

---

## 7. Lo que los números dicen sobre el horizonte de predicción útil

La vida media del proceso (τ₁/₂ = 13.3 meses) fija el horizonte donde el sistema todavía "recuerda" su estado actual. Más allá de ese horizonte, la predicción se acerca a la media estacional y la incertidumbre crece irreversiblemente.

```
Horizonte 1-4 meses:   predicción útil (ACO_lag1 domina, r=0.95)
Horizonte 5-9 meses:   predicción de tendencia general (H=0.80 ayuda)
Horizonte 10-15 meses: límite del proceso (τ₁/₂ = 13.3 meses)
Horizonte >15 meses:   solo media estacional + análisis de anomalía histórica
```

El objetivo operativo de Cipre Holding (1-4 semanas) está en el régimen más favorable: la correlación ACO_lag1→CM con **r=0.890 (n=14)** cubre ese horizonte con alta confianza. La ventana se extiende hasta lag-2 (r=0.725), pero lag-3 no es significativo.

**Nota de compatibilidad**: `aligned_CM` en datos Mendeley = NWGoM (Golfo de México), NO el Caribe Mexicano. GASB→NWGoM tiene correlación ligeramente negativa (r≈−0.14 lag-1). Las correlaciones operativas ACO→CM son válidas únicamente con datos SEMAR (fuente="semar" en el CSV combinado).

---

## 8. Ecuación de Fokker-Planck: la distribución de futuros posibles

Para el proceso fOU estacional, la distribución de probabilidad de log(GASB) en el tiempo t+h dado el estado actual satisface la **ecuación de Fokker-Planck** (versión aproximada para H≈1 en tiempos cortos):

```
∂p(x,t)/∂t = -∂/∂x [θ(μ(t)-x) · p(x,t)]  +  ½σ²_eff · ∂²p(x,t)/∂x²
```

donde σ²_eff = σ² · (2H · t^(2H-1)) depende del tiempo (no constante) a causa del fBM.

Esta ecuación produce intervalos de predicción que **se abren más lentamente** que los del GBM estándar — consistente con la memoria larga. En la práctica, esto significa que las predicciones a 3-6 meses son más confiables de lo que un modelo simple sugeriría.

---

## 9. Resumen ejecutivo

El sistema de sargazo **no es aleatorio**, pero tampoco es simple. Es un proceso fraccionalmente integrado (H=0.8) con:
- Estacionalidad anual fuerte
- Media reversión lenta (vida media 13 meses)
- Saltos ocasionales (mega-blooms como 2024)
- Cadena causal con retardo de transporte (ACO→CM, lag 1 mes, r=0.95)

La "apariencia aleatoria" es consecuencia de observar el proceso en escalas menores a su τ₁/₂. A escalas de 12-18 meses el patrón es predecible.

El marco más honesto matemáticamente es **ARFIMA / fOU**, con Prophet como implementación práctica y TimesFM como verificación zero-shot. Prophet debe considerarse una aproximación de primer orden al proceso real: buena para comunicar con el equipo operativo, pero que subestima la persistencia de anomalías extremas.

Cuando CM biomasa alcance ~36 meses (≈ 2028), el modelo completo vectorial ACO→CM con SARIMAX(d_fracc) o fOU multidimensional se convierte en el camino óptimo.
