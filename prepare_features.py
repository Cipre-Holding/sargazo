"""
Genera los datasets de features listos para modelado en SQLite y CSV:
  1. features_fuente         — serie histórica larga
  2. features_prediccion_cm  — features para predicción CM
  3. features_semaforo       — target semáforo ordinal
  4. residuos_estocasticos   — residuos OU des-estacionalizados
  5. features_growth         — growth features para Prophet con SST
"""

import sys
import json
import pandas as pd
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backend.database import SessionLocal, init_db
from backend.models import ClimatologyObservation, SatelliteObservation, ModelFeature

COMBINED = ROOT / "sargazo_combinado_2000_2026.csv"
EPS = 1e-9

SEM_MAP = {
    "ESCASO": 1, "MUY BAJO": 2, "BAJO": 3,
    "MODERADO": 4, "ALTO": 5, "MUY ALTO": 6,
}

DIR_MAP = {
    "norte": 0, "noreste": 45, "este": 90, "sureste": 135,
    "sur": 180, "suroeste": 225, "oeste": 270, "noroeste": 315,
}


def range_to_mid(s) -> float:
    if pd.isna(s):
        return np.nan
    parts = str(s).replace("–", "-").replace(" ", "").split("-")
    try:
        nums = [float(p) for p in parts if p]
        return sum(nums) / len(nums)
    except Exception:
        return np.nan


def dir_to_angle(s) -> float:
    if pd.isna(s):
        return np.nan
    return DIR_MAP.get(str(s).strip().lower(), np.nan)


def add_cyclic_month(df: pd.DataFrame) -> pd.DataFrame:
    df["mes"] = df["month"].str[5:7].astype(int)
    df["anio"] = df["month"].str[:4].astype(int)
    df["month_sin"] = np.sin(2 * np.pi * df["mes"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["mes"] / 12)
    return df


def compute_seasonal_stats(log_series: pd.Series, months: pd.Series) -> tuple[dict, dict]:
    seasonal_mean, seasonal_std = {}, {}
    for m in range(1, 13):
        vals = log_series[months == m].dropna()
        seasonal_mean[m] = vals.mean() if len(vals) > 0 else np.nan
        seasonal_std[m] = vals.std() if len(vals) > 1 else 1.0
    return seasonal_mean, seasonal_std


def build_features_fuente(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, r in df.iterrows():
        bio = r["Mend_GASB_Mt"] if pd.notna(r["Mend_GASB_Mt"]) else r["SEMAR_ACO_Mt"]
        if pd.isna(bio):
            continue
        rows.append({
            "month": r["month"],
            "biomasa_mt": bio,
            "log_biomasa": np.log(bio + EPS),
            "fuente": r["fuente"],
        })
    out = pd.DataFrame(rows).reset_index(drop=True)
    out = add_cyclic_month(out)

    mend_mask = out["fuente"] == "mendeley"
    s_mean, s_std = compute_seasonal_stats(out.loc[mend_mask, "log_biomasa"],
                                           out.loc[mend_mask, "mes"])
    out["log_seasonal_mean"] = out["mes"].map(s_mean)
    out["log_seasonal_std"] = out["mes"].map(s_std)
    out["z_score"] = (out["log_biomasa"] - out["log_seasonal_mean"]) / out["log_seasonal_std"]

    out["log_biomasa_lag1"] = out["log_biomasa"].shift(1)
    out["log_biomasa_lag2"] = out["log_biomasa"].shift(2)
    out["log_biomasa_lag3"] = out["log_biomasa"].shift(3)
    out["delta_log"] = out["log_biomasa"].diff()
    out["post_2011"] = (out["anio"] >= 2011).astype(int)

    return out


def build_residuos_estocasticos(fuente_df: pd.DataFrame) -> pd.DataFrame:
    out = fuente_df[fuente_df["fuente"] == "mendeley"].copy()
    out["residuo_ou"] = out["log_biomasa"] - out["log_seasonal_mean"]
    out["delta_log_lag1"] = out["delta_log"].shift(1)
    out["delta_log_sq"] = out["delta_log"] ** 2
    out["es_salto"] = (out["z_score"].abs() > 1.5).astype(int)

    cols = ["month", "log_biomasa", "log_seasonal_mean", "residuo_ou",
            "delta_log", "delta_log_lag1", "delta_log_sq", "z_score", "es_salto"]
    return out[cols].reset_index(drop=True)


def build_features_prediccion_cm(df: pd.DataFrame, fuente_df: pd.DataFrame, db) -> pd.DataFrame:
    semar = df[df["fuente"].isin(["semar", "semar_sem_only"])].copy()
    semar = add_cyclic_month(semar)

    semar["semaforo_ord"] = semar["semaforo_mensual"].map(SEM_MAP)
    semar["conglomerado"] = semar["conglomerado_cozumel"].map({"SI": 1, "NO": 0})

    semar["log_cm"] = np.log(semar["SEMAR_CM_Mt"] + EPS)
    semar["log_aco"] = np.log(semar["SEMAR_ACO_Mt"] + EPS)
    semar["log_cc"] = np.log(semar["SEMAR_CC_Mt"] + EPS)
    semar["log_co"] = np.log(semar["SEMAR_CO_Mt"] + EPS)
    semar["num_conglomerados"] = semar["num_conglomerados"]

    semar_aco = semar.dropna(subset=["log_aco"]).set_index("month")["log_aco"]
    for lag in [1, 2, 3]:
        semar[f"log_aco_lag{lag}"] = semar["month"].map(
            lambda m, l=lag: _get_lag(semar_aco, m, l)
        )

    mend_df = fuente_df[fuente_df["fuente"] == "mendeley"]
    s_mean, s_std = compute_seasonal_stats(mend_df["log_biomasa"], mend_df["mes"])
    semar["z_score_aco"] = semar.apply(
        lambda r: (r["log_aco"] - s_mean.get(r["mes"], np.nan)) /
                  s_std.get(r["mes"], 1.0)
        if pd.notna(r["SEMAR_ACO_Mt"]) else np.nan,
        axis=1,
    )

    # SATsum from DB
    try:
        query = db.query(SatelliteObservation).all()
        rows = []
        for q in query:
            rows.append({
                "month_key": q.month,
                "satsum_caribe_mt": q.satsum_caribe_mt,
                "satsum_zee_mt": q.satsum_zee_mt,
            })
        sat_df = pd.DataFrame(rows)
        if len(sat_df) > 0:
            semar["month_key"] = semar["month"].astype(str)
            semar = semar.merge(sat_df, on="month_key", how="left")
            semar["log_satsum_caribe"] = np.log(semar["satsum_caribe_mt"] + EPS)
            semar["log_satsum_zee"] = np.log(semar["satsum_zee_mt"] + EPS)
            semar.drop(columns=["month_key"], inplace=True)
            print(f"  SATsum (DB) integrado: n={len(sat_df)}")
        else:
            semar["satsum_caribe_mt"] = np.nan
            semar["satsum_zee_mt"] = np.nan
            semar["log_satsum_caribe"] = np.nan
            semar["log_satsum_zee"] = np.nan
    except Exception as e:
        print(f"  SATsum load error: {e}")
        semar["satsum_caribe_mt"] = np.nan
        semar["satsum_zee_mt"] = np.nan
        semar["log_satsum_caribe"] = np.nan
        semar["log_satsum_zee"] = np.nan

    # SST + Viento NCEP from DB
    semar = add_sst_wind_to_semar(semar, db)

    estaciones = {
        "corriente_xcalak_nudos": "corriente_xcalak_nudos_f",
        "corriente_mahahual_nudos": "corriente_mahahual_nudos_f",
        "corriente_tulum_nudos": "corriente_tulum_nudos_f",
        "corriente_playa_carmen_nudos": "corriente_pm_nudos",
        "corriente_puerto_morelos_nudos": "corriente_puerto_morelos_nudos_f",
        "corriente_cancun_nudos": "corriente_cancun_nudos_f",
    }
    for orig, dest in estaciones.items():
        if orig in semar.columns:
            semar[dest] = semar[orig]
        else:
            semar[dest] = np.nan
    
    semar["corriente_pm_dir_ang"] = semar["corriente_playa_carmen_dir"].map(dir_to_angle) if "corriente_playa_carmen_dir" in semar.columns else np.nan
    semar["corriente_cancun_dir_ang"] = semar["corriente_cancun_dir"].map(dir_to_angle) if "corriente_cancun_dir" in semar.columns else np.nan
    semar["corriente_xcalak_dir_ang"] = semar["corriente_xcalak_dir"].map(dir_to_angle) if "corriente_xcalak_dir" in semar.columns else np.nan
    semar["corriente_mahahual_dir_ang"] = semar["corriente_mahahual_dir"].map(dir_to_angle) if "corriente_mahahual_dir" in semar.columns else np.nan

    semar["viento_norte_mid"] = semar["viento_norte_nudos"].map(range_to_mid) if "viento_norte_nudos" in semar.columns else np.nan
    semar["viento_sur_mid"] = semar["viento_sur_nudos"].map(range_to_mid) if "viento_sur_nudos" in semar.columns else np.nan
    semar["viento_norte_dir_ang"] = semar["viento_norte_dir"].map(dir_to_angle) if "viento_norte_dir" in semar.columns else np.nan
    semar["viento_sur_dir_ang"] = semar["viento_sur_dir"].map(dir_to_angle) if "viento_sur_dir" in semar.columns else np.nan

    cols = [
        "month", "log_cm", "semaforo_ord", "conglomerado", "num_conglomerados",
        "log_aco", "log_aco_lag1", "log_aco_lag2", "log_aco_lag3",
        "log_cc", "log_co",
        "month_sin", "month_cos", "mes", "anio",
        "corriente_xcalak_nudos_f", "corriente_mahahual_nudos_f", "corriente_tulum_nudos_f",
        "corriente_pm_nudos", "corriente_puerto_morelos_nudos_f", "corriente_cancun_nudos_f",
        "corriente_pm_dir_ang", "corriente_cancun_dir_ang",
        "corriente_xcalak_dir_ang", "corriente_mahahual_dir_ang",
        "viento_norte_mid", "viento_sur_mid", "viento_norte_dir_ang", "viento_sur_dir_ang",
        "z_score_aco",
        "log_satsum_caribe", "log_satsum_zee",
        "satsum_caribe_mt", "satsum_zee_mt",
        "sst",
        "sst_anom",
        "uwnd_ms", "vwnd_ms", "onshore_cozumel_ms",
    ]
    return semar[[c for c in cols if c in semar.columns]].reset_index(drop=True)


def add_sst_wind_to_semar(semar: pd.DataFrame, db) -> pd.DataFrame:
    try:
        query = db.query(ClimatologyObservation).all()
        rows = []
        for q in query:
            rows.append({
                "month_key": q.month,
                "sst": q.sst,
                "sst_anom": q.sst_anom,
                "uwnd_ms": q.uwnd_ms,
                "vwnd_ms": q.vwnd_ms,
                "onshore_cozumel_ms": q.onshore_cozumel_ms,
            })
        clim_df = pd.DataFrame(rows)
        if len(clim_df) > 0:
            semar["month_key"] = semar["month"].astype(str)
            semar = semar.merge(clim_df, on="month_key", how="left")
            semar.drop(columns=["month_key"], inplace=True)
            print(f"  Climatology (DB) integrado: n={len(clim_df)}")
        else:
            semar["sst"] = np.nan
            semar["sst_anom"] = np.nan
            semar["uwnd_ms"] = np.nan
            semar["vwnd_ms"] = np.nan
            semar["onshore_cozumel_ms"] = np.nan
    except Exception as e:
        print(f"  Climatology DB load error: {e}")
        semar["sst"] = np.nan
        semar["sst_anom"] = np.nan
        semar["uwnd_ms"] = np.nan
        semar["vwnd_ms"] = np.nan
        semar["onshore_cozumel_ms"] = np.nan
    return semar


def build_features_semaforo(df: pd.DataFrame, fuente_df: pd.DataFrame, db) -> pd.DataFrame:
    semar = df[df["fuente"].str.startswith("semar")].copy()
    semar = add_cyclic_month(semar)
    semar["semaforo_ord"] = semar["semaforo_mensual"].map(SEM_MAP)
    semar["conglomerado"] = semar["conglomerado_cozumel"].map({"SI": 1, "NO": 0})

    semar["log_aco"] = np.log(semar["SEMAR_ACO_Mt"] + EPS)
    semar["log_cc"] = np.log(semar["SEMAR_CC_Mt"] + EPS)
    semar["log_co"] = np.log(semar["SEMAR_CO_Mt"] + EPS)
    semar["num_conglomerados"] = semar["num_conglomerados"]
    semar_aco = semar.dropna(subset=["log_aco"]).set_index("month")["log_aco"]
    for lag in [1, 2]:
        semar[f"aligned_aco_lag{lag}"] = semar["month"].map(
            lambda m, l=lag: _get_lag(semar_aco, m, l)
        )

    mend_df = fuente_df[fuente_df["fuente"] == "mendeley"]
    s_mean, s_std = compute_seasonal_stats(mend_df["log_biomasa"], mend_df["mes"])
    semar["z_score_aco_lag1"] = semar.apply(
        lambda r: (r["aligned_aco_lag1"] - s_mean.get(r["mes"], np.nan)) /
                  s_std.get(r["mes"], 1.0)
        if pd.notna(r["aligned_aco_lag1"]) else np.nan,
        axis=1,
    )
    semar = add_sst_wind_to_semar(semar, db)

    cols = [
        "month", "semaforo_ord", "conglomerado", "num_conglomerados",
        "aligned_aco_lag1", "aligned_aco_lag2",
        "log_cc", "log_co",
        "month_sin", "month_cos", "mes", "anio",
        "z_score_aco_lag1",
        "sst", "sst_anom", "uwnd_ms", "vwnd_ms", "onshore_cozumel_ms",
    ]
    return semar[[c for c in cols if c in semar.columns]].reset_index(drop=True)


def _get_lag(series: pd.Series, month_str: str, lag: int):
    try:
        period = pd.Period(month_str, freq="M") - lag
        return series.get(str(period), np.nan)
    except Exception:
        return np.nan


def build_features_growth(fuente_df: pd.DataFrame, db) -> pd.DataFrame:
    growth = fuente_df[["month", "log_biomasa", "post_2011", "fuente"]].copy()
    growth = add_sst_wind_to_semar(growth, db)
    growth["sst_anom_lag1"] = growth["sst_anom"].shift(1)
    return growth.reset_index(drop=True)


def save_features_to_db(df, dataset_type, db):
    """Guarda un dataframe de características en la tabla model_features de SQLite."""
    print(f"Guardando features '{dataset_type}' en DB...")
    db.query(ModelFeature).filter(ModelFeature.dataset_type == dataset_type).delete()
    
    for _, r in df.iterrows():
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
    db.commit()


def main():
    init_db()
    db = SessionLocal()
    
    try:
        df = pd.read_csv(COMBINED)

        fuente = build_features_fuente(df)
        fuente.to_csv(ROOT / "features_fuente.csv", index=False)
        save_features_to_db(fuente, "fuente", db)

        residuos = build_residuos_estocasticos(fuente)
        residuos.to_csv(ROOT / "residuos_estocasticos.csv", index=False)
        save_features_to_db(residuos, "residuos", db)

        cm_feat = build_features_prediccion_cm(df, fuente, db)
        cm_feat.to_csv(ROOT / "features_prediccion_cm.csv", index=False)
        save_features_to_db(cm_feat, "prediccion_cm", db)

        sem_feat = build_features_semaforo(df, fuente, db)
        sem_feat.to_csv(ROOT / "features_semaforo.csv", index=False)
        save_features_to_db(sem_feat, "semaforo", db)

        growth = build_features_growth(fuente, db)
        growth.to_csv(ROOT / "features_growth.csv", index=False)
        save_features_to_db(growth, "growth", db)

        print("\nPipeline de características completado exitosamente.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
