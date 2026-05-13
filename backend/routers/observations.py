import json
import csv
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

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
def get_semar(limit: int = 200):
    fp = ROOT / "boletines_sargazo_MASTER.csv"
    data = csv_to_json(fp, limit)
    if data is None:
        raise HTTPException(404, "No SEMAR data")
    return JSONResponse(content=data)


@router.get("/satsum/caribe")
def get_satsum_caribe():
    fp = ROOT / "satsum_caribe_mensual.csv"
    data = csv_to_json(fp)
    if data is None:
        raise HTTPException(404, "No SATsum Caribe data")
    return JSONResponse(content=data)


@router.get("/satsum/zee")
def get_satsum_zee():
    fp = ROOT / "satsum_zee_mex_mensual.csv"
    data = csv_to_json(fp)
    if data is None:
        raise HTTPException(404, "No SATsum ZEE data")
    return JSONResponse(content=data)


@router.get("/features/cm")
def get_features_cm():
    fp = ROOT / "features_prediccion_cm.csv"
    data = csv_to_json(fp)
    if data is None:
        raise HTTPException(404, "No CM feature data")
    return JSONResponse(content=data)


@router.get("/features/semaforo")
def get_features_semaforo():
    fp = ROOT / "features_semaforo.csv"
    data = csv_to_json(fp)
    if data is None:
        raise HTTPException(404, "No semaforo feature data")
    return JSONResponse(content=data)


@router.get("/features/fuente")
def get_features_fuente():
    fp = ROOT / "features_fuente.csv"
    data = csv_to_json(fp, limit=50)
    if data is None:
        raise HTTPException(404, "No fuente feature data")
    return JSONResponse(content=data)


@router.get("/combined")
def get_combined(limit: int = 100):
    fp = ROOT / "sargazo_combinado_2000_2026.csv"
    data = csv_to_json(fp, limit)
    if data is None:
        raise HTTPException(404, "No combined data")
    return JSONResponse(content=data)


@router.get("/residuos")
def get_residuos(limit: int = 50):
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
