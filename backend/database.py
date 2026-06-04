import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

ROOT = Path(__file__).resolve().parent.parent

def get_db_path():
    if os.getenv("K_SERVICE") or not os.access(str(ROOT), os.W_OK):
        return Path("/tmp/sargazo.db")
    return ROOT / "sargazo.db"

DB_PATH = get_db_path()
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_database_if_empty(db):
    import pandas as pd
    import json
    import numpy as np
    from backend.models import (
        MendeleyObservation, SEMARObservation, SatelliteObservation,
        ClimatologyObservation, DailySirSummary, BeachRiskProfile
    )
    
    # 1. Mendeley
    if db.query(MendeleyObservation).first() is None:
        xlsx_path = ROOT / "Sargassum_biomass_subregions.xlsx"
        if xlsx_path.exists():
            print("Seeding Mendeley observations...")
            df = pd.read_excel(xlsx_path)
            for _, r in df.iterrows():
                try:
                    month_dt = pd.to_datetime(r["Time (mm-yyyy)"], format="%m-%Y")
                    month_str = month_dt.strftime("%Y-%m")
                    obs = MendeleyObservation(
                        month=month_str,
                        nss_biomass=float(r["NSS biomass"]) if pd.notna(r["NSS biomass"]) else None,
                        sss_biomass=float(r["SSS biomass"]) if pd.notna(r["SSS biomass"]) else None,
                        gsr_biomass=float(r["GSR biomass"]) if pd.notna(r["GSR biomass"]) else None,
                        acr_biomass=float(r["ACR biomass"]) if pd.notna(r["ACR biomass"]) else None,
                        gasb_biomass=float(r["GASB biomass"]) if pd.notna(r["GASB biomass"]) else None,
                        nw_gom_biomass=float(r["NW_GoM biomass"]) if pd.notna(r["NW_GoM biomass"]) else None,
                    )
                    db.add(obs)
                except Exception as e:
                    print(f"Error parsing mendeley row: {e}")
            db.commit()
            
    # 2. SEMAR Observations
    if db.query(SEMARObservation).first() is None:
        csv_path = ROOT / "boletines_sargazo_MASTER.csv"
        if csv_path.exists():
            print("Seeding SEMAR master observations...")
            df = pd.read_csv(csv_path)
            for _, r in df.iterrows():
                try:
                    def to_float(val):
                        if pd.isna(val) or val == "":
                            return None
                        try:
                            return float(val)
                        except:
                            return None
                            
                    def to_int(val):
                        if pd.isna(val) or val == "":
                            return None
                        try:
                            return int(float(val))
                        except:
                            return None
                            
                    obs = SEMARObservation(
                        fecha=str(r["fecha"]),
                        num_boletin=str(r["num_boletin"]) if pd.notna(r["num_boletin"]) else None,
                        semaforo=str(r["semaforo"]) if pd.notna(r["semaforo"]) else None,
                        biomasa_caribe_mexicano_ton=to_float(r.get("biomasa_caribe_mexicano_ton")),
                        biomasa_caribe_central_ton=to_float(r.get("biomasa_caribe_central_ton")),
                        biomasa_caribe_oriental_ton=to_float(r.get("biomasa_caribe_oriental_ton")),
                        biomasa_atlantico_central_ton=to_float(r.get("biomasa_atlantico_central_ton")),
                        num_conglomerados=to_int(r.get("num_conglomerados")),
                        conglomerado_cozumel=str(r.get("conglomerado_cozumel")) if pd.notna(r.get("conglomerado_cozumel")) else None,
                        
                        corriente_xcalak_nudos=to_float(r.get("corriente_xcalak_nudos")),
                        corriente_xcalak_dir=str(r.get("corriente_xcalak_dir")) if pd.notna(r.get("corriente_xcalak_dir")) else None,
                        corriente_mahahual_nudos=to_float(r.get("corriente_mahahual_nudos")),
                        corriente_mahahual_dir=str(r.get("corriente_mahahual_dir")) if pd.notna(r.get("corriente_mahahual_dir")) else None,
                        corriente_tulum_nudos=to_float(r.get("corriente_tulum_nudos")),
                        corriente_tulum_dir=str(r.get("corriente_tulum_dir")) if pd.notna(r.get("corriente_tulum_dir")) else None,
                        corriente_playa_carmen_nudos=to_float(r.get("corriente_playa_carmen_nudos")),
                        corriente_playa_carmen_dir=str(r.get("corriente_playa_carmen_dir")) if pd.notna(r.get("corriente_playa_carmen_dir")) else None,
                        corriente_puerto_morelos_nudos=to_float(r.get("corriente_puerto_morelos_nudos")),
                        corriente_puerto_morelos_dir=str(r.get("corriente_puerto_morelos_dir")) if pd.notna(r.get("corriente_puerto_morelos_dir")) else None,
                        corriente_cancun_nudos=to_float(r.get("corriente_cancun_nudos")),
                        corriente_cancun_dir=str(r.get("corriente_cancun_dir")) if pd.notna(r.get("corriente_cancun_dir")) else None,
                        
                        viento_norte_nudos=str(r.get("viento_norte_nudos")) if pd.notna(r.get("viento_norte_nudos")) else None,
                        viento_norte_dir=str(r.get("viento_norte_dir")) if pd.notna(r.get("viento_norte_dir")) else None,
                        viento_sur_nudos=str(r.get("viento_sur_nudos")) if pd.notna(r.get("viento_sur_nudos")) else None,
                        viento_sur_dir=str(r.get("viento_sur_dir")) if pd.notna(r.get("viento_sur_dir")) else None,
                        
                        archivo=str(r.get("archivo")) if pd.notna(r.get("archivo")) else None,
                        anio=to_int(r.get("año")) or to_int(r.get("anio")),
                    )
                    db.add(obs)
                except Exception as e:
                    print(f"Error seeding SEMAR master row: {e}")
            db.commit()
            
    # 3. Satellite Observations
    if db.query(SatelliteObservation).first() is None:
        sat_caribe = ROOT / "satsum_caribe_mensual.csv"
        sat_zee = ROOT / "satsum_zee_mex_mensual.csv"
        if sat_caribe.exists() or sat_zee.exists():
            print("Seeding Satellite (SATsum) observations...")
            data = {}
            if sat_caribe.exists():
                df = pd.read_csv(sat_caribe)
                for _, r in df.iterrows():
                    m_key = f"{int(r['year'])}-{str(int(r['month'])).zfill(2)}"
                    data.setdefault(m_key, {})["caribe"] = float(r["biomasa_mt"]) if pd.notna(r["biomasa_mt"]) else None
            if sat_zee.exists():
                df = pd.read_csv(sat_zee)
                for _, r in df.iterrows():
                    m_key = f"{int(r['year'])}-{str(int(r['month'])).zfill(2)}"
                    data.setdefault(m_key, {})["zee"] = float(r["biomasa_mt"]) if pd.notna(r["biomasa_mt"]) else None
            
            for m_key, vals in data.items():
                obs = SatelliteObservation(
                    month=m_key,
                    satsum_caribe_mt=vals.get("caribe"),
                    satsum_zee_mt=vals.get("zee"),
                )
                db.add(obs)
            db.commit()

    # 4. Climatology Observations
    if db.query(ClimatologyObservation).first() is None:
        sst_path = ROOT / "sst_cozumel_mensual.csv"
        wind_path = ROOT / "viento_cozumel_mensual.csv"
        if sst_path.exists() or wind_path.exists():
            print("Seeding Climatology observations...")
            data = {}
            if sst_path.exists():
                df = pd.read_csv(sst_path)
                df["month_num"] = pd.to_datetime(df["time"]).dt.month
                clim = df.groupby("month_num")["sst_c"].mean().to_dict()
                df["sst_anom"] = df["sst_c"] - df["month_num"].map(clim)
                for _, r in df.iterrows():
                    m_key = r["month_key"]
                    data.setdefault(m_key, {})["sst"] = float(r["sst_c"]) if pd.notna(r["sst_c"]) else None
                    data.setdefault(m_key, {})["sst_anom"] = float(r["sst_anom"]) if pd.notna(r["sst_anom"]) else None
            
            if wind_path.exists():
                df = pd.read_csv(wind_path)
                for _, r in df.iterrows():
                    m_key = r["month_key"]
                    data.setdefault(m_key, {})["uwnd_ms"] = float(r["uwnd_ms"]) if pd.notna(r["uwnd_ms"]) else None
                    data.setdefault(m_key, {})["vwnd_ms"] = float(r["vwnd_ms"]) if pd.notna(r["vwnd_ms"]) else None
                    data.setdefault(m_key, {})["onshore_cozumel_ms"] = float(r["onshore_cozumel_ms"]) if pd.notna(r["onshore_cozumel_ms"]) else None
                    
            for m_key, vals in data.items():
                obs = ClimatologyObservation(
                    month=m_key,
                    sst=vals.get("sst"),
                    sst_anom=vals.get("sst_anom"),
                    uwnd_ms=vals.get("uwnd_ms"),
                    vwnd_ms=vals.get("vwnd_ms"),
                    onshore_cozumel_ms=vals.get("onshore_cozumel_ms"),
                )
                db.add(obs)
            db.commit()

    # 5. Daily SIR summaries
    if db.query(DailySirSummary).first() is None:
        sir_path = ROOT / "noaa_sir_resumen_diario.csv"
        if sir_path.exists():
            print("Seeding Daily SIR summaries...")
            df = pd.read_csv(sir_path)
            for _, r in df.iterrows():
                try:
                    summary = DailySirSummary(
                        date=str(int(r["date"])),
                        total_segments=int(r["total_segments"]),
                        count_low=int(r["count_low"]),
                        count_warning=int(r["count_warning"]),
                        count_medium=int(r["count_medium"]),
                        count_high=int(r["count_high"]),
                    )
                    db.add(summary)
                except Exception as e:
                    print(f"Error seeding Daily SIR row: {e}")
            db.commit()

    # 6. Beach Risk Profile
    if db.query(BeachRiskProfile).first() is None:
        beach_path = ROOT / "risk_by_beach.json"
        if beach_path.exists():
            print("Seeding Beach Risk Profiles...")
            try:
                with open(beach_path) as f:
                    beach_data = json.load(f)
                segmentos = beach_data.get("segmentos", [])
                for seg in segmentos:
                    pct = float(seg.get("pct_high_medium", 0.0))
                    if pct >= 60:
                        r_level = "HIGH"
                    elif pct >= 30:
                        r_level = "MEDIUM"
                    else:
                        r_level = "LOW"
                    profile = BeachRiskProfile(
                        beach_name=seg["name"],
                        risk_level=r_level,
                        pct_high_medium=pct,
                        frequency_score=float(seg.get("riesgo_promedio", 0.0)),
                    )
                    db.add(profile)
                db.commit()
            except Exception as e:
                print(f"Error seeding Beach Risk profiles: {e}")

    # 7. Model Features
    from backend.models import ModelFeature
    if db.query(ModelFeature).first() is None:
        feature_files = {
            "fuente": "features_fuente.csv",
            "residuos": "residuos_estocasticos.csv",
            "prediccion_cm": "features_prediccion_cm.csv",
            "semaforo": "features_semaforo.csv",
            "growth": "features_growth.csv"
        }
        print("Seeding Model features...")
        for dataset_type, fname in feature_files.items():
            fpath = ROOT / fname
            if fpath.exists():
                try:
                    df_feat = pd.read_csv(fpath)
                    for _, r in df_feat.iterrows():
                        row_dict = r.to_dict()
                        for k, v in row_dict.items():
                            if isinstance(v, (pd.Period, pd.Timestamp)):
                                row_dict[k] = str(v)
                            elif isinstance(v, float) and np.isnan(v):
                                row_dict[k] = None
                        feat = ModelFeature(
                            month=str(r["month"]),
                            dataset_type=dataset_type,
                            feature_json=json.dumps(row_dict),
                        )
                        db.add(feat)
                except Exception as e:
                    print(f"Error seeding feature file {fname}: {e}")
        db.commit()

    # 8. Model Predictions
    from backend.models import ModelPrediction
    if db.query(ModelPrediction).first() is None:
        print("Seeding Model predictions...")
        for fname in ["predicciones_fase0.json", "predicciones_fase1.json", "predicciones_fase2.json"]:
            fpath = ROOT / fname
            if fpath.exists():
                try:
                    with open(fpath) as f:
                        preds_data = json.load(f)
                    for key, val in preds_data.items():
                        target_month = "2026-06"
                        if isinstance(val, dict):
                            for k_val in val.keys():
                                if k_val.startswith("prediccion_"):
                                    month_name = k_val.replace("prediccion_", "")
                                    months_map = {
                                        "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
                                        "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
                                        "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"
                                    }
                                    target_month = f"2026-{months_map.get(month_name, '06')}"
                                    break
                        pred = ModelPrediction(
                            run_log_id=None,
                            model_name=key,
                            date_month=target_month,
                            prediction_json=json.dumps(val, default=str),
                        )
                        db.add(pred)
                except Exception as e:
                    print(f"Error seeding predictions file {fname}: {e}")
        db.commit()


def init_db():
    import backend.models  # noqa: F401
    Base.metadata.create_all(bind=engine, checkfirst=True)
    db = SessionLocal()
    try:
        seed_database_if_empty(db)
    finally:
        db.close()
