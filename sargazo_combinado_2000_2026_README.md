# sargazo_combinado_2000_2026.csv — Documentación

Dataset mensual de biomasa de *Sargassum* que unifica dos fuentes independientes en una serie temporal continua de 26 años (marzo 2000 – mayo 2026).

---

## Archivos

| Archivo | Descripción |
|---|---|
| `sargazo_combinado_2000_2026.csv` | Dataset principal — 311 filas, 34 columnas |
| `sargazo_correlaciones_lag.csv` | Correlaciones de Pearson con lag 0-6 meses para 6 pares de regiones |
| `combine_datasets.py` | Script que genera ambos archivos |

---

## Fuentes de datos

### 1. Mendeley — Hu et al. 2023
- **Referencia:** Hu, C. et al. (2023). *A 23-year satellite-derived monthly biomass dataset of macroalgal Sargassum in the Atlantic Ocean*. Mendeley Data, DOI: [10.17632/zcyd5wvncc.1](https://doi.org/10.17632/zcyd5wvncc.1)
- **Archivo original:** `Sargassum_biomass_subregions.xlsx`
- **Cobertura:** marzo 2000 – febrero 2024 (288 meses)
- **Resolución:** mensual
- **Método:** teledetección satelital MODIS/VIIRS con índice AFAI, algoritmo Res-UNet
- **Unidades:** millones de toneladas métricas (Mt)
- **Regiones:** 6 subregiones del Atlántico

### 2. SEMAR/IOGMC — Boletines Diarios de Sargazo
- **Fuente:** [diredimoat.semar.gob.mx/OpSargazo/SargazoBoletinDiario.html](https://diredimoat.semar.gob.mx/OpSargazo/SargazoBoletinDiario.html)
- **Archivo derivado:** `boletines_sargazo_MASTER.csv` (604 registros diarios)
- **Cobertura:** marzo 2024 – mayo 2026 (23 meses tras agregación mensual)
- **Resolución original:** diaria; aquí agregada a mensual (media de biomasa, moda de semáforo)
- **Método de extracción:** `pdfplumber` para PDFs nativos; NVIDIA PaddleOCR para PDFs escaneados
- **Unidades originales:** toneladas métricas → convertidas a Mt (÷ 1 000 000)
- **Regiones:** 4 subregiones del Caribe Mexicano y Atlántico

---

## Período cubierto y cobertura de datos

```
2000-03  ───────────────────────────────  2024-02   Mendeley (biomasa completa)
                                          2024-03  ───────────────────  2026-05   SEMAR
```

| Período | Fuente | Biomasa numérica | Semáforo |
|---|---|---|---|
| 2000-03 → 2024-02 | Mendeley | Sí (todas las regiones) | No aplica |
| 2024-03 → 2025-07 | SEMAR | No (formatos A y C sin tabla de biomasa) | Sí |
| 2025-08 → 2026-05 | SEMAR | Sí (CM, CC, CO, ACO) | Sí |

Los PDFs de SEMAR anteriores a agosto 2025 corresponden a los formatos "BOLETÍN DIARIO" (mar-abr 2024) y "ANÁLISIS IOGMC temprano" (mar-jul 2025), los cuales no incluyen tabla de biomasa regional desglosada. Solo contienen el nivel de semáforo.

---

## Descripción de columnas

### Columna de índice temporal

| Columna | Tipo | Ejemplo | Descripción |
|---|---|---|---|
| `month` | string | `2024-03` | Año-mes en formato ISO `YYYY-MM` |

### Regiones Mendeley (fuente: Hu et al. 2023)

Unidades: millones de toneladas métricas (Mt). Vacío (`NaN`) para los 23 meses SEMAR.

| Columna | Región | Descripción |
|---|---|---|
| `Mend_NSS_Mt` | NSS — North Sargasso Sea | Sargaso Norte; zona de origen histórico |
| `Mend_SSS_Mt` | SSS — South Sargasso Sea | Sargaso Sur |
| `Mend_GSR_Mt` | GSR — Gulf Stream Region | Corriente del Golfo |
| `Mend_ACR_Mt` | ACR — Antilles Current Region | Corriente Antillana; embudo hacia el Caribe |
| `Mend_GASB_Mt` | GASB — Great Atlantic Sargassum Belt | Gran Cinturón Atlántico; fuente principal |
| `Mend_NWGoM_Mt` | NW_GoM — Northwest Gulf of Mexico | Golfo de México noreste |

### Regiones SEMAR/IOGMC — biomasa (fuente: boletines diarios)

Unidades: millones de toneladas métricas (Mt). Vacío para los 288 meses Mendeley y para los 13 meses SEMAR sin tabla de biomasa.

| Columna | Región SEMAR | Descripción |
|---|---|---|
| `SEMAR_CM_Mt` | CM — Caribe Mexicano | Costa de Quintana Roo (Cozumel, Playa del Carmen, Cancún) |
| `SEMAR_CC_Mt` | CC — Caribe Central | Zona central del Caribe |
| `SEMAR_CO_Mt` | CO — Caribe Oriental | Arco Antillano y Caribe Este |
| `SEMAR_ACO_Mt` | ACO — Atlántico Central Occidental | Atlántico frente al Caribe; región origen/tránsito |

### Semáforo y conglomerados (SEMAR)

| Columna | Tipo | Valores / Unidad | Descripción |
|---|---|---|---|
| `semaforo_mensual` | string | ESCASO / MUY BAJO / BAJO / MODERADO / ALTO / MUY ALTO | Moda de los semáforos diarios del mes. Solo período SEMAR. |
| `conglomerado_cozumel` | string | SI / NO | Moda mensual. Indica si se reportó presencia de conglomerado de sargazo frente a Cozumel. |
| `num_conglomerados` | float | entero | Media mensual del número de conglomerados identificados en el Caribe Mexicano. |

### Corrientes marinas — 6 estaciones (SEMAR)

Disponibles solo cuando el boletín incluye datos operacionales (agosto 2025 en adelante para la mayoría de meses). Unidad de nudos: media mensual de las lecturas diarias. Dirección: moda mensual.

| Columna | Tipo | Descripción |
|---|---|---|
| `corriente_xcalak_nudos` | float | Velocidad de corriente en Xcalak (nudos) |
| `corriente_xcalak_dir` | string | Dirección dominante en Xcalak |
| `corriente_mahahual_nudos` | float | Velocidad en Mahahual |
| `corriente_mahahual_dir` | string | Dirección en Mahahual |
| `corriente_tulum_nudos` | float | Velocidad en Tulum |
| `corriente_tulum_dir` | string | Dirección en Tulum |
| `corriente_playa_carmen_nudos` | float | Velocidad en Playa del Carmen |
| `corriente_playa_carmen_dir` | string | Dirección en Playa del Carmen |
| `corriente_puerto_morelos_nudos` | float | Velocidad en Puerto Morelos |
| `corriente_puerto_morelos_dir` | string | Dirección en Puerto Morelos |
| `corriente_cancun_nudos` | float | Velocidad en Cancún |
| `corriente_cancun_dir` | string | Dirección en Cancún |

Valores de dirección: `norte`, `sur`, `este`, `oeste`, `noreste`, `noroeste`, `sureste`, `suroeste`.

### Viento — 2 zonas (SEMAR)

Los nudos de viento son rangos reportados como texto (ej. `"3-6"`, `"8-13"`); se almacena la moda mensual del rango. La dirección es la moda mensual.

| Columna | Tipo | Descripción |
|---|---|---|
| `viento_norte_nudos` | string | Rango de velocidad de viento en zona norte (ej. `"3-6"` nudos) |
| `viento_norte_dir` | string | Dirección del viento en zona norte |
| `viento_sur_nudos` | string | Rango de velocidad de viento en zona sur |
| `viento_sur_dir` | string | Dirección del viento en zona sur |

### Columnas alineadas (series homólogas cross-dataset)

Estas columnas combinan el dato Mendeley donde existe, y el dato SEMAR donde no, usando el mapeo de regiones equivalentes (ver sección siguiente).

| Columna | Lógica | Descripción |
|---|---|---|
| `aligned_CM` | `Mend_NWGoM_Mt` → `SEMAR_CM_Mt` | Serie larga "llegada a costas occidentales" |
| `aligned_ACO` | `Mend_GASB_Mt` → `SEMAR_ACO_Mt` | Serie larga "fuente Atlántica" |
| `aligned_CO` | `Mend_ACR_Mt` → `SEMAR_CO_Mt` | Serie larga "embudo Caribe" |

### Columna de fuente

| Columna | Valores | Descripción |
|---|---|---|
| `fuente` | `mendeley` / `semar` / `semar_sem_only` / `overlap` | Indica el origen del registro. `semar_sem_only`: SEMAR presente pero sin biomasa numérica. `overlap`: ambas fuentes tienen datos para ese mes (no ocurre en este dataset porque Mendeley termina en feb 2024 y SEMAR empieza en mar 2024). |

---

## Mapeo de regiones entre datasets

Las dos fuentes no comparten nomenclatura de regiones. El mapeo se basa en la posición geográfica y el rol oceanográfico de cada zona:

| Mendeley | SEMAR | Equivalencia | Observaciones |
|---|---|---|---|
| GASB | ACO | Alta | Ambas representan el Gran Cinturón Atlántico / zona fuente |
| ACR | CO | Alta | Corriente Antillana / Caribe Oriental: embudo hacia el Caribe Mexicano |
| NW_GoM | CM | Baja | Ambas son destinos finales, pero NW_GoM es Golfo de México y CM es Mar Caribe — sistemas de corriente distintos |
| NSS, SSS, GSR, CC | — | Sin equivalente directo | — |

La correlación GASB → NW_GoM es prácticamente nula (r = −0.11) precisamente porque son destinos en cuencas distintas. El uso de `aligned_CM` como serie larga debe interpretarse con esta limitación.

---

## Correlaciones con lag (sargazo_correlaciones_lag.csv)

Correlación de Pearson calculada para lags de 0 a 6 meses. La variable `lead` antecede a la variable `lag`.

| Par | Mejor r | Lag óptimo | n | Interpretación |
|---|---|---|---|---|
| GASB → ACR (Mendeley) | 0.721 | 1 mes | 287 | El Cinturón Atlántico predice la Corriente Antillana con 1 mes de adelanto |
| GASB → NW_GoM (Mendeley) | −0.108 | — | 282 | Sin correlación; cuencas oceanográficas distintas |
| ACO → CM (SEMAR) | 0.938 | 1 mes | 9 | Muy fuerte pero muestra pequeña (n=9); requiere más datos |
| ACO → CO (SEMAR) | 0.864 | 3 meses | 7 | ACO precede al Caribe Oriental por 3 meses |
| ACO/GASB → CM/NWGoM (combinado) | −0.108 | — | 286 | Hereda la no-correlación GASB–NW_GoM de Mendeley |
| ACO/GASB → CO/ACR (combinado) | 0.716 | 1 mes | 296 | Robusto con n=296; confirma el predictor regional |

El par **ACO/GASB → CO/ACR** con r=0.716 y lag=1 mes es el predictor más confiable con datos completos (n=296). La serie ACO→CM de SEMAR es más fuerte (r=0.938) pero provisional por el tamaño de muestra.

---

## Hallazgos clave

### Anomalía 2024
Los datos Mendeley de enero-febrero 2024 (últimos disponibles) muestran biomasa GASB de 5-6× la media histórica:

| Mes | Media histórica (Mt) | Valor 2024 (Mt) | Ratio | Z-score |
|---|---|---|---|---|
| Enero 2024 | 1.24 | 6.47 | 5.2× | +2.36 σ |
| Febrero 2024 | 1.22 | 6.85 | 5.6× | +2.44 σ |

Este megabloome se propagó hacia el Caribe con un lag aparente de 15-17 meses: el semáforo SEMAR pasó a **ALTO** en junio-julio 2025.

### Situación mayo 2026
- Semáforo SEMAR: **MUY ALTO**
- SEMAR_ACO: 0.512 Mt (tendencia alcista, de 0.14 Mt en enero a 0.51 Mt en mayo)
- Con lag ACO→CM de ~1 mes, la biomasa en Cozumel debería mantenerse alta en junio 2026

### Brecha de datos cuantitativa
No existe biomasa numérica regional para el período **marzo 2024 – julio 2025** (16 meses). Solo está disponible el nivel de semáforo para ese tramo. Esto genera un vacío en las series `SEMAR_CM_Mt`, `SEMAR_CO_Mt` y `SEMAR_ACO_Mt` que impide calcular correlaciones cuantitativas para ese período.

---

## Cómo usar el dataset

```python
import pandas as pd

df = pd.read_csv("sargazo_combinado_2000_2026.csv")
df["month"] = pd.to_datetime(df["month"])

# Serie larga fuente Atlántica (Mendeley hasta feb 2024, SEMAR desde ago 2025)
df["aligned_ACO"].plot(title="Biomasa fuente Atlántica 2000-2026")

# Solo datos con biomasa numérica confiable
bio = df[df["fuente"].isin(["mendeley", "semar"])]

# Solo período SEMAR con semáforo
semar = df[df["fuente"].str.startswith("semar")]
```

---

## Reproducibilidad

Para regenerar `sargazo_combinado_2000_2026.csv` y `sargazo_correlaciones_lag.csv`:

```bash
# Dependencias: pandas >= 2.0, openpyxl
uv run --with pandas --with openpyxl python3 combine_datasets.py
```

Los archivos fuente necesarios son:
- `boletines_sargazo_MASTER.csv` — generado por `extract_boletines.py`
- `Sargassum_biomass_subregions.xlsx` — descargado de Mendeley DOI 10.17632/zcyd5wvncc.1
