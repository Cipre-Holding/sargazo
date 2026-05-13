# Stage 1: Build React frontend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.13-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /app/dist ./frontend/dist

COPY *.py *.csv *.json *.nc *.geojson ./ 2>/dev/null || true
COPY modelos_fase0.py modelos_fase1.py modelos_fase2_wind.py ./ 2>/dev/null || true
COPY modelo_lagrangiano_fbm.py modelo_pronostico_7dias.py ./ 2>/dev/null || true
COPY interpolar_riesgo_ml_v2.py ./ 2>/dev/null || true
COPY descargar_noaa_sir.py download_boletines.py extract_boletines.py ./ 2>/dev/null || true
COPY combine_datasets.py prepare_features.py ./ 2>/dev/null || true

ENV PYTHONPATH=/app
ENV PORT=8080

EXPOSE 8080

CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8080", "--timeout", "600", "backend.app:app"]
