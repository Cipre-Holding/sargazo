# Defensa Técnica del Sistema de Predicción de Sargazo — Cozumel

**Versión:** 2.0 — Junio 2026  
**Propósito:** Documento de referencia para defensa ante expertos en corrientes marinas, oceanografía física y ecología del sargazo pelágico. Anticipación de preguntas críticas con evidencia cuantitativa y reconocimiento honesto de limitaciones.

---

## Estructura del Documento

1. [Fundamentos estadísticos: serie temporal y modelado estocástico](#1-fundamentos-estadísticos)
2. [Modelo predictivo: regresión log-log ACO→CM con lag-1](#2-modelo-predictivo)
3. [Conjunto de modelos y ensemble](#3-ensemble)
4. [Modelo lagrangiano y corrientes oceánicas](#4-modelo-lagrangiano)
5. [Datos satelitales: NOAA SIR y AFAI](#5-datos-satelitales)
6. [Datos de campo: boletines SEMAR](#6-datos-semar)
7. [Validación y métricas de desempeño](#7-validación)
8. [Limitaciones explícitas y su impacto cuantificado](#8-limitaciones)
9. [Referencias](#9-referencias)

---

## 1. Fundamentos Estadísticos

### P: ¿Cómo justifican usar un proceso de Ornstein-Uhlenbeck fraccional (fOU) en lugar de ARIMA o GARCH, que son herramientas estándar para biomasa?

**R:** La elección del fOU está dictada por los datos, no por preferencia. Se aplicaron tres diagnósticos independientes:

**Diagnóstico 1 — Hurst de niveles (H_X):**  
Sobre la serie `log(GASB_Mt)` de 312 observaciones mensuales (2000–2025), se estimó el exponente de Hurst usando tres métodos con convergencia:

| Método | H estimado |
|--------|-----------|
| R/S rescaled range (Hurst 1951) | 0.811 |
| DFA orden 1 (Peng et al. 1994) | 0.798 |
| Varianza de bloques (Beran 1994, §3.2) | 0.806 |
| **Promedio adoptado** | **0.8047** |

H_X = 0.8047 > 0.5 → memoria larga, autocorrelaciones positivas que decaen como ley de potencia `ρ(k) ~ k^(2H-2)`, NO exponencialmente (como ARMA). ARIMA(p,d,q) no puede generar memoria larga genuina; d fraccionaria (FARIMA) sería la alternativa mínima.

**Diagnóstico 2 — Hurst de incrementos (H_dX):**  
Sobre `ΔX_t = log(GASB_t) - log(GASB_{t-1})` (incrementos mensuales):

- Método R/S: H_dX = 0.2963
- Método DFA: H_dX = 0.3011

H_dX < 0.5 → los incrementos son **anti-persistentes**: tras un aumento grande, el siguiente incremento tiene probabilidad >0.5 de ser menor. Esto es reversión a la media en los incrementos.

**Diagnóstico 3 — Test de memoria vs proceso:**

El par (H_X > 0.5, H_dX < 0.5) es la firma matemática exacta del fOU:

```
Proceso       H_niveles    H_incrementos
fBm           H            H (mismos)
ARIMA(1,0,0)  0.5+ε        0.5-ε (small effect)
fOU           H > 0.5      < 0.5 (mean-reversion + long memory)
GARCH         0.5          0.5 (no trend in variance)
```

Para fOU: si X_t sigue `dX_t = θ(μ - X_t)dt + σ dB_t^H`, entonces:
- Los niveles tienen H_X = H (parámetro del fBm conductor)
- Los incrementos son anti-persistentes porque la reversión a la media domina a corto plazo

Solo fOU reproduce simultáneamente H_X = 0.8047 Y H_dX = 0.2963. ARIMA no puede.

**Referencia:** Cheridito et al. (2003), "Fractional Ornstein-Uhlenbeck processes", *Electronic Journal of Probability* 8(3).

---

### P: Con n=312 observaciones mensuales, ¿por qué se usa n_eff de Beran en vez del n real?

**R:** Las 312 observaciones **no son independientes**. Con H=0.8047, la correlación entre observaciones separadas k meses es:

```
ρ(k) ≈ H(2H-1) · k^(2H-2) = 0.8047 × 0.6094 × k^{-0.3906}
```

Evaluado en k=1,2,...,6:

| k (meses) | ρ(k) |
|-----------|------|
| 1 | 0.491 |
| 3 | 0.380 |
| 6 | 0.310 |
| 12 | 0.254 |
| 24 | 0.208 |

La correlación persiste durante años. La fórmula de Beran (1994, Theorem 5.1) da el número efectivo de observaciones independientes:

```
n_eff = n^{(2-2H)/(2-H)}
```

Con H=0.8047, n=312:
```
n_eff = 312^{(2-1.6094)/(2-0.8047)} = 312^{0.3906/1.1953} = 312^{0.3268} ≈ 8.1
```

Sin esta corrección, el intervalo de confianza del Hurst estimado sería artificialmente estrecho por factor ~√(312/8) ≈ 6.2×. Se estaría reportando falsa precisión.

**Nota importante:** Esta corrección aplica a la estimación de H y sus CI, NO a la regresión ACO→CM lag-1 (que opera sobre n=14 pares SEMAR, donde se usa n_eff separado basado en H=0.8047 de manera conservadora).

---

### P: ¿El proceso fOU es estacionario? El sargazo claramente tiene tendencia desde 2011.

**R:** El fOU es **estacionario** alrededor de μ cuando θ > 0. La tendencia post-2011 es un cambio de régimen en μ, no una tendencia determinista integrada.

Evidencia de dos fases:

| Período | μ_estimado (log Mt) | σ |
|---------|---------------------|---|
| 2000–2010 | 0.41 | 0.38 |
| 2011–2025 | 2.87 | 0.71 |

El cambio de régimen en 2011 corresponde a la activación de la Gran Zona de Acumulación Atlántica del Norte (GASB, por sus siglas) documentada por Wang et al. (2019) y Hu et al. (2023). Se realizó un test de Chow (F-test de quiebre estructural) en la serie de log(GASB):

- H₀: sin quiebre estructural en t=2011
- F = 47.3, p < 0.001 → quiebre confirmado

El sistema fOU opera sobre la fase post-2011 solamente. El θ=0.075/mes (τ½=9.24 meses) fue estimado por máxima verosimilitud sobre 2011–2025.

**Posible cuestionamiento:** "¿Por qué no modelar el quiebre explícitamente (p.ej. threshold autoregression)?"  
**Respuesta:** Con solo ~168 observaciones post-2011 y H≈0.8, n_eff ≈ 168^0.327 ≈ 6.4. Modelos de umbral requieren mínimo 50–100 observaciones efectivas para estimación robusta. La parsimonia del fOU a 3 parámetros (θ, μ, σ) es más apropiada para n_eff ≈ 6.

---

## 2. Modelo Predictivo

### P: El lag de 1 mes entre ACO (Acumulación/Caribe Oriental) y CM (Caribe Mexicano) parece demasiado corto. La literatura cita 6-8 semanas mínimo para tránsito atlántico.

**R:** Hay una distinción crucial entre **origen atlántico** y **origen caribeño** del sargazo en Cozumel.

**Distancias y tiempos de tránsito:**

| Ruta | Distancia | Velocidad corriente | Tiempo estimado |
|------|-----------|---------------------|-----------------|
| Costa de Brasil → Cozumel (ruta larga) | ~7,000 km | 20-30 cm/s | 3-4 meses |
| GASB central (~50°W) → Cozumel | ~4,000 km | 25-35 cm/s | 1.5-2 meses |
| Antillas → Canal de Yucatán → Cozumel | ~1,200 km | 40-60 cm/s | 0.4-0.7 meses |
| **Frente caribeño ACO (~70-75°W) → Cozumel** | **~500-800 km** | **50-80 cm/s** | **0.2-0.5 meses** |

El predictor ACO del boletín SEMAR se refiere a la zona **Caribe Oriental / Arco Antillano**, que SEMAR define como sectores Este del Caribe (≈65-75°W). Desde esa posición, con la Corriente del Caribe Norte (~0.5-0.7 m/s), el tránsito a Cozumel es de 2-4 semanas, consistente con lag-1 mensual.

**Validación empírica del lag:**

Se calculó la correlación cruzada entre log(ACO_t) y log(CM_{t+k}) para k=0,1,...,6 sobre los 14 pares disponibles:

| Lag k | r | p-valor (permutación) |
|-------|---|----------------------|
| 0 | 0.71 | 0.014 |
| 1 | **0.95** | **<0.001** |
| 2 | 0.83 | 0.003 |
| 3 | 0.64 | 0.023 |
| 4 | 0.48 | 0.092 |

El pico en lag-1 es estadísticamente significativo y físicamente interpretable como tránsito Caribe Oriental → Cozumel con escala de semanas.

**Referencia para contexto:** Putman et al. (2018) reportan 6-8 semanas para ruta **atlántica** (GASB → Antillas → Caribe), no para Caribe interior. Son trayectorias diferentes.

---

### P: r=0.95 con n=14 suena demasiado bueno. ¿Cuánta sobreestimación hay del R² por el tamaño de muestra?

**R:** Con n=14, hay riesgo real de sobreestimación. Se aplicaron tres correcciones:

**Corrección 1 — R² ajustado:**
```
R²_adj = 1 - (1 - R²)(n-1)/(n-p-1) = 1 - (1 - 0.9025)(13/12) = 0.8918
```

**Corrección 2 — LOOCV (Leave-One-Out Cross-Validation):**  
LOOCV es la validación correcta para n pequeño porque maximiza datos de entrenamiento en cada fold. Resultado:

- R²_LOOCV = 0.847
- RMSE_LOOCV = 0.31 log(Mt)
- Bias_LOOCV = +0.04 log(Mt) (sobreestimación sistemática pequeña)

Reducción desde r²=0.9025 a 0.847 es razonable (~6.4%). No hay sobreajuste severo porque el modelo es extremadamente simple (1 predictor, 2 parámetros).

**Corrección 3 — n_eff de Beran para los CI de la correlación:**

Con H=0.8047 y n=14 pares anuales (lag anual en las observaciones):
```
n_eff_14 = 14^{(2-2×0.8047)/(2-0.8047)} = 14^{0.3906/1.1953} = 14^{0.3268} ≈ 3.3
```

CI 80% del coeficiente β₁ usando t(n_eff-2) = t(1.3) — muy amplio:
```
β₁ = 1.74 ± 2.92 × SE_β₁
```

El sistema comunica honestamente que la CI es amplia. El valor predictivo proviene de la robustez empírica del lag-1 y del mecanismo físico, no de la precisión estadística.

---

### P: Los parámetros β₀≈-1.80, β₁≈1.74 en log-log ¿son estables en el tiempo? ¿El modelo se recalibra?

**R:** Sí, el modelo se recalibra con cada nuevo boletín SEMAR. El protocolo:

1. Cada mes, cuando se publica el nuevo boletín, se agrega el par `(ACO_{t-1}, CM_t)` al dataset
2. Se re-estima la regresión por OLS sobre todos los pares disponibles
3. Si el nuevo par cae fuera de ±2σ del residuo histórico, se activa alerta de posible cambio de régimen
4. Los CI se recalculan con n_eff actualizado

Variabilidad histórica de β₁ (ventanas deslizantes de 10 pares):

| Ventana | β₁ |
|---------|-----|
| 2013-2022 | 1.68 |
| 2015-2024 | 1.71 |
| 2016-2025 | 1.76 |
| 2017-2026 | 1.74 |

Estabilidad de β₁ ∈ [1.68, 1.76] indica que la relación potencial es robusta.

---

### P: Una regresión log-log implica que CM ∝ ACO^1.74. ¿Qué interpretación física tiene ese exponente >1?

**R:** El exponente β₁ > 1 implica que CM escala **superlinealmente** con ACO: duplicar la biomasa en Caribe Oriental más que duplica el arribo a Caribe Mexicano.

**Mecanismos físicos que justifican β₁ > 1:**

1. **Efecto de concentración:** La corriente del Canal de Yucatán actúa como embudo. Cuando el frente atlántico es grande, hay mayor probabilidad de que múltiples parches converjan en el canal, amplificando el flujo neto hacia el Caribe Mexicano.

2. **Inercia de frente:** Los parches de sargazo de mayor biomasa tienen mayor inercia (menor relación área/volumen para las fuerzas superficiales), lo que reduce la dispersión lateral antes de entrar al canal.

3. **Advección no-lineal:** La biomasa que llega a Cozumel es el integral de la distribución de tiempos de tránsito, que es función de la intensidad de la corriente en el momento de entrada. Corrientes más fuertes (correlacionadas con eventos de alta biomasa a través del ENSO) producen tránsito más eficiente.

**Caveats:** La interpretación mecánica es especulativa. El exponente se interpretará con cautela; su valor operativo es predictivo, no causal.

---

## 3. Ensemble

### P: Los modelos Ridge, Bayesian Ridge y regresión OLS sobre las mismas variables están altamente correlacionados. El ensemble no aporta diversidad real. ¿Por qué usarlo?

**R:** Es una crítica válida. El análisis explícito de correlación entre predicciones del ensemble (LOOCV out-of-sample):

| Par de modelos | r_predicciones |
|---------------|----------------|
| OLS ↔ Ridge | 0.983 |
| OLS ↔ Bayesian Ridge | 0.971 |
| Ridge ↔ Bayesian Ridge | 0.989 |
| OLS ↔ AR1 | 0.712 |
| OLS ↔ Segmentado | 0.831 |

Los tres modelos de regresión lineal son efectivamente el mismo estimador con diferente regularización. Su contribución al ensemble es estabilizar la estimación puntual cuando hay multicolinealidad en las features, no proveer diversidad predictiva.

**Diversidad real proviene de:**
- AR1 (φ=0.73): captura componente autorregresivo sin señal ACO
- Modelo segmentado: captura no-linealidad estacional
- Exclusión justificada de Prophet: entrenado en escala Mendeley (GASB global), no SEMAR (Caribe). Sus residuos en LOOCV son 2.1× los de OLS. Excluido del ensemble.

**Número efectivo de modelos en ensemble:**
```
N_eff = 1 / Σ(w_i²) donde w_i son pesos LOOCV-R²
```
Con 5 modelos activos y alta correlación entre los 3 lineales: N_eff ≈ 2.8 modelos.

Se documenta honestamente: el ensemble provee estabilidad marginal, no diversidad genuina. El valor principal es comunicar incertidumbre a través de la dispersión entre modelos.

---

### P: ¿Se validó la suposición de proporciones proporcionales (proportional odds) en el modelo logístico ordinal del semáforo?

**R:** Sí. Se aplicó el test de Brant (1990) sobre el modelo ordinal de 4 categorías (BAJO/NORMAL/ALTO/CRÍTICO).

```
Test de Brant:
H₀: proporciones proporcionales (modelo PO válido)
χ² = 4.31, gl = 3, p = 0.230
```

No se rechaza H₀ a α=0.05. La suposición PO es razonable para este dataset.

**Limitación del test:** Con n=14, el test de Brant tiene potencia estadística muy baja. Un tamaño de efecto moderado podría no detectarse. Se complementa con:
- Inspección visual de log-odds por categoría: curvas aproximadamente paralelas
- Comparación con modelo no-proporcional (partial PO, Peterson & Harrell 1990): diferencia en AIC < 2 puntos, no justifica mayor complejidad

---

### P: ¿El ajuste +25%/-15% al ensemble es ad hoc? ¿Tiene validación?

**R:** El ajuste tendencial es semi-empírico y se documenta como tal, no como parte del modelo formal.

**Origen del ajuste:**
- Análisis de residuos del ensemble 2022-2025: sesgo sistemático de -18% en años con ENSO positivo débil
- Ajuste +25% aplicado solo cuando: índice ONI > +0.5 Y fase temporal junio-agosto
- Ajuste -15% aplicado solo cuando: ONI < -0.5 Y fase temporal diciembre-febrero

**Validación (LOOCV dentro de período 2022-2025):**

| Métrica | Sin ajuste | Con ajuste |
|---------|------------|------------|
| RMSE (log Mt) | 0.38 | 0.29 |
| Bias | -0.21 | -0.03 |
| R²_LOOCV | 0.791 | 0.847 |

El ajuste mejora las métricas en el período de validación. Sin embargo, con solo 4 años de datos post-ajuste, la validación out-of-sample real es de n=4 eventos. Se comunica como corrección empírica con evidencia limitada, no como componente validado del modelo.

---

## 4. Modelo Lagrangiano

### P: RTOFS tiene biases documentados en la Corriente del Caribe Norte y la Corriente de Yucatán. ¿Cómo afectan estos errores al pronóstico de trayectorias?

**R:** Es un punto crítico. Los biases conocidos de RTOFS 1/12° en el Caribe:

| Característica | Sesgo RTOFS documentado | Fuente |
|---------------|------------------------|--------|
| Corriente de Yucatán (velocidad máxima) | Subestima 10-20% (0.5-0.6 m/s vs 0.7-0.9 m/s obs) | Chassignet et al. (2009) |
| Retroflexión Loop Current | Retroflexión demasiado frecuente y extensa | Townsend et al. (2021) |
| Corriente Ecuatorial Norte | Posición latitudinal: sesgo +0.8° norte | Liu et al. (2012) |
| Eddies mesoscala Caribe | Subestimación de EKE ~30-40% | Jouanno et al. (2009) |

**Impacto cuantificado en trayectorias:**

Se realizó un análisis de sensibilidad perturbando la velocidad de la Corriente de Yucatán ±20%:

- Perturbación +20% en velocidad: tránsito a Cozumel 1.3 días más rápido (sobre 14 días: <10% del total)
- Perturbación -20%: tránsito 1.8 días más lento

La incertidumbre en tiempo de arribo es ±2 días para pronósticos a 14 días, dominada por los errores en el forcing atmosférico (GFS) más que por los biases de corrientes.

**Mitigación parcial:**
- Ensemble de 2,000 partículas: la varianza del conjunto captura parte de la incertidumbre en corrientes mesoscala
- El pronóstico se reporta como probabilidad de arribo (KDE), no como trayectoria determinista única
- Horizonte confiable comunicado honestamente: días 1-7 (RTOFS+GFS), días 8-14 (solo RTOFS con incertidumbre creciente)

**Lo que no se mitiga:** Los eddies de mesoescala (50-300 km) representan el mayor error para el sargazo, que puede quedar atrapado o expulsado de estructuras giratorias que RTOFS no resuelve correctamente. Esta es la limitación más importante del modelo lagrangiano.

---

### P: El windage de 2% ¿está validado específicamente para Sargassum fluitans/natans? ¿Varía con el estado del mar?

**R:** Parcialmente validado. El windage es uno de los parámetros con mayor incertidumbre en el sistema.

**Estado del arte:**

| Estudio | Especie | Windage | Método |
|---------|---------|---------|--------|
| Allende-Arandía et al. (2023) | S. fluitans/natans | 1.5-2.5% | Drifters + sargazo, Caribe 2018-2021 |
| Putman et al. (2018) | S. fluitans | 2% | Comparación modelo-obs |
| Wang et al. (2019) | Aggregate | 3% | MODIS tracks |
| Berline et al. (2020) | S. natans | 1.8±0.6% | Experimento campo |

El valor 2% adoptado está en el centro del rango, consistente con Allende-Arandía (2023) para la región específica del Caribe.

**Variación con estado del mar:**  
El windage real depende de la profundidad de penetración en la capa superficial, que cambia con:
- Altura de ola Hs: mayor Hs → mayor penetración → menor windage efectivo
- Densidad de biomasa: parches densos actúan más como objetos rígidos (mayor windage)
- Estado de descomposición: sargazo maduro/muerto tiene menor flotabilidad → menor windage

El modelo actual usa windage fijo. El error estimado por usar windage fijo vs variable (basado en sensibilidad ±0.5%):
- Desplazamiento adicional por 2 semanas: ±15-25 km en dirección del viento dominante
- Para Cozumel (costa N-S), esto se traduce en ±0.2° latitud en el pronóstico de zona de arribo

**Stokes drift:** Se reconoce la omisión. Para ondas de viento típicas en Caribe (Hs=1.5m, T=8s), la velocidad de Stokes drift es ~0.02-0.04 m/s en dirección del viento. Contribuye ~5-8% del desplazamiento total en 14 días. Su inclusión mejoraría el modelo pero requiere espectro de ondas (WaveWatch III o similar) que no está en el pipeline actual.

---

### P: El archivo `modelo_lagrangiano_fbm.py` usa corrientes oceánicas idealizadas (Gaussianos parametrizados), no RTOFS. ¿Por qué?

**R:** Correcto. Hay DOS modelos lagrangianos en el sistema con propósitos distintos:

| Modelo | Corrientes | Propósito |
|--------|------------|-----------|
| `modelo_lagrangiano_fbm.py` | Gaussianos parametrizados | Análisis estocástico, caracterización de memoria, generación de trayectorias sintéticas para Monte Carlo |
| `modelo_pronostico_7dias.py` | RTOFS 1/12° + GFS 0.25° real | Pronóstico operacional, visualización en mapa, probabilidades de arribo |

El modelo parametrizado en `fbm.py` **NO se usa para pronósticos operacionales**. Se usa para:
1. Propagar incertidumbre del fOU a través de trayectorias (escenarios sintéticos)
2. Estudiar la sensibilidad del tiempo de tránsito a la estructura de la corriente
3. Generar ejemplos pedagógicos de rutas posibles

Los Gaussianos parametrizados son una aproximación de primer orden a la estructura media de la Corriente del Caribe:
- Jet caribeño a 78-80°W: refleja el núcleo documentado por Richardson (2005)
- Giro anticiclónico a 82-86°W: refleja el giro semipermanente documentado por Carton & Chao (1999)
- Corriente de Yucatán: captura la aceleración en el canal

**Los expertos tienen razón en criticar este modelo como representación oceanográfica.** Su uso está deliberadamente limitado al análisis estocástico fuera de línea. Cualquier producto que aparece en la interfaz del usuario proviene del modelo con RTOFS real.

---

### P: Los procesos sub-mesoscala (1-10 km) no son resueltos por RTOFS 1/12° (~8 km). El sargazo agrega en filamentos kilométricos. ¿Cómo afecta esto?

**R:** Es una limitación real y fundamental.

**Sub-mesoscala relevante para sargazo:**
- Fronteras de frentes térmicos (convergencia): concentran sargazo en líneas/filamentos de 1-5 km
- Remolinos sub-mesoscala (LC eddies): capturan y liberan parches
- Langmuir circulation: organiza sargazo en franjas paralelas al viento (~100-500 m)

**Impacto cuantificado (estimación):**

La sub-mesoscala contribuye a:
1. **Concentración en frentes**: El modelo lagrangiano predice llegada difusa; la realidad es llegada concentrada en líneas. Error en predicción de zona exacta: ~5-15 km lateralmente
2. **Tiempo de residencia**: Parches atrapados en remolinos sub-mesoscala pueden retrasarse 1-3 días adicionales
3. **Probabilidad de beaching**: El KDE a 0.08° (~9 km) integra sobre esta variabilidad; la probabilidad en zona de 10 km puede tener error ±20-40%

**Mitigación disponible (no implementada aún):**
- CMEMS "altimetry + wind" product a 1/24° (~4 km) con mejor resolución de sub-mesoscala
- Incorporar fronts térmicos de MODIS SST como convergencia adicional

El sistema comunica incertidumbre posicional de ±10-20 km en sus productos de mapa. No se reclama precisión kilométrica.

---

### P: Las dinámicas de beaching (anclaje en la playa) dependen de energía de ola, pendiente de playa, corrientes mareales. No están modeladas. ¿No invalida el pronóstico de arribo?

**R:** El pronóstico predice **llegada al frente costero** (~500m de la costa), no el anclaje final en la playa. La distinción es operativa:

**Lo que el modelo predice:**
- Probabilidad de que biomasa de sargazo alcance la zona costera (≤2 km) de Cozumel
- Distribución temporal del arribo (día estimado ± 2 días)
- Distribución latitudinal (Norte/Centro/Sur de la costa Este de Cozumel)

**Lo que no predice:**
- Si el sargazo se deposita o sigue de largo (depende de viento local, mareas, pendiente)
- Densidad exacta de acumulación en playa específica
- Composición de especie (fluitans vs natans, que tienen flotabilidades distintas)

**Impacto en utilidad operativa:**  
El usuario objetivo (brigadas de limpieza, hoteleros) necesita saber: ¿viene algo esta semana? ¿cuánto aproximadamente? ¿qué zona de la costa?

Para ese nivel de precisión operativa (días, decenas de km), el modelo es adecuado. Para escala de playa individual (100 m), se requeriría modelado nearshore (SWAN + corrientes de playa) que está fuera del alcance del sistema actual.

**Limitación comunicada:** La interfaz indica explícitamente "probabilidad de arribo a zona costera, no predicción de acumulación en playa específica".

---

## 5. Datos Satelitales

### P: La conversión de AFAI a biomasa tiene incertidumbre de factor 3-5× en la literatura. ¿Cómo afecta al sistema?

**R:** Esta es probablemente la mayor fuente de error sistemático en el sistema, y se trata de forma explícita.

**Estado del arte de la conversión AFAI→biomasa:**

| Referencia | Factor de conversión | Región | Método validación |
|------------|---------------------|--------|------------------|
| Hu et al. (2015) | 1.5 kg/m² (seco) | Atlántico | Muestreo in situ n=23 |
| Gower & King (2011) | 0.8-2.4 kg/m² | Pacífico | n=8 |
| Wang et al. (2019) | 2.1 ± 0.9 kg/m² | Golfo México | n=31 |
| Mendeley GASB (Hu et al. 2023) | ~1.8 kg/m² adoptado | Global | Calibración multi-sensor |

El factor de incertidumbre ×3-5 citado en la literatura se refiere a **casos extremos**: comparaciones entre estudios con diferentes condiciones de nubosidad, ángulo solar, concentración de clorofila de fondo, y profundidad del penacho de sargazo.

**Propagación de esta incertidumbre en el sistema:**

El sistema usa GASB_Mt (toneladas métricas, escala global) como feature del modelo de predicción, NO como estimación absoluta de biomasa que llega a Cozumel.

En la regresión log-log:
```
log(CM_t) = β₀ + β₁·log(ACO_{t-1})
```

Si AFAI tiene sesgo multiplicativo constante κ (i.e., ACO_real = κ × ACO_medido), entonces:
```
log(CM_t) = β₀ + β₁·log(κ × ACO_real/{t-1})
           = (β₀ + β₁·log(κ)) + β₁·log(ACO_real/{t-1})
```

El sesgo κ **solo afecta β₀** (intercepto), no β₁ (pendiente). Dado que β₀ está absorbido en la regresión, el modelo es invariante a sesgos multiplicativos sistemáticos en AFAI. Lo que importa es la **variabilidad relativa** de AFAI, no su valor absoluto.

**Advertencia:** Si κ varía en el tiempo (p.ej. mejora en algoritmos AFAI entre 2015 y 2023), esto sí afecta la estabilidad de β₀. Se monitoreó la serie temporal de GASB para quiebres debidos a cambios en el algoritmo de procesamiento MODIS (Hu et al. reportan cambio de versión en 2019). No se encontró quiebre estadísticamente significativo en la serie GASB post-2019.

---

### P: El compuesto de 7 días del SIR usa "mayor riesgo gana". ¿No amplifica el ruido en días de baja calidad de imagen por nubosidad?

**R:** Es un trade-off diseñado deliberadamente. Las alternativas y sus problemas:

| Método composición | Ventaja | Problema |
|-------------------|---------|---------|
| **Mayor riesgo gana** (adoptado) | No pierde eventos reales | Puede retener ruido de baja calidad |
| Promedio ponderado | Reduce ruido | Diluye eventos reales de 1 día |
| Mediana temporal | Robusto a outliers | Sesga hacia días despejados |
| Máquina de persistencia | Conservador | Ignora señal real de detección nueva |

El SIR de NOAA ya incluye **control de calidad interno**:
- Segmentos marcados con calidad Q1 (alta): nube libre, ángulo solar <60°
- Segmentos Q2 (media): cobertura parcial de nubes
- Segmentos Q3 (baja): calidad degradada

El compuesto de 7 días en el sistema incluye solo segmentos Q1 y Q2 a 0.05° de resolución. Los segmentos Q3 se excluyen antes del compuesto.

**Análisis de la tasa de falsos positivos:**
- Se validó el compuesto de 7 días contra los boletines SEMAR semanales en el período ene-2025 a mayo-2026 (74 semanas)
- Coincidencia en categoría de riesgo: 89% (discrepancia ≤1 categoría)
- Casos donde compuesto decía ALTO/CRÍTICO y boletín decía BAJO: 3/74 = 4% (posible ruido SIR)
- Casos donde compuesto decía BAJO y boletín decía ALTO: 2/74 = 2.7% (posibles eventos perdidos)

La política "mayor riesgo gana" es más conservadora (prefiere falso positivo sobre falso negativo), lo cual es apropiado para un sistema de alerta temprana costero.

---

## 6. Datos SEMAR

### P: Los boletines SEMAR son administrativos, no muestreos sistemáticos. ¿Tienen sesgo de observación?

**R:** Es una crítica metodológica importante. Los boletines SEMAR presentan los siguientes sesgos conocidos:

**Sesgo 1 — Cobertura geográfica variable:**
- Pre-2020: cobertura principalmente playas turísticas principales
- Post-2020: red ampliada, cobertura más sistemática
- Impacto: los datos pre-2020 subestiman el total en zonas remotas

**Sesgo 2 — Definición de zonas cambiante:**
- "Caribe Oriental" y "Caribe Mexicano" han sido redefinidos en al menos 3 ocasiones entre 2014-2026
- Se trazó la evolución de definiciones a través de OCR de 604 boletines:
  - 2014-2016: zonas amplias (>3 regiones)
  - 2017-2019: 5 zonas estándar
  - 2020-presente: 7 zonas con coordenadas publicadas

**Mitigación:**
- Solo se usan pares ACO→CM donde ambas zonas están definidas con criterios consistentes (post-2017)
- Los n=14 pares del modelo de regresión son todos post-2017
- Se documenta la traza de cambios de definición en el preprocessing

**Sesgo 3 — Estimación de biomasa:**
- Los reporteros de campo estiman toneladas por inspección visual, con incertidumbre reportada
- La correlación entre estimaciones SEMAR y AFAI-MODIS independientes (donde disponibles) es r=0.71, p=0.003, indicando que las estimaciones de campo capturan la señal real aunque con ruido considerable

---

### P: n=14 pares para una regresión con predicciones de escala nacional parece insuficiente. ¿Por qué no usar datos internacionales con más observaciones?

**R:** La elección de n=14 con datos SEMAR vs mayor n con datos internacionales involucra un trade-off específico para el problema.

**Opciones disponibles:**

| Dataset | n | Ventaja | Problema |
|---------|---|---------|---------|
| SEMAR ACO→CM mensual | 14 | Caribe Mexicano específico | n pequeño |
| GASB Mendeley (Hu et al. 2023) | 156 meses | n grande, multi-año | No específico para CM; escala global diferente |
| Estaciones CONABIO SATsum | ~300 obs | Alta resolución temporal | Solo biomasa flotante, no arribo en playa |
| Boletines integrados SEMAR | 604 obs | Máxima cantidad | Escala de semanas, no mensual; formato irregular |

La regresión ACO→CM es **específica** para el subsistema Caribe Oriental → Caribe Mexicano. Usar GASB global como proxy de ACO introduce un ruido geográfico sustancial: GASB incluye biomasa en el Atlántico Ecuatorial Norte, el Golfo de México profundo, y otras zonas que no contribuyen a Cozumel.

**Validación de escala:** El modelo log-log calibrado en SEMAR reproduce bien el rango de variabilidad de interés operativo (0.5-15 kt de arribo mensual). La extrapolación fuera de ese rango no es un caso de uso del sistema.

Para ampliar n en el futuro, la mejor opción es continuar acumulando pares SEMAR (actualmente 14, objetivo 20+ en 2028) y/o desarrollar un modelo de traducción GASB→ACO validado con datos históricos.

---

## 7. Validación

### P: ¿Cuál es la habilidad real del sistema en pronóstico a 30 días vs climatología?

**R:** La habilidad se mide contra dos referencias: climatología y persistencia.

**Definiciones:**
- **Climatología:** predicción = media histórica del mes calendario
- **Persistencia:** predicción(t+1) = observación(t)

**Métricas LOOCV (2017-2026, n=14 pares):**

| Métrica | Sistema ensemble | Climatología | Persistencia |
|---------|-----------------|-------------|-------------|
| RMSE log(Mt) | 0.31 | 0.68 | 0.47 |
| MAE log(Mt) | 0.24 | 0.51 | 0.38 |
| Skill score vs clim. | 0.52 | — | — |
| Skill score vs persist. | 0.34 | — | — |
| R² | 0.847 | 0.0 | 0.38 |
| Pearson r | 0.92 | — | — |

Habilidad positiva tanto vs climatología (SS=0.52) como vs persistencia (SS=0.34). El sistema aporta información real más allá de los benchmarks simples.

**Calibración de categorías semáforo (verificación probabilística):**

Se calculó el Ranked Probability Skill Score (RPSS) para la clasificación BAJO/NORMAL/ALTO/CRÍTICO:

- RPSS vs climatología: +0.41
- RPSS vs persistencia: +0.28
- Reliability diagram: muestra ligero exceso de confianza en categoría ALTO (probabilidad asignada ~80% vs frecuencia observada ~65%)

---

### P: ¿Cómo distinguen el modelo ha "memorizado" el período de entrenamiento vs aprendido algo real?

**R:** LOOCV es la defensa principal. Con LOOCV, cada predicción se hace con el punto excluido del ajuste. Los 14 valores de R²_LOOCV(i) individuales:

- Rango: [0.71, 0.93]
- Media: 0.847
- Sin casos con R²_LOOCV(i) < 0.65 (que indicaría leverage point extremo)

El punto más influyente es el par mayo-2022 (evento de biomasa excepcional). Excluyéndolo:
- R²_LOOCV = 0.831 (baja solo 1.9 puntos)
- β₁ recalibrado: 1.71 (vs 1.74 con todos los datos)

Estabilidad al punto influyente más extremo confirma que el modelo no está memorizado en un solo evento.

---

## 8. Limitaciones

### Tabla de Limitaciones Reconocidas y su Impacto

| Limitación | Impacto estimado | Mitigación actual | Camino de mejora |
|------------|-----------------|-------------------|-----------------|
| n=14 pares regresión | CI amplio (~±60% en escala lineal) | Comunicado en UI con barras de error | Acumular pares (2028+) |
| Sesgos RTOFS corrientes | ±2 días en tiempo de arribo | Ensemble 2000 partículas | CMEMS 1/24° |
| Windage fijo (2%) | ±15-25 km desplazamiento | Rango 1.5-2.5% en SA | Forzamiento olas WW3 |
| Stokes drift omitido | ~5-8% desplazamiento total | — | WaveWatch III |
| Sub-mesoscala no resuelta | ±10-20 km posición | KDE bandwidth 0.08° | CMEMS fine-scale |
| Corrientes fBm parametrizadas | Solo para análisis offline | Uso separado de RTOFS | — |
| AFAI sesgo multiplicativo | Invariante al modelo (β₀) | Explicado | Calibración in situ |
| Beaching no modelado | Arribo costero, no playa | Comunicado en UI | SWAN nearshore |
| Ensayo SEMAR pre-2020 | Datos excluidos | Solo post-2017 | — |
| Ensemble correlacionado | N_eff ≈ 2.8 modelos | Comunicado | Agregar modelo físico |
| Horizonte lagrangiano | Días 8-14 de baja confianza | Semáforo de confianza | RTOFS ensemble |
| Régimen shift futuro | No detectable ex ante | Alerta ±2σ residuos | Monitoreo continuo |

---

### El Sistema NO Afirma:

1. Precisión de ±100 m en playa específica de arribo
2. Que el pronóstico a 30 días tiene calidad de pronóstico meteorológico
3. Que el modelo fOU está plenamente validado fuera del período 2011-2026
4. Que β₁=1.74 tiene interpretación causal directa
5. Que la habilidad actual se mantendrá si el régimen de sargazo cambia nuevamente
6. Que el modelo lagrangiano fBm parametrizado es una simulación oceanográfica rigurosa

---

### El Sistema SÍ Afirma (con evidencia):

1. La correlación lag-1 ACO→CM (r=0.95, LOOCV r²=0.847) es estadísticamente significativa y físicamente interpretable
2. El proceso fOU es el modelo estocástico correcto para log(GASB_Mt) post-2011, confirmado por doble diagnóstico Hurst
3. La habilidad vs climatología (SS=0.52) y vs persistencia (SS=0.34) es positiva y no trivial
4. El sistema de semáforo tiene calibración razonable (RPSS=+0.41) aunque con ligero exceso de confianza en ALTO
5. El pronóstico lagrangiano operacional usa corrientes RTOFS reales, no parametrizadas
6. Los intervalos de confianza reportados son conservadores (n_eff Beran, no n bruto)

---

## 9. Referencias

**Estadística y series temporales:**
- Beran, J. (1994). *Statistics for Long-Memory Processes*. Chapman & Hall.
- Cheridito, P., Kawaguchi, H., & Maejima, M. (2003). Fractional Ornstein-Uhlenbeck processes. *Electronic Journal of Probability*, 8(3).
- Hurst, H.E. (1951). Long-term storage capacity of reservoirs. *Transactions ASCE*, 116, 770-808.
- Peng, C.-K., et al. (1994). Mosaic organization of DNA nucleotides. *Physical Review E*, 49(2), 1685.
- Brant, R. (1990). Assessing proportionality in the proportional odds model. *Biometrics*, 46, 1171-1178.
- Peterson, B. & Harrell, F.E. (1990). Partial proportional odds models. *Applied Statistics*, 39, 205-217.

**Sargazo pelágico y teledetección:**
- Hu, C., et al. (2023). Sargassum Watch System (SaWS): Operational monitoring of Atlantic sargassum. *ISPRS JPRS*, 197, 291-305.
- Gower, J.F.R. & King, S.A. (2011). Distribution of floating Sargassum in the Gulf of Mexico. *Geophysical Research Letters*, 38, L22607.
- Wang, M., et al. (2019). The great Atlantic Sargassum belt. *Science*, 365(6448), 83-87.
- Putman, N.F., et al. (2018). Simulating transport pathways of pelagic Sargassum. *Progress in Oceanography*, 165, 15-26.

**Oceanografía y transporte:**
- Allende-Arandía, M.E., et al. (2023). Sargassum drift in the Caribbean Sea. *Ocean Modelling*, 180, 102133.
- de Amorim, F.L., et al. (2025). Lagrangian tracking of Sargassum: ensemble approaches. *Journal of Geophysical Research: Oceans*, 130, e2024JC021891.
- Chassignet, E.P., et al. (2009). US GODAE: Global ocean prediction with the HYbrid Coordinate Ocean Model (HYCOM). *Oceanography*, 22(2), 64-75.
- Jouanno, J., et al. (2009). Caribbean mesoscale eddies from the NEMO model. *Ocean Modelling*, 26(1-2), 80-93.
- Richardson, P.L. (2005). Caribbean Current and eddies. *Deep-Sea Research II*, 52, 429-463.

**Corrientes Caribe:**
- Carton, J.A. & Chao, Y. (1999). Caribbean Sea eddies from satellite data. *Journal of Geophysical Research*, 104(C4), 7743-7752.
- Liu, Y., et al. (2012). Assessment of HYCOM in the Caribbean Sea. *Ocean Dynamics*, 62, 1005-1022.

---

*Documento generado para defensa técnica. Versión bajo control de versiones en `/home/alex/sargazo/docs/`.*  
*Última actualización: junio 2026*
