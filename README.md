# Sargazo Cozumel — Predicción Operativa de Arribo de Sargazo

Sistema de monitoreo satelital, modelos estadísticos y simulación Lagrangiana para
predecir el arribo de sargazo a las costas de Cozumel con 1–14 días y hasta 1–2 meses
de anticipación. Desplegado en Google Cloud Run con pipeline semanal automático.

**URL:** [sargazo-xvcvxyopra-pv.a.run.app](https://sargazo-xvcvxyopra-pv.a.run.app)

---

## ¿Qué es y para qué sirve?

El sargazo es un alga marina que desde 2011 arriba masivamente a las costas del Caribe
mexicano, afectando al turismo, la navegación, los ecosistemas costeros y la calidad
de vida. Este sistema integra **datos satelitales, boletines oficiales, modelos
estadísticos y simulación numérica** para anticipar cuándo y dónde llegará el sargazo,
permitiendo a autoridades y hoteleros tomar decisiones informadas.

### Capacidades principales

| Capacidad | Horizonte | Qué entrega |
|-----------|-----------|-------------|
| **Predicción mensual** | 1–2 meses | Toneladas de biomasa esperadas + intervalo de confianza |
| **Riesgo costero satelital** | Diario (315 días históricos) | Mapa de calor con nivel LOW / WARNING / MEDIUM / HIGH |
| **Forecast Lagrangiano** | 12h – 14 días | Mapa de densidad de partículas + trayectorias |
| **Riesgo por playa** | Histórico (315 días) | % de días con riesgo HIGH+MED por segmento costero |
| **Dashboard** | Tiempo real | Charts de evolución, comparación de modelos, salud del sistema |

---

## ¿Cómo funciona?

### Arquitectura general

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React)                   │
│  MapLibre GL (mapa) · Sidebar (pred/capas/sistema)  │
│  Dashboard (charts SVG) · InfoPanel (documentación)  │
│                  sirve estáticos                     │
└────────────────────────┬────────────────────────────┘
                         │ HTTP /api/*
┌────────────────────────▼────────────────────────────┐
│                   BACKEND (FastAPI)                   │
│  predictions · observations · forecast · download    │
│  manual · scheduler (APScheduler semanal)            │
│               + SQLite (sargazo.db)                  │
└────────────────────────┬────────────────────────────┘
                         │ import
┌────────────────────────▼────────────────────────────┐
│              PIPELINE DE DATOS (Python)               │
│  combine_datasets → prepare_features →               │
│  modelos_fase0 → modelos_fase1 → confidence_score →  │
│  interpolar_riesgo_ml_v2 → risk_by_beach →           │
│  modelo_pronostico_7dias                              │
│    ↓ datos ↓                                          │
│  SEMAR · Mendeley · NOAA SIR · OISST · NCEP · SATsum │
│  RTOFS · GFS                                          │
└─────────────────────────────────────────────────────┘
```

### Fuentes de datos

| Fuente | Qué aporta | Período | Variables clave |
|--------|-----------|---------|-----------------|
| **SEMAR** | Boletines diarios de biomasa costera | 2024–2026 (604 reg.) | CM (ton), ACO (Mt), semáforo |
| **Mendeley GASB** | Serie histórica atlántica (Hu et al.) | 2000–2024 (288 meses) | log_biomasa, aligned_ACO |
| **NOAA SIR** | Riesgo costero satelital diario | 315 días, 52,551 celdas | LOW/MEDIUM/HIGH por celda |
| **OISST SST** | Temperatura superficial del mar | 2020–2026 (76 meses) | sst, sst_anom |
| **NCEP/NCAR** | Viento reanálisis | 2020–2026 (74 meses) | uwnd, vwnd, onshore Cozumel |
| **SATsum** | Biomasa satelital mensual | Mensual | Caribe, ZEE Mexicana |
| **RTOFS + GFS** | Corrientes + viento para forecast | Diario | U/V currents, U/V wind |

### Modelos predictivos

**Fase 0 — Modelos base (5):**
- Regresión lineal ponderada (kernel tricúbico): log(CM) ~ log(ACOₜ₋₁)
- Regresión delta: Δlog(CM) ~ log(ACOₜ₋₁) + Δlog(ACOₜ₋₁)
- Logística ordinal: semáforo ~ log(ACOₜ₋₁)
- Prophet: aligned_ACO ~ tendencia + estacionalidad
- AR(1) fallback: log(CMₜ) ~ log(CMₜ₋₁)

**Fase 1 — Modelos extendidos + Ensemble:**
- Ridge, Bayesian Ridge, Rolling Window, ARIMAX, Segmentada, Prophet Tuneado
- **Ensemble ponderado por R²** de LOOCV (3 mejores modelos)
- **Bias correction por tendencia** (×1.25 si sube, ×0.85 si baja)
- **Calibración isotónica** del IC usando RMSE del backtest

**Interpolación espacial:**
- Función Wendland C2 sobre datos NOAA SIR → malla 0.04° (~4 km)
- Max-pooling costero para no subestimar riesgo en segmentos críticos

**Forecast Lagrangiano:**
- 2,000 partículas con OpenDrift, RTOFS (corrientes) + GFS (viento)
- KDE gaussiano bandwidth 0.08° (~9 km)
- 25 horizontes cada 12h hasta 336h (14 días)

---

## Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| Backend | Python 3.13 / FastAPI / Uvicorn / Gunicorn |
| Frontend | React 19 / Vite / TypeScript / Tailwind v4 |
| Mapas | MapLibre GL JS v5 / mapcn |
| Charts | SVG inline (sin librerías externas) |
| Base de datos | SQLite (SQLAlchemy ORM, en `/tmp` en Cloud Run) |
| Pipeline | Python scripts secuenciales + APScheduler |
| Contenedor | Docker multi-stage (Node build → Python slim) |
| Infraestructura | Google Cloud Run + Cloud Build + Artifact Registry |
| Tamaño imagen | ~700 MB (Python + dependencias científicas) |
| Región | northamerica-south1 (México) |

---

## Predicción actual

| Métrica | Valor |
|---------|-------|
| **Predicción ensemble junio 2026** | **52,571 ton** |
| Cambio vs mayo 2026 | +1.4% |
| IC 80% | [6,596 — 293,445] ton |
| Confianza del sistema | **83/100 (ALTA)** |
| Mejor predictor individual | ACO_lag1 → CM (r=0.918) |
| Exponente Hurst (memoria) | H=0.8047 (memoria larga) |
| Pares SEMAR disponibles | 14 |
| R² LOOCV promedio | 0.78 |

---

## Documentación detallada

| Documento | Contenido |
|-----------|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura completa, stack, estructura de directorios |
| [`docs/PIPELINE.md`](docs/PIPELINE.md) | Pipeline de datos paso a paso con timing y restricciones |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Problemas conocidos y roadmap de mejoras priorizado |
| [`docs/MODELS/MODEL_CARDS.md`](docs/MODELS/MODEL_CARDS.md) | Fichas de todos los modelos con métricas |
| [`docs/API/API_REFERENCE.md`](docs/API/API_REFERENCE.md) | Endpoints REST documentados con ejemplos |
| [`DATA_CATALOG.md`](DATA_CATALOG.md) | Inventario completo de archivos de datos |
| [`compendio_matematico.md`](compendio_matematico.md) | Derivaciones matemáticas y ecuaciones |
| [`analisis_estocastico.md`](analisis_estocastico.md) | Análisis Hurst, fOU, ARFIMA |
| [`bitacora_2026-05-12.md`](bitacora_2026-05-12.md) | Bitácora de desarrollo mayo 2026 |

---

## Desarrollo local

```bash
# Requisitos
python 3.13, node 22

# Clonar e instalar
git clone git@github.com:Cipre-Holding/sargazo.git
cd sargazo
python -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# Ejecutar (frontend :5173 + backend :8000)
./dev.sh
```

---

## Despliegue

Cada push a `main` dispara Cloud Build:

1. `docker build` → imagen multi-stage (~700 MB)
2. `docker push` → Artifact Registry (`northamerica-south1-docker.pkg.dev/...`)
3. `gcloud run deploy` → Cloud Run (4Gi RAM, 2 CPU, timeout 600s)

Variables de entorno en Cloud Run:
- `DATABASE_URL`: sqlite:////tmp/sargazo.db *(efímero — se reinicia con el contenedor)*
- `ALLOWED_ORIGINS`: URL del servicio

> **Nota:** El pipeline completo (~70-90 min) no corre dentro de Cloud Run porque requiere archivos grandes (~350 MB de KMZ + NetCDF) y excede el timeout. Se ejecuta localmente y los artefactos se incluyen en la imagen Docker.

---

## Limitaciones conocidas

- **Datos limitados**: solo 14 pares ACO+CM. MAPE > 100% en todos los modelos.
- **Forecast direccional**: indica zonas probables, no magnitudes exactas (cobertura 11% vs NOAA SIR).
- **SATsum sin API pública**: requiere descarga manual del explorador GIS de SEMAR.
- **Pipeline no corre en Cloud Run aún**: la imagen Docker no incluye datos crudos (KMZ, PDFs, NetCDF).
- **SST y viento no mejoran significativamente**: +2.7% y +0.3% marginal de R² sobre ACO_lag1 solo.
