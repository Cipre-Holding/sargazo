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


class MendeleyObservation(Base):
    __tablename__ = "mendeley_observations"

    month = Column(String(7), primary_key=True)  # "YYYY-MM"
    nss_biomass = Column(Float, nullable=True)
    sss_biomass = Column(Float, nullable=True)
    gsr_biomass = Column(Float, nullable=True)
    acr_biomass = Column(Float, nullable=True)
    gasb_biomass = Column(Float, nullable=True)
    nw_gom_biomass = Column(Float, nullable=True)


class SEMARObservation(Base):
    __tablename__ = "semar_observations"

    fecha = Column(String(10), primary_key=True)  # "YYYY-MM-DD"
    num_boletin = Column(String(20), nullable=True)
    semaforo = Column(String(20), nullable=True)
    biomasa_caribe_mexicano_ton = Column(Float, nullable=True)
    biomasa_caribe_central_ton = Column(Float, nullable=True)
    biomasa_caribe_oriental_ton = Column(Float, nullable=True)
    biomasa_atlantico_central_ton = Column(Float, nullable=True)
    num_conglomerados = Column(Integer, nullable=True)
    conglomerado_cozumel = Column(String(5), nullable=True)

    # Corrientes
    corriente_xcalak_nudos = Column(Float, nullable=True)
    corriente_xcalak_dir = Column(String(50), nullable=True)
    corriente_mahahual_nudos = Column(Float, nullable=True)
    corriente_mahahual_dir = Column(String(50), nullable=True)
    corriente_tulum_nudos = Column(Float, nullable=True)
    corriente_tulum_dir = Column(String(50), nullable=True)
    corriente_playa_carmen_nudos = Column(Float, nullable=True)
    corriente_playa_carmen_dir = Column(String(50), nullable=True)
    corriente_puerto_morelos_nudos = Column(Float, nullable=True)
    corriente_puerto_morelos_dir = Column(String(50), nullable=True)
    corriente_cancun_nudos = Column(Float, nullable=True)
    corriente_cancun_dir = Column(String(50), nullable=True)

    # Vientos
    viento_norte_nudos = Column(String(20), nullable=True)
    viento_norte_dir = Column(String(50), nullable=True)
    viento_sur_nudos = Column(String(20), nullable=True)
    viento_sur_dir = Column(String(50), nullable=True)

    archivo = Column(String(255), nullable=True)
    anio = Column(Integer, nullable=True)


class SatelliteObservation(Base):
    __tablename__ = "satellite_observations"

    month = Column(String(7), primary_key=True)  # "YYYY-MM"
    satsum_caribe_mt = Column(Float, nullable=True)
    satsum_zee_mt = Column(Float, nullable=True)


class ClimatologyObservation(Base):
    __tablename__ = "climatology_observations"

    month = Column(String(7), primary_key=True)  # "YYYY-MM"
    sst = Column(Float, nullable=True)
    sst_anom = Column(Float, nullable=True)
    uwnd_ms = Column(Float, nullable=True)
    vwnd_ms = Column(Float, nullable=True)
    onshore_cozumel_ms = Column(Float, nullable=True)


class DailySirSummary(Base):
    __tablename__ = "daily_sir_summaries"

    date = Column(String(8), primary_key=True)  # "YYYYMMDD"
    total_segments = Column(Integer, nullable=False)
    count_low = Column(Integer, nullable=False)
    count_warning = Column(Integer, nullable=False)
    count_medium = Column(Integer, nullable=False)
    count_high = Column(Integer, nullable=False)


class ModelFeature(Base):
    __tablename__ = "model_features"

    month = Column(String(7), primary_key=True)  # "YYYY-MM"
    dataset_type = Column(String(50), primary_key=True)  # "fuente", "prediccion_cm", "semaforo", "growth", "residuos"
    feature_json = Column(Text, nullable=False)


class ModelPrediction(Base):
    __tablename__ = "model_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_log_id = Column(Integer, nullable=True)
    model_name = Column(String(50), nullable=False)  # "0.1_regresion_lineal", "ensemble", etc.
    date_month = Column(String(10), nullable=False)  # "2026-06"
    prediction_json = Column(Text, nullable=False)


class BeachRiskProfile(Base):
    __tablename__ = "beach_risk_profiles"

    beach_name = Column(String(100), primary_key=True)
    risk_level = Column(String(20), nullable=False)
    pct_high_medium = Column(Float, nullable=False)
    frequency_score = Column(Float, nullable=False)
