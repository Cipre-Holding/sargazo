"""
Genera los 4 datasets de features listos para modelado:
  1. features_fuente.csv         — serie histórica larga (298 meses, ARFIMA/Prophet)
  2. features_prediccion_cm.csv  — features para predicción CM (10 meses, SVR/logístico)
  3. features_semaforo.csv       — target semáforo ordinal (21 meses, clasificador)
  4. residuos_estocasticos.csv   — residuos OU des-estacionalizados (288 meses, fOU/ARFIMA)

Transformaciones aplicadas:
  - log(biomasa + 1e-9)
  - rango viento "3-6" → midpoint 4.5
  - dirección texto → ángulo grados [0-360]
  - semáforo → ordinal 1-6
  - mes → sin/cos cíclico
  - z-score vs media estacional histórica
  - lags 1-3 meses
"""

import pandas as pd
import numpy as np
from pathlib import Path

COMBINED = Path("sargazo_combinado_2000_2026.csv")
SATSUM_CARIBE = Path("satsum_caribe_mensual.csv")
SATSUM_ZEE = Path("satsum_zee_mex_mensual.csv")
SST_COZUMEL = Path("sst_cozumel_mensual.csv")
VIENTO_NCEP = Path("viento_cozumel_mensual.csv")
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
    """Retorna (media por mes, std por mes) sobre la serie histórica Mendeley."""
    seasonal_mean, seasonal_std = {}, {}
    for m in range(1, 13):
        vals = log_series[months == m].dropna()
        seasonal_mean[m] = vals.mean() if len(vals) > 0 else np.nan
        seasonal_std[m] = vals.std() if len(vals) > 1 else 1.0
    return seasonal_mean, seasonal_std


def build_features_fuente(df: pd.DataFrame) -> pd.DataFrame:
    """Serie histórica de la región fuente: Mendeley GASB + SEMAR ACO."""
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

    # Z-score vs media estacional (calculado solo sobre período Mendeley)
    mend_mask = out["fuente"] == "mendeley"
    s_mean, s_std = compute_seasonal_stats(out.loc[mend_mask, "log_biomasa"],
                                           out.loc[mend_mask, "mes"])
    out["log_seasonal_mean"] = out["mes"].map(s_mean)
    out["log_seasonal_std"] = out["mes"].map(s_std)
    out["z_score"] = (out["log_biomasa"] - out["log_seasonal_mean"]) / out["log_seasonal_std"]

    # Lags y diferencias
    out["log_biomasa_lag1"] = out["log_biomasa"].shift(1)
    out["log_biomasa_lag2"] = out["log_biomasa"].shift(2)
    out["log_biomasa_lag3"] = out["log_biomasa"].shift(3)
    out["delta_log"] = out["log_biomasa"].diff()

    # Dummy cambio de régimen ~2011
    out["post_2011"] = (out["anio"] >= 2011).astype(int)

    return out


def build_residuos_estocasticos(fuente_df: pd.DataFrame) -> pd.DataFrame:
    """Residuos des-estacionalizados para análisis fOU/ARFIMA."""
    out = fuente_df[fuente_df["fuente"] == "mendeley"].copy()
    out["residuo_ou"] = out["log_biomasa"] - out["log_seasonal_mean"]
    out["delta_log_lag1"] = out["delta_log"].shift(1)
    out["delta_log_sq"] = out["delta_log"] ** 2
    out["es_salto"] = (out["z_score"].abs() > 1.5).astype(int)

    cols = ["month", "log_biomasa", "log_seasonal_mean", "residuo_ou",
            "delta_log", "delta_log_lag1", "delta_log_sq", "z_score", "es_salto"]
    return out[cols].reset_index(drop=True)


def build_features_prediccion_cm(df: pd.DataFrame,
                                  fuente_df: pd.DataFrame) -> pd.DataFrame:
    """Features para predicción cuantitativa de CM (10 meses)."""
    semar = df[df["fuente"].isin(["semar", "semar_sem_only"])].copy()
    semar = add_cyclic_month(semar)

    # Semáforo ordinal
    semar["semaforo_ord"] = semar["semaforo_mensual"].map(SEM_MAP)
    semar["conglomerado"] = semar["conglomerado_cozumel"].map({"SI": 1, "NO": 0})

    # Log biomasa target + variables relacionadas
    semar["log_cm"] = np.log(semar["SEMAR_CM_Mt"] + EPS)
    semar["log_aco"] = np.log(semar["SEMAR_ACO_Mt"] + EPS)
    semar["log_cc"] = np.log(semar["SEMAR_CC_Mt"] + EPS)
    semar["log_co"] = np.log(semar["SEMAR_CO_Mt"] + EPS)
    semar["num_conglomerados"] = semar["num_conglomerados"]

    # Lags ACO solo desde datos SEMAR (evita contaminación con GASB Mendeley)
    semar_aco = semar.dropna(subset=["log_aco"]).set_index("month")["log_aco"]
    for lag in [1, 2, 3]:
        semar[f"log_aco_lag{lag}"] = semar["month"].map(
            lambda m, l=lag: _get_lag(semar_aco, m, l)
        )

    # Z-score ACO
    mend_df = fuente_df[fuente_df["fuente"] == "mendeley"]
    s_mean, s_std = compute_seasonal_stats(mend_df["log_biomasa"], mend_df["mes"])
    semar["z_score_aco"] = semar.apply(
        lambda r: (r["log_aco"] - s_mean.get(r["mes"], np.nan)) /
                  s_std.get(r["mes"], 1.0)
        if pd.notna(r["SEMAR_ACO_Mt"]) else np.nan,
        axis=1,
    )

    # SATsum: agregar biomasa satelital como predictor adicional
    try:
        sc = pd.read_csv(SATSUM_CARIBE)
        sc["month_key"] = sc["year"].astype(str) + "-" + sc["month"].astype(str).str.zfill(2)
        sz = pd.read_csv(SATSUM_ZEE)
        sz["month_key"] = sz["year"].astype(str) + "-" + sz["month"].astype(str).str.zfill(2)
        semar["month_key"] = semar["month"].astype(str)
        semar = semar.merge(sc[["month_key", "biomasa_mt"]], on="month_key", how="left")
        semar.rename(columns={"biomasa_mt": "satsum_caribe_mt"}, inplace=True)
        semar = semar.merge(sz[["month_key", "biomasa_mt"]], on="month_key", how="left")
        semar.rename(columns={"biomasa_mt": "satsum_zee_mt"}, inplace=True)
        semar["log_satsum_caribe"] = np.log(semar["satsum_caribe_mt"] + EPS)
        semar["log_satsum_zee"] = np.log(semar["satsum_zee_mt"] + EPS)
        semar.drop(columns=["month_key"], inplace=True)
        print(f"  SATsum integrado: Caribe n={semar['satsum_caribe_mt'].notna().sum()}, ZEE n={semar['satsum_zee_mt'].notna().sum()}")
    except Exception as e:
        print(f"  SATsum no disponible: {e}")
        semar["satsum_caribe_mt"] = np.nan
        semar["satsum_zee_mt"] = np.nan
        semar["log_satsum_caribe"] = np.nan
        semar["log_satsum_zee"] = np.nan

    # SST + Viento NCEP
    semar = add_sst_wind_to_semar(semar)

    # Corrientes (todas las estaciones disponibles)
    estaciones = {
        "corriente_xcalak_nudos": "corriente_xcalak_nudos_f",
        "corriente_mahahual_nudos": "corriente_mahahual_nudos_f",
        "corriente_tulum_nudos": "corriente_tulum_nudos_f",
        "corriente_playa_carmen_nudos": "corriente_pm_nudos",
        "corriente_puerto_morelos_nudos": "corriente_puerto_morelos_nudos_f",
        "corriente_cancun_nudos": "corriente_cancun_nudos_f",
    }
    for orig, dest in estaciones.items():
        semar[dest] = semar[orig]
    
    # Direcciones de corrientes
    semar["corriente_pm_dir_ang"] = semar["corriente_playa_carmen_dir"].map(dir_to_angle)
    semar["corriente_cancun_dir_ang"] = semar["corriente_cancun_dir"].map(dir_to_angle)
    semar["corriente_xcalak_dir_ang"] = semar["corriente_xcalak_dir"].map(dir_to_angle)
    semar["corriente_mahahual_dir_ang"] = semar["corriente_mahahual_dir"].map(dir_to_angle)

    # Vientos
    semar["viento_norte_mid"] = semar["viento_norte_nudos"].map(range_to_mid)
    semar["viento_sur_mid"] = semar["viento_sur_nudos"].map(range_to_mid)
    semar["viento_norte_dir_ang"] = semar["viento_norte_dir"].map(dir_to_angle)
    semar["viento_sur_dir_ang"] = semar["viento_sur_dir"].map(dir_to_angle)

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
    return semar[cols].reset_index(drop=True)


def add_sst_wind_to_semar(semar: pd.DataFrame) -> pd.DataFrame:
    """Add SST (with anomaly), NCEP wind to a semar-based dataframe."""
    try:
        sst_df = pd.read_csv(SST_COZUMEL)
        # Calculate SST anomaly from monthly climatology
        sst_df["month_num"] = pd.to_datetime(sst_df["time"]).dt.month
        clim = sst_df.groupby("month_num")["sst_c"].mean().to_dict()
        sst_df["sst_anom"] = sst_df["sst_c"] - sst_df["month_num"].map(clim)
        
        semar["month_key"] = semar["month"].astype(str)
        semar = semar.merge(sst_df[["month_key", "sst_c", "sst_anom"]], on="month_key", how="left")
        semar.rename(columns={"sst_c": "sst"}, inplace=True)
        semar.drop(columns=["month_key"], inplace=True)
    except Exception as e:
        print(f"  SST carga: {e}")
        semar["sst"] = np.nan
        semar["sst_anom"] = np.nan

    try:
        v_df = pd.read_csv(VIENTO_NCEP)
        semar["month_key"] = semar["month"].astype(str)
        semar = semar.merge(v_df[["month_key", "uwnd_ms", "vwnd_ms", "onshore_cozumel_ms"]],
                          on="month_key", how="left")
        semar.drop(columns=["month_key"], inplace=True)
    except:
        semar["uwnd_ms"] = np.nan
        semar["vwnd_ms"] = np.nan
        semar["onshore_cozumel_ms"] = np.nan

    return semar


def build_features_semaforo(df: pd.DataFrame, fuente_df: pd.DataFrame) -> pd.DataFrame:
    """Dataset para clasificador ordinal de semáforo (21 meses)."""
    semar = df[df["fuente"].str.startswith("semar")].copy()
    semar = add_cyclic_month(semar)
    semar["semaforo_ord"] = semar["semaforo_mensual"].map(SEM_MAP)
    semar["conglomerado"] = semar["conglomerado_cozumel"].map({"SI": 1, "NO": 0})

    # Aligned ACO lags solo desde datos SEMAR (evita GASB Mendeley)
    semar["log_aco"] = np.log(semar["SEMAR_ACO_Mt"] + EPS)
    semar["log_cc"] = np.log(semar["SEMAR_CC_Mt"] + EPS)
    semar["log_co"] = np.log(semar["SEMAR_CO_Mt"] + EPS)
    semar["num_conglomerados"] = semar["num_conglomerados"]
    semar_aco = semar.dropna(subset=["log_aco"]).set_index("month")["log_aco"]
    for lag in [1, 2]:
        semar[f"aligned_aco_lag{lag}"] = semar["month"].map(
            lambda m, l=lag: _get_lag(semar_aco, m, l)
        )

    # Z-score del predictor
    mend_df = fuente_df[fuente_df["fuente"] == "mendeley"]
    s_mean, s_std = compute_seasonal_stats(mend_df["log_biomasa"], mend_df["mes"])
    semar["z_score_aco_lag1"] = semar.apply(
        lambda r: (r["aligned_aco_lag1"] - s_mean.get(r["mes"], np.nan)) /
                  s_std.get(r["mes"], 1.0)
        if pd.notna(r["aligned_aco_lag1"]) else np.nan,
        axis=1,
    )
    semar = add_sst_wind_to_semar(semar)

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
    """Obtiene el valor de la serie con lag meses de anticipación."""
    try:
        period = pd.Period(month_str, freq="M") - lag
        return series.get(str(period), np.nan)
    except Exception:
        return np.nan


def main():
    df = pd.read_csv(COMBINED)

    fuente = build_features_fuente(df)
    fuente.to_csv("features_fuente.csv", index=False)
    print(f"features_fuente.csv          {len(fuente):>4} filas  {len(fuente.columns)} cols")

    residuos = build_residuos_estocasticos(fuente)
    residuos.to_csv("residuos_estocasticos.csv", index=False)
    print(f"residuos_estocasticos.csv    {len(residuos):>4} filas  {len(residuos.columns)} cols")

    cm_feat = build_features_prediccion_cm(df, fuente)
    cm_feat.to_csv("features_prediccion_cm.csv", index=False)
    print(f"features_prediccion_cm.csv   {len(cm_feat):>4} filas  {len(cm_feat.columns)} cols")
    print(f"  → filas con log_cm no-nulo: {cm_feat['log_cm'].notna().sum()}")

    sem_feat = build_features_semaforo(df, fuente)
    sem_feat.to_csv("features_semaforo.csv", index=False)
    print(f"features_semaforo.csv        {len(sem_feat):>4} filas  {len(sem_feat.columns)} cols")
    print(f"  → filas con semaforo_ord no-nulo: {sem_feat['semaforo_ord'].notna().sum()}")

    print("\nDistribución semáforo (features_semaforo.csv):")
    SEM_INV = {v: k for k, v in SEM_MAP.items()}
    dist = sem_feat["semaforo_ord"].value_counts().sort_index()
    for k, v in dist.items():
        print(f"  {k} ({SEM_INV.get(k,'?'):<10}): {v}")

    # Dataset #5: growth features para Prophet con SST
    try:
        growth = build_features_growth(df, fuente)
        growth.to_csv("features_growth.csv", index=False)
        print(f"features_growth.csv           {len(growth):>4} filas  {len(growth.columns)} cols")
    except Exception as e:
        print(f"features_growth.csv           ERROR: {e}")
        import traceback
        traceback.print_exc()


def build_features_growth(df: pd.DataFrame, fuente_df: pd.DataFrame) -> pd.DataFrame:
    """Dataset para modelo de crecimiento (Prophet) con SST y viento."""
    growth = fuente_df[["month", "log_biomasa", "post_2011", "fuente"]].copy()

    try:
        sst_df = pd.read_csv(SST_COZUMEL)
        sst_df["month_key"] = sst_df["year"].astype(str) + "-" + sst_df["month"].astype(str).str.zfill(2)
        sst_df["month_num"] = pd.to_datetime(sst_df["time"]).dt.month
        clim = sst_df.groupby("month_num")["sst_c"].mean().to_dict()
        sst_df["sst_anom"] = sst_df["sst_c"] - sst_df["month_num"].map(clim)
        growth["month_key"] = growth["month"].astype(str)
        growth = growth.merge(sst_df[["month_key", "sst_c", "sst_anom"]], on="month_key", how="left")
        growth.rename(columns={"sst_c": "sst"}, inplace=True)
        growth.drop(columns=["month_key"], inplace=True)
    except:
        growth["sst"] = np.nan
        growth["sst_anom"] = np.nan

    try:
        v_df = pd.read_csv(VIENTO_NCEP)
        growth["month_key"] = growth["month"].astype(str)
        growth = growth.merge(v_df[["month_key", "uwnd_ms", "vwnd_ms"]], on="month_key", how="left")
        growth.drop(columns=["month_key"], inplace=True)
    except:
        growth["uwnd_ms"] = np.nan
        growth["vwnd_ms"] = np.nan

    growth["sst_anom_lag1"] = growth["sst_anom"].shift(1)
    return growth.reset_index(drop=True)


if __name__ == "__main__":
    main()
