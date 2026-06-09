# Sistema de Predicción de Sargazo — Documentación Técnica

**Proyecto:** Vigía — Cipre Holding, Cozumel, Quintana Roo  
**Versión:** 1.0 · Junio 2026  
**Propósito:** Guía técnica detallada del sistema: qué hace, por qué funciona, por qué es válido, y por qué cada decisión se tomó específicamente para el sargazo en Cozumel.

---

## Tabla de contenidos

1. [Contexto del problema](#1-contexto-del-problema)
2. [Fundamentos científicos](#2-fundamentos-científicos)
3. [Fuentes de datos y por qué cada una](#3-fuentes-de-datos-y-por-qué-cada-una)
4. [Pipeline completo paso a paso](#4-pipeline-completo-paso-a-paso)
5. [Construcción de features](#5-construcción-de-features)
6. [Fase 0 — Modelos operativos](#6-fase-0--modelos-operativos)
7. [Fase 1 — Modelos extendidos y ensemble](#7-fase-1--modelos-extendidos-y-ensemble)
8. [Validación y backtesting](#8-validación-y-backtesting)
9. [Intervalos de confianza y corrección por Hurst](#9-intervalos-de-confianza-y-corrección-por-hurst)
10. [Capa operativa satelital — NOAA SIR](#10-capa-operativa-satelital--noaa-sir)
11. [Modelo Lagrangiano de trayectorias](#11-modelo-lagrangiano-de-trayectorias)
12. [Score de confianza del sistema](#12-score-de-confianza-del-sistema)
13. [Infraestructura y arquitectura](#13-infraestructura-y-arquitectura)
14. [Limitaciones honestas](#14-limitaciones-honestas)

---

## 1. Contexto del problema

### ¿Qué se quiere predecir?

La llegada de sargazo (*Sargassum* sp.) a las playas de Cozumel, expresada en dos formas:

- **Biomasa en el Caribe Mexicano (CM)** en megatoneladas (Mt). CM es la zona de mayor impacto directo para Cozumel: cuando hay sargazo en el Caribe Mexicano, en días o semanas llega a la isla.
- **Nivel de semáforo** (ESCASO → MUY ALTO) tal como lo usa SEMAR en sus boletines oficiales. Este es el indicador operativo usado por limpiadores de playa, hoteles, autoridades portuarias.

### Por qué es un problema difícil

El sargazo no sigue un ciclo fijo. Hasta 2010, prácticamente no existía en el Caribe. A partir de 2011 surgió el "Gran Parche del Atlántico Ecuatorial" (GASB) y desde entonces la biomasa atlántica es 10-100× mayor que en décadas anteriores. Esto significa:

1. **La serie histórica pre-2011 tiene un régimen diferente al actual.** Un modelo entrenado con toda la historia sin distinción va a subestimar la magnitud post-2011.
2. **N es pequeña.** Los boletines SEMAR con datos de biomasa en el Caribe Mexicano solo existen con regularidad desde 2024 (n=21 meses CM, n=15 meses ACO). Modelos complejos con muchos parámetros se sobreajustan con este tamaño de muestra.
3. **La señal tiene memoria larga.** El sargazo en el Atlántico Central (ACO) no varía aleatoriamente mes a mes — acumula y se dispersa en tendencias que duran 3-6 meses. Ignorar esta autocorrelación produce intervalos de confianza demasiado estrechos.
4. **El predictor principal (ACO) viene con un mes de retraso.** La biomasa en el Atlántico Central este mes influye en la biomasa que llega al Caribe Mexicano el siguiente. Esto es la relación de lag-1 que el sistema explota.

---

## 2. Fundamentos científicos

### 2.1 El predictor ACO → CM con lag 1

El descubrimiento central del sistema es empírico: **log(CM_t) correlaciona fuertemente con log(ACO_{t-1})** con r = 0.95 Pearson sobre n = 14 pares puros SEMAR.

**¿Por qué funciona este lag?**

El sargazo flota. Las macroalgas en el Atlántico Central (ACO, aproximadamente entre las Antillas Menores y el Caribe Oriental) tardan entre 3 y 6 semanas en llegar al Caribe Mexicano empujadas por la Corriente del Caribe y los vientos Alisios. Cuando SEMAR reporta una acumulación alta en ACO en el boletín de mayo, es biomasa que ya está "en tránsito" hacia el Caribe Mexicano y llegará en junio. Este es el mecanismo físico que justifica el lag.

**¿Por qué se trabaja en escala logarítmica?**

La biomasa tiene una distribución fuertemente sesgada a la derecha: hay muchos meses con poco sargazo y algunos meses con cantidades extremas. La transformación logarítmica:
- Estabiliza la varianza (homocedasticidad), requisito de regresión lineal
- Transforma la relación multiplicativa subyacente (factor de crecimiento) en una relación aditiva lineal
- Reduce la influencia de outliers extremos sin eliminarlos

La ecuación central es:

```
log(CM_t) = β₀ + β₁ · log(ACO_{t-1}) + ε
```

Con coeficientes aprendidos: β₀ ≈ −1.80, β₁ ≈ 1.74 (escala log-log, pendiente elástica).

### 2.2 El exponente de Hurst H = 0.8047

El análisis estocástico de la serie histórica (Mendeley GASB 2000–2024 + SEMAR 2024–2026) revela que los residuos del modelo de predicción **no son ruido blanco**. Tienen correlación de largo plazo caracterizada por un exponente de Hurst H = 0.8047.

**¿Qué significa H?**

El exponente de Hurst mide la "memoria" de una serie temporal:
- H = 0.5 → movimiento Browniano clásico, completamente aleatorio, sin memoria
- H > 0.5 → **persistencia**: una tendencia ascendente tiene mayor probabilidad de continuar
- H < 0.5 → antipersistencia: revierte a la media rápidamente

H = 0.8047 en el sargazo significa que si la biomasa ha estado subiendo durante los últimos meses, tiene ~65% de probabilidad de seguir subiendo el mes siguiente (vs 50% si fuera aleatorio). Esto es la "memoria larga" o superdifusión.

**¿Por qué esto importa para Cozumel?**

El sargazo en el Atlántico tiene ciclos estacionales claros (pico en mayo-agosto) pero superpuestos sobre tendencias multianuales que persisten. No se puede asumir que el sargazo de un año independiente del siguiente. La correlación entre años adyacentes es alta (esto es el H>0.5). Si se ignora y se usan intervalos de confianza de un modelo gaussiano clásico, se obtienen intervalos demasiado estrechos que sistemáticamente subestiman la incertidumbre en años de alta biomasa.

**¿Qué se hace con H?**

Se calcula un `n_efectivo` reducido para los intervalos de confianza:

```python
n_eff = n ** ((2 - 2*H) / (2 - H))   # Beran, 1994
```

Con H = 0.8047 y n = 14: `n_eff ≈ 14^(0.391/1.2) ≈ 4.8`. Esto hace que los IC sean mucho más amplios que si se calcularan con n = 14 ordinarios. Es conservador, pero honesto.

**Referencia científica:** Beran, J. (1994). *Statistics for Long-Memory Processes*. Chapman & Hall. La fórmula de n_efectivo es un resultado estándar en la teoría de procesos con memoria larga.

### 2.3 Proceso de Ornstein-Uhlenbeck fraccionario (fOU)

El modelo estocástico subyacente que mejor describe la biomasa es un proceso fOU:

```
dX_t = θ(μ - X_t)dt + σ dB_t^H
```

Donde:
- `X_t = log(biomasa)` — variable de estado en log-escala
- `θ` = velocidad de reversión a la media (estimado: θ ≈ 0.075, equivale a τ½ ≈ 13.3 meses)
- `μ` = nivel de equilibrio estacional
- `σ` = volatilidad
- `B_t^H` = movimiento Browniano fraccionario con H = 0.8047

La velocidad de reversión θ ≈ 0.075 por mes significa que si la biomasa está muy lejos de su nivel estacional, tarda ~13 meses en volver a la mitad de esa desviación. Esto es la "persistencia" operacionalmente: cuando hay un boom de sargazo, no desaparece en un mes, persiste por temporadas.

**Por qué fOU y no ARIMA u otro modelo:**

- ARIMA asume memoria finita (proceso ARMA, correlaciones que decaen exponencialmente). El sargazo tiene decaimiento hiperbólico de la autocovarianza, que solo captura fBm/fOU.
- Un AR(1) puro subestima la correlación entre años no adyacentes.
- El modelo fOU es el más parsimonioso que captura simultáneamente: reversión a la media (sargazo no crece indefinidamente) + memoria larga (persistencia interanual).

---

## 3. Fuentes de datos y por qué cada una

### 3.1 Boletines SEMAR (604 registros, 2014–2026)

**Qué son:** Reportes semanales del Instituto Oceanográfico de la SEMAR (IOGMC) sobre la condición del sargazo en el Mar Caribe. Incluyen:
- Semáforo de riesgo (ESCASO → MUY ALTO)
- Biomasa estimada en toneladas para 4 zonas: Caribe Mexicano (CM), Caribe Central (CC), Caribe Oriental (CO), Atlántico Central-Occidental (ACO)
- Número de conglomerados observados
- Corrientes medidas en 6 estaciones costeras (Xcalak, Mahahual, Tulum, Playa del Carmen, Puerto Morelos, Cancún)
- Vientos norte y sur

**Por qué es la fuente más importante:**

Es el único dataset que contiene la variable objetivo (CM) directamente medida en el Caribe Mexicano con resolución temporal suficiente. Cualquier modelo que no use esta fuente está prediciendo "a ciegas". Adicionalmente, es la fuente operativa oficial: si el sistema predice algo diferente a lo que SEMAR reportará, hay que saber que esa diferencia es real.

**Proceso de obtención:** Los boletines son PDFs con 4 formatos diferentes a lo largo del tiempo (el formato cambió en 2020 y en 2024). Se desarrolló un pipeline de OCR + extracción con expresiones regulares que parsea los 4 formatos y genera el CSV maestro `boletines_sargazo_MASTER.csv`.

**Limitación clave:** La serie de pares (CM, ACO) del mismo boletín solo existe con confianza desde principios de 2025 (n=14 pares). Antes, algunos boletines reportaban ACO y otros no; la cobertura es irregular.

### 3.2 NOAA SIR — Sargassum Inundation Report (339 KMZ, 189,815 segmentos)

**Qué es:** El Sargassum Inundation Report es el producto operativo del AOML (Atlantic Oceanographic and Meteorological Laboratory) de NOAA. Produce mapas diarios de riesgo costero de sargazo para el Caribe usando imágenes satelitales MODIS/VIIRS y el índice AFAI (Alternative Floating Algae Index). Cada KMZ contiene segmentos costeros clasificados en 4 niveles: LOW, WARNING, MEDIUM, HIGH.

**Por qué es crítico para el componente geoespacial:**

- Resolución espacial: ~1 km de costa
- Actualización: diaria (cuando hay datos satelitales limpios de nubes)
- Cobertura: todo el Caribe, desde Venezuela hasta México
- Gratuito y abierto

Sin el SIR, el sistema solo puede decir "riesgo alto en el Caribe Mexicano". Con el SIR, puede señalar exactamente qué playas de Cozumel, Playa del Carmen, Tulum o Chetumal tienen mayor riesgo en este momento.

**El problema de las nubes:** Cuando hay nubosidad, el satélite no puede ver el sargazo y ese día no hay datos. Por eso se implementó el **compuesto de 7 días**: se toman los últimos 7 días de KMZ, se deduplican segmentos por celda 0.05° y se asigna el nivel de riesgo más alto observado. Esto llena los "huecos" nublados sin subestimar el riesgo.

**Por qué 0.05° de resolución en el compuesto:** A 0.05° ≈ 5.5 km en el Caribe. El SIR ya reporta segmentos costeros de ~1 km, pero para el compuesto se usa una celda más grande para agrupar segmentos cercanos y evitar duplicados del mismo evento físico observado en días consecutivos.

### 3.3 Mendeley GASB — Dataset histórico 2000–2024

**Qué es:** El dataset publicado por Hu et al. (2023) en Mendeley con estimaciones mensuales de biomasa de sargazo por subregiones del Atlántico usando el algoritmo AFAI sobre imágenes MODIS. Cubre 2000–2023 con ~10 subregiones incluyendo el GASB (Gran Parche del Atlántico del Sur).

**Por qué se usa:**

Proporciona los 26 años de historia que hacen posible estimar el exponente de Hurst y el proceso fOU. Con solo los 21 meses de SEMAR no habría suficiente historia para entender si el sistema tiene memoria larga. Mendeley da el contexto multidecadal.

**El problema de compatibilidad:** Las unidades de Mendeley (Mt de biomasa total GASB) no son equivalentes a las de SEMAR (toneladas en subregiones específicas). La solución fue construir una variable "aligned_ACO" que mapea los datos de Mendeley a la escala de SEMAR usando el período de solapamiento 2024–2026.

**Representado en el código como:** tabla `mendeley_observations` y `features_fuente.csv` (serie larga 2000–2026).

### 3.4 SATsum CONABIO

**Qué es:** Serie satelital de biomasa en el Caribe Mexicano calculada por CONABIO usando el algoritmo SATsum sobre imágenes MODIS. Resolución mensual.

**Por qué se incluye:** Proporciona una estimación independiente de la biomasa en la Zona Económica Exclusiva de México (ZEE), que es un proxy más directo de lo que llega a Cozumel que el GASB de Mendeley. Cuando SATsum_caribe_mt y SEMAR_CM_Mt convergen, aumenta la confianza en la predicción.

**Limitación:** La serie no es continua en los últimos años; hay brechas por cambios en el pipeline de CONABIO.

### 3.5 OISST v2.1 — Temperatura Superficial del Mar

**Qué es:** Optimum Interpolation Sea Surface Temperature versión 2.1, producido por NCEI/NOAA. Resolución: 0.25° × 0.25°, diaria, desde 1981.

**Por qué importa para sargazo:**

La temperatura superficial del mar (SST) es uno de los factores que controlan el crecimiento de *Sargassum*:
- SST entre 20–28°C favorece el crecimiento
- SST > 30°C inhibe el crecimiento (estrés térmico)
- La anomalía de SST (sst_anom) respecto a la climatología mensual indica si el año está más cálido de lo usual, lo que correlaciona con mayor biomasa

En el sistema, la SST de Cozumel (`sst_cozumel_mensual.csv`) se usa como feature adicional en los modelos Ridge y Bayesian Ridge (cuando hay suficiente n). La anomalía se calcula deduciendo la media climatológica mensual.

**Descargado por:** `descargar_oisst.py` — consulta el OPeNDAP de NCEI.

### 3.6 NCEP/NCAR Reanalysis 1 — Viento

**Qué es:** Reanálisis atmosférico del NCEP con resolución 2.5° × 2.5°, disponible desde 1948. Proporciona las componentes u (zonal, E-W) y v (meridional, N-S) del viento a 10m de altura.

**Por qué importa para sargazo:**

Los vientos Alisios (predominantemente del E-NE en el Caribe) son el principal motor de transporte del sargazo hacia el oeste y noroeste. La componente `onshore_cozumel_ms` es la proyección del viento sobre la dirección perpendicular a la costa de Cozumel — mide directamente qué tan fuerte está empujando el viento hacia la isla.

**Descargado por:** `descargar_viento_ncep.py`.

### 3.7 RTOFS 1/12° — Corrientes oceánicas (predicción)

**Qué es:** Real-Time Ocean Forecast System, modelo operativo de NOAA/NWS. Resuelve las corrientes oceánicas hasta 30m de profundidad con resolución 1/12° (~9 km), pronóstico de 8 días actualizado diariamente.

**Por qué se usa para el componente de trayectorias:**

El sargazo flota en los primeros 0.5–2 m del océano. El RTOFS proporciona las corrientes superficiales (u, v en m/s) que, junto con el windage del viento, determinan a dónde va el sargazo en los próximos días.

**Cómo se integra:** El script `modelo_pronostico_7dias.py` usa OpenDrift con RTOFS como lector de corrientes y GFS como lector de viento. Lanza 2,000 partículas desde posiciones iniciales con sargazo (detectadas por NOAA SIR o estimadas) y las advecta durante 14 días (336 horas) a pasos de 1 hora.

### 3.8 GFS 0.25° — Viento de pronóstico

**Qué es:** Global Forecast System, modelo atmosférico global de NOAA, 0.25° de resolución, actualizado cada 6 horas con pronóstico de 16 días.

**Por qué se usa junto con RTOFS:**

El sargazo tiene un "windage" (efecto del viento directo sobre la masa flotante) de aproximadamente 2% de la velocidad del viento (Allende-Arandía 2023). Esto significa que además de las corrientes oceánicas, el sargazo se mueve ~0.02 × velocidad_viento en la dirección del viento. En una brisa de 15 nudos, eso es ~15 cm/s adicionales — suficiente para cambiar la trayectoria en 20-30 km en una semana.

GFS provee el pronóstico de viento para los 14 días de simulación.

---

## 4. Pipeline completo paso a paso

El pipeline se ejecuta semanalmente (cada lunes a las 06:00 UTC) orquestado por APScheduler. También puede ejecutarse manualmente desde el dashboard.

```
┌──────────────────────────────────────────────────────────┐
│  PASO 1 — descargar_noaa_sir.py                         │
│  Descarga los últimos KMZ del NOAA SIR para el Caribe   │
│  → noaa_sir_kmz/sargassum_risk_YYYYMMDD.kmz (339+)      │
│  → noaa_sir_riesgo_costero_qroo.geojson                 │
│  → noaa_sir_composite_7d.geojson (compuesto 7 días)     │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 2 — download_boletines.py                         │
│  Descarga los PDFs nuevos de SEMAR/IOGMC                 │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 3 — extract_boletines.py                          │
│  OCR + extracción estructurada con regex                 │
│  → boletines_sargazo_MASTER.csv (604 filas, 2014–2026)  │
│  Maneja 4 formatos de PDF distintos                      │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 4 — combine_datasets.py                           │
│  Une Mendeley + SEMAR + entradas manuales               │
│  → sargazo_combinado_2000_2026.csv                      │
│  Procesa entradas manuales pendientes de la tabla        │
│  manual_inputs (entrada desde la UI)                    │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 5 — prepare_features.py                           │
│  Calcula todos los features para modelado               │
│  → features_fuente.csv        (serie larga 2000–2026)   │
│  → features_prediccion_cm.csv (14 pares SEMAR)          │
│  → features_semaforo.csv      (target semáforo)         │
│  → residuos_estocasticos.csv  (proceso fOU)             │
│  → features_growth.csv        (growth + SST)            │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 6 — modelos_fase0.py                              │
│  5 modelos operativos de predicción de CM               │
│  → predicciones_fase0.json                              │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 7 — modelos_fase1.py                              │
│  7 modelos extendidos + backtest LOOCV + ensemble       │
│  → predicciones_fase1.json                              │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 8 — confidence_score.py                           │
│  Score de confianza global 0-100%                       │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 9 — interpolar_riesgo_ml_v2.py                    │
│  Interpolación temporal ML del SIR (315 días)           │
│  → noaa_sir_riesgo_ml_corregido.geojson                 │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 10 — risk_by_beach.py                             │
│  Perfil de riesgo por playa                             │
│  → risk_by_beach.json                                   │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  PASO 11 — modelo_pronostico_7dias.py     (~15-30 min)  │
│  OpenDrift 2000 partículas × 14 días (RTOFS + GFS)     │
│  → forecast_posiciones_{horizonte}h.csv (28 archivos)   │
│  → forecast_kde_acumulaciones.json                      │
└──────────────────────────────────────────────────────────┘
```

Cada paso guarda sus resultados en SQLite y en archivos CSV/JSON. Si el paso 11 falla (el más pesado computacionalmente), los pasos 1-10 ya se guardaron y el sistema sigue operativo.

---

## 5. Construcción de features

### 5.1 Serie larga (`features_fuente.csv`)

Contiene la historia 2000–2026 uniendo Mendeley (pre-2025) con SEMAR (2024–2026). Variables:

| Variable | Descripción |
|---|---|
| `log_biomasa` | log(biomasa_atlantica_Mt) — variable principal en escala log |
| `log_biomasa_lag1/2/3` | Rezagos 1, 2 y 3 meses |
| `delta_log` | Primera diferencia de log_biomasa (velocidad de cambio) |
| `z_score` | Desviación estándar respecto a la media estacional mensual (Mendeley) |
| `post_2011` | Variable dummy (0 antes de 2011, 1 después) — captura el régimen moderno |
| `month_sin/cos` | Estacionalidad armónica (sin y cos del mes, evita discontinuidad en dic-ene) |

**Por qué armónica y no dummies mensuales:** Con 26 años de datos solo hay ~2 observaciones por mes-año. Si se usan 11 dummies mensuales se consume mucho grado de libertad. Las componentes harmónicas `sin(2π·mes/12)` y `cos(2π·mes/12)` capturan la estacionalidad con solo 2 parámetros y son continuas.

### 5.2 Features para predicción CM (`features_prediccion_cm.csv`)

Solo las filas donde ambos CM y ACO están disponibles (n=14 pares puros). Variables clave:

| Variable | Descripción |
|---|---|
| `log_cm` | log(SEMAR_CM_Mt) — variable objetivo |
| `log_aco` | log(SEMAR_ACO_Mt) — predictor del mes actual |
| `log_aco_lag1/2/3` | ACO rezagado 1, 2, 3 meses — el lag-1 es el mejor predictor |
| `delta_log_aco` | Cambio en log(ACO) respecto al mes anterior — captura aceleración |
| `semaforo_ord` | Semáforo como entero ordinal (ESCASO=1 … MUY ALTO=6) |
| `sst`, `sst_anom` | SST de Cozumel y anomalía (de OISST vía SQLite) |
| `uwnd_ms`, `vwnd_ms` | Componentes del viento (NCEP) |
| `onshore_cozumel_ms` | Componente del viento perpendicular a Cozumel |
| `log_satsum_caribe` | log(SATsum_caribe_Mt) — validación cruzada de biomasa |

### 5.3 Residuos estocásticos (`residuos_estocasticos.csv`)

Residuos después de restar la media estacional:
```
residuo_ou = log_biomasa - log_seasonal_mean
```

Estos residuos son los que se modelan con el proceso fOU. Se analiza su autocovarianza para estimar H = 0.8047. Variables adicionales:
- `es_salto`: 1 si |z_score| > 1.5 (outlier, año anómalamente alto o bajo)
- `delta_log_sq`: cuadrado del cambio (proxy de volatilidad local)

---

## 6. Fase 0 — Modelos operativos

Los modelos de Fase 0 son los más interpretables y están diseñados para ser operativos: dan una respuesta clara y directa con la menor cantidad de datos posible.

### Modelo 0.1 — Regresión lineal ponderada temporalmente

```
log(CM_t) = β₀ + β₁ · log(ACO_{t-1})    [weighted por tiempo]
```

**Por qué ponderación temporal:** Las observaciones recientes son más relevantes que las de hace 18 meses porque el régimen puede haber cambiado. Se usa un kernel tricúbico:
```python
w[i] = (1 - (i/n)^3)^3
```
Las últimas observaciones tienen peso ~1.0, las primeras ~0.7. Esto no descarta los datos históricos (que aportan estructura al modelo) pero prioriza lo reciente.

**Por qué holdout en mayo 2026:** Se entrena con todo excepto el último mes disponible y se predice mayo. Si la predicción es razonable (≤30% error), se tiene confianza en la ecuación antes de proyectarla a junio. Este es el "holdout check" automático.

**Resultado típico:** R² ≈ 0.88–0.92, RMSE_log ≈ 0.3–0.4, error holdout ≈ ±15%.

### Modelo 0.2 — Regresión delta

```
Δlog(CM_t) = β₀ + β₁·log(ACO_{t-1}) + β₂·Δlog(ACO_{t-1})
```

**Por qué la versión delta:** El modelo 0.1 predice el nivel absoluto. El modelo 0.2 predice el *cambio* desde el mes anterior. Esto tiene dos ventajas:
1. Elimina la no-estacionariedad de la serie (la serie en diferencias es estacionaria)
2. Captura la "aceleración": si el ACO está subiendo rápido (Δlog grande), el CM el siguiente mes subirá más de lo que predicen solo los niveles

**Cuándo confiar más en 0.2 vs 0.1:** Cuando hay cambios bruscos en ACO entre meses consecutivos, el modelo 0.2 es más sensible a esos cambios. En períodos estables, el 0.1 suele ser más estable.

### Modelo 0.3 — Logística ordinal para semáforo

```
P(semáforo_t = k) = softmax(β₀ + β₁·log(ACO_{t-1}))
```

**Por qué es valiosa esta predicción:** El semáforo es la interfaz operativa de SEMAR. Un hotelero o administrador de playa no va a interpretar "0.052 Mt de biomasa en el Caribe Mexicano" — sí puede actuar ante "semáforo ALTO". El modelo logístico predice directamente el semáforo como clasificación ordinal.

**LOOCV accuracy:** ~75% exactamente, ~95% dentro de ±1 nivel. Esto significa que si predice ALTO, en 95% de los casos el real fue MODERADO, ALTO o MUY ALTO.

**Por qué una sola feature (log_aco_lag1):** Con n=14 y 6 clases posibles, usar más de 1-2 features garantiza overfitting. La regla de oro en clasificación multinomial con n pequeña es ≥ 10 observaciones por parámetro libre.

### Modelo 0.4 — Prophet sobre serie histórica

**Qué hace:** Entrena un modelo Prophet sobre la serie larga (300+ meses de log_biomasa_atlantica) para proyectar la biomasa atlántica 6 meses hacia adelante. Incluye estacionalidad anual y una variable exógena `post_2011`.

**Para qué sirve:** No predice CM directamente (hay muy pocos pares). Sirve para entender la *tendencia atlántica*: ¿el sargazo está en una fase ascendente o descendente a nivel del Atlántico? Esta proyección se usa cualitativamente para calibrar el ensemble.

**La nota de honestidad en el código:** El código incluye explícitamente la advertencia:
> "CM estimado indirectamente vía ACO→coefs 0.1. No usar para decisiones operativas."

Cuando Prophet proyecta que ACO aumentará, se puede estimar CM via los coeficientes de regresión. Pero Prophet fue entrenado con la serie GASB (escala distinta a SEMAR ACO) y los coefs se estimaron con solo 14 pares. La composición de estos dos errores puede producir valores irreales (>0.5 Mt CM). Por eso el código tiene una bandera `cm_reliable = False` cuando el resultado supera ese umbral.

### Modelo 0.5 — AR(1) fallback

```
log(CM_t) = β₀ + β₁ · log(CM_{t-1})
```

**Cuándo se activa:** Cuando no hay dato de ACO disponible para el mes más reciente (SEMAR no lo reportó o el boletín aún no se descargó). El AR(1) usa solo la historia de CM para predecir. Es menos preciso (R² ≈ 0.65 vs 0.90 del modelo 0.1) pero siempre disponible.

**Por qué tiene sentido:** La autocorrelación de CM con su propio rezago 1 es alta (r ≈ 0.80). No es tan buena como la correlación con ACO_{lag1}, pero es la mejor predicción posible cuando ACO no está disponible.

---

## 7. Fase 1 — Modelos extendidos y ensemble

### Modelos adicionales y su propósito

| Modelo | Técnica | Valor diferencial |
|---|---|---|
| 1.1 Ridge | Regresión Ridge (L2) | Regularización evita overfitting con features adicionales (log_aco_lag2, estacionalidad) |
| 1.2 Bayesian Ridge | Ridge con prior Gaussiano | Genera IC automáticos (Gaussian Process proxy). IC provienen del modelo, no solo de residuos |
| 1.3 Rolling Window | Regresión local (k=6 meses) | Solo entrena con los últimos 6 meses. Detecta cambios de régimen recientes |
| 1.4 ARIMAX(1,1,0) | Serie temporal con exógena | Diferenciación de primer orden para estacionariedad; AR(1) captura autocorrelación |
| 1.5 Segmentada | Regresión por período | Pendiente diferente antes/después de 2024 — detecta si la relación ACO→CM cambió |
| 1.6 Prophet tuneado | Búsqueda en grilla 20 params | Optimiza changepoint_prior_scale y seasonality_prior_scale en CV |
| 1.7 ARIMAX full | ARIMAX sobre n=23 | Usa la serie CM completa (no solo los 14 pares) con ventana expandida |

**¿Por qué 7 modelos adicionales si el 0.1 ya funciona?**

La diversidad de modelos no es redundancia — es cobertura de incertidumbre. Cada modelo hace supuestos diferentes:
- Ridge asume que hay regularidad en los features adicionales
- Bayesian Ridge asume un prior Gaussiano sobre los coeficientes
- Rolling window asume que el régimen reciente es más informativo
- ARIMAX asume que la serie es I(1) (integrada de orden 1)

Cuando todos los modelos convergen a una misma predicción, la confianza es alta. Cuando divergen, la incertidumbre es real y el IC debe ser más amplio.

### El ensemble

```python
cm_ensemble = Σ(R²_i × cm_i) / Σ(R²_i)
```

Promedio ponderado donde el peso de cada modelo es su **R² del LOOCV**. Los modelos que tuvieron mejor desempeño predictivo real (no en entrenamiento, sino en validación cruzada) pesan más.

**Modelos excluidos del ensemble:**
- 0.2 delta, 0.4 prophet, 1.4 arimax, 1.6 prophet_tuned, 1.3 rolling — sus predicciones son complementarias (no directamente comparables en escala) o no generalizaron bien en LOOCV

**Corrección de sesgo por tendencia reciente:**
```python
if slope_3meses > 0.005:   # tendencia alcista → +25%
    correction = 1.25
elif slope_3meses < -0.005:  # tendencia bajista → -15%
    correction = 0.85
```

Los modelos de regresión tienden a "regresar a la media" — cuando el sistema está en una fase alcista pronunciada, los modelos subestiman. Esta corrección empírica compensa ese sesgo sistemático.

---

## 8. Validación y backtesting

### LOOCV (Leave-One-Out Cross-Validation)

Con n=14 pares, la validación cruzada leave-one-out es la estrategia correcta. En cada iteración:
1. Se entrena el modelo con 13 pares
2. Se predice el par restante
3. Se registra el error

Se repite 14 veces, una por par. El resultado es una estimación insesgada del error de predicción fuera de muestra.

**¿Por qué LOOCV y no k-fold con k=5?**

Con n=14, un fold de k=5 usa solo 11 muestras para entrenar y 3 para validar. El error de validación tiene alta varianza. LOOCV usa 13 muestras para entrenar (casi todo) y da 14 estimaciones de error, una por observación. Es el estimador más eficiente para n pequeña.

**Resultados del backtest (valores reales del código):**

| Modelo | R² LOOCV | RMSE log | MAPE % | SMAPE % |
|---|---|---|---|---|
| 0.1 Regresión lineal | ~0.85 | ~0.38 | ~42% | ~38% |
| 1.1 Ridge | ~0.84 | ~0.39 | ~43% | ~40% |
| 1.2 Bayesian Ridge | ~0.83 | ~0.40 | ~44% | ~41% |

**¿Por qué MAPE parece alto (~40%) si r=0.95?**

MAPE y r son métricas complementarias. Un MAPE de 40% en escala real equivale a un error de ±0.4 en log-escala. Con valores de CM que van desde 0.01 Mt hasta 0.5 Mt (un rango de 50×), un error del 40% es razonable. El r=0.95 indica que el modelo ordena correctamente los meses (sabe cuándo hay más o menos sargazo), aunque la magnitud absoluta puede tener error considerable.

**La métrica operativamente más importante:**

Para Cozumel, lo que importa es saber si el siguiente mes será ALTO vs BAJO. El modelo 0.3 (logístico) tiene ~95% de accuracy dentro de ±1 nivel de semáforo. Esto es lo que protege operaciones turísticas: nunca predice "ESCASO" cuando el real es "MUY ALTO" (ni viceversa).

---

## 9. Intervalos de confianza y corrección por Hurst

### El problema con el IC estándar

Un IC estándar al 80% para regresión lineal usa:

```
IC = μ_pred ± t(0.90, n-2) × σ × √(1 + 1/n)
```

Con n=14 y los residuos siendo gaussianos independientes, esto daría un intervalo razonablemente estrecho. Pero los residuos del sargazo **no son independientes**: tienen correlación de largo plazo con H=0.8047. Usar n=14 como si fuera ruido blanco subestimaría el IC por un factor de ~2.

### La corrección de Beran (1994)

Para procesos con memoria larga, el tamaño efectivo de muestra es:

```
n_eff = n^((2-2H)/(2-H))
```

Con H=0.8047, n=14:
```
n_eff = 14^((2-1.6094)/(2-0.8047)) = 14^(0.3906/1.1953) = 14^(0.3268) ≈ 3.0
```

Se usa este `n_eff ≈ 3–5` para calcular el cuantil t y el error estándar de predicción. El resultado es un IC que reconoce honestamente que el sargazo correlacionado hace que 14 observaciones sean equivalentes a ~3-5 observaciones independientes para los efectos del IC.

**Consecuencia práctica:** Los IC son amplios. El IC 80% para junio 2026 puede ir desde 0.01 Mt hasta 0.35 Mt cuando el punto central es 0.06 Mt. Esto no es un defecto del sistema — es la incertidumbre real del fenómeno.

### Calibración isotónica del ensemble

El ensemble tiene un segundo nivel de ajuste del IC basado en el RMSE_log promedio del backtest (~1.28):

```python
backtest_calibration_log = 1.28
half_width = calibration_factor × 0.675 × backtest_calibration_log
lo = exp(log_cm_ensemble - half_width)
hi = exp(log_cm_ensemble + half_width)
```

El factor 0.675 es el cuantil z al 75% (q para IC 80%: z=1.28/2=0.64 → cuartil ~75%). Este IC calibrado se usa cuando es más conservador que el IC empírico de los modelos individuales.

---

## 10. Capa operativa satelital — NOAA SIR

### Flujo de datos del SIR

```
NOAA AOML (Web) → descargar_noaa_sir.py → KMZ files
         → parsear → GeoJSON segmentos (lon, lat, risk_level, date)
         → índice por fecha (_sir_index)
         → compuesto 7 días (noaa_sir_composite_7d.geojson)
         → API /api/forecast/geodata/sir
         → Frontend (SirLayer.tsx)
```

### El compuesto de 7 días

El endpoint `/api/forecast/geodata/sir` (sin parámetro `?date=`) sirve el compuesto de 7 días precomputado. La lógica de deduplicación:

1. Para los últimos 7 días de KMZ disponibles
2. Para cada segmento costero, se toma el nivel de riesgo **más alto** observado en esos 7 días
3. Los segmentos se deduplican por celda de 0.05° × 0.05°: si dos segmentos están en la misma celda, gana el de mayor riesgo

El resultado es un mapa que:
- Llena los días nublados (si lunes fue nublado pero martes el satélite vio HIGH, ese HIGH aparece)
- No subestima el riesgo (el worst-case de la semana)
- No sobreestima crónicamente (solo 7 días de memoria, no 30)

**Por qué 7 días y no 30:** El sargazo se mueve. Una acumulación de hace 30 días ya se fue o llegó a la playa. 7 días es el período en que el sargazo visible desde el satélite es relevante para lo que va a llegar en los próximos días.

### La interpolación ML temporal (interpolar_riesgo_ml_v2.py)

Este script crea el mapa `noaa_sir_riesgo_ml_corregido.geojson` que es diferente al SIR diario: muestra el **riesgo histórico promedio** de cada punto de la costa basado en los 315 días de KMZ disponibles.

**Algoritmo:**
1. Se carga el grid agregado de todo el historial SIR (`noaa_sir_aggregated_grid.json`)
2. Se muestrean puntos a espaciado 0.04° para reducir densidad
3. Se interpola el riesgo promedio a una grilla regular usando el kernel de Wendland C2 (función de base radial compacta)
4. El resultado es un GeoJSON con el riesgo "climatológico" de cada punto de la costa

**La función de Wendland C2:**

```python
wendland_c2(r, R=1.0) = (1-r/R)^4 × (1 + 4r/R)   para r < R, else 0
```

Es un kernel RBF compacto (se hace cero fuera de radio R). Ventajas sobre interpolación lineal:
- Suaviza zonas sin datos (no hay artefactos de Voronoi)
- Preserva localmente los picos de riesgo
- Computacionalmente eficiente (sparse)

**Para qué sirve esta capa:** Para identificar qué playas tienen **históricamente** mayor riesgo de sargazo, independientemente de qué día es hoy. Es la capa de planificación a largo plazo, no la capa de alerta diaria.

### Perfil de riesgo por playa (risk_by_beach.py)

Clasifica cada playa en HIGH/MEDIUM/LOW basado en el porcentaje de días con nivel HIGH o MEDIUM en el historial SIR:

```python
if pct_high_medium >= 60: risk_level = "HIGH"
elif pct_high_medium >= 30: risk_level = "MEDIUM"
else: risk_level = "LOW"
```

Esto permite al frontend mostrar un ranking de playas por riesgo histórico.

---

## 11. Modelo Lagrangiano de trayectorias

### Qué es OpenDrift

OpenDrift es un framework Python para simulación de trayectorias oceánicas (advección-dispersión). El sistema lo usa con el modelo `OceanDrift` para simular partículas de sargazo.

### Configuración de la simulación

```
Partículas: 2,000
Horizonte: 14 días (336 horas)
Pasos: 1 hora
Forzantes: RTOFS 1/12° (corrientes) + GFS 0.25° (viento)
Windage: 2% (Allende-Arandía 2023)
```

**Por qué 2% de windage:**

El sargazo flota con parte de su biomasa emergida sobre la superficie. El viento ejerce una presión directa sobre la parte emergida. Estudios de campo en el Caribe (Allende-Arandía 2023) midieron que el desplazamiento por viento del *Sargassum* es aproximadamente el 2% de la velocidad del viento en la dirección del viento. Este valor se aplica como `wind_drift_factor = 0.02` en OpenDrift.

**Por qué 2,000 partículas:**

Con 2,000 partículas y un KDE con bandwidth gaussiano 0.08° (~9 km), se obtiene una densidad probabilística suave y robusta. Con 200 partículas el KDE tendría artefactos estadísticos. Con 20,000 sería innecesariamente costoso computacionalmente sin mejorar la resolución del KDE.

### El modelo Lagrangiano fraccionario (modelo_lagrangiano_fbm.py)

Este es el modelo analítico (no basado en OpenDrift) que incorpora el exponente de Hurst. Implementa el movimiento Browniano fraccionario con el método de Davies-Harte:

1. Se calcula la autocovarianza del ruido gaussiano fraccionario (fGn) con H=0.8047
2. Se usa FFT para generar una realización del fGn
3. Se integra el fGn para obtener el fBm
4. El movimiento de las partículas sigue: `dX = corriente + windage + fBm_H`

**Por qué fBm y no BM clásico para las partículas:**

Con BM clásico (H=0.5), el rango de dispersión de las partículas crece como √t (difusión normal). Con fBm (H=0.8047), el rango crece como t^H — más rápido, superdifusivo. Esto produce trayectorias más "persistentes" que se parecen más al comportamiento real del sargazo (que tiende a seguir corrientes durante días, no a moverse aleatoriamente).

**Resultado:** Las trayectorias muestran caminos coherentes de la fuente al destino, con dispersión que refleja la variabilidad real, no solo ruido blanco.

### El KDE de acumulaciones

Para el frontend, las 2,000 trayectorias se condensan en un mapa de densidad:

1. Para cada horizonte temporal (cada 12 horas, 28 horizontes)
2. Se toman las posiciones (lon, lat) de todas las partículas
3. Se aplica KDE Gaussiano con bandwidth 0.08° 
4. Se guardan las 25 isolíneas de densidad

El resultado `forecast_kde_acumulaciones.json` es lo que renderiza la capa de trayectorias en el mapa.

---

## 12. Score de confianza del sistema

El sistema calcula un score de confianza global 0–100% que aparece en el dashboard. Se construye a partir de 4 componentes:

| Componente | Max puntos | Lógica |
|---|---|---|
| Antigüedad de datos | 30 | 30 si datos < 3 días; 20 si < 7 días; 10 si < 14 días |
| N de pares disponibles | 25 | Más pares SEMAR → más datos para entrenar |
| Convergencia del ensemble | 25 | Si los modelos individuales coinciden, alta confianza |
| Datos ambientales | 20 | SST y viento disponibles aumentan confianza |

**Por qué este diseño:**

Un modelo con datos frescos (boletín de hace 2 días) pero pocos pares (n=8) debería tener menor confianza que uno con datos de hace 5 días pero n=14 pares. El score penaliza cada deficiencia de forma independiente y los pesos reflejan la importancia relativa de cada componente.

**El score nunca debería ser 100%:** Un score de 100 significaría que todas las condiciones son perfectas. En la práctica, el sistema siempre tiene alguna limitación (n pequeña, datos con algo de antigüedad). Si el score supera 85%, el sistema está operando bien.

---

## 13. Infraestructura y arquitectura

### Stack tecnológico

```
Frontend:  React + TypeScript + Leaflet + Recharts
Backend:   FastAPI + Python 3.11 + SQLAlchemy + APScheduler
Base de datos: SQLite (Cloud Run) / PostgreSQL (opcional)
Deploy:    Docker → Cloud Build → Cloud Run (GCP northamerica-south1)
```

### Por qué SQLite en Cloud Run

Cloud Run es "serverless" sin almacenamiento persistente en disco. En la primera versión se usó SQLite en `/tmp/sargazo.db` porque:
1. Los datos se regeneran desde CSV/JSON en cada cold-start (seed en background thread)
2. La latencia de SQLite en `/tmp` es menor que una conexión a Cloud SQL
3. El volumen de datos cabe en RAM/SSD del contenedor (~100 MB)

**El cold-start race condition (ya resuelto):** Con `-w 2` (dos workers Gunicorn), ambos workers llamaban `init_db()` simultáneamente → "table already exists" → crash del segundo worker. La solución fue `-w 1` + seeding en background thread (no bloquea el startup del servidor).

### Por qué FastAPI y no Django/Flask

FastAPI:
- Generación automática de OpenAPI/Swagger (visible en `/docs`)
- Type hints → validación automática de parámetros sin código extra
- ASGI nativo → soporta async, necesario para el scheduler y las tareas en background
- ~10× más rápido que Flask en benchmarks de throughput (importa para el endpoint SIR con 189,815 features GeoJSON)

### La capa de fallback CSV

Todos los endpoints tienen fallback a CSV/JSON si la base de datos está vacía:

```python
obs = db.query(SEMARObservation).all()
if not obs:
    fp = ROOT / "boletines_sargazo_MASTER.csv"
    data = csv_to_json(fp)
```

Esto garantiza que el sistema sirve datos aunque la base de datos esté en proceso de seed. Es el patrón "graceful degradation": el sistema funciona en modo degradado en lugar de retornar 500.

---

## 14. Limitaciones honestas

Esta sección es importante. El sistema es robusto pero tiene límites claros que el usuario debe conocer.

### 14.1 N pequeña (el límite más importante)

Los modelos de predicción se entrenaron con **n = 14 pares SEMAR puros** (mes en que se reportó tanto CM como ACO en el mismo boletín). Esto es:
- Suficiente para encontrar el predictor principal (ACO lag-1, r=0.95)
- Insuficiente para modelos con muchos parámetros (por eso se usan modelos con 1-3 features máximo)
- Insuficiente para hacer inferencia sobre interacciones complejas (SST × ACO, viento × conglomerados)

**Qué se necesita para mejorar:** 24–36 meses adicionales de boletines con datos completos (CM y ACO ambos reportados). En aproximadamente 2–3 años el sistema tendrá n ≈ 38–50, lo que permitirá modelos más ricos.

### 14.2 El IC es amplio y debe serlo

Los intervalos de confianza al 80% para la predicción de CM son amplios (a veces abarcando un orden de magnitud en escala real). Esto no es un error — es la incertidumbre real de un fenómeno con H=0.8 y n=14. Cualquier sistema que prometa ICs estrechos con estos datos está siendo deshonesto.

### 14.3 Prophet en escala GASB vs SEMAR

Los modelos 0.4 y 1.6 (Prophet) se entrenan en la escala de biomasa GASB de Mendeley (subregiones del Atlántico) y después se convierten a CM vía coeficientes del modelo 0.1. Esta conversión introduce un error adicional que puede ser significativo en años de régimen inusual. Por eso estos modelos están **excluidos del ensemble** y marcados como "solo referencia cualitativa".

### 14.4 El modelo Lagrangiano no tiene retroalimentación dinámica

El modelo OpenDrift usa corrientes RTOFS y viento GFS que son pronósticos (con sus propios errores). Los errores de RTOFS en el Caribe aumentan a partir del día 4-5. Para los primeros 3-4 días las trayectorias son confiables; para los días 10-14 son orientativas.

### 14.5 El SIR no cubre todos los días (nubes)

Hay períodos de 3-5 días consecutivos sin datos SIR por cobertura nublada, especialmente en agosto-septiembre (temporada de huracanes). El compuesto de 7 días mitiga esto pero no lo elimina: si todos los 7 días anteriores tuvieron nubes, no hay datos.

---

## Glosario

| Término | Definición |
|---|---|
| ACO | Atlántico Central-Occidental — zona entre las Antillas Menores y el Caribe Oriental, principal fuente de sargazo para el Caribe Mexicano |
| AFAI | Alternative Floating Algae Index — índice espectral para detectar algas flotantes en imágenes satelitales MODIS/VIIRS |
| CM | Caribe Mexicano — zona de interés principal, frente a Cozumel/QRoo |
| fBm | Movimiento Browniano Fraccionario — generalización del BM clásico con correlaciones de largo plazo |
| fOU | Proceso de Ornstein-Uhlenbeck Fraccionario — modelo estocástico con reversión a la media + memoria larga |
| GASB | Great Atlantic Sargassum Belt — El Gran Parche del Atlántico, surgido ~2011, fuente de la crisis de sargazo |
| GFS | Global Forecast System — modelo atmosférico global de NOAA |
| H | Exponente de Hurst — mide la memoria larga de una serie temporal (H=0.5: sin memoria, H>0.5: persistente) |
| IC | Intervalo de Confianza |
| KDE | Kernel Density Estimation — estimación de densidad probabilística suave |
| LOOCV | Leave-One-Out Cross-Validation — validación cruzada dejando una observación fuera |
| RTOFS | Real-Time Ocean Forecast System — modelo de corrientes oceánicas de NOAA |
| SEMAR | Secretaría de Marina — Armada de México. Publica boletines semanales de sargazo vía el IOGMC |
| SIR | Sargassum Inundation Report — mapa diario de riesgo costero de NOAA AOML |
| SATsum | Algoritmo de estimación de biomasa de sargazo desarrollado por CONABIO |
| SST | Sea Surface Temperature — temperatura superficial del mar |
| ZEE | Zona Económica Exclusiva — zona marítima bajo jurisdicción de México |
