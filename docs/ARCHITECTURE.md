# System Architecture — Sargazo Cozumel

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SISTEMA SARGASO COZUMEL                          │
│              Predicción operativa de arribo de sargazo                  │
│              1-7 días hasta 1-2 meses de anticipación                  │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   USUARIOS    │
                              │ (Web browser) │
                              └──────┬───────┘
                                     │ HTTPS
                                     ▼
                        ┌────────────────────┐
                        │   REACT FRONTEND    │
                        │  mapcn + MapLibre   │
                        │  Fira Sans + Code   │
                        │  Tailwind v4        │
                        └────────┬───────────┘
                                 │ /api/*
                                 ▼
                        ┌────────────────────┐
                        │  FASTAPI BACKEND    │
                        │  6 routers          │
                        │  15+ endpoints      │
                        │  APScheduler        │
                        └────────┬───────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
    ┌─────────────────┐ ┌──────────────┐ ┌────────────────┐
    │    PREDICCIONES  │ │ OBSERVACIONES│ │   DOWNLOAD     │
    │  fase0, fase1,   │ │ SEMAR, SATsum│ │ NOAA SIR, run  │
    │  fase2, ensemble │ │ features, etc│ │ pipeline, logs │
    └─────────────────┘ └──────────────┘ └────────────────┘
              │                  │                  │
              ▼                  ▼                  ▼
    ┌─────────────────────────────────────────────────┐
    │              PIPELINE DE DATOS (Python)          │
    │                                                  │
    │  SEMAR PDFs ─→ download_boletines.py             │
    │       └─→ extract_boletines.py (OCR)             │
    │       └─→ boletines_sargazo_MASTER.csv           │
    │                                                  │
    │  Mendeley XLSX ─→ combine_datasets.py            │
    │       └─→ sargazo_combinado_2000_2026.csv        │
    │                                                  │
    │  SATsum PDFs ─→ NVIDIA PaddleOCR                 │
    │       └─→ satsum_caribe/zee_mensual.csv          │
    │                                                  │
    │  NOAA SIR KMZ ─→ descargar_noaa_sir.py           │
    │       └─→ noaa_sir_riesgo_costero_qroo.geojson   │
    │                                                  │
    │  RTOFS + GFS ─→ modelo_pronostico_7dias.py       │
    │       └─→ forecast_kde_acumulaciones.json         │
    │                                                  │
    │  OISST SST ─→ descargar_oisst.py                 │
    │       └─→ sst_cozumel_mensual.csv                │
    │                                                  │
    │  NCEP Wind ─→ descargar_viento_ncep.py           │
    │       └─→ viento_cozumel_mensual.csv             │
    │                                                  │
    │  prepare_features.py ─→ features_prediccion_cm   │
    │       └─→ features_semaforo, features_growth     │
    │                                                  │
    │  modelos_fase0.py ─→ predicciones_fase0.json     │
    │  modelos_fase1.py ─→ predicciones_fase1.json     │
    │                                                  │
    │  interpolar_riesgo_ml_v2.py                      │
    │       └─→ noaa_sir_riesgo_ml_corregido.geojson   │
    │                                                  │
    │  risk_by_beach.py ─→ risk_by_beach.json           │
    └─────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React | 19.2 | UI framework |
| | Vite | 8.0 | Build tool |
| | TypeScript | 5.x | Type safety |
| | Tailwind CSS | 4 | Styling |
| | shadcn/ui | 4.7 | UI components |
| | mapcn | 0.1 | Map components (MapLibre GL) |
| | MapLibre GL | 5.15 | Map rendering |
| | Lucide React | 0.56 | Icons |
| **Backend** | Python | 3.13 | Runtime |
| | FastAPI | 0.136 | API framework |
| | Uvicorn | 0.46 | ASGI server |
| | Gunicorn | 26.0 | Production WSGI |
| | SQLAlchemy | 2.0 | ORM |
| | APScheduler | 3.11 | Weekly pipeline |
| | Pydantic | 2.13 | Data validation |
| **Data/ML** | pandas | 3.0 | Data processing |
| | numpy | 2.4 | Numerical |
| | scikit-learn | 1.6 | ML models |
| | Prophet | 1.3 | Time series |
| | OpenDrift | 1.14 | Lagrangian trajectories |
| | xarray | 2026 | NetCDF handling |
| | netCDF4 | 1.7 | Climate data |
| | scipy | 1.17 | KDE, statistics |
| **Database** | SQLite | — | Manual inputs + logs |
| **Infrastructure** | Docker | — | Containerization |
| | Cloud Run | — | Deployment target |

## Directory Structure

```
/home/alex/sargazo/
├── backend/                        # FastAPI application
│   ├── app.py                      # App entry point, lifespan, CORS
│   ├── database.py                 # SQLite engine + session
│   ├── models.py                   # SQLAlchemy models
│   ├── schemas.py                  # Pydantic schemas
│   ├── scheduler.py                # APScheduler weekly job
│   └── routers/
│       ├── predictions.py          # /api/predictions/*
│       ├── observations.py         # /api/observations/*
│       ├── forecast.py             # /api/forecast/*
│       ├── download.py             # /api/download/*
│       └── manual.py               # /api/manual/*
│
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── App.tsx                 # Main app (map + sidebar + panels)
│   │   ├── components/
│   │   │   ├── map/                # Map layer components
│   │   │   │   ├── SirLayer.tsx    # NOAA SIR risk lines
│   │   │   │   ├── MlRiskLayer.tsx # ML risk interpolation
│   │   │   │   ├── KdeLayer.tsx    # KDE accumulation
│   │   │   │   └── TrajectoryLayer.tsx  # Animated particles
│   │   │   ├── panels/             # UI panels
│   │   │   │   ├── LayerControl.tsx    # Layer toggles
│   │   │   │   ├── ManualInputDialog.tsx  # Manual data entry
│   │   │   │   ├── Dashboard.tsx       # CM chart, model comparison, beach risk, alerts
│   │   │   │   └── SystemStatus.tsx     # System health
│   │   │   └── ui/                 # shadcn/ui + mapcn components
│   │   ├── hooks/
│   │   │   └── useApi.ts           # API fetch hook
│   │   └── lib/
│   │       └── utils.ts            # cn() utility
│   └── index.html
│
├── *.py                            # 12 pipeline scripts
├── *.csv                           # ~15 data files
├── *.json                          # ~8 prediction/risk files
├── *.nc                            # 2 NetCDF files (RTOFS 108MB, GFS 4MB)
├── sargazo.db                      # SQLite database
├── Dockerfile                      # Multi-stage build
├── dev.sh                          # Local development
└── noaa_sir_kmz/                   # 315 NOAA SIR KMZ files
```

## Data Sources

| Source | Type | Access | Period | Variables |
|---|---|---|---|---|
| SEMAR/IOGMC | PDF boletines | HTTP download | Mar 2024→present | CM, ACO, CC, CO, semáforo, corrientes, vientos |
| Mendeley Data | XLSX | Local file | 2000-2024 | GASB, ACR, NSS, SSS, GSR, NWGoM |
| SATsum CONABIO | PDF monthly | Manual download | 2010→present | Biomasa húmeda regional |
| NOAA SIR v1.5 | KMZ | HTTP download | Jul 2025→present | Riesgo costero 1km |
| RTOFS | GRIB2/NetCDF | NOMADS THREDDS | 6d forecast | Corrientes u/v |
| GFS 0.25° | GRIB2 | NOMADS CGI | 16d forecast | Viento U/V 10m |
| OISST v2.1 | NetCDF | PSL THREDDS OPeNDAP | 1981→present | SST mensual 0.25° |
| NCEP Reanalysis | NetCDF | PSL THREDDS OPeNDAP | 1948→present | Viento U/V 10m mensual |

## Pipeline Stages

| Stage | Script | Input | Output | Frequency |
|---|---|---|---|---|
| 1. Download SEMAR | `download_boletines.py` | SEMAR website | PDF files | Weekly |
| 2. Extract OCR | `extract_boletines.py` | PDF files | `boletines_sargazo_MASTER.csv` | Weekly |
| 3. Combine datasets | `combine_datasets.py` | Master CSV + Mendeley | `sargazo_combinado_2000_2026.csv` | Weekly |
| 4. Feature engineering | `prepare_features.py` | Combined CSV + SST + wind | 5 feature CSVs | Weekly |
| 5. Train models | `modelos_fase0.py` + `modelos_fase1.py` | Features CSVs | `predicciones_fase*.json` | Weekly |
| 6. ML risk | `interpolar_riesgo_ml_v2.py` | NOAA SIR + Lagrangian + temporal | ML risk GeoJSON + temporal dist. | Weekly |
| 7. Temporal risk | `interpolar_riesgo_ml_v2.py` | NOAA SIR (315 days) | Temporal risk distribution | Weekly |
| 8. Beach risk | `risk_by_beach.py` | NOAA SIR (315 days) | `risk_by_beach.json` | Weekly |
| 9. Confidence score | `confidence_score.py` | Predictions JSON | Score in predictions | Weekly |
| 10. Forecast 14d | `modelo_pronostico_7dias.py` | RTOFS + GFS | KDE (25 horizons) + trajectories | On demand |

## Backend API

| Prefix | Router | Endpoints |
|---|---|---|
| `/api/predictions` | `predictions.py` | GET `/` (all), `/ensemble`, `/phase0`, `/phase1`, `/phase2` |
| `/api/observations` | `observations.py` | GET `/semar`, `/satsum/caribe`, `/satsum/zee`, `/features/cm`, `/features/semaforo`, `/features/fuente`, `/combined`, `/residuos`, `/correlaciones`, `/sir/daily-summary` |
| `/api/forecast` | `forecast.py` | GET `/kde`, `/trajectories`, `/positions/{horizonte}`, `/geodata/sir`, `/geodata/ml-risk`, `/risk-by-beach` |
| `/api/download` | `download.py` | POST `/run`, GET `/status`, GET `/logs` |
| `/api/manual` | `manual.py` | POST `/input`, POST `/predict`, GET `/inputs` |
| `/api/health` | `app.py` | GET `/` (status ok) |

## Models Inventory

| Model | Type | n | Features | Output | RMSE |
|---|---|---|---|---|---|
| 0.1 Regression | OLS weighted | 14 | ACO_lag1 | CM ton | 20,896 |
| 0.2 Delta | OLS | 12 | ACO_lag1 + ΔACO | CM change | — |
| 0.3 Logistic | Ordinal | 21 | ACO_lag1 | Semáforo 1-6 | Acc 64% |
| 0.4 Prophet | TS | 303 | Seasonal + trend | ACO/GASB | — |
| 0.5 AR(1) | Autoregressive | 22 | CM_lag1 | CM ton | 45,197 |
| 1.1 Ridge | L2 regularized | 14 | 4 features | CM ton | 8,143 |
| 1.2 Bayesian Ridge | Bayesian | 14 | 4 features | CM ton | — |
| 1.3 Rolling | Local (k=6) | 14 | ACO_lag1 | CM ton | — |
| 1.7 ARIMAX Full | TS + exog | 23 | CM + ACO | CM ton | — |
| Ensemble | Weighted avg | — | 3 models | CM ton | 31,043 |
| ML Risk | Wendland C2 | 4,250 pts | NOAA SIR | Risk cells | — |
| Beach Risk | Historical freq | 52K features | NOAA SIR 315d | Prob/beach | — |
| Temporal ML Risk | Wendland C2 temporal | 4,250×315 pts | NOAA SIR 315d distribution | Risk cells | — |
| Forecast 14d | OpenDrift KDE | 2,000 particles | RTOFS + GFS | KDE horizons (25) | — |

## Frontend Component Tree

```
App
├── Map (mapcn MapLibre GL)
│   ├── RecenterBtn (floating button)
│   ├── MapControls (zoom + compass)
│   ├── SirLayer (NOAA SIR risk lines)
│   ├── MlRiskLayer (ML interpolation)
│   ├── KdeLayer (particle density)
│   └── TrajectoryLayer (animated particles + slider)
├── TopBar (title + status)
├── SidebarToggle (collapse button)
├── Sidebar (collapsible, left)
│   ├── KPICard (ensemble prediction)
│   ├── Dashboard (CM chart, model comparison, beach risk, alerts)
│   ├── BeachRiskList (top 5 beaches)
│   ├── LayerControl (layer toggles + horizon + date)
│   ├── DownloadButton
│   └── SystemHealth (progress bar)
└── Legend (risk colors + data sources)
```

## Deployment

```
Dockerfile (multi-stage)
  Stage 1: node:22 → npm ci → npm run build (React)
  Stage 2: python:3.13-slim → pip install → copy frontend dist
  CMD: gunicorn -w 2 uvicorn.workers.UvicornWorker backend.app:app

Cloud Run:
  Memory: 4Gi
  CPU: 2
  Timeout: 600s
  Concurrency: 1
  Port: 8080
```
