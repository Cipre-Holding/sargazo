import sys
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import DownloadLog

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

router = APIRouter(prefix="/api/download", tags=["download"])


def run_weekly_pipeline(log_id: int):
    """Executes the full data pipeline: download → extract → combine → predict."""
    import json
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.database import SQLALCHEMY_DATABASE_URL
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {},
    )
    Session = sessionmaker(bind=engine)
    db = Session()

    steps = {}
    error = None
    try:
        # Step 1: Download NOAA SIR
        from descargar_noaa_sir import main as download_noaa
        download_noaa()
        steps["noaa_sir"] = "ok"

        # Step 2: Download SEMAR boletines
        from download_boletines import main as download_semar
        download_semar()
        steps["semar_download"] = "ok"

        # Step 3: Extract boletines
        from extract_boletines import main as extract_semar
        extract_semar()
        steps["semar_extract"] = "ok"

        # Step 4: Combine datasets
        from combine_datasets import main as combine
        combine()
        steps["combine"] = "ok"

        # Step 5: Prepare features
        from prepare_features import main as prepare
        prepare()
        steps["features"] = "ok"

        # Step 6: Run predictions
        from modelos_fase0 import main as pred0
        pred0()
        steps["predict_phase0"] = "ok"

        from modelos_fase1 import main as pred1
        pred1()
        steps["predict_phase1"] = "ok"

        # Step 7: Confidence score
        from confidence_score import calculate_confidence as calc_conf
        calc_conf()
        steps["confidence"] = "ok"

        # Step 8: ML risk interpolation (NOAA SIR → grid)
        from interpolar_riesgo_ml_v2 import build_temporal_risk as ml_risk
        ml_risk()
        steps["ml_risk"] = "ok"

        # Step 9: Beach risk profile
        from risk_by_beach import build_risk_profile as beach_risk
        beach_risk()
        steps["beach_risk"] = "ok"

        # Step 10: Trajectory forecast (14 días, RTOFS+GFS)
        # ⚠️ Ejecución lenta (~15-30 min). Se ejecuta al final para no bloquear
        # los pasos rápidos anteriores. Si falla, los pasos 7-9 ya se guardaron.
        try:
            from modelo_pronostico_7dias import run_forecast_7dias as trajectory
            trajectory()
            steps["trajectory_forecast"] = "ok"
        except Exception as traj_err:
            steps["trajectory_forecast"] = f"falló: {traj_err}"
            print(f"  ⚠️ Trajectory forecast falló (no crítico): {traj_err}")

    except Exception as e:
        error = str(e)
        steps["error"] = error

    log = db.query(DownloadLog).filter(DownloadLog.id == log_id).first()
    if log:
        log.status = "error" if error else "ok"
        log.finished_at = datetime.now(timezone.utc)
        log.steps = json.dumps(steps)
        log.error = error
        db.commit()
    db.close()


@router.post("/run")
def trigger_download(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    log = DownloadLog(status="running")
    db.add(log)
    db.commit()
    db.refresh(log)
    background_tasks.add_task(run_weekly_pipeline, log.id)
    return {"status": "started", "log_id": log.id, "message": "Pipeline running in background"}


@router.get("/status")
def get_download_status(db: Session = Depends(get_db)):
    log = db.query(DownloadLog).order_by(DownloadLog.id.desc()).first()
    if not log:
        return {"status": "never_run"}
    import json
    return {
        "status": log.status,
        "started_at": str(log.started_at) if log.started_at else None,
        "finished_at": str(log.finished_at) if log.finished_at else None,
        "steps": json.loads(log.steps) if log.steps else None,
        "error": log.error,
    }


@router.get("/logs")
def get_download_logs(limit: int = 10, db: Session = Depends(get_db)):
    logs = db.query(DownloadLog).order_by(DownloadLog.id.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "started_at": str(log.started_at) if log.started_at else None,
            "finished_at": str(log.finished_at) if log.finished_at else None,
            "status": log.status,
            "error": log.error,
        }
        for log in logs
    ]
