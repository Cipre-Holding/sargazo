import json
import csv
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import (
    SEMARObservation, SatelliteObservation, ModelFeature, MendeleyObservation
)

ROOT = Path(__file__).resolve().parent.parent.parent
router = APIRouter(prefix="/api/observations", tags=["observations"])


def csv_to_json(fp: Path, limit: int = 0):
    if not fp.exists():
        return None
    rows = []
    with open(fp, newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break
            rows.append(row)
    return rows


@router.get("/semar")
def get_semar(limit: int = 200, db: Session = Depends(get_db)):
    obs = db.query(SEMARObservation).order_by(SEMARObservation.fecha.desc()).limit(limit).all()
    if not obs:
        fp = ROOT / "boletines_sargazo_MASTER.csv"
        data = csv_to_json(fp, limit)
        if data is None:
            raise HTTPException(404, "No SEMAR data")
        return JSONResponse(content=data)
    
    data = []
    for o in obs:
        d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        # Map 'anio' back to 'año' for frontend compatibility
        d["año"] = d.pop("anio", None)
        # Convert numeric values to strings or floats as expected by frontend
        for k, v in d.items():
            if v is None:
                d[k] = ""
            elif isinstance(v, float):
                d[k] = str(v)
            elif isinstance(v, int):
                d[k] = str(v)
        data.append(d)
    return JSONResponse(content=data)


@router.get("/satsum/caribe")
def get_satsum_caribe(db: Session = Depends(get_db)):
    obs = db.query(SatelliteObservation).filter(SatelliteObservation.satsum_caribe_mt.isnot(None)).all()
    if not obs:
        fp = ROOT / "satsum_caribe_mensual.csv"
        data = csv_to_json(fp)
        if data is None:
            raise HTTPException(404, "No SATsum Caribe data")
        return JSONResponse(content=data)
    
    data = []
    for o in obs:
        parts = o.month.split("-")
        data.append({
            "year": str(int(parts[0])),
            "month": str(int(parts[1])),
            "biomasa_mt": str(o.satsum_caribe_mt)
        })
    return JSONResponse(content=data)


@router.get("/satsum/zee")
def get_satsum_zee(db: Session = Depends(get_db)):
    obs = db.query(SatelliteObservation).filter(SatelliteObservation.satsum_zee_mt.isnot(None)).all()
    if not obs:
        fp = ROOT / "satsum_zee_mex_mensual.csv"
        data = csv_to_json(fp)
        if data is None:
            raise HTTPException(404, "No SATsum ZEE data")
        return JSONResponse(content=data)
    
    data = []
    for o in obs:
        parts = o.month.split("-")
        data.append({
            "year": str(int(parts[0])),
            "month": str(int(parts[1])),
            "biomasa_mt": str(o.satsum_zee_mt)
        })
    return JSONResponse(content=data)


def get_db_features(dataset_type: str, db: Session, limit: int = 0):
    query = db.query(ModelFeature).filter(ModelFeature.dataset_type == dataset_type).all()
    if not query:
        return None
    
    # Sort by month
    query.sort(key=lambda x: x.month)
    if limit:
        query = query[:limit]
        
    data = []
    for q in query:
        try:
            d = json.loads(q.feature_json)
            # convert all types to string to match CSV output format
            for k, v in d.items():
                if v is None:
                    d[k] = ""
                else:
                    d[k] = str(v)
            data.append(d)
        except Exception:
            pass
    return data


@router.get("/features/cm")
def get_features_cm(db: Session = Depends(get_db)):
    data = get_db_features("prediccion_cm", db)
    if data is None:
        fp = ROOT / "features_prediccion_cm.csv"
        data = csv_to_json(fp)
        if data is None:
            raise HTTPException(404, "No CM feature data")
    return JSONResponse(content=data)


@router.get("/features/semaforo")
def get_features_semaforo(db: Session = Depends(get_db)):
    data = get_db_features("semaforo", db)
    if data is None:
        fp = ROOT / "features_semaforo.csv"
        data = csv_to_json(fp)
        if data is None:
            raise HTTPException(404, "No semaforo feature data")
    return JSONResponse(content=data)


@router.get("/features/fuente")
def get_features_fuente(db: Session = Depends(get_db)):
    data = get_db_features("fuente", db, limit=50)
    if data is None:
        fp = ROOT / "features_fuente.csv"
        data = csv_to_json(fp, limit=50)
        if data is None:
            raise HTTPException(404, "No fuente feature data")
    return JSONResponse(content=data)


@router.get("/combined")
def get_combined(limit: int = 100, db: Session = Depends(get_db)):
    # Fallback to combined CSV for speed and format compatibility
    fp = ROOT / "sargazo_combinado_2000_2026.csv"
    data = csv_to_json(fp, limit)
    if data is None:
        raise HTTPException(404, "No combined data")
    return JSONResponse(content=data)


@router.get("/residuos")
def get_residuos(limit: int = 50, db: Session = Depends(get_db)):
    data = get_db_features("residuos", db, limit=limit)
    if data is None:
        fp = ROOT / "residuos_estocasticos.csv"
        data = csv_to_json(fp, limit)
        if data is None:
            raise HTTPException(404, "No residual data")
    return JSONResponse(content=data)


@router.get("/correlaciones")
def get_correlaciones(limit: int = 50):
    fp = ROOT / "sargazo_correlaciones_lag.csv"
    data = csv_to_json(fp, limit)
    if data is None:
        raise HTTPException(404, "No correlation data")
    return JSONResponse(content=data)


@router.get("/sir/daily-summary")
def get_sir_summary(limit: int = 100):
    fp = ROOT / "noaa_sir_resumen_diario.csv"
    data = csv_to_json(fp, limit)
    if data is None:
        raise HTTPException(404, "No SIR summary data")
    return JSONResponse(content=data)
