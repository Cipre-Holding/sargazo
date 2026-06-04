# Roadmap de Mejoras — Sargazo Cozumel

**Análisis basado en:** Junio 2026  
**Estado actual del sistema:** Operativo en Cloud Run. Confianza 83/100 (ALTA).

---

## Problemas activos (ordenados por severidad)

| # | Problema | Severidad | Impacto |
|---|----------|-----------|---------|
| P1 | Solo 14 pares ACO+CM — todos los modelos overfitean | CRÍTICO | MAPE > 100% en todos los modelos |
| P2 | IC 80% inutilizable [6k — 293k ton] — rango 44× | ALTO | Comunicación de incertidumbre imposible |
| P3 | SQLite en `/tmp` — historial de logs se pierde al reiniciar | ALTO | Sin auditoría de ejecuciones en Cloud Run |
| P4 | Pipeline no corre en Cloud Run — solo local | ALTO | Datos pueden quedarse desactualizados si no hay push |
| P5 | SATsum sin API — descarga manual mensual obligatoria | MEDIO | Cuello de botella operativo |
| P6 | Forecast Lagrangiano: solo 11% cobertura a 48h | MEDIO | Poca utilidad predictiva en Cozumel específicamente |
| P7 | NOAA SIR KMZ: 244 MB en imagen Docker | MEDIO | Build lento, imagen pesada |
| P8 | Prophet asume H=0.5 implícito, pero la serie tiene H=0.8 | BAJO | Subestima persistencia y amplía IC innecesariamente |
| P9 | SST y viento aportan solo +2.7% y +0.3% de R² | BAJO | Features de poca utilidad marginal |
| P10 | Cozumel Sur enmascarado como tierra en ML risk | BAJO | Celdas faltantes en el sur de la isla |

---

## Mejoras por área

### A. Datos — Ampliar base de entrenamiento (CRÍTICO)

**A1. Recuperar datos SEMAR 2022–2023** *(Alta prioridad)*
- Los boletines diarios 2022–2023 existen en archivo SEMAR pero no están descargados
- Podría triplicar el dataset de 14 a ~40 pares ACO+CM
- Ejecutar `download_boletines.py` con fechas extendidas
- Esperado: R² sube de 0.78 a 0.85+, IC se estrecha significativamente

**A2. API AFAI satelital directa** *(Media prioridad)*
- Calcular AFAI (Alternative Floating Algae Index) directamente desde imágenes MODIS/VIIRS
- Seguir método Hu et al. 2023 (Res-UNet): clasificación pixel-a-pixel → biomasa
- Elimina dependencia de SEMAR como proxy
- Herramientas: `earthengine-api` o `pystac` + MODIS Terra/Aqua

**A3. Automatizar SATsum** *(Media prioridad)*
- Hacer scraping del explorador GIS de CONABIO al primer día de cada mes
- O contactar CONABIO para acceso API directo
- Elimina el cuello de botella manual mensual

**A4. Ampliar ventana SST y viento** *(Baja prioridad)*
- Extender OISST y NCEP a 2010 para capturar la ruptura de 2011 (inicio del boom)
- Potencialmente mejora los modelos en el período post-2011

---

### B. Modelos ML — Mejorar precisión

**B1. ARFIMA(p, d=0.3, q) con d Hurst** *(Alta prioridad)*
- El exponente Hurst H=0.8047 implica d=0.3 (proceso de memoria larga)
- `statsmodels.tsa.arima_model.ARIMA` no soporta d fraccionario
- Usar `arch` library o implementar ARFIMA manualmente
- Esperado: mejora el modelado de la persistencia, IC más realista

**B2. Ensemble con ponderación dinámica** *(Media prioridad)*
- Actualmente los 3 modelos del ensemble tienen pesos casi idénticos (~0.33 cada uno)
- Implementar ponderación por rendimiento reciente (rolling RMSE de los últimos 6 meses)
- Permite que el modelo más preciso en temporada actual domine

**B3. Regresión cuantílica** *(Media prioridad)*
- Complementa el ensemble para IC más calibrados
- `statsmodels.regression.quantile_regression.QuantReg`
- IC derivado empíricamente en lugar de asumir distribución normal

**B4. Modelo de mezcla: SEMAR + satélite** *(Baja prioridad, alta complejidad)*
- Cuando A2 esté disponible: combinar predictor ACO_lag1 (SEMAR) con AFAI_lag1 (MODIS)
- Potencialmente elimina la limitación de n=14

---

### C. Pipeline — Automatización y robustez

**C1. Pipeline en Cloud Run con volumen GCS** *(Alta prioridad)*
- Montar un bucket GCS como volumen en Cloud Run
- Artefactos grandes (KMZ, NetCDF) se leen/escriben en GCS, no en imagen Docker
- Requiere: `google-cloud-storage` en requirements, `gcs_fuse` mount, IAM role
- Habilita el trigger semanal APScheduler sin necesidad de push manual

**C2. Base de datos en Cloud SQL (SQLite → PostgreSQL)** *(Media prioridad)*
- SQLite en `/tmp` se pierde al reiniciar el contenedor
- Migrar a Cloud SQL PostgreSQL (o al menos a GCS bucket para el `.db`)
- Preserva historial de `download_log` y `manual_inputs` entre reinicios

**C3. Min-instances=1 en Cloud Run** *(Baja prioridad, costo)*
- Elimina cold start de 20-30 segundos en primer acceso
- Costo: ~$15-25 USD/mes por mantener la instancia activa
- Alternativa sin costo: keep-alive cron job desde GCP Cloud Scheduler (ping /api/health cada 10 min)

**C4. GitHub Actions → Artifact Registry** *(Baja prioridad)*
- Migrar Cloud Build a GitHub Actions para mayor control
- Permite tests automáticos antes del deploy

---

### D. Forecast Lagrangiano — Mejorar cobertura

**D1. HYCOM en lugar de RTOFS** *(Alta prioridad)*
- RTOFS solo tiene 6 días de forecast → partículas salen del área antes de 7 días
- HYCOM (Global) tiene hindcast + nowcast + 5 días: cubre mejor el Mar Caribe
- API: `https://tds.hycom.org/thredds/catalog/GLBy0.08/expt_93.0/catalog.html`

**D2. Área de siembra dinámica** *(Media prioridad)*
- Actualmente las 2,000 partículas se siembran en posición fija (región de ACO atlántica)
- Usar AFAI actual para sembrar donde haya sargazo detectado por satélite ese día
- Mejora la relevancia del forecast para la semana específica

**D3. Ensamblar trayectorias con incertidumbre** *(Baja prioridad)*
- Múltiples runs con pequeñas perturbaciones en IC (bootstrapping de fBm)
- IC espacial del forecast → banda de confianza de trayectoria

---

### E. Frontend — UX y visualización

**E1. Selector de fecha NOAA SIR** *(Alta prioridad, ya parcialmente implementado)*
- El endpoint `/api/forecast/geodata/sir/dates` retorna 315 fechas
- Implementar slider de fecha en LayerControl para ver el historial diario
- Actualmente solo muestra las últimas 3 fechas del GeoJSON reducido

**E2. Alerta de datos desactualizados** *(Media prioridad)*
- Si la predicción más reciente tiene > 7 días, mostrar warning en dashboard
- Usar `confidence_score.last_updated` del JSON de predicciones

**E3. Exportar predicción como PDF** *(Baja prioridad)*
- Botón "Descargar reporte" que genere PDF con predicción ensemble + chart + IC
- Útil para comunicación con autoridades / hoteleros

---

### F. Investigación — Mejorar la ciencia

**F1. Validar ACO local (plumas costeras QRoo) como predictor** *(Alta prioridad)*
- Los boletines SEMAR incluyen `conglomerado_cozumel` (conglomerados frente a Cozumel)
- Correlacionar ese valor con CM del mes siguiente → predictor local sin lag intercontinental
- Podría tener r > 0.95 (señal más directa que ACO atlántico)

**F2. Modelo Lagrangiano con climatología** *(Media prioridad)*
- Construir 20 años de trayectorias con HYCOM reanalysis (HYCOM3.1 hindcast)
- Calcular probabilidad de arribo por playa y por mes del año
- Climatología de riesgo costero independiente de pronóstico numérico

**F3. Red neuronal con imagen satelital** *(Largo plazo)*
- Siguiendo Hu et al. 2023 (Res-UNet): CNN sobre parches MODIS 256×256
- Entrada: imágenes MODIS Rrs_645, Rrs_469, Rrs_555
- Salida: máscara binaria sargazo + AFAI estimado
- Requiere etiquetado de entrenamiento y GPU

---

## Cronograma sugerido

| Trimestre | Mejoras |
|-----------|---------|
| **Q3 2026** | A1 (recuperar 2022-2023), C1 (GCS volume), E1 (date slider SIR), B1 (ARFIMA) |
| **Q4 2026** | A3 (SATsum automation), F1 (conglomerado_cozumel), D1 (HYCOM), C2 (Cloud SQL) |
| **Q1 2027** | A2 (AFAI MODIS), B2 (ensemble dinámico), D2 (siembra dinámica), F2 (climatología Lagrangiana) |
| **2027+** | F3 (Res-UNet CNN), B4 (modelo de mezcla), C4 (GitHub Actions) |

---

## Estado de score de confianza con mejoras

| Escenario | n pares | R² esperado | MAPE estimado | IC 80% (ton) | Score |
|-----------|---------|-------------|---------------|--------------|-------|
| **Actual** | 14 | 0.78 | >100% | [6k–293k] | 83/100 |
| + datos 2022-23 | ~40 | 0.85 | ~60-70% | [20k–120k] | ~88/100 |
| + ARFIMA(d=0.3) | ~40 | 0.87 | ~50% | [30k–80k] | ~91/100 |
| + AFAI MODIS | 100+ | >0.90 | <40% | [40k–60k] | >95/100 |
