# API Reference — Sargazo Cozumel

**Base URL:** `http://localhost:8000` (dev) o `https://<service>.run.app` (Cloud Run)
**Auth:** Ninguna (endpoints públicos)
**Content-Type:** `application/json`
**Errores:** HTTP 404 con `{"detail": "mensaje"}`

---

## Health

### `GET /api/health`

Verifica que el servicio está operativo.

**Response:**
```json
{"status": "ok", "app": "sargazo-cozumel", "version": "1.0.0"}
```

---

## Predicciones

### `GET /api/predictions`

Retorna todas las predicciones disponibles (Fase 0, Fase 1, Fase 2).

**Response:** Objeto con keys `predicciones_fase0_json`, `predicciones_fase1_json`, `predicciones_fase2_json`.

### `GET /api/predictions/ensemble`

Retorna solo el ensemble con bias correction y confidence score.

**Response:**
```json
{
  "modelo": "ensemble",
  "n_modelos": 3,
  "correction_factor": 1.25,
  "prediccion_junio": {
    "cm_mt": 0.052571,
    "cm_ton": 52571,
    "cambio_pct_vs_mayo": 1.4,
    "ci_80_mt": [0.006596, 0.293445]
  },
  "confidence_score": {
    "score": 83,
    "max": 100,
    "porcentaje": 83,
    "nivel": "ALTA"
  }
}
```

### `GET /api/predictions/phase0`
### `GET /api/predictions/phase1`
### `GET /api/predictions/phase2`

Retorna las predicciones completas de cada fase.

---

## Observaciones

### `GET /api/observations/semar?limit=200`

Datos crudos de SEMAR. `limit` controla filas retornadas.

### `GET /api/observations/satsum/caribe`
### `GET /api/observations/satsum/zee`

Datos SATsum por región. Columnas: `year`, `month`, `biomasa_mt`.

### `GET /api/observations/features/cm`
### `GET /api/observations/features/semaforo`
### `GET /api/observations/features/fuente`

Features listas para modelado. 39 columnas en CM, 18 en semáforo, 16 en fuente.

### `GET /api/observations/combined?limit=100`

Dataset combinado Mendeley+SEMAR (311 filas, 34 columnas).

### `GET /api/observations/residuos?limit=50`

Residuos estocásticos OU (288 filas).

### `GET /api/observations/correlaciones?limit=50`

Tabla de correlaciones con lag.

### `GET /api/observations/sir/daily-summary?limit=100`

Resumen diario de riesgo NOAA SIR.

---

## Forecast

### `GET /api/forecast/kde`

Acumulaciones KDE 2D. 25 horizontes (12h→336h). Grid 60×55.

**Response:**
```json
{
  "12h": {"lon": [...], "lat": [...], "density": [[...]]},
  "24h": {"lon": [...], "lat": [...], "density": [[...]]},
  ...
}
```

### `GET /api/forecast/trajectories`

Trayectorias de partículas. Array con `lon`, `lat`, `step`, `id`.

### `GET /api/forecast/positions/{horizonte}`

Ej: `/api/forecast/positions/48h`. Posiciones de partículas en un horizonte específico. Retorna array `[{lon, lat}]`.

### `GET /api/forecast/geodata/sir`

NOAA SIR risk lines (ligero: solo últimas 3 fechas, 559 features). GeoJSON FeatureCollection con LineStrings.

### `GET /api/forecast/geodata/sir/dates`

Lista de fechas disponibles en el dataset NOAA SIR (315 fechas, Jul 2025 → May 2026).

**Response:**
```json
{
  "dates": ["2025-07-01", "2025-07-02", ...],
  "total": 315,
  "min_date": "2025-07-01",
  "max_date": "2026-05-11"
}
```

Usar con `GET /api/forecast/geodata/sir?date=YYYY-MM-DD` para filtrar por fecha (paginación en memoria).

### `GET /api/forecast/geodata/ml-risk`

ML risk interpolation (582 celdas, ~0.6 MB). GeoJSON FeatureCollection con Polygons.
Colores por nivel: LOW=#00d4aa (teal), WARNING=#f5d000 (gold), MEDIUM=#ff8800 (naranja), HIGH=#ff3333 (rojo).

### `GET /api/forecast/risk-by-beach`

Perfil de riesgo por playa (10 segmentos).

**Response:**
```json
{
  "fecha_generacion": "2026-05-13",
  "n_dias": 315,
  "segmentos": [
    {"id": "isla_mujeres", "name": "Isla Mujeres", "pct_high_medium": 70.8, ...},
    ...
  ],
  "top_5_riesgo": ["isla_mujeres", "cancun", "cozumel_norte", ...]
}
```

---

## Download (Pipeline)

### `POST /api/download/run`

Ejecuta el pipeline completo en background: NOAA SIR → SEMAR → combine → features → predict.

**Response:**
```json
{"status": "started", "log_id": 42, "message": "Pipeline running in background"}
```

### `GET /api/download/status`

Estado de la última ejecución.

**Response:**
```json
{
  "status": "ok",
  "started_at": "2026-05-13 01:00:00",
  "finished_at": "2026-05-13 01:05:00",
  "steps": {"noaa_sir": "ok", "semar_download": "ok", ...},
  "error": null
}
```

### `GET /api/download/logs?limit=10`

Historial de ejecuciones.

---

## Manual Input

### `POST /api/manual/input`

Ingresar datos SEMAR manualmente.

**Request:**
```json
{
  "fecha": "2026-05-13",
  "cm_ton": 51837,
  "aco_mt": 0.512,
  "semaforo": "ALTO",
  "notas": "Dato de prueba"
}
```

**Response:** El registro creado con su `id`.

### `POST /api/manual/predict`

Re-ejecuta el pipeline completo con los datos manuales incluidos.

### `GET /api/manual/inputs?limit=50`

Lista los inputs manuales ingresados.

---

## SQLite Database

**Archivo:** `sargazo.db` (se crea automáticamente)

### Tabla `manual_inputs`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| fecha | DATE | Fecha del dato |
| cm_ton | FLOAT | Biomasa Caribe Mexicano |
| aco_mt | FLOAT | Biomasa Atlántico Central |
| semaforo | TEXT | Nivel de alerta |
| created_at | TIMESTAMP | Fecha de ingreso |
| processed | BOOLEAN | TRUE si ya se procesó |

### Tabla `download_log`
| Columna | Tipo | Descripción |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| started_at | TIMESTAMP | Inicio de ejecución |
| finished_at | TIMESTAMP | Fin de ejecución |
| status | TEXT | running / ok / error |
| steps | JSON | Detalle por paso |
| error | TEXT | Mensaje de error si falló |
