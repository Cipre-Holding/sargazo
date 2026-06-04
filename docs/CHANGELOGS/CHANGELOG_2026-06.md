# Changelog — Junio 2026

## Fixes de producción

### Dockerfile — COPY con shell syntax roto
- **Problema:** Las 7 líneas `COPY *.py ... 2>/dev/null || true` fallaban en Cloud Build porque Docker no interpreta shell syntax en instrucciones COPY.
- **Fix:** Reemplazadas por `COPY . .` en Stage 2.
- **Resultado:** Cloud Build pasó de FAILURE a SUCCESS.

### .dockerignore — Excluía fuentes frontend
- **Problema:** `.dockerignore` excluía `frontend/src/`, `frontend/tsconfig*.json`, etc. El Stage 1 (node:22) necesita esos archivos para `npm run build`. Error: `TS5083: Cannot read file '/app/tsconfig.json'`.
- **Fix:** Removidas todas las exclusiones de archivos fuente de frontend. `.dockerignore` ahora solo excluye `node_modules/`, `frontend/dist/`, datos grandes, y archivos de estado.
- **Tamaño final del build context:** ~8.1 MB.

### NOAA SIR Layer — No aparecía en Cloud Run
- **Problema:** `sirGeoUrl = layers.sir && sirDate` — cuando `sirDate=""` (falsy), la URL quedaba `null`. En Cloud Run no hay KMZ → `/forecast/geodata/sir/dates` retorna `[]` → `sirDate` nunca se asigna → capa nunca carga.
- **Fix:** `sirGeoUrl = layers.sir ? (sirDate ? .../sir?date=${sirDate} : "/forecast/geodata/sir") : null`
- **Resultado:** Capa SIR carga con el GeoJSON reducido (559 features, 3 fechas).

### ML Risk Layer — Polígonos invisibles en mapa oscuro
- **Problema:** El GeoJSON usaba `#0000ff` (azul puro) para `low` risk al 12% de opacidad — completamente invisible sobre basemap CartoDB Dark Matter.
- **Fix:** Colores overrideados con expresión `match` para tema oscuro: teal (`#00d4aa`), gold (`#f5d000`), naranja (`#ff8800`), rojo (`#ff3333`).
- **Archivo:** `frontend/src/components/map/MlRiskLayer.tsx`

### Prophet grid search — Demasiado lento
- **Problema:** 5×4×2=40 combinaciones × ~35 CV folds cada una = ~15-20 min de ejecución.
- **Fix:** Eliminado modo `multiplicative` (nunca supera a `additive` en esta serie). Grid reducido a 20 combinaciones.
- **Archivo:** `modelos_fase1.py`

### Cold start UX — Sin feedback al usuario
- **Problema:** Cloud Run con min-instances=0 tarda ~20-30s en arrancar. El frontend mostraba skeleton sin explicación.
- **Fix:** Estado `slowLoad` con timeout de 6s. Si `loadingPred` sigue activo después de 6s, muestra mensaje "Iniciando servidor… puede tomar 20–30 segundos".
- **Archivo:** `frontend/src/App.tsx`

## Documentación nueva

- `docs/PIPELINE.md` — Pipeline completo paso a paso con timing, restricciones y diagrama
- `docs/ROADMAP.md` — 10 problemas conocidos + 30+ mejoras priorizadas en 6 áreas

## Documentación actualizada

- `README.md` — Corregida rama (`master` → `main`), región (`us-central1` → `northamerica-south1`), nota sobre pipeline local
- `docs/ARCHITECTURE.md` — Añadidos datos de Cloud Run (proyecto, URL, cold start, restricción de pipeline)
- `docs/MODELS/MODEL_CARDS.md` — Prophet Tuneado: 40 → 20 combinaciones, nota sobre `multiplicative`
- `docs/API/API_REFERENCE.md` — ml-risk endpoint: 1,149 → 582 celdas, colores actualizados
