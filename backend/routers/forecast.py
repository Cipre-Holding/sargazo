import json
import threading
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parent.parent.parent
router = APIRouter(prefix="/api/forecast", tags=["forecast"])

# Lazy index: date (YYYYMMDD) → list of GeoJSON features, built once on first date request
_sir_index: dict[str, list] = {}
_sir_index_lock = threading.Lock()
_sir_index_ready = False


def _build_sir_index() -> None:
    global _sir_index_ready
    # 1. Cargar segmentos históricos de Quintana Roo
    fp = ROOT / "noaa_sir_riesgo_costero_qroo.geojson"
    if fp.exists():
        with open(fp) as f:
            data = json.load(f)
        for feat in data.get("features", []):
            d = feat.get("properties", {}).get("date")
            if d:
                _sir_index.setdefault(d, []).append(feat)

    # 2. Cargar segmentos de todo el Caribe para las últimas 3 fechas (sobrescribe para evitar duplicados)
    reduced_fp = ROOT / "noaa_sir_riesgo_costero_qroo_reduced.geojson"
    if reduced_fp.exists():
        with open(reduced_fp) as f:
            reduced_data = json.load(f)
        
        # Obtener las fechas recientes del archivo reducido
        recent_dates = set()
        for feat in reduced_data.get("features", []):
            d = feat.get("properties", {}).get("date")
            if d:
                recent_dates.add(d)
        
        # Limpiar esas fechas en el índice histórico de QRoo
        for d in recent_dates:
            _sir_index[d] = []
            
        # Llenar con los segmentos de todo el Caribe
        for feat in reduced_data.get("features", []):
            d = feat.get("properties", {}).get("date")
            if d:
                _sir_index[d].append(feat)

    _sir_index_ready = True


def _ensure_sir_index() -> None:
    if _sir_index_ready:
        return
    with _sir_index_lock:
        if not _sir_index_ready:
            _build_sir_index()


@router.get("/kde")
def get_kde():
    fp = ROOT / "forecast_kde_acumulaciones.json"
    if not fp.exists():
        raise HTTPException(404, "No KDE data")
    with open(fp) as f:
        return json.load(f)


@router.get("/trajectories")
def get_trajectories():
    fp = ROOT / "forecast_7d_trayectorias.csv"
    if not fp.exists():
        raise HTTPException(404, "No trajectory data")
    import csv
    rows = []
    with open(fp) as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({"lon": float(row["lon"]), "lat": float(row["lat"]),
                         "step": int(row["step"]), "id": int(row["id"])})
    return JSONResponse(content=rows)


@router.get("/positions/{horizonte}")
def get_positions(horizonte: str):
    fp = ROOT / f"forecast_posiciones_{horizonte}.csv"
    if not fp.exists():
        raise HTTPException(404, f"No positions for horizon {horizonte}")
    import csv
    rows = []
    with open(fp) as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({"lon": float(row["lon"]), "lat": float(row["lat"])})
    return JSONResponse(content=rows)


@router.get("/geodata/sir/dates")
def get_sir_dates():
    """List all available SIR dates from downloaded KMZ files (instant, no file parsing)."""
    kmz_dir = ROOT / "noaa_sir_kmz"
    if not kmz_dir.exists():
        return []
    return sorted(
        f.stem.replace("sargassum_risk_", "")
        for f in kmz_dir.glob("sargassum_risk_*.kmz")
    )


@router.get("/geodata/sir")
def get_sir(date: Optional[str] = Query(default=None, description="Filter by date YYYYMMDD")):
    """Return SIR GeoJSON. Without ?date= serves 3-date reduced file. With ?date= filters full dataset."""
    if date is None:
        fp = ROOT / "noaa_sir_riesgo_costero_qroo_reduced.geojson"
        if not fp.exists():
            raise HTTPException(404, "No SIR GeoJSON")
        with open(fp) as f:
            return json.load(f)

    _ensure_sir_index()
    if not _sir_index:
        raise HTTPException(503, "SIR full index not available (full GeoJSON missing)")
        
    from datetime import datetime, timedelta
    try:
        dt = datetime.strptime(date, "%Y%m%d")
        target_dates = []
        for i in range(7):
            d_str = (dt - timedelta(days=i)).strftime("%Y%m%d")
            if d_str in _sir_index:
                target_dates.append(d_str)
    except ValueError:
        if date in _sir_index:
            target_dates = [date]
        else:
            raise HTTPException(404, f"Date {date} not found in SIR data")

    combined_features = []
    for d in target_dates:
        combined_features.extend(_sir_index[d])
        
    return JSONResponse({"type": "FeatureCollection", "features": combined_features})


@router.get("/geodata/ml-risk")
def get_ml_risk():
    fp = ROOT / "noaa_sir_riesgo_ml_corregido.geojson"
    if not fp.exists():
        raise HTTPException(404, "No ML risk GeoJSON")
    with open(fp) as f:
        return json.load(f)


@router.get("/risk-by-beach")
def get_risk_by_beach():
    fp = ROOT / "risk_by_beach.json"
    if not fp.exists():
        raise HTTPException(404, "No beach risk data")
    with open(fp) as f:
        return json.load(f)
