import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

ROOT = Path(__file__).resolve().parent.parent.parent
router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("")
def get_predictions():
    result = {}
    for fname in ["predicciones_fase0.json", "predicciones_fase1.json", "predicciones_fase2.json"]:
        fp = ROOT / fname
        if fp.exists():
            with open(fp) as f:
                result[fname.replace(".json", "")] = json.load(f)
    if not result:
        raise HTTPException(404, "No predictions found")
    return result


@router.get("/ensemble")
def get_ensemble():
    fp = ROOT / "predicciones_fase1.json"
    if not fp.exists():
        raise HTTPException(404, "No ensemble data")
    with open(fp) as f:
        data = json.load(f)
    if "ensemble" not in data:
        raise HTTPException(404, "No ensemble in predictions")
    return data["ensemble"]


@router.get("/phase0")
def get_phase0():
    fp = ROOT / "predicciones_fase0.json"
    if not fp.exists():
        raise HTTPException(404, "No Phase 0 data")
    with open(fp) as f:
        return json.load(f)


@router.get("/phase1")
def get_phase1():
    fp = ROOT / "predicciones_fase1.json"
    if not fp.exists():
        raise HTTPException(404, "No Phase 1 data")
    with open(fp) as f:
        return json.load(f)


@router.get("/phase2")
def get_phase2():
    fp = ROOT / "predicciones_fase2.json"
    if not fp.exists():
        raise HTTPException(404, "No Phase 2 data")
    with open(fp) as f:
        return json.load(f)
