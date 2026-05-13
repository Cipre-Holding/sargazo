# Sargazo Cozumel — Predicción Operativa de Arribo de Sargazo

**Objetivo:** Sistema de predicción de arribo de sargazo a la costa de Cozumel con 1-2 meses de anticipación.

**Stack:** Python/FastAPI + React/MapLibre + SQLite + Docker → Cloud Run

## Quick Start

```bash
./dev.sh                    # Backend :8000 + Frontend :5173
```

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Visión general del sistema, diagrama de flujo, stack, componentes |
| [`docs/MODELS/MODEL_CARDS.md`](docs/MODELS/MODEL_CARDS.md) | Fichas de todos los modelos: propósito, datos, performance, límites |
| [`docs/API/API_REFERENCE.md`](docs/API/API_REFERENCE.md) | Todos los endpoints con request/response |
| [`DATA_CATALOG.md`](DATA_CATALOG.md) | Inventario completo de archivos de datos |
| [`compendio_matematico.md`](compendio_matematico.md) | Derivaciones matemáticas, ecuaciones, estadística |
| [`bitacora_2026-05-12.md`](bitacora_2026-05-12.md) | Bitácora científica y acta de correcciones |

## Pipeline

```bash
# Ejecución completa (orden)
venv/bin/python prepare_features.py
venv/bin/python modelos_fase1.py
venv/bin/python confidence_score.py
# Opcional:
venv/bin/python interpolar_riesgo_ml_v2.py   # ML Risk
venv/bin/python risk_by_beach.py              # Beach Risk
venv/bin/python modelo_pronostico_7dias.py    # Forecast 14 días (~5 min)
```

## Estado actual

- **Predicción junio 2026:** 52,571 ton (+1.4% vs mayo)
- **Confianza del sistema:** 83/100 (ALTA)
- **Últimos datos:** Mayo 2026
- **Mejor predictor:** ACO_lag1 → CM (r=0.92)
