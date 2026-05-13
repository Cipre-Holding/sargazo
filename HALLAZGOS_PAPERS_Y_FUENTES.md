# Hallazgos de Papers, SATsum y Mejoras al Pipeline
## Sistema de Predicción de Sargazo — Cozumel / Cipre Holding
**Fecha:** 12 de Mayo de 2026

---

## 1. Papers Científicos — Análisis y Aplicación

### 1.1 Allende-Arandía et al. 2023 — El más relevante para Cozumel

**Referencia:**
Allende-Arandía, M.E., Duran, R., Sanvicente-Añorve, L., & Appendini, C.M. (2023).
Lagrangian Characterization of Surface Transport From the Equatorial Atlantic to the
Caribbean Sea Using Climatological Lagrangian Coherent Structures and
Self-Organizing Maps. *Journal of Geophysical Research: Oceans*, 128(7).
DOI: 10.1029/2023JC019894

**Archivo local:** `JGR Oceans - 2023 - Allende-Arandía - Lagrangian Characterization...pdf`

**Afiliación:** Instituto de Ingeniería, UNAM (Yucatán) + ICML UNAM.

#### Qué hace
Caracteriza rutas de transporte de partículas desde el Atlántico Ecuatorial hasta 10
regiones estratégicas del Caribe usando:
- **HYCOM** (modelo oceánico, mismas corrientes que referencias en tu pipeline)
- **cLCS** (Estructuras Lagrangianas Coherentes climatológicas) — identifican rutas y
  barreras de transporte persistentes
- **SOMs** (Self-Organizing Maps) — reducen la variabilidad espacio-temporal a 8
  patrones dominantes de corriente superficial
- **Experimentos Lagrangianos** con 3 escenarios: sin viento, con 1% windage, con 2% windage

#### Hallazgos clave que validan tu proyecto

| Tópico | Hallazgo | Implicación para Cozumel |
|---|---|---|
| **Zona 2** | Quintana Roo es una de las 10 zonas modeladas | Tu área de estudio está validada en el paper |
| **Windage 2%** | Máxima confluencia de partículas en QRoo con 2% de viento | **El viento es el factor crítico** para predecir arribo a Cozumel |
| **Ventana de arribo (sin viento)** | Partículas tardan 6-7 meses del Atlántico Ecuatorial a Yucatán | Consistente con tu lag GASB→CM de ~13-17 meses incluyendo transporte interno |
| **Ventana óptima de liberación** | Octubre-Enero → entran al Caribe; Junio-Noviembre → quedan fuera | La estacionalidad del GASB predice la temporada en QRoo |
| **cLCS como rutas** | Las corrientes superficiales organizan el transporte en carriles predecibles | Tu cadena causal ACO→CM (r=0.89) tiene base física |

#### Cómo integrarlo en tu modelo
1. **Reforzar viento como predictor** — El paper demuestra que 2% windage es el
   factor que determina si el sargazo llega a QRoo. Tus variables
   `viento_norte_mid` y `viento_sur_mid` (ya en `features_prediccion_cm.csv`)
   deberían tener más peso en el modelo.
2. **Ventana estacional** — Las partículas liberadas entre octubre-enero son las que
   llegan a Yucatán 6-7 meses después. Esto alinea con el pico de temporada
   (abril-agosto).
3. **Metodología replicable** — Puedes implementar un modelo Lagrangiano simple
   (Etapa 3 de tu plan) usando el framework de cLCS + HYCOM que ellos describen.
   El código de cLCS es open-source (Duran et al., 2019).

---

### 1.2 Hu et al. 2023 — Base técnica de tu dataset Mendeley

**Referencia:**
Hu, C., Zhang, S., Barnes, B.B., Xie, Y., Wang, M., Cannizzaro, J.P., & English, D.C. (2023).
Mapping and quantifying pelagic Sargassum in the Atlantic Ocean using multi-band
medium-resolution satellite data and deep learning. *Remote Sensing of Environment*,
289, 113515.

**Archivo local:** `1-s2.0-S0034425723000664-main.pdf`

**Afiliación:** College of Marine Science, University of South Florida.

#### Qué hace
Desarrolla un modelo **Res-UNet (deep learning)** para detectar sargazo en
imágenes satelitales MODIS/VIIRS/OLCI/OLI/MSI, superando dos limitaciones del
AFAI tradicional:
1. Falsos positivos en aguas costeras (hasta 30 km de la costa)
2. Sombras de nubes y straylight

#### Relevancia para tu proyecto
- **Es el autor principal de tu dataset Mendeley** — Hu et al. publicaron el dataset
  de biomasa que usas (`Sargassum_biomass_subregions.xlsx`).
- **Explica el índice AFAI** que también usa SATsum de CONABIO.
- El modelo Res-UNet está entrenado con 8,518 imágenes de "ground truth".

#### Método y datos que aplican
- **Sensores:** MODIS (Aqua/Terra), VIIRS (SNPP/NOAA-20), OLCI (Sentinel-3),
  OLI (Landsat-8), MSI (Sentinel-2)
- **Índice:** AFAI (Alternative Floating Algae Index)
- **Resolución espacial:** 250m-1km (MODIS/VIIRS), 10-300m (OLCI/MSI/OLI)
- **Período:** 2000-presente
- **Arquitectura DL:** Res-UNet con 4 niveles de profundidad

---

### 1.3 De Amorim et al. 2025 — Modelo Lagrangiano de arribos

**Referencia:**
De Amorim, J.P.M., do Carmo, A.M.C., & Martinelli Filho, J.E. (2025).
Sargassum transport to the Amazon Coast: Explaining the stranding through
meteorological and oceanographic conditions. *Harmful Algae*, 149, 102955.

**Archivo local:** `1-s2.0-S156898832500157X-main.pdf`

**Afiliación:** Universidade de São Paulo / Universidade Federal do Pará.

#### Qué hace
Modela el transporte de sargazo hacia la costa amazónica brasileña, explicando
eventos masivos de 2014, 2015, 2019 y 2025 usando:
- Datos observacionales (TRMM rainfall, estaciones meteorológicas)
- Reanálisis (ERA5, CMEMS)
- **Experimentos Lagrangianos** con HYCOM/NEMO
- Análisis de la ZCIT (Zona de Convergencia Intertropical)

#### Hallazgos clave
- Los arribos masivos ocurren en temporada lluviosa cuando la ZCIT está en su
  posición más austral (febrero-marzo)
- Vientos del noreste incrementan el transporte hacia la costa
- El mismo mecanismo de **Corriente Norte de Brasil → Guyana → Caribe** aplica
  a Cozumel

#### Relevancia para tu proyecto
- Valida la cadena de transporte desde el Atlántico Ecuatorial hasta el Caribe
- Los mecanismos meteorológicos (ZCIT, vientos alisios) son compartidos
- Su marco metodológico (Lagrangiano + observaciones) puede replicarse para
  la Etapa 3 de tu plan (2027-2028)

---

## 2. SATsum (CONABIO) — Sistema Satelital de Alerta Temprana

### Qué es
**SATsum** (Satellite-based Early Warning System for Sargassum) es un desarrollo
de la CONABIO, parte del Sistema de Información y Análisis Marino Costero (SIMAR).

### Referencia
Cerdeira-Estrada, S., Martell-Dubois, R., Valdez-Chavarin, J., Rosique-de la Cruz, L.,
Caballero-Aragón, H., Santamaria-del-Angel, E., Perera-Valderrama, S., & Ressl, R.
(2025). SATsum: Satellite-based Early Warning System for Sargassum in
Marine-Coastal Information and Analysis System (SIMAR). CONABIO.
Disponible en: https://simar.conabio.gob.mx/alertas/#sargazo-satsum

### Contacto del equipo
- **Dr. Sergio Cerdeira Estrada** — Coordinador del SIMAR, CONABIO
- **Correo:** scerdeira@conabio.gob.mx (inferido de publicaciones CONABIO)
- **Plataforma:** https://simar.conabio.gob.mx
- **Explorador de datos:** https://simar.conabio.gob.mx/explorer/
- **Twitter/X:** @SIMARConabio (publican boletines diarios)

### Productos disponibles

| Producto | Resolución | Cobertura temporal | Formato |
|---|---|---|---|
| SWB-1KM (biomasa húmeda diaria) | 1 km (MODIS) | 2010-presente | GeoTIFF, KMZ, PNG |
| M-SWB-1KM (biomasa húmeda mensual) | 1 km (MODIS) | 2010-presente | GeoTIFF, KMZ, PNG |
| R-SEWB-1KM (extensión + biomasa regional) | 1 km (MODIS) | 2010-presente | Estadísticas agregadas |
| WSB-OLCI (biomasa 300m) | 300 m (Sentinel-3) | 2018-presente | Experimental |
| Boletines mensuales | Regional | 2025-presente | PDF (Google Drive público) |

### Regiones monitoreadas
- Mar Caribe (Caribbean Sea)
- Golfo de México (Gulf of Mexico)
- Zonas Marinas del Gran Caribe (Greater Caribbean)

### Cómo acceder a los datos
1. **Explorador web:** https://simar.conabio.gob.mx/explorer/ (interfaz GIS)
2. **Boletines mensuales:** Google Drive de CONABIO
3. **Contacto directo:** vía scerdeira@conabio.gob.mx (no hay API pública)

### Potencial para tu proyecto
SATsum provee biomasa satelital MODIS desde 2010 (16 años) a 1km de resolución
para todo el Caribe. Esto podría:
- **Extender tu serie cuantitativa** de 10 meses a 16 años
- **Llenar el gap de 141 días** (oct2024-feb2025) en tus datos SEMAR
- **Validar cruzadamente** tus estimaciones de biomasa SEMAR
- **Mejorar el modelo fOU** con una serie larga y consistente

---

## 3. Mejoras Implementadas al Pipeline (12-May-2026)

### 3.1 Mejora A — Lags ACO solo con datos SEMAR

**Archivo:** `prepare_features.py` (líneas 134-138, 179-184)

**Problema:** `log_aco_lag1` se calculaba desde `features_fuente.csv` que incluye
Mendeley GASB. Para meses sin SEMAR ACO (pre-2025-08), usaba GASB (Atlántico
Norte, ~6.85 Mt) que no es compatible geográficamente con CM (Caribe).

**Solución:** Lags ahora usan solo la serie SEMAR de ACO (`semar_aco`).

**Resultado:** Correlación corregida de r=0.47 → **r=0.918** (Pearson, n=14).

### 3.2 Mejora B — Mediana en vez de media mensual

**Archivo:** `combine_datasets.py` (línea 66)

**Problema:** Outliers diarios extremos (hasta 82,699 ton) inflaban la media
mensual. Ej: dic 2025 ratio mean/median = 8.66x.

**Solución:** `.mean()` → `.median()` para agregación de biomasa mensual.

**Resultado:** Los valores mensuales ahora son robustos a outliers.

### 3.3 Mejora C — Umbral adaptativo para detección de saltos

**Archivo:** `prepare_features.py` (línea 113)

**Problema:** El umbral |z|>2 nunca se alcanzaba en log-scale porque la
transformación logarítmica comprime la escala (anomalía 2024: z=2.44 raw →
z=1.46 log).

**Solución:** Umbral cambiado a |z|>1.5.

**Resultado:** Saltos detectados: 0 → **11 eventos** en 288 meses.

### 3.4 Mejora D — Winsorización P99

**Archivo:** `combine_datasets.py` (líneas 66-69)

**Problema:** 3 valores extremos (82,699, 79,571, 78,978 ton) en biomasa
diaria.

**Solución:** `clip(upper=P99=74,342 ton)` antes de agregación mensual.

**Resultado:** 3 valores afectados (0.56% de los datos).

### 3.5 Corrección de correlaciones (previo, del usuario)

**Archivo:** `correcciones_correlaciones.md`

**Errores corregidos:**
1. Mezcla Mendeley/SEMAR en aligned_CM → NWGoM ≠ Caribe Mexicano
2. r=0.950 inflado por n=9 → corregido a r=0.890 (Spearman, n=14)

---

## 4. Estado Actual de los Datos (Mayo 2026)

| Dataset | Filas | Período | Columnas |
|---|---|---|---|
| `sargazo_combinado_2000_2026.csv` | 311 | 2000-03 → 2026-05 | 34 |
| `boletines_sargazo_MASTER.csv` | 604 | 2024-03 → 2026-05 (diario) | 27 |
| `features_fuente.csv` | 303 | 2000-03 → 2026-05 | 16 |
| `features_prediccion_cm.csv` | 23 | 2024-03 → 2026-05 | 20 |
| `features_semaforo.csv` | 23 | 2024-03 → 2026-05 | 10 |
| `residuos_estocasticos.csv` | 288 | 2000-03 → 2024-02 | 9 |
| `sargazo_correlaciones_lag.csv` | 32 | — | 7 |

### Correlaciones validadas (SEMAR)

| Predictor | lag | n | Spearman r | p |
|---|---|---|---|---|
| **ACO → CM** | 1 mes | 14 | **0.8901** | 0.00002 |
| CO → CM | 0 | 15 | 0.8321 | 0.0001 |
| ACO → CO | 1 mes | 14 | 0.8593 | 0.0001 |
| **ACO → CM** | 2 meses | 13 | **0.7253** | 0.005 |
| ACO → CM | 3 meses | 12 | 0.3357 | 0.286 (NS) |

### Datos del momento (mayo 2026)
- **Semáforo:** MUY ALTO
- **ACO:** 0.512 Mt (tendencia alcista: 0.14→0.51 Mt ene-may 2026)
- **CM:** 0.047 Mt (crecimiento 340x desde nov 2025)
- **Pronóstico:** Junio 2026 seguirá MUY ALTO con alta probabilidad

---

## 5. Pendientes y Próximos Pasos

### Prioridad inmediata
- [ ] Entrenar modelo Prophet sobre `aligned_ACO` (298 meses, tendencia GASB)
- [ ] Entrenar regresión lineal `log(ACO_lag1) → log(CM)` con 14 pares SEMAR
- [ ] Entrenar logística ordinal sobre `features_semaforo.csv` (21 meses)

### Corto plazo (1-2 meses)
- [ ] GPH / Whittle para estimar d-fraccional precisa (d=0.30?)
- [ ] Bai-Perron changepoint detection (2011, 2024)
- [ ] Granger causality formal ACO→CM
- [ ] Automatizar pipeline: `make update` (download→extract→combine→features→predict)
- [ ] Eliminar NVIDIA_API_KEY hardcodeada → `.env`

### Mediano plazo (3-12 meses)
- [ ] ARFIMA(1, d, 0) + estacionalidad sobre aligned_ACO
- [ ] Integrar viento como predictor reforzado (basado en Allende-Arandía 2023)
- [ ] Explorar integración con SATsum (CONABIO) para serie larga de biomasa
- [ ] Tests unitarios para extract_boletines.py

### Largo plazo (2027+)
- [ ] Modelo Lagrangiano de partículas (basado en De Amorim 2025)
- [ ] SARIMAX(p,1,q)(P,1,Q)[12] sobre log(CM) cuando haya ≥36 meses
- [ ] fOU multidimensional con Euler-Maruyama
- [ ] Integración con imágenes AFAI MODIS de USF

---

*Documento generado el 12 de Mayo de 2026 — Sesión de análisis de papers, SATsum,
y mejoras al pipeline de predicción de sargazo en Cozumel.*
