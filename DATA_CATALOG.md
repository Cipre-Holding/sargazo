# Catálogo de Datos — Proyecto Sargazo Cozumel

**Versión:** 13 de Mayo de 2026
**Propósito:** Inventario completo de todos los archivos de datos, su origen, uso y estado.

---

## Convención de estado

| Símbolo | Significado |
|---|---|
| ✅ | Usado activamente en pipeline o frontend |
| 📡 | Servido vía API pero no en modelo predictivo |
| ⏳ | Generado pero sin consumidor actual |
| 🗑️ | Obsoleto / ya eliminado |

---

## 1. Datos de entrada (SEMAR)

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| `boletines_sargazo_2024.csv` | 18 KB | ✅ | extract_boletines | backup parcial |
| `boletines_sargazo_2025.csv` | 36 KB | ✅ | extract_boletines | backup parcial |
| `boletines_sargazo_2026.csv` | 17 KB | ✅ | extract_boletines | backup parcial |
| **`boletines_sargazo_MASTER.csv`** | **73 KB** | **✅** | **extract_boletines → merge** | **combine_datasets, modelos (todos)** |

**27 columnas:** fecha, num_boletin, semaforo, CM, CC, CO, ACO, num_conglomerados, conglomerado_cozumel, 6 corrientes (nudos+dir), viento N/S (nudos+dir), archivo, año

---

## 2. Datos procesados (pipeline)

### 2.1 Combinado

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`sargazo_combinado_2000_2026.csv`** | **64 KB** | **✅** | **combine_datasets** | **prepare_features** |
| `sargazo_correlaciones_lag.csv` | 2 KB | 📡 | combine_datasets | API endpoint |

**34 columnas:** 7 Mendeley, 6 corrientes SEMAR, 4 SEMAR biomasa, semáforo, conglomerado, vientos, dirs, 3 aligned, fuente

### 2.2 Features

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`features_fuente.csv`** | **70 KB** | **✅** | **prepare_features** | **modelos_fase0/1 Prophet** |
| **`features_prediccion_cm.csv`** | **8 KB** | **✅** | **prepare_features** | **modelos_fase0/1/2** |
| **`features_semaforo.csv`** | **2 KB** | **✅** | **prepare_features** | **modelos_fase0 logística** |
| **`features_growth.csv`** | **10 KB** | **✅** | **prepare_features** | **Prophet + SST/wind** |
| `residuos_estocasticos.csv` | 42 KB | 📡 | prepare_features | API endpoint |

**features_prediccion_cm.csv (39 columnas):** month, log_cm, semaforo_ord, conglomerado, num_conglomerados, log_aco, log_aco_lag1/2/3, log_cc, log_co, month_sin/cos, mes, anio, 6 corrientes nudos, 4 corrientes dir, viento N/S mid+dir, z_score_aco, log_satsum_caribe/zee, satsum_caribe/zee_mt, sst, sst_anom, uwnd_ms, vwnd_ms, onshore_cozumel_ms

### 2.3 Predicciones

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`predicciones_fase0.json`** | **3 KB** | **✅** | **modelos_fase0** | **API, frontend** |
| **`predicciones_fase1.json`** | **6 KB** | **✅** | **modelos_fase1** | **API, frontend** |
| **`predicciones_fase2.json`** | **3 KB** | **📡** | **modelos_fase2_wind** | **API endpoint** |

### 2.4 Backtest

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`backtest_resultados.json`** | **5 KB** | **✅** | **backtest_modelos** | **documentación** |
| **`backtest_forecast_resultados.json`** | **1 KB** | **✅** | **backtest_forecast** | **documentación** |
| **`validacion_forecast.json`** | **2 KB** | **✅** | **validar_forecast** | **documentación** |

---

## 3. Datos satelitales

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`satsum_caribe_mensual.csv`** | **2 KB** | **✅** | **NVIDIA PaddleOCR** | **features, mapas** |
| **`satsum_zee_mex_mensual.csv`** | **3 KB** | **✅** | **NVIDIA PaddleOCR** | **ML risk BC, features** |
| **`satsum_regiones_geo.json`** | **1 KB** | **✅** | **manual** | **mapas** |

**172 pts Caribe (2012-2026), 179 pts ZEE Mexicana (2011-2026).** Columnas: year, month, biomasa_mt.

---

## 4. Riesgo costero NOAA SIR

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`noaa_sir_riesgo_costero_qroo.geojson`** | **244 MB** | **✅** | **descargar_noaa_sir** | **interpolar_riesgo_ml, API** |
| **`noaa_sir_riesgo_costero_qroo_reduced.geojson`** | **1.5 MB** | **✅** | **descargar_noaa_sir** | **frontend (3 fechas)** |
| **`noaa_sir_riesgo_ml_corregido.geojson`** | **0.6 MB** | **✅** | **interpolar_riesgo_ml_v2** | **API, frontend** |
| **`risk_by_beach.json`** | **4 KB** | **✅** | **risk_by_beach** | **API, frontend** |
| `noaa_sir_resumen_diario.csv` | 13 KB | 📡 | descargar_noaa_sir | API endpoint |
| `noaa_sir_kmz/` | 315 KMZ | ✅ | descargar_noaa_sir | fuente original (conservar) |

**315 fechas, 52,551 features.** Distribución: LOW 12,376 | WARNING 2,688 | MEDIUM 20,222 | HIGH 17,265

**ML interpolation (2026-05-11):** 1,149 celdas — LOW 690 | WARNING 173 | MEDIUM 223 | HIGH 63

**Beach risk (10 segmentos):** Top 3 — Isla Mujeres 71%, Cancún 66%, Cozumel Norte 65%

---

## 5. Datos ambientales (nuevas fuentes)

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`sst_cozumel_mensual.csv`** | **3 KB** | **✅** | **descargar_oisst** | **features_prediccion_cm (sst, sst_anom)** |
| **`viento_cozumel_mensual.csv`** | **4 KB** | **✅** | **descargar_viento_ncep** | **features_prediccion_cm (uwnd, vwnd, onshore)** |

**SST:** NOAA OISST v2.1, 76 meses (2020-2026), 25.6-30.6°C, 0.25°
**Viento:** NCEP/NCAR Reanalysis, 74 meses (2020-2026), componentes U/V 10m, onshore Cozumel

---

## 6. Modelo Lagrangiano

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`lagrangian_fbm_trayectorias.csv`** | **246 KB** | **✅** | **modelo_lagrangiano_fbm** | **ML risk weight** |
| **`lagrangian_fbm_finales.csv`** | **8 KB** | **✅** | **modelo_lagrangiano_fbm** | **interpolar_riesgo_ml** |

---

## 7. Pronóstico 14 días RTOFS+GFS

| Archivo | Tamaño | Estado | Generado por | Usado por |
|---|---|---|---|---|
| **`rtofs_carib_surface.nc`** | **108 MB** | **✅** | **download** | **modelo_pronostico_7dias** |
| **`gfs_carib_wind.nc`** | **4 MB** | **✅** | **download** | **modelo_pronostico_7dias** |
| **`forecast_7d_trayectorias.csv`** | **136 KB** | **✅** | **modelo_pronostico_7dias** | **API, frontend** |
| **`forecast_kde_acumulaciones.json`** | **540 KB** | **✅** | **modelo_pronostico_7dias** | **API, frontend (25 horizontes)** |
| `forecast_posiciones_*.csv` | 6-8 KB c/u | 📡 | modelo_pronostico_7dias | API endpoint (28 horizontes) |

---

## 8. Backend

| Archivo | Tamaño | Estado | Descripción |
|---|---|---|---|
| **`backend/`** | 6 routers, 15+ endpoints | ✅ | FastAPI application |
| **`sargazo.db`** | Variable | ✅ | SQLite database (manual_inputs + download_log) |

---

## 9. Frontend

| Archivo | Tamaño | Estado | Descripción |
|---|---|---|---|
| **`frontend/`** | React 19 + Vite 8 | ✅ | SPA con mapa MapLibre GL |

---

## 10. Infraestructura

| Archivo | Tamaño | Estado | Descripción |
|---|---|---|---|
| **`Dockerfile`** | Multi-stage | ✅ | Node build → Python slim |
| **`dev.sh`** | Script | ✅ | Dev local (backend + frontend) |

---

## 11. Archivos eliminados (ya no existen)

| Archivo | Tamaño (liberado) | Razón |
|---|---|---|
| `mapa_sargazo_caribe.html` | 18 KB | Reemplazado por frontend React |
| `mapa_sargazo_completo.html` | 77 KB | Reemplazado por frontend React |
| `mapa_sargazo_v2.html` | 614 KB | Reemplazado por frontend React |
| `mapa_sargazo_v3.html` | 8.2 MB | Reemplazado por frontend React |
| `mapa_sargazo_v4.html` | 6.3 MB | Reemplazado por frontend React |
| `mapa_sargazo_v5.html` | 22 MB | Reemplazado por frontend React |
| `mapa_sargazo_v6.html` | 22 MB | Reemplazado por frontend React |
| `lagrangian_trajectories.csv` | 99 KB | Legacy HYCOM (reemplazado por fBm) |
| `lagrangian_hycom_*.csv` | 185 KB | Legacy HYCOM (reemplazado por fBm) |
| `lagrangian_final_positions.csv` | 1 KB | Legacy HYCOM |
| `rtofs_forecast_*.csv` | 18 KB | Legacy RTOFS (reemplazado) |
| `rtofs_gfs_forecast_*.csv` | 36 KB | Legacy RTOFS+GFS (reemplazado) |
| `rtofs_carib_currents.nc` | 27 MB | No usado |
| `rtofs_carib_forecast.nc` | 108 MB | No usado |
| `noaa_sir_timeslider.geojson` | 208 MB | No usado |
| `mendeley_page.html` | 159 KB | Backup web |
| `download_sargasso.py` | 2 KB | Script no usado |
| `analyze_data.py` | 2 KB | Script no usado |
| **Total** | **~403 MB** | |
