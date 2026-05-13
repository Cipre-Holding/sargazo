import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import ManualInput, DownloadLog
from backend.schemas import ManualInputCreate, ManualInputResponse

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

router = APIRouter(prefix="/api/manual", tags=["manual"])


def append_to_csv(row_data: dict):
    """Append a manual input row to the SEMAR master CSV."""
    csv_path = ROOT / "boletines_sargazo_MASTER.csv"
    import csv
    from datetime import date
    fieldnames = [
        "fecha", "biomasa_caribe_mexicano_ton", "biomasa_atlantico_central_ton",
        "biomasa_caribe_central_ton", "biomasa_caribe_oriental_ton",
        "semaforo", "conglomerado_cozumel", "num_conglomerados",
        "viento_norte_nudos", "viento_sur_nudos",
        "corriente_playa_carmen_nudos", "corriente_cancun_nudos",
    ]
    new_row = {
        "fecha": row_data.get("fecha", str(date.today())),
        "biomasa_caribe_mexicano_ton": row_data.get("cm_ton", ""),
        "biomasa_atlantico_central_ton": row_data.get("aco_mt", ""),
        "biomasa_caribe_central_ton": row_data.get("cc_ton", ""),
        "biomasa_caribe_oriental_ton": row_data.get("co_ton", ""),
        "semaforo": row_data.get("semaforo", ""),
        "conglomerado_cozumel": row_data.get("conglomerado_cozumel", ""),
        "num_conglomerados": "",
        "viento_norte_nudos": row_data.get("viento_norte_nudos", ""),
        "viento_sur_nudos": row_data.get("viento_sur_nudos", ""),
        "corriente_playa_carmen_nudos": row_data.get("corriente_playa_carmen_nudos", ""),
        "corriente_cancun_nudos": row_data.get("corriente_cancun_nudos", ""),
    }
    file_exists = csv_path.exists()
    with open(csv_path, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(new_row)


@router.post("/input", response_model=ManualInputResponse)
def create_manual_input(data: ManualInputCreate, db: Session = Depends(get_db)):
    record = ManualInput(
        fecha=str(data.fecha),
        cm_ton=data.cm_ton,
        aco_mt=data.aco_mt,
        cc_ton=data.cc_ton,
        co_ton=data.co_ton,
        viento_norte_nudos=data.viento_norte_nudos,
        viento_sur_nudos=data.viento_sur_nudos,
        corriente_playa_carmen_nudos=data.corriente_playa_carmen_nudos,
        corriente_cancun_nudos=data.corriente_cancun_nudos,
        semaforo=data.semaforo,
        conglomerado_cozumel=data.conglomerado_cozumel,
        notas=data.notas,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    append_to_csv(data.model_dump())
    return record


@router.post("/predict")
def run_manual_predict(db: Session = Depends(get_db)):
    """Re-run the full prediction pipeline (requires downloaded data)."""
    from backend.routers.download import run_weekly_pipeline
    log = DownloadLog(status="running")
    db.add(log)
    db.commit()
    db.refresh(log)
    run_weekly_pipeline(log.id)
    db.refresh(log)
    return {"status": log.status, "log_id": log.id, "error": log.error}


@router.get("/inputs")
def list_manual_inputs(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(ManualInput).order_by(ManualInput.id.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "fecha": r.fecha,
            "cm_ton": r.cm_ton,
            "aco_mt": r.aco_mt,
            "semaforo": r.semaforo,
            "created_at": str(r.created_at) if r.created_at else None,
            "processed": r.processed,
        }
        for r in records
    ]
