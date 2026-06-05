from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.database import SessionLocal
from backend.models import DownloadLog

scheduler = BackgroundScheduler()


def weekly_pipeline_job():
    """Runs every Monday at 06:00 UTC."""
    from backend.routers.download import run_weekly_pipeline
    db = SessionLocal()
    log = DownloadLog(status="running")
    db.add(log)
    db.commit()
    db.refresh(log)
    db.close()
    run_weekly_pipeline(log.id)


def start_scheduler():
    scheduler.add_job(
        weekly_pipeline_job,
        CronTrigger(day_of_week="mon", hour=6, minute=0),
        id="weekly_pipeline",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown(wait=False)
