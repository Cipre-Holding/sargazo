# Metodología Científica, Datos y Validación — Sargazo Cozumel

Este documento recopila el sustento científico, papers de referencia, variables evaluadas y descartadas, lecciones de depuración y las metodologías de validación del sistema predictivo.

---

## 1. Literatura Científica de Referencia (Papers Base)

El diseño físico y predictivo de este sistema se fundamenta en los siguientes estudios y bases científicas:

1. **Allende-Arandia et al. 2023 — JGR Oceans — Lagrangian Characterization of Surface Transport**
   * *Aporte*: Valida la parametrización de deriva superficial en el Caribe Mexicano. Confirma el uso del coeficiente de arrastre del viento (*windage*) del **2%** y la trayectoria de corrientes hacia Cozumel. Sirve de base física para justificar el retardo causal entre la biomasa acumulada en el Atlántico Central y su arribo al Caribe Mexicano (ACO → CM).
2. **Hu et al. 2023 — Remote Sensing of Environment — GASB Dataset**
   * *Aporte*: Creadores del dataset *Great Atlantic Sargassum Belt (GASB)*, que cubre 288 meses de observaciones en 6 subregiones atlánticas. Explica la implementación de la red neuronal Res-UNet sobre imágenes satelitales MODIS/VIIRS para extraer el índice de algas flotantes AFAI (Alternative Floating Algae Index).
3. **De Amorim et al. 2025 — Harmful Algae — Transporte Amazonas-Caribe**
   * *Aporte*: Valida el mecanismo de transporte de sargazo desde la pluma del río Amazonas hacia el Caribe impulsado por la Corriente del Norte de Brasil (NBC), la corriente de Guyana y la Corriente del Caribe.
4. **Cerdeira-Estrada et al. 2025 — SATsum CONABIO**
   * *Aporte*: Describe el funcionamiento del sistema de monitoreo satelital SATsum de la CONABIO en México. Utiliza imágenes MODIS a resolución de 1 km para la detección operativa local de acumulaciones.
5. **Mandelbrot & Van Ness 1968 — Fractional Brownian Motion (fBm)**
   * *Aporte*: Sustento matemático para el modelado del movimiento estocástico de las partículas. Justifica el valor del exponente de Hurst ($H = 0.8047$) obtenido en el análisis de series temporales de sargazo, confirmando que el proceso tiene memoria persistente a largo plazo.
6. **Davies & Harte 1987 — Simulación de fBm**
   * *Aporte*: Método matemático eficiente para simular series de tiempo y desplazamientos fraccionales brownianos con covarianza exacta.
7. **Dagestad et al. 2018 — OpenDrift GMD**
   * *Aporte*: Presentación de la arquitectura de simulación lagrangiana de código abierto OpenDrift utilizada para calcular el pronóstico de trayectorias.
8. **Wendland 1995 — Kernel C2 para Interpolación**
   * *Aporte*: Define las funciones de base radial compactas (CSRBF), específicamente el kernel Wendland C2, que se utiliza en la capa de riesgo ML para lograr una interpolación geoespacial robusta sin singularidades.

---

## 2. Variables y Modelos Descartados

Durante el proceso de investigación y modelado predictivo, se descartaron varios enfoques tras comprobar que reducían la precisión o no eran viables matemáticamente:

* **Viento como predictor directo en la predicción de biomasa (Fase 2)**:
  * *Razón*: Se encontró una correlación parcial débil e inversa ($r = -0.22$). El viento norte dominante es paralelo a la costa este de Cozumel, por lo que no genera un empuje perpendicular hacia las playas (*onshore*). Además, SEMAR no desglosa arribos este/oeste. El modelo que combinaba ACO + viento dio un $R^2 = 0.77$, inferior al modelo de solo ACO ($R^2 = 0.78$).
* **Temperatura Superficial del Mar (SST)**:
  * *Razón*: Aportaba un incremento marginal de $R^2$ de apenas $+2.7\%$ sobre la variable ACO con lag de 1 mes. Se le asignó prioridad muy baja (P9) y se excluyó para mantener la parsimonia del modelo.
* **Modelos ARIMAX con muestra pequeña**:
  * *Razón*: No lograron converger con el tamaño de muestra histórico inicial ($n = 13$), retornando valores nulos. Requieren series de tiempo más extensas ($n \ge 24$).
* **Prophet Multiplicativo**:
  * *Razón*: La estacionalidad aditiva obtuvo mejor ajuste sistemático. El modo multiplicativo fue eliminado del grid search de hiperparámetros.
* **Movimiento Browniano Geométrico (GBM)**:
  * *Razón*: GBM asume que los incrementos son independientes ($H = 0.5$, ruido blanco), pero la serie temporal real del sargazo muestra una memoria persistente y de largo plazo muy alta ($H = 0.80$).
* **ARIMA con diferenciación entera ($d$)**:
  * *Razón*: No captura la naturaleza de integración fraccional de la serie ($d = 0.3047$).
* **Proceso de Ornstein-Uhlenbeck (OU) simple**:
  * *Razón*: Los residuos del modelo eran bimodales, lo que delató la presencia de dos regímenes de arribo distintos (temporada alta vs baja) que el modelo simple no podía separar.

---

## 3. Lecciones y Errores Depurados en el Pipeline

Se corrigieron varios sesgos críticos de alineación y procesamiento de datos que afectaban gravemente el rendimiento del modelo:

* **Mezcla de Lags (Mendeley GASB + SEMAR ACO)**:
  * *Error*: Al combinar lags cruzados entre la serie histórica de Mendeley y los reportes recientes de SEMAR, la correlación original se invertía y se desplomaba de $r = 0.918$ a $r = 0.47$.
  * *Corrección*: Se aisló el cálculo de lags temporales exclusivamente a partir de la serie de boletines homogéneos de SEMAR.
* **Confusión de Regiones (aligned_CM vs NWGoM)**:
  * *Error*: El dataset de Mendeley denominaba `aligned_CM` a una región que en realidad correspondía al Noroeste del Golfo de México (NWGoM), no al Caribe Mexicano (CM). Mapear GASB contra esta serie daba una correlación errónea de $r = -0.14$.
  * *Corrección*: Se realinearon y verificaron las coordenadas espaciales para garantizar la correspondencia exacta con el Caribe Mexicano.
* **Inflación de Correlación por Muestra Pequeña**:
  * *Error*: Un tamaño de muestra muy reducido de solo $n = 9$ puntos inflaba artificialmente la correlación de Pearson a $r = 0.95$.
  * *Corrección*: Al expandir y limpiar la serie de datos a $n = 14$ puntos de control validados, la correlación se corrigió a un valor real y robusto de $r = 0.89$.
* **Tratamiento de Outliers de Biomasa**:
  * *Error*: Las lecturas extremas de biomasa mensual alcanzaban picos atípicos de hasta 82,699 toneladas que distorsionaban las regresiones.
  * *Corrección*: Se aplicó un filtro de winsorización al percentil 99 (P99) y escalado basado en medianas robustas.

---

## 4. Metodologías de Backtesting y Validación

El rendimiento y fiabilidad del sistema se evalúan mediante dos enfoques de validación cruzada:

### A. Ventana Expandible (Expanding Window)
Implementado en `backtest_modelos.py` para medir el desempeño simulando una predicción real mes a mes:
* Para cada mes disponible con datos reales de biomasa en el Caribe Mexicano (abril 2025 → mayo 2026, $n = 14$):
  * Paso $i=3$: entrena con meses `[0, 1, 2]` y predice el mes `[3]`.
  * Paso $i=4$: entrena con meses `[0, 1, 2, 3]` y predice el mes `[4]`.
  * ...
  * Paso $i=13$: entrena con meses `[0..12]` y predice el mes `[13]`.
* En cada iteración se evalúan los modelos operativos individuales (Regresión Lineal, Ridge, AR(1)) y el ensemble. Las métricas de error (RMSE, MAE, SMAPE, Bias y Correlación de Pearson) se calculan en escala real convirtiendo los outputs logarítmicos mediante la función exponencial. Los resultados se exportan a `backtest_resultados.json`.

### B. Validación Cruzada Leave-One-Out (LOOCV)
Implementado en `modelos_fase1.py` para calcular el rendimiento del modelo en toda la serie de datos limitados ($n=14$):
* En cada iteración, se excluye una única observación $i$, se entrena el modelo con las $n-1$ observaciones restantes y se calcula el error de predicción sobre la observación excluida.
* Los coeficientes de determinación ($R^2$) obtenidos mediante LOOCV se utilizan como **pesos dinámicos en el ensemble final**:
  $$peso_{modelo} = \max(0.05, R^2_{LOOCV})$$
  $$prediccion_{ensemble} = \frac{\sum (peso_{j} \cdot pred_{j})}{\sum peso_{j}}$$
* Adicionalmente, se aplica un factor de calibración empírico para corregir el sesgo y calcular el intervalo de confianza del 80% (IC80) a partir del RMSE de la validación cruzada.
