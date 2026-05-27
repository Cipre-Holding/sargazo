import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import ModelPrediction

ROOT = Path(__file__).resolve().parent.parent.parent
router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("")
def get_predictions(db: Session = Depends(get_db)):
    result = {}
    
    # Query the latest predictions in database
    latest_pred = db.query(ModelPrediction).order_by(ModelPrediction.id.desc()).first()
    if not latest_pred:
        # Fallback to local files if database is empty
        for fname in ["predicciones_fase0.json", "predicciones_fase1.json", "predicciones_fase2.json"]:
            fp = ROOT / fname
            if fp.exists():
                with open(fp) as f:
                    result[fname.replace(".json", "")] = json.load(f)
        if not result:
            raise HTTPException(404, "No predictions found")
        return result

    latest_month = latest_pred.date_month
    
    # Query all predictions for that latest month
    preds = db.query(ModelPrediction).filter(ModelPrediction.date_month == latest_month).all()
    
    p0 = {}
    p1 = {}
    p2 = {}
    
    p0_models = ["0.1_regresion", "0.1_regresion_lineal", "0.2_delta", "0.3_logistica", "0.4_prophet", "0.5_ar1", "0.5_ar1_fallback"]
    p1_models = ["1.1_ridge", "1.2_bayesian_ridge", "1.3_rolling", "1.4_arimax", "1.5_segmentada", "1.6_prophet_tuned", "1.7_arimax_full", "ensemble"]
    
    for p in preds:
        m_name = p.model_name
        try:
            data = json.loads(p.prediction_json)
        except Exception:
            data = {}
        if m_name in p0_models:
            p0[m_name] = data
        elif m_name in p1_models:
            p1[m_name] = data
        else:
            p2[m_name] = data
            
    p0["metadata"] = {
        "generado": str(datetime.now().isoformat()),
        "fase": "0_refinada_db",
    }
    p1["metadata"] = {
        "generado": str(datetime.now().isoformat()),
        "fase": "1_extendida_db",
    }
    
    # Phase 2 fallback from file if not populated in DB
    if not p2:
        p2_path = ROOT / "predicciones_fase2.json"
        if p2_path.exists():
            with open(p2_path) as f:
                p2 = json.load(f)
                
    result["predicciones_fase0"] = p0
    result["predicciones_fase1"] = p1
    if p2:
        result["predicciones_fase2"] = p2
        
    return result


@router.get("/ensemble")
def get_ensemble(db: Session = Depends(get_db)):
    pred = db.query(ModelPrediction).filter(
        ModelPrediction.model_name == "ensemble"
    ).order_by(ModelPrediction.id.desc()).first()
    
    if not pred:
        # Fallback to local files
        fp = ROOT / "predicciones_fase1.json"
        if not fp.exists():
            raise HTTPException(404, "No ensemble data")
        with open(fp) as f:
            data = json.load(f)
        if "ensemble" not in data:
            raise HTTPException(404, "No ensemble in predictions")
        return data["ensemble"]
        
    try:
        return json.loads(pred.prediction_json)
    except Exception:
        raise HTTPException(500, "Error loading ensemble prediction from database")


@router.get("/phase0")
def get_phase0(db: Session = Depends(get_db)):
    all_preds = get_predictions(db)
    if "predicciones_fase0" not in all_preds:
        raise HTTPException(404, "No Phase 0 data")
    return all_preds["predicciones_fase0"]


@router.get("/phase1")
def get_phase1(db: Session = Depends(get_db)):
    all_preds = get_predictions(db)
    if "predicciones_fase1" not in all_preds:
        raise HTTPException(404, "No Phase 1 data")
    return all_preds["predicciones_fase1"]


@router.get("/phase2")
def get_phase2(db: Session = Depends(get_db)):
    all_preds = get_predictions(db)
    if "predicciones_fase2" not in all_preds:
        raise HTTPException(404, "No Phase 2 data")
    return all_preds["predicciones_fase2"]
