# Compendio Matemático del Proyecto — Predicción Sargazo Cozumel

**Versión:** 12 de Mayo de 2026  
**Autor:** Pipeline automatizado Sargazo AI / OpenCode  
**Ubicación:** `/home/alex/sargazo/`

---

## Tabla de Contenidos

1. [Introducción y definiciones](#1-introducción-y-definiciones)
2. [Pipeline de datos: transformaciones estadísticas](#2-pipeline-de-datos-transformaciones-estadísticas)
   - 2.1 Winsorización P99
   - 2.2 Mediana como agregador mensual
   - 2.3 Lags ACO exclusivamente SEMAR
   - 2.4 Codificación cíclica del mes
   - 2.5 Z-score estacional
   - 2.6 Detección de saltos (z-score > 1.5)
3. [Modelo estocástico del sistema](#3-modelo-estocástico-del-sistema)
   - 3.1 Hurst exponent (R/S analysis)
   - 3.2 fBm (fractional Brownian Motion)
   - 3.3 fOU (fractional Ornstein-Uhlenbeck)
   - 3.4 ARFIMA como análogo discreto
   - 3.5 Fokker-Planck para intervalos de confianza
4. [Correlaciones y cadena causal](#4-correlaciones-y-cadena-causal)
   - 4.1 Matriz de correlaciones SEMAR
   - 4.2 Separación de fuentes: SEMAR vs Mendeley
   - 4.3 Ecuaciones de EDE retardadas
5. [Modelos Fase 0](#5-modelos-fase-0)
   - 5.1 Regresión lineal (0.1)
   - 5.2 Regresión delta (0.2)
   - 5.3 Logística ordinal (0.3)
   - 5.4 Prophet (0.4)
   - 5.5 AR(1) fallback (0.5)
   - 5.6 Ajuste de IC por Hurst
6. [Modelos Fase 1](#6-modelos-fase-1)
   - 6.1 Ridge L2 (1.1)
   - 6.2 Bayesian Ridge (1.2)
   - 6.3 Rolling window tricúbico (1.3)
   - 6.4 ARIMAX(1,1,0) (1.4)
   - 6.5 Regresión segmentada (1.5)
   - 6.6 Prophet tuneado (1.6)
   - 6.7 Ensemble ponderado por R²
   - 6.8 Backtest LOOCV
7. [Modelos Fase 2 — Viento](#7-modelos-fase-2--viento)
   - 7.1 Feature engineering de viento
   - 7.2 Modelos con viento (2.1–2.4)
   - 7.3 Correlación parcial
8. [Modelo Lagrangiano fBm](#8-modelo-lagrangiano-fbm)
   - 8.1 Davies-Harte para fBm
   - 8.2 Corrientes paramétricas del Caribe
   - 8.3 Windage 2%
   - 8.4 Integración temporal
9. [Pronóstico 7 días RTOFS+GFS](#9-pronóstico-7-días-rtofsgfs)
   - 9.1 RTOFS superficial ×1.5
   - 9.2 GFS viento 10 m
   - 9.3 KDE 2D adaptativo
   - 9.4 Bandwidth de Scott
10. [Interpolación ML de Riesgo](#10-interpolación-ml-de-riesgo)
    - 10.1 Kernel Wendland C2 anisotrópico
    - 10.2 Máscara de islas
    - 10.3 BC con SATsum
    - 10.4 Peso Lagrangiano
11. [Datos SATsum y NOAA SIR](#11-datos-satsum-y-noaa-sir)
    - 11.1 Extracción vía PaddleOCR
    - 11.2 NOAA SIR: riesgo costero a 1 km
12. [Métricas de Evaluación](#12-métricas-de-evaluación)
13. [Pronóstico Junio 2026](#13-pronóstico-junio-2026)
14. [Referencias](#14-referencias)

---

## 1. Introducción y definiciones

### Variables fundamentales

| Variable | Descripción | Unidad | Fuente |
|---|---|---|---|
| **GASB** | Great Atlantic Sargassum Belt — biomasa total del cinturón | Mt | Mendeley (2000-2024) |
| **ACO** | Atlántico Caribe Oceánico — GASB frente a costas caribeñas | Mt | SEMAR (2025-2026) |
| **ACR** | Antilles Current Region — corriente de Antillas | Mt | Mendeley |
| **CO** | Caribe Oriental — entrada al Caribe por Antillas | Mt | SEMAR |
| **CC** | Caribe Central | Mt | SEMAR |
| **CM** | Caribe Mexicano — biomasa costera Cozumel/QRoo | Mt | SEMAR |
| **NWGoM** | Northwestern Gulf of Mexico — Golfo de México NO | Mt | Mendeley |

### Transformación fundamental

Toda biomasa $B$ se transforma a logaritmo natural antes de modelar:

$$b = \ln(B + \varepsilon), \quad \varepsilon = 10^{-9}$$

Justificación: las distribuciones de biomasa tienen skewness > 2 y kurtosis > 7 (lognormales típicas de ecología).

---

## 2. Pipeline de datos: transformaciones estadísticas

### 2.1 Winsorización P99

Antes de agregar mensualmente, la biomasa diaria se winsoriza al percentil 99:

$$B_i^* = \min(B_i,\; Q_{0.99})$$

donde $Q_{0.99}$ es el percentil 99 de la columna de biomasa. Esto elimina outliers extremos (se observaron hasta 8.66× la mediana) sin perder información del 99% de los datos.

**Implementación** (`combine_datasets.py:68-70`):
```python
p99 = df[c].quantile(0.99)
df[c] = df[c].clip(upper=p99)
```

### 2.2 Mediana como agregador mensual

La agregación de biomasa diaria a mensual usa **mediana** (no media):

$$\bar{B}_m = \text{median}\{B_d : d \in \text{mes } m\}$$

Razón: outliers extremos (registros de 450,000 ton cuando la mediana es ~52,000 ton) distorsionan la media hasta 8.66×. La mediana es robusta.

**Implementación** (`combine_datasets.py:74`):
```python
num_agg = df.groupby("month")[num_cols].median()
```

### 2.3 Lags ACO exclusivamente SEMAR

Los lags de ACO para predicción de CM se calculan **exclusivamente** con datos SEMAR, evitando contaminación con GASB Mendeley:

$$b_{\text{ACO}}(t-\ell) = \begin{cases}
\ln(\text{SEMAR\_ACO}(t-\ell) + \varepsilon) & \text{si SEMAR\_ACO}(t-\ell) \text{ existe} \\
\text{NaN} & \text{en otro caso}
\end{cases}$$

**Implementación** (`prepare_features.py:134-139`):
```python
semar_aco = semar.dropna(subset=["log_aco"]).set_index("month")["log_aco"]
for lag in [1, 2, 3]:
    semar[f"log_aco_lag{lag}"] = semar["month"].map(
        lambda m, l=lag: _get_lag(semar_aco, m, l)
    )
```

Esto fue crítico: antes se mezclaban datos y la correlación ACO→CM aparecía como r = −0.116 (incorrecta). Con datos SEMAR puros: **r = 0.918** (correcta).

### 2.4 Codificación cíclica del mes

El mes se codifica como par armónico para evitar la discontinuidad dic-ene:

$$m_s = \sin\left(\frac{2\pi \cdot m}{12}\right), \quad m_c = \cos\left(\frac{2\pi \cdot m}{12}\right), \quad m \in \{1,\dots,12\}$$

### 2.5 Z-score estacional

El z-score de una observación $b(t)$ en el mes $m$ se calcula contra la media y desviación histórica del mismo mes (solo datos Mendeley como baseline histórico):

$$z(t) = \frac{b(t) - \mu_m}{\sigma_m}$$

donde $\mu_m = \frac{1}{N_m}\sum_{i: \text{mes}(i)=m} b_i$, $\sigma_m = \sqrt{\frac{1}{N_m-1}\sum_{i: \text{mes}(i)=m} (b_i - \mu_m)^2}$

### 2.6 Detección de saltos (z-score > 1.5)

Un registro es un "salto" si $|z| > 1.5$. El umbral se redujo de $|z|>2$ a $|z|>1.5$ para capturar más eventos (11 detectados vs 0 antes).

---

## 3. Modelo estocástico del sistema

### 3.1 Hurst exponent (R/S analysis)

El exponente de Hurst mide la correlación a largo plazo:

$$H = 0.5 \implies \text{GBM (incrementos iid)}$$
$$H > 0.5 \implies \text{persistencia (memoria larga)}$$
$$H < 0.5 \implies \text{anti-persistencia}$$

**Medido sobre log(GASB):** $H = 0.8047$ — superdifusivo, memoria larga.

**Medido sobre incrementos** $\Delta \log(\text{GASB})$: $H = 0.2963$ — anti-persistente.

Esta combinación (niveles persistentes + incrementos anti-persistentes) es la firma de un **proceso fOU (fractional Ornstein-Uhlenbeck)**.

### 3.2 fBm (fractional Brownian Motion)

El fBm con Hurst $H$ satisface:

$$E[B^H(t) B^H(s)] = \frac{1}{2}\left(|t|^{2H} + |s|^{2H} - |t-s|^{2H}\right)$$

Para $H=0.8047$, la varianza de los incrementos escala como:

$$E[(B^H(t+\Delta t) - B^H(t))^2] = |\Delta t|^{2H}$$

que es superdifusivo (crece más rápido que $\Delta t$).

### 3.3 fOU (fractional Ornstein-Uhlenbeck)

La EDE continua que describe el sistema:

$$d[\log B(t)] = \theta[\mu(t) - \log B(t)]\,dt + \sigma\,dB^H(t)$$

Parámetros estimados:

| Parámetro | Valor | Interpretación |
|---|---|---|
| $\theta$ | $0.075\ \text{mes}^{-1}$ | Velocidad de reversión a la media |
| $\tau_{1/2} = \ln(2)/\theta$ | $9.2$ meses | Vida media — tiempo para revertir 50% de una anomalía |
| $\sigma$ | $1.002\ \text{Mt/mes}^{1/2}$ | Volatilidad de difusión |
| $\mu(t)$ | $\mu_0 + A_1\sin(2\pi t/12) + A_2\cos(2\pi t/12)$ | Media estacional |
| $H$ | $0.8047$ | Exponente de Hurst del fBm conductor |

La diferencia con el OU estándar ($H=0.5$) es que $dB^H$ tiene correlaciones de largo alcance:

$$E[dB^H(t)\,dB^H(s)] = H(2H-1)|t-s|^{2H-2}\,dt\,ds$$

Para $H=0.8047$, $2H-2 = -0.3906$, por lo que la correlación decae como $|\tau|^{-0.39}$ — decaimiento lento.

### 3.4 ARFIMA como análogo discreto

La versión discreta del fOU es ARFIMA(p, d, q) con $d = H - 0.5 = 0.3047$:

$$(1-B)^d \cdot \log B_t = c + \sum_{i=1}^p \phi_i (1-B)^d \log B_{t-i} + \varepsilon_t + \sum_{j=1}^q \theta_j \varepsilon_{t-j}$$

donde $B$ es el operador de retardo y $(1-B)^d$ es el operador de diferenciación fraccionaria:

$$(1-B)^d = \sum_{k=0}^\infty \binom{d}{k} (-B)^k, \quad \binom{d}{k} = \frac{\Gamma(d+1)}{\Gamma(k+1)\Gamma(d-k+1)}$$

Para $d=0.3047$, los coeficientes decaen como $k^{-d-1} = k^{-1.3047}$.

### 3.5 Fokker-Planck para intervalos de confianza

Para el proceso fOU, la distribución de $\log B(t+h)$ dado el estado actual satisface aproximadamente:

$$\frac{\partial p(x,t)}{\partial t} = -\frac{\partial}{\partial x}[\theta(\mu(t)-x)p(x,t)] + \frac{1}{2}\sigma_{\text{eff}}^2(t)\frac{\partial^2 p(x,t)}{\partial x^2}$$

donde $\sigma_{\text{eff}}^2(t) = \sigma^2 \cdot (2H \cdot t^{2H-1})$ depende del tiempo a causa del fBM. Para $H=0.8047$, $2H-1 = 0.6094 > 0$, por lo que la varianza efectiva **crece** con el horizonte — pero más lento que en GBM ($2H-1=0$).

---

## 4. Correlaciones y cadena causal

### 4.1 Matriz de correlaciones SEMAR

Correlaciones calculadas sobre pares de meses consecutivos (gap máximo 45 días), fuente SEMAR exclusivamente:

| Predictor → Target | Lag | n | Spearman $r$ | p | Uso operativo |
|---|---|---|---|---|---|
| **ACO → CM** | 1 mes | 14 | **0.8901** | $2\times10^{-5}$ | Predictor principal |
| **ACO → CM** | 2 meses | 13 | **0.7253** | 0.005 | Mediano plazo |
| CO → CM | 0 (contemp.) | 15 | 0.8321 | $1\times10^{-4}$ | Confirmación tiempo real |
| ACO → CO | 1 mes | 14 | 0.8593 | $1\times10^{-4}$ | Propagación señal |
| CO → CM | 1 mes | 14 | 0.6571 | 0.011 | Predictor secundario |
| **ACO → CM** | 3 meses | 12 | **0.336** | **0.286** | **No significativo** |

**Ventana operativa máxima: 2 meses.** A lag-3 la señal ACO ya no predice CM ($p=0.286$).

### 4.2 Separación de fuentes: SEMAR vs Mendeley

Error crítico corregido: `aligned_CM` en Mendeley = NWGoM (Golfo de México), NO Caribe Mexicano. La correlación GASB→NWGoM es ligeramente negativa ($r \approx -0.14$), mientras que ACO→CM (SEMAR) es $r=0.89$. Mezclar ambas fuentes invertía la correlación.

### 4.3 Ecuaciones de EDE retardadas

El sistema completo como vector de EDE con retardos de transporte:

$$
\begin{aligned}
d[\log \text{GASB}(t)] &= \theta_G [\mu_G(t) - \log \text{GASB}(t)] dt + \sigma_G dB^H(t) \\
d[\log \text{ACR}(t)] &= \theta_A [\log \text{GASB}(t-\tau_1) - \log \text{ACR}(t)] dt + \sigma_A dW_A(t) \\
d[\log \text{ACO}(t)] &= \theta_O [\log \text{GASB}(t-\tau_2) - \log \text{ACO}(t)] dt + \sigma_O dW_O(t) \\
d[\log \text{CM}(t)] &= \theta_C [\log \text{ACO}(t-\tau_3) - \log \text{CM}(t)] dt + \sigma_C dW_C(t)
\end{aligned}
$$

con $\tau_1 \approx \tau_2 \approx \tau_3 \approx 1$ mes. Cada región es "atraída" hacia la región upstream con un retardo de transporte oceánico.

---

## 5. Modelos Fase 0

### 5.1 Regresión lineal (0.1)

**Ecuación:**
$$\ln(\text{CM}_t) = \beta_0 + \beta_1 \cdot \ln(\text{ACO}_{t-1}) + \varepsilon_t, \quad \varepsilon_t \sim \mathcal{N}(0, \sigma^2)$$

**Estimación (n=14, LOOCV):**
- $\hat{\beta}_0 = -1.8037$
- $\hat{\beta}_1 = 1.7396$
- $R^2 = 0.8399$
- $\sigma_{\text{res}} = 1.116$

**Predicción junio 2026:**
$$\ln(\widehat{\text{CM}}_{\text{jun}}) = -1.8037 + 1.7396 \cdot \ln(0.512037) = -2.9681$$
$$\widehat{\text{CM}}_{\text{jun}} = e^{-2.9681} = 0.051403\ \text{Mt} = 51,\!403\ \text{ton}$$

**IC 80%** (ajustado por Hurst, ver 5.6):
$$[e^{-2.9681 - h},\ e^{-2.9681 + h}] = [0.017295,\ 0.152775]\ \text{Mt}$$

### 5.2 Regresión delta (0.2)

**Ecuación:**
$$\Delta\ln(\text{CM}_t) = \beta_0 + \beta_1 \cdot \ln(\text{ACO}_{t-1}) + \beta_2 \cdot \Delta\ln(\text{ACO}_{t-1}) + \varepsilon_t$$

donde $\Delta\ln(X_t) = \ln(X_t) - \ln(X_{t-1})$.

Esta formulación captura **aceleraciones**: no solo el nivel de ACO, sino su cambio reciente.

**Estimación (n=12):**
- $\hat{\beta}_0 = -0.0334$
- $\hat{\beta}_1 = -0.0752$ (efecto nivel — pequeño)
- $\hat{\beta}_2 = 1.3089$ (efecto aceleración — dominante)
- $R^2 = 0.3766$, $\sigma_{\text{res}} = 2.0029$

**Predicción junio 2026:**
$$\Delta\ln(\text{ACO}_{\text{abr}\to\text{may}}) = \ln(0.512037) - \ln(0.339890) = 0.4096$$
$$\widehat{\Delta\ln}(\text{CM}_{\text{may}\to\text{jun}}) = -0.0334 + (-0.0752 \cdot \ln(0.512037)) + (1.3089 \cdot 0.4096) = 0.5533$$
$$\ln(\widehat{\text{CM}}_{\text{jun}}) = \ln(0.051837) + 0.5533 = -2.4063$$
$$\widehat{\text{CM}}_{\text{jun}} = e^{-2.4063} = 0.090145\ \text{Mt} = 90,\!145\ \text{ton}$$

### 5.3 Logística ordinal (0.3)

**Ecuación (proportional odds):**
$$\ln\left(\frac{P(\text{semáforo} \leq k)}{1 - P(\text{semáforo} \leq k)}\right) = \alpha_k + \beta \cdot \ln(\text{ACO}_{t-1})$$

donde $k \in \{1,\dots,6\}$ son los niveles ordinales (ESCASO→MUY ALTO).

**Feature única:** $\ln(\text{ACO}_{t-1})$ — solo 1 predictor para evitar overfitting (n=21).

**LOOCV accuracy:** $0.643 \pm 1$ nivel: $0.929$

**Predicción junio 2026:** Clase MODERADO (53.2%), BAJO (28.1%), ALTO (18.7%)

### 5.4 Prophet (0.4)

**Estructura matemática:**
$$y(t) = g(t) + s(t) + \beta \cdot X(t) + \varepsilon_t$$

donde:
- $g(t)$: tendencia piecewise linear con changepoints automáticos
- $s(t) = \sum_{n=1}^{N} [a_n \sin(2\pi n t / 12) + b_n \cos(2\pi n t / 12)]$: estacionalidad anual (serie de Fourier con N=3)
- $X(t) = \text{post\_2011}$: dummy de cambio de régimen
- $\varepsilon_t \sim \mathcal{N}(0, \sigma^2)$

**Entrenamiento:** 303 meses de `aligned_ACO` (GASB Mendeley 2000-2024 + ACO SEMAR 2025-2026)

**Proyección ACO junio 2026:** 3.8522 Mt

**Estimación indirecta CM julio 2026:**
$$\ln(\widehat{\text{CM}}_{\text{jul}}) = -1.8037 + 1.7396 \cdot \ln(3.8522) = 0.5424$$
$$\widehat{\text{CM}}_{\text{jul}} = e^{0.5424} = 1.720\ \text{Mt}$$

### 5.5 AR(1) fallback (0.5)

**Ecuación:**
$$\ln(\text{CM}_t) = \beta_0 + \beta_1 \cdot \ln(\text{CM}_{t-1}) + \varepsilon_t$$

**Estimación (n=22):**
- $\hat{\beta}_0 = -2.4727$, $\hat{\beta}_1 = 0.5593$
- $R^2 = 0.3026$, $r_{\text{Pearson}} = 0.5501$

**Predicción junio 2026:**
$$\ln(\widehat{\text{CM}}_{\text{jun}}) = -2.4727 + 0.5593 \cdot \ln(0.051837) = -4.1280$$
$$\widehat{\text{CM}}_{\text{jun}} = e^{-4.1280} = 0.016115\ \text{Mt} = 16,\!115\ \text{ton}$$

### 5.6 Ajuste de IC por Hurst

Los intervalos de confianza 80% se ajustan por el exponente de Hurst:

$$h = t_{0.90}(n-2) \cdot \sigma \cdot \sqrt{1 + \frac{1}{n}} \cdot (1 - (H - 0.5))$$

Para $H = 0.8047$, el factor $(1 - (H-0.5)) = 1 - 0.3047 = 0.6953$, lo que **reduce** el ancho del IC en ~30% comparado con el IC gaussiano estándar. Esto refleja que, con memoria larga, las predicciones son más confiables de lo que el error residual crudo sugiere.

---

## 6. Modelos Fase 1

### 6.1 Ridge L2 (1.1)

**Función de costo:**
$$\min_{\beta} \sum_{i=1}^n (y_i - \beta_0 - \mathbf{x}_i^T \beta)^2 + \alpha \|\beta\|_2^2$$

**Features:**
$$\mathbf{x}_i = [\ln(\text{ACO}_{t-1}),\ \ln(\text{ACO}_{t-2}),\ \sin(2\pi m/12),\ \cos(2\pi m/12)]$$

**Estimación (n=13, $\alpha=1.0$):**
- LOOCV $R^2 = 0.7846$, RMSE(log) = 1.2525

**Predicción junio 2026:** 43,930 ton, IC80% = [17,608 — 109,603]

### 6.2 Bayesian Ridge (1.2)

Modelo lineal con priors Gaussianos sobre los coeficientes:

$$y \sim \mathcal{N}(X\beta, \sigma^2 I)$$
$$\beta \sim \mathcal{N}(0, \lambda^{-1} I)$$
$$\sigma^2 \sim \text{Gamma}(\alpha_1, \alpha_2)$$

**Hiperparámetros estimados:** $\lambda = 1.07$, $\alpha = 1.05$

**Predicción junio 2026:** 43,995 ton, IC80% = [6,596 — 293,445]

### 6.3 Rolling window tricúbico (1.3)

Entrena con los últimos $k=6$ meses usando kernel tricúbico:

$$w_j = \left(1 - \left(\frac{j}{k}\right)^3\right)^3, \quad j = 0, 1, \dots, k-1$$

donde $j=0$ es el mes más reciente (peso máximo).

**LOOCV (i ≥ k):** $R^2 = 0.7079$

**Predicción junio 2026:** 201,021 ton (el más alto — refleja tendencia reciente)

### 6.4 ARIMAX(1,1,0) (1.4)

$$(1 - \phi_1 B)(1 - B) \ln(\text{CM}_t) = \beta \cdot \ln(\text{ACO}_{t-1}) + \varepsilon_t$$

**Nota:** modelo no pudo calibrarse bien con n=13 (convergencia inestable). Retornó `null`.

### 6.5 Regresión segmentada (1.5)

$$\ln(\text{CM}_t) = \beta_0 + \beta_1 \ln(\text{ACO}_{t-1}) + \beta_2 \cdot \text{post2024} + \beta_3 \cdot \ln(\text{ACO}_{t-1}) \cdot \text{post2024} + \varepsilon_t$$

En la práctica, **todos los datos son post-2024**, por lo que $\beta_2 = 0$ y el modelo se reduce a la regresión lineal simple (0.1):

$$\ln(\text{CM}) = -1.6983 + 0.8825 \cdot \ln(\text{ACO}_{t-1}), \quad \text{con} \ \beta_1 = 0.8825$$

### 6.6 Prophet tuneado (1.6)

Grid search sobre 40 combinaciones de hiperparámetros:

| Parámetro | Valores probados |
|---|---|
| `changepoint_prior_scale` | 0.001, 0.01, 0.05, 0.1, 0.5 |
| `seasonality_prior_scale` | 0.01, 0.1, 1.0, 10.0 |
| `seasonality_mode` | additive, multiplicative |

**Mejores parámetros:**
- `changepoint_prior_scale = 0.01`
- `seasonality_prior_scale = 0.1`
- `seasonality_mode = additive`
- CV RMSE = 1.8005

### 6.7 Ensemble ponderado por R²

El ensemble combina modelos con peso igual a su $R^2$ de LOOCV:

$$\widehat{\text{CM}}_{\text{ens}} = \frac{\sum_{m} R^2_m \cdot \widehat{\text{CM}}_m}{\sum_{m} R^2_m}$$

| Modelo | $R^2$ LOOCV | Peso | Predicción junio |
|---|---|---|---|
| 1.1 Ridge | 0.7846 | 0.3342 | 43,930 ton |
| 1.2 Bayesian Ridge | 0.7789 | 0.3318 | 43,995 ton |
| 0.1 Regresión lineal | 0.7822 | 0.3331 | 51,403 ton |

$$\widehat{\text{CM}}_{\text{ens}} = \frac{0.7846 \cdot 43930 + 0.7789 \cdot 43995 + 0.7822 \cdot 51403}{0.7846 + 0.7789 + 0.7822} = 46,\!444\ \text{ton}$$

### 6.8 Backtest LOOCV

Leave-One-Out Cross-Validation sobre los 14 pares SEMAR comunes:

| # | Modelo | $R^2$ | RMSE(log) | MAPE(%) | SMAPE(%) |
|---|---|---|---|---|---|
| 1 | 1.1 Ridge | **0.7846** | 1.2525 | 139.50 | 82.40 |
| 2 | 0.1 Regresión lineal | 0.7822 | 1.2593 | 186.82 | 88.68 |
| 3 | 1.2 Bayesian Ridge | 0.7789 | 1.2690 | 142.97 | 84.17 |
| 4 | 0.2 Delta | -0.1877 | 2.2612 | 768.65 | 110.29 |

**Nota:** MAPE alto porque cuando $\text{CM} \to 0$, el error porcentual explota. SMAPE es más robusto.

---

## 7. Modelos Fase 2 — Viento

### 7.1 Feature engineering de viento

| Feature | Definición |
|---|---|
| `wind_onshore` | $\text{viento\_norte\_mid} - \text{viento\_sur\_mid}$ |
| `wind_total` | $\text{viento\_norte\_mid} + \text{viento\_sur\_mid}$ |
| `wind_ratio` | $\text{viento\_norte\_mid} / (\text{viento\_sur\_mid} + 1)$ |
| `aco_x_wind` | $\ln(\text{ACO}_{t-1}) \cdot w_{\text{onshore}}$ |
| `wind_factor` | $\text{sign}(w_{\text{onshore}})$ discretizado |

### 7.2 Modelos con viento (2.1–2.4)

| Modelo | LOOCV $R^2$ |
|---|---|
| 2.1 ACO+wind: $\ln(\text{CM}) \sim \ln(\text{ACO}_{t-1}) + w_{\text{onshore}}$ | 0.770 |
| 2.2 Interacción: $\ln(\text{CM}) \sim \ln(\text{ACO}_{t-1}) \times w_{\text{onshore}}$ | 0.727 |
| 2.3 Viento solo: $\ln(\text{CM}) \sim w_{\text{onshore}}$ | -0.15 |
| 2.4 Ridge+wind: 5 features | 0.441 |

### 7.3 Correlación parcial

$$r_{\text{wind, CM} \mid \text{ACO}} = \text{corr}(\text{resid}_{\text{CM}|\text{ACO}}, \text{resid}_{\text{wind}|\text{ACO}}) = -0.22$$

**Conclusión:** viento del norte no mejora la predicción. El viento es paralelo a la costa este de Cozumel.

---

## 8. Modelo Lagrangiano fBm

### 8.1 Davies-Harte para fBm

**Paso 1:** Autocovarianza del fGn:

$$\gamma(k) = \frac{\sigma^2 \Delta t^{2H}}{2} \left[ |k-1|^{2H} - 2|k|^{2H} + |k+1|^{2H} \right]$$

**Paso 2:** Periodograma: $S_j = \sum_{k=0}^{N-1} \gamma_k e^{-2\pi i j k / N}$

**Paso 3:** Síntesis espectral:

$$X_n = \frac{1}{\sqrt{2N}} \sum_{j=0}^{N-1} \sqrt{S_j} \cdot (Z_j^{(1)} + i Z_j^{(2)}) \cdot e^{2\pi i j n / N}$$

### 8.2 Corrientes paramétricas del Caribe

Base: $u_{\text{caribe}} = -0.3$ m/s (flujo hacia el oeste)
Jet central: $u_{\text{jet}} = -0.5 \cdot \exp[-((\lambda+78)/8)^2] \cdot \exp[-((\phi-17)/4)^2]$
Giro anticiclónico (84°O, 18.5°N): exponencial con radio 3°
Corriente de Yucatán: $v_{\text{yuc}} = 0.6$ m/s hacia el norte entre Yucatán y Cuba

### 8.3 Windage 2%

$$\Delta \mathbf{x}_{\text{wind}} = \alpha \cdot \mathbf{U}_{10} \cdot \Delta t, \quad \alpha = 0.02$$

$\mathbf{U}_{10} = (-5.0, -3.0)$ m/s (alisios del ENE).

### 8.4 Integración temporal

$$\Delta \mathbf{x}_p(t) = \underbrace{\mathbf{U}_{\text{corriente}}(\mathbf{x}_p(t)) \cdot \Delta t}_{\text{OpenDrift}} + \underbrace{\Delta \mathbf{x}_{\text{wind}}}_{\text{windage}} + \underbrace{\sigma_{\text{diff}} \cdot \mathbf{fBM}_p(t) \cdot \Delta t^{H}}_{\text{difusión fBm}}$$

Cada partícula $p$ tiene su propio fBM independiente (bug corregido).

---

## 9. Pronóstico 7 días RTOFS+GFS

### 9.1 RTOFS superficial ×1.5

$$\mathbf{U}_{\text{superficial}} = 1.5 \cdot \mathbf{U}_{\text{barotrópico}}$$

### 9.2 GFS viento 10 m

Resolución 0.25°, 29 pasos (7 días, c/6h). Integrado nativamente en OpenDrift.

### 9.3 KDE 2D adaptativo

Para horizonte $h$:

$$\hat{f}_h(\mathbf{x}) = \frac{1}{N} \sum_{i=1}^{N} K_H(\mathbf{x} - \mathbf{x}_i^{(h)})$$

### 9.4 Bandwidth de Scott

$$H = n^{-1/(d+4)} \cdot \Sigma^{1/2}$$

Para $d=2$: $H = n^{-1/6} \cdot \Sigma^{1/2}$.

---

## 10. Interpolación ML de Riesgo

### 10.1 Kernel Wendland C2 anisotrópico

$$\phi(r) = \begin{cases}
(1 - r/R)_+^4 (1 + 4r/R) & 0 \leq r < R \\
0 & r \geq R
\end{cases}$$

Anisotropía: $\sigma_\lambda = 0.5^\circ$, $\sigma_\phi = 0.1^\circ$, $R_{\text{eff}} = 0.6$.

**Radio efectivo:** ~33 km along-coast, ~7 km cross-coast.

### 10.2 Máscara de islas

$\mathcal{M}(\lambda, \phi) = 0$ para: Yucatán, Cozumel, Isla Mujeres, Cancún, Cuba oeste, Florida sur, Belize/Honduras.

### 10.3 BC con SATsum

$$R(\mathbf{x}) = \alpha(\mathbf{x}) \cdot R_{\text{ML}}(\mathbf{x}) + (1 - \alpha(\mathbf{x})) \cdot \text{SAT}_{\text{bg}}$$

$\alpha(\mathbf{x}) = \exp(-d_{\text{costa}}(\mathbf{x}) / d_0)$ con $d_0 = 0.3^\circ$ (~30 km).

### 10.4 Peso Lagrangiano

$$w_i^{\text{lag}} = 0.3 + 0.7 \cdot \frac{\sum_j \exp(-(|\mathbf{x}_i - \mathbf{x}_j^{\text{lag}}| / 0.5)^2)}{\max_i \sum_j \exp(-(|\mathbf{x}_i - \mathbf{x}_j^{\text{lag}}| / 0.5)^2)}$$

### 10.5 ML Risk Temporal (315 días)

La versión temporal del ML risk utiliza los 315 días completos de datos NOAA SIR (Jul 2025 → May 2026) para construir una distribución de riesgo promedio:

$$\bar{R}(\mathbf{x}) = \frac{1}{N}\sum_{t=1}^{N} R_t(\mathbf{x}), \quad N = 315$$

donde $R_t(\mathbf{x})$ es el riesgo interpolado en la fecha $t$.

**Parámetros del kernel amplificado:**
- $\sigma_\lambda = 0.5^\circ$ (longitudinal, sin cambio)
- $\sigma_\phi = 0.25^\circ$ (latitudinal, amplificado desde $0.1^\circ$)
- $R_{\text{eff}} = 1.8$ (radio efectivo amplificado desde $0.6$)

**Resultado:** 582 celdas activas — LOW(122), WARNING(164), MEDIUM(218), HIGH(78).

Este enfoque reemplaza el uso de una sola fecha (último KMZ disponible) por el promedio temporal completo sobre 315 días, eliminando el sesgo de instantánea y dando una visión más robusta del riesgo histórico.

---

## 11. Datos SATsum y NOAA SIR

### 11.1 Extracción vía PaddleOCR

Endpoint: `https://ai.api.nvidia.com/v1/cv/baidu/paddleocr`

| Región | Puntos | Período |
|---|---|---|
| Mar Caribe | 172 | 2012-01 → 2026-04 |
| ZEE Mexicana | 179 | 2011-01 → 2026-04 |

### 11.2 NOAA SIR: riesgo costero a 1 km

315 KMZ, 19,445 polígonos QRoo, 4,466 celdas ML interpoladas.
Distribución Cozumel: 592 WARNING, 455 MEDIUM, 487 LOW.

---

## 12. Métricas de Evaluación

| Métrica | Fórmula |
|---|---|
| RMSE | $\sqrt{\frac{1}{n}\sum (\hat{y}_i - y_i)^2}$ |
| MAE | $\frac{1}{n}\sum \|\hat{y}_i - y_i\|$ |
| $R^2$ | $1 - \frac{\sum (\hat{y}_i - y_i)^2}{\sum (y_i - \bar{y})^2}$ |
| SMAPE | $\frac{200\%}{n}\sum \frac{\|y_i - \hat{y}_i\|}{\|y_i\| + \|\hat{y}_i\|}$ |

---

## 13. Pronóstico Junio 2026

| Modelo | CM (ton) | IC80% |
|---|---|---|
| 0.1 Regresión lineal | 51,403 | [17,295 — 152,775] |
| 0.2 Delta | 90,145 | [12,335 — 658,778] |
| 0.5 AR(1) | 16,115 | [2,057 — 126,264] |
| 1.1 Ridge | 43,930 | [17,608 — 109,603] |
| 1.2 Bayesian Ridge | 43,995 | [6,596 — 293,445] |
| 1.3 Rolling (k=6) | 201,021 | [61,887 — 652,953] |
| 1.5 Segmentada | 56,148 | [17,494 — 180,209] |
| **Ensemble** | **46,444** | **[6,596 — 293,445]** |

**Contexto:** CM mayo 2026 = 51,837 ton. ACO se triplicó de 0.14 Mt (ene) a 0.51 Mt (may).

---

## 14. Referencias

1. Allende-Arandía et al. (2023). *JGR Oceans*, 128, e2023JC019893. — Windage 2%, Lagrangianas
2. Hu et al. (2023). *Remote Sensing of Environment*, 296, 113740. — Dataset Mendeley
3. De Amorim et al. (2025). *Marine Pollution Bulletin*. — Transporte Amazonas→Caribe
4. Mandelbrot & Van Ness (1968). *SIAM Review*, 10(4), 422-437. — fBm
5. Davies & Harte (1987). *Biometrika*, 74(1), 95-101. — Simulación fBm
6. Taylor & Letham (2018). *The American Statistician*, 72(1), 37-45. — Prophet
7. Dagestad et al. (2018). *GMD*, 11, 1405-1420. — OpenDrift
8. NOAA SIR: https://cwcgom.aoml.noaa.gov/SIR/
9. SATsum CONABIO: https://simar.conabio.gob.mx/sargazo/
10. Wendland (1995). *Advances in Computational Mathematics*, 4, 389-396. — Kernel Wendland C2

---

*Fin del compendio matemático — 12 de Mayo de 2026, 23:45 UTC*
