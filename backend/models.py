from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from backend.database import Base


class ManualInput(Base):
    __tablename__ = "manual_inputs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fecha = Column(String(10), nullable=False)
    cm_ton = Column(Float, nullable=True)
    aco_mt = Column(Float, nullable=True)
    cc_ton = Column(Float, nullable=True)
    co_ton = Column(Float, nullable=True)
    viento_norte_nudos = Column(String(20), nullable=True)
    viento_sur_nudos = Column(String(20), nullable=True)
    corriente_playa_carmen_nudos = Column(Float, nullable=True)
    corriente_cancun_nudos = Column(Float, nullable=True)
    semaforo = Column(String(20), nullable=True)
    conglomerado_cozumel = Column(String(5), nullable=True)
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Boolean, default=False)


class DownloadLog(Base):
    __tablename__ = "download_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="running")
    steps = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
