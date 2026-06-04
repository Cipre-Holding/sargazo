# Pipeline de Datos — Sargazo Cozumel

**Última actualización:** Junio 2026  
**Tiempo total estimado:** 70–90 minutos (en local)  
**Entorno:** Local únicamente. El pipeline NO corre dentro de Cloud Run.

---

## Contexto

El pipeline es una cadena de 10 scripts Python que transforma fuentes heterogéneas de datos
(PDFs, KMZ, NetCDF, XLSX) en los artefactos JSON/GeoJSON/CSV que el backend sirve al frontend.
Se ejecuta manualmente o vía APScheduler (lunes 06:00 UTC), pero en producción ese trigger
dispara solo la descarga del estado del pipeline — los artefactos finales deben estar ya
embebidos en la imagen Docker.

---

## Restricción crítica: Pipeline vs Cloud Run

| Aspecto | Implicación |
|---------|-------------|
| NOAA SIR GeoJSON | 244 MB — no cabe en build context, no se descarga en runtime |
| NetCDF RTOFS | 108 MB — requiere descarga NOMADS (~10 min) |
| Tiempo total | ~70-90 min — excede timeout Cloud Run (600s) |
| SQLite `/tmp` | Se borra al reiniciar contenedor → historial de logs se pierde |
| **Flujo actual** | Ejecutar localmente → `git push main` → Cloud Build reconstruye imagen con artefactos |

---

## Paso a paso

### Paso 1 — Descarga boletines SEMAR
```
Script:  download_boletines.py
Input:   HTTP GET https://iogmc.semar.gob.mx/ (boletines PDF diarios)
Output:  backend/boletines_2024/*.pdf, backend/boletines_2025/*.pdf, backend/boletines_2026/*.pdf
Tiempo:  5–10 min (velocidad red)
```

SEMAR publica boletines en 4 formatos distintos según el período:
- **Formato A** (2024): tabla HTML en boletin con 7 columnas
- **Formato B** (mid-2024): PDF estructurado con campos individuales
- **Formato C** (2025): layout multicolumna con imagen de satélite
- **Formato D** (2026): formato simplificado, campos reducidos

### Paso 2 — OCR y extracción de campos
```
Script:  extract_boletines.py
Input:   PDF files
Output:  boletines_sargazo_2024.csv, 2025.csv, 2026.csv → boletines_sargazo_MASTER.csv
Tiempo:  10–15 min (~604 boletines)
```

Usa `pdfplumber` + regex adaptados por formato. Extrae 27 columnas:
`fecha, num_boletin, semaforo, CM, CC, CO, ACO, conglomerados, corrientes×6, vientos×2, etc.`

### Paso 3 — Combinación de datasets
```
Script:  combine_datasets.py
Input:   boletines_sargazo_MASTER.csv + Mendeley XLSX (sargazo_gasb_2000_2024.xlsx)
Output:  sargazo_combinado_2000_2026.csv (311 filas, 34 columnas)
         sargazo_correlaciones_lag.csv
Tiempo:  < 1 min
```

Alinea la serie Mendeley GASB (2000–2024, 288 meses) con la serie SEMAR (2024–2026, 23 meses).
Genera columna `aligned_ACO` para Prophet y `aligned_CM` para correlaciones.

> **Advertencia:** `aligned_CM` del dataset Mendeley corresponde a NWGoM (Golfo Norte de México),
> NO al Caribe Mexicano. La correlación NWGoM↔CM es negativa. Solo usar SEMAR para CM.

### Paso 4 — Feature engineering
```
Script:  prepare_features.py
Input:   sargazo_combinado_2000_2026.csv + sst_cozumel_mensual.csv + viento_cozumel_mensual.csv
         + satsum_caribe_mensual.csv + satsum_zee_mex_mensual.csv
Output:  features_prediccion_cm.csv   (14 pares, 39 columnas)
         features_semaforo.csv         (21 filas, semáforo como variable ordinal)
         features_growth.csv           (23 filas, Δlog_cm para Prophet)
         features_fuente.csv           (303 filas, serie completa para Prophet)
         residuos_estocasticos.csv     (288 filas, proceso OU)
Tiempo:  < 1 min
```

Correcciones aplicadas (mayo 2026):
- **Lags ACO** calculados solo sobre índice SEMAR (no mezclado con Mendeley) → r sube de 0.47 a 0.918
- **Mediana mensual** en lugar de media para robustez ante pulsos diarios
- **Corrección del gap** mar→abr 2024 (primer boletín SEMAR con dato ACO fue abril 2024)
- **Corrección de unidades** ACO: Mendeley en Mt, SEMAR en Mt (verificado)

### Paso 5 — Modelos Fase 0
```
Script:  modelos_fase0.py
Input:   features_prediccion_cm.csv, features_semaforo.csv, features_fuente.csv
Output:  predicciones_fase0.json
Tiempo:  < 1 min
```

5 modelos base: regresión lineal, delta, logística ordinal, Prophet, AR(1).
Todos usan n=14 pares SEMAR. Prophet usa 303 meses de aligned_ACO.

### Paso 6 — Modelos Fase 1 + Ensemble
```
Script:  modelos_fase1.py
Input:   features_prediccion_cm.csv, features_growth.csv
Output:  predicciones_fase1.json (incluye ensemble + confidence score)
Tiempo:  5–10 min (grid search Prophet 20 combinaciones × ~35 CV folds)
```

6 modelos extendidos. El ensemble usa los 3 mejores por R² LOOCV.
Grid Prophet reducido a 20 combinaciones (modo `multiplicative` eliminado — nunca gana).

### Paso 7 — Descarga NOAA SIR
```
Script:  descargar_noaa_sir.py
Input:   NOAA Sargassum Inundation Report (NOAA AOML) — KMZ por fecha
Output:  noaa_sir_kmz/*.kmz (315 archivos)
         noaa_sir_riesgo_costero_qroo.geojson (244 MB — 52,551 features)
         noaa_sir_riesgo_costero_qroo_reduced.geojson (1.5 MB — 3 fechas recientes)
         noaa_sir_resumen_diario.csv
Tiempo:  15–25 min (descarga + conversión KMZ→GeoJSON)
```

KMZ descargados: Jul 2025 → May 2026 (315 días). Distribución de riesgo:
LOW 12,376 | WARNING 2,688 | MEDIUM 20,222 | HIGH 17,265

### Paso 8 — Interpolación ML Risk
```
Script:  interpolar_riesgo_ml_v2.py
Input:   noaa_sir_riesgo_costero_qroo.geojson + lagrangian_fbm_finales.csv
         + sargazo_combinado_2000_2026.csv
Output:  noaa_sir_riesgo_ml_corregido.geojson (0.6 MB — 582 polígonos)
Tiempo:  5–10 min (interpolación Wendland C2 sobre malla 98×129)
```

Kernel Wendland C2 anisotrópico: σ_lon=0.5°, σ_lat=0.25°, R_eff=1.8 (100×50 km).
582 celdas: LOW(122) | WARNING(164) | MEDIUM(218) | HIGH(78).
Cozumel: 86 celdas con riesgo medio 0.524.

### Paso 9 — Beach Risk
```
Script:  risk_by_beach.py
Input:   noaa_sir_riesgo_costero_qroo.geojson
Output:  risk_by_beach.json
Tiempo:  < 1 min
```

10 segmentos costeros. Top 3 riesgo histórico (315 días):
Isla Mujeres 71% | Cancún 66% | Cozumel Norte 65%

### Paso 10 — Forecast 14 días (bajo demanda)
```
Script:  modelo_pronostico_7dias.py
Input:   rtofs_carib_surface.nc (108 MB) + gfs_carib_wind.nc (4 MB)
Output:  forecast_kde_acumulaciones.json (540 KB — 25 horizontes)
         forecast_7d_trayectorias.csv (136 KB — 2,000 partículas)
Tiempo:  5–10 min
```

OpenDrift: 2,000 partículas, paso 30 min, windage 2%.
Corrientes RTOFS ×1.5 + viento GFS 10m. KDE bandwidth 0.08°.
Precisión vs NOAA SIR a 48h: ~11% cobertura (modelo direccional, no cuantitativo).

---

## Flujo completo (diagrama)

```
SEMAR PDFs ──────────────────────────────────────────────────────────────────────────┐
  └── download_boletines.py                                                           │
      └── extract_boletines.py ──→ MASTER.csv ──→ combine_datasets.py               │
                                                       │                              │
Mendeley XLSX ──────────────────────────────────────── ┘                              │
SST OISST ───────────────────────────────────────────────→ prepare_features.py        │
Viento NCEP ─────────────────────────────────────────────────  │                      │
SATsum PDFs ─────────────────────────────────────────────────  │                      │
                                                                 ▼                    │
                                                    modelos_fase0.py + fase1.py       │
                                                           │                          │
NOAA SIR KMZ ────→ descargar_noaa_sir.py ──────────────────┼──→ interpolar_riesgo   │
Lagrangian fBm ──────────────────────────────────────────────      └──→ risk_by_beach│
                                                                                      │
RTOFS + GFS ──────────────────────────────────────→ modelo_pronostico_7dias          │
                                                                                      │
                    ┌─────────────────────────────────────────────────────────────────┘
                    ▼
             Artefactos en /home/alex/sargazo/
             *.json, *.geojson, *.csv
                    │
             git push main
                    │
             Cloud Build → Docker build (COPY . .) → deploy Cloud Run
```

---

## Variables de entorno necesarias

| Variable | Uso | Ejemplo |
|----------|-----|---------|
| `DATABASE_URL` | SQLite path | `sqlite:////tmp/sargazo.db` |
| `ALLOWED_ORIGINS` | CORS | `https://sargazo-xvcvxyopra-pv.a.run.app` |

---

## Dependencias externas (URLs)

| Servicio | URL | Acceso | Período |
|----------|-----|--------|---------|
| SEMAR IOGMC | https://iogmc.semar.gob.mx | HTTP público | 2024→ |
| NOAA SIR | https://www.star.nesdis.noaa.gov | HTTP público | Jul 2025→ |
| OISST | PSL THREDDS OPeNDAP | HTTP público | 1981→ |
| NCEP Reanalysis | PSL THREDDS OPeNDAP | HTTP público | 1948→ |
| RTOFS | NOMADS THREDDS | HTTP público | 6d rolling |
| GFS | NOMADS CGI | HTTP público | 16d rolling |
| SATsum CONABIO | Explorador GIS SEMAR | **Manual** | 2010→ |

> SATsum no tiene API pública — requiere descarga manual mensual del explorador GIS de CONABIO/SEMAR.
