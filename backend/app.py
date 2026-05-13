import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.scheduler import start_scheduler, stop_scheduler
from backend.database import init_db
from backend.routers import predictions, observations, forecast, download, manual


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Sargazo Cozumel — API de Predicción",
    description="Monolithic API for sargazo prediction at Cozumel, QRoo.",
    version="1.0.0",
    lifespan=lifespan,
)

_raw = os.getenv("ALLOWED_ORIGINS", "")
_origins = [o.strip() for o in _raw.split(",") if o.strip()] if _raw else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predictions.router)
app.include_router(observations.router)
app.include_router(forecast.router)
app.include_router(download.router)
app.include_router(manual.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "sargazo-cozumel", "version": "1.0.0"}


# Serve React frontend build if available
static_dir = ROOT / "frontend" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
