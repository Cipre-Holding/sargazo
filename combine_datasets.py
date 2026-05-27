"""
Combina el dataset Mendeley (Hu et al. 2023) con los boletines SEMAR/IOGMC
para crear una serie temporal de biomasa 2000-2026 en la base de datos SQLite.
"""

import sys
import re
import pandas as pd
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backend.database import SessionLocal, init_db
from backend.models import MendeleyObservation, SEMARObservation, ManualInput

OUTPUT_CSV = ROOT / "sargazo_combinado_2000_2026.csv"
OUTPUT_CORR = ROOT / "sargazo_correlaciones_lag.csv"

SEMAR_COLS = {
    "biomasa_caribe_mexicano_ton": "SEMAR_CM_Mt",
    "biomasa_caribe_central_ton": "SEMAR_CC_Mt",
    "biomasa_caribe_oriental_ton": "SEMAR_CO_Mt",
    "biomasa_atlantico_central_ton": "SEMAR_ACO_Mt",
}


def process_manual_inputs(db):
    """Integra las observaciones manuales pendientes en la tabla semar_observations."""
    pending = db.query(ManualInput).filter(ManualInput.processed == False).all()
    if not pending:
        print("No hay entradas manuales pendientes.")
        return
    
    print(f"Procesando {len(pending)} entradas manuales...")
    for inp in pending:
        # Buscar si ya existe una observación para esta fecha
        obs = db.query(SEMARObservation).filter(SEMARObservation.fecha == inp.fecha).first()
        if not obs:
            obs = SEMARObservation(fecha=inp.fecha)
            db.add(obs)
        
        if inp.cm_ton is not None:
            obs.biomasa_caribe_mexicano_ton = inp.cm_ton
        if inp.aco_mt is not None:
            obs.biomasa_atlantico_central_ton = inp.aco_mt
        if inp.cc_ton is not None:
            obs.biomasa_caribe_central_ton = inp.cc_ton
        if inp.co_ton is not None:
            obs.biomasa_caribe_oriental_ton = inp.co_ton
        if inp.semaforo is not None:
            obs.semaforo = inp.semaforo
        if inp.conglomerado_cozumel is not None:
            obs.conglomerado_cozumel = inp.conglomerado_cozumel
        if inp.viento_norte_nudos is not None:
            obs.viento_norte_nudos = inp.viento_norte_nudos
        if inp.viento_sur_nudos is not None:
            obs.viento_sur_nudos = inp.viento_sur_nudos
        if inp.corriente_playa_carmen_nudos is not None:
            obs.corriente_playa_carmen_nudos = inp.corriente_playa_carmen_nudos
        if inp.corriente_cancun_nudos is not None:
            obs.corriente_cancun_nudos = inp.corriente_cancun_nudos
            
        inp.processed = True
    db.commit()


def load_mendeley(db) -> pd.DataFrame:
    query = db.query(MendeleyObservation).all()
    rows = []
    for q in query:
        rows.append({
            "month": q.month,
            "Mend_NSS_Mt": q.nss_biomass,
            "Mend_SSS_Mt": q.sss_biomass,
            "Mend_GSR_Mt": q.gsr_biomass,
            "Mend_ACR_Mt": q.acr_biomass,
            "Mend_GASB_Mt": q.gasb_biomass,
            "Mend_NWGoM_Mt": q.nw_gom_biomass,
        })
    df = pd.DataFrame(rows)
    if len(df) > 0:
        df["month"] = pd.to_datetime(df["month"], format="%Y-%m").dt.to_period("M")
        df = df.set_index("month").sort_index()
    else:
        df = pd.DataFrame(columns=["Mend_NSS_Mt", "Mend_SSS_Mt", "Mend_GSR_Mt", "Mend_ACR_Mt", "Mend_GASB_Mt", "Mend_NWGoM_Mt"])
        df.index = pd.PeriodIndex([], freq="M")
        df.index.name = "month"
    print(f"Mendeley (DB): {len(df)} meses")
    return df


def _mode_or_nan(s: pd.Series):
    v = s.dropna()
    return v.mode().iloc[0] if len(v) > 0 else np.nan


def load_semar_monthly(db) -> pd.DataFrame:
    query = db.query(SEMARObservation).all()
    rows = []
    for q in query:
        rows.append({
            "fecha": pd.to_datetime(q.fecha),
            "biomasa_caribe_mexicano_ton": q.biomasa_caribe_mexicano_ton,
            "biomasa_caribe_central_ton": q.biomasa_caribe_central_ton,
            "biomasa_caribe_oriental_ton": q.biomasa_caribe_oriental_ton,
            "biomasa_atlantico_central_ton": q.biomasa_atlantico_central_ton,
            "num_conglomerados": q.num_conglomerados,
            "semaforo": q.semaforo,
            "conglomerado_cozumel": q.conglomerado_cozumel,
            "corriente_xcalak_nudos": q.corriente_xcalak_nudos,
            "corriente_xcalak_dir": q.corriente_xcalak_dir,
            "corriente_mahahual_nudos": q.corriente_mahahual_nudos,
            "corriente_mahahual_dir": q.corriente_mahahual_dir,
            "corriente_tulum_nudos": q.corriente_tulum_nudos,
            "corriente_tulum_dir": q.corriente_tulum_dir,
            "corriente_playa_carmen_nudos": q.corriente_playa_carmen_nudos,
            "corriente_playa_carmen_dir": q.corriente_playa_carmen_dir,
            "corriente_puerto_morelos_nudos": q.corriente_puerto_morelos_nudos,
            "corriente_puerto_morelos_dir": q.corriente_puerto_morelos_dir,
            "corriente_cancun_nudos": q.corriente_cancun_nudos,
            "corriente_cancun_dir": q.corriente_cancun_dir,
            "viento_norte_nudos": q.viento_norte_nudos,
            "viento_norte_dir": q.viento_norte_dir,
            "viento_sur_nudos": q.viento_sur_nudos,
            "viento_sur_dir": q.viento_sur_dir,
        })
    df = pd.DataFrame(rows)
    if len(df) == 0:
        cols = ["fecha", "biomasa_caribe_mexicano_ton", "biomasa_caribe_central_ton",
                "biomasa_caribe_oriental_ton", "biomasa_atlantico_central_ton", "num_conglomerados",
                "semaforo", "conglomerado_cozumel", "corriente_xcalak_nudos", "corriente_xcalak_dir",
                "corriente_mahahual_nudos", "corriente_mahahual_dir", "corriente_tulum_nudos", "corriente_tulum_dir",
                "corriente_playa_carmen_nudos", "corriente_playa_carmen_dir", "corriente_puerto_morelos_nudos",
                "corriente_puerto_morelos_dir", "corriente_cancun_nudos", "corriente_cancun_dir",
                "viento_norte_nudos", "viento_norte_dir", "viento_sur_nudos", "viento_sur_dir"]
        df = pd.DataFrame(columns=cols)
        df["month"] = pd.PeriodIndex([], freq="M")
        df = df.set_index("month")
        return df

    df["month"] = df["fecha"].dt.to_period("M")

    corriente_nudos = [c for c in df.columns if c.startswith("corriente_") and c.endswith("_nudos")]
    viento_nudos    = [c for c in df.columns if c.startswith("viento_") and c.endswith("_nudos")]

    bio_cols = list(SEMAR_COLS.keys())
    for c in bio_cols:
        p99 = df[c].quantile(0.99)
        if pd.notna(p99):
            df[c] = df[c].clip(upper=p99)

    num_cols = bio_cols + ["num_conglomerados"] + corriente_nudos
    num_agg = df.groupby("month")[num_cols].median()

    for raw, renamed in SEMAR_COLS.items():
        num_agg[renamed] = num_agg.pop(raw) / 1_000_000

    cat_cols = (
        ["semaforo", "conglomerado_cozumel"]
        + viento_nudos
        + [c for c in df.columns if c.endswith("_dir")]
    )
    cat_agg = df.groupby("month")[cat_cols].agg(_mode_or_nan)
    cat_agg.rename(columns={"semaforo": "semaforo_mensual"}, inplace=True)

    monthly = num_agg.join(cat_agg, how="left").sort_index()
    print(f"SEMAR mensual (DB): {len(monthly)} meses")
    valid_bio = monthly["SEMAR_CM_Mt"].notna().sum()
    print(f"  → Meses con biomasa CM no-nula: {valid_bio}/{len(monthly)}")
    return monthly


def build_combined(mendeley: pd.DataFrame, semar: pd.DataFrame) -> pd.DataFrame:
    combined = mendeley.join(semar, how="outer")
    combined = combined.sort_index()

    combined["aligned_CM"]  = combined["Mend_NWGoM_Mt"].fillna(combined["SEMAR_CM_Mt"])
    combined["aligned_ACO"] = combined["Mend_GASB_Mt"].fillna(combined["SEMAR_ACO_Mt"])
    combined["aligned_CO"]  = combined["Mend_ACR_Mt"].fillna(combined["SEMAR_CO_Mt"])

    has_mend = combined["Mend_GASB_Mt"].notna()
    has_semar_bio = combined["SEMAR_CM_Mt"].notna()
    combined["fuente"] = np.select(
        [has_mend & has_semar_bio, has_mend, has_semar_bio],
        ["overlap", "mendeley", "semar"],
        default="semar_sem_only",
    )

    print(f"\nCombinado: {len(combined)} meses  ({combined.index[0]} → {combined.index[-1]})")
    print(combined["fuente"].value_counts().to_string())
    return combined


def lag_correlation(series_lead: pd.Series, series_lag: pd.Series,
                    max_lag: int = 6) -> pd.DataFrame:
    records = []
    s1 = series_lead.dropna()
    for lag in range(0, max_lag + 1):
        s2 = series_lag.shift(-lag).dropna()
        aligned = s1.align(s2, join="inner")
        if len(aligned[0]) > 5:
            r = aligned[0].corr(aligned[1])
            records.append({"lag_meses": lag, "n": len(aligned[0]), "r": round(r, 4)})
    return pd.DataFrame(records)


def compute_correlations(combined: pd.DataFrame) -> pd.DataFrame:
    pairs = [
        ("Mend_GASB_Mt", "Mend_ACR_Mt",  "GASB → ACR (Mendeley)"),
        ("Mend_GASB_Mt", "Mend_NWGoM_Mt","GASB → NW_GoM (Mendeley)"),
        ("SEMAR_ACO_Mt", "SEMAR_CM_Mt",  "ACO → CM (SEMAR)"),
        ("SEMAR_ACO_Mt", "SEMAR_CO_Mt",  "ACO → CO (SEMAR)"),
        ("aligned_ACO",  "aligned_CM",   "ACO/GASB → CM/NWGoM (combinado)"),
        ("aligned_ACO",  "aligned_CO",   "ACO/GASB → CO/ACR (combinado)"),
    ]
    all_rows = []
    for lead_col, lag_col, label in pairs:
        if lead_col in combined.columns and lag_col in combined.columns:
            df_lag = lag_correlation(combined[lead_col], combined[lag_col])
            df_lag.insert(0, "par", label)
            all_rows.append(df_lag)
    return pd.concat(all_rows, ignore_index=True)


def anomaly_vs_baseline(combined: pd.DataFrame):
    hist_df = combined[combined.index.year < 2024].reset_index()
    hist_df["mes"] = hist_df["month"].dt.month
    baseline_gasb = hist_df.groupby("mes")["Mend_GASB_Mt"].agg(["mean", "std"])
    baseline_acr  = hist_df.groupby("mes")["Mend_ACR_Mt"].agg(["mean", "std"])

    print("\n=== Anomalía GASB 2024 vs media histórica 2000-2023 ===")
    print(f"{'Mes':<9} {'GASB_hist_mean':>15} {'GASB_2024':>11} {'σ':>6}  {'z-score':>8}")
    mend_2024 = combined[(combined.index.year == 2024) & combined["Mend_GASB_Mt"].notna()]
    for period, row in mend_2024.iterrows():
        m = period.month
        mu = baseline_gasb.loc[m, "mean"]
        sigma = baseline_gasb.loc[m, "std"]
        val = row["Mend_GASB_Mt"]
        z = (val - mu) / sigma if sigma > 0 else np.nan
        flag = "⚠ " if z > 2 else "  "
        print(f"{flag}{str(period):<9} {mu:>15.4f} {val:>11.4f} {sigma:>6.4f}  {z:>8.2f}")

    # ACR anomaly
    print("\n=== Anomalía ACR 2024 (embudo Caribe) ===")
    print(f"{'Mes':<9} {'ACR_hist_mean':>14} {'ACR_2024':>10}  {'z-score':>8}")
    mend_acr_2024 = combined[(combined.index.year == 2024) & combined["Mend_ACR_Mt"].notna()]
    for period, row in mend_acr_2024.iterrows():
        m = period.month
        mu = baseline_acr.loc[m, "mean"]
        sigma = baseline_acr.loc[m, "std"]
        val = row["Mend_ACR_Mt"]
        z = (val - mu) / sigma if sigma > 0 else np.nan
        flag = "⚠ " if z > 2 else "  "
        print(f"{flag}{str(period):<9} {mu:>14.4f} {val:>10.4f}  {z:>8.2f}")

    # SEMAR 2024-2026
    print("\n=== Semáforo SEMAR 2024-2026 ===")
    semar_rows = combined[combined.index.year >= 2024].reset_index()
    print(f"{'Mes':<9} {'Semáforo':<12} {'CM_Mt':>8} {'CO_Mt':>8} {'ACO_Mt':>8}")
    for _, row in semar_rows.iterrows():
        sem  = row.get("semaforo_mensual", "")
        cm   = f"{row['SEMAR_CM_Mt']:.4f}"  if pd.notna(row.get("SEMAR_CM_Mt")) else "—"
        co   = f"{row['SEMAR_CO_Mt']:.4f}"  if pd.notna(row.get("SEMAR_CO_Mt")) else "—"
        aco  = f"{row['SEMAR_ACO_Mt']:.4f}" if pd.notna(row.get("SEMAR_ACO_Mt")) else "—"
        print(f"{str(row['month']):<9} {str(sem):<12} {cm:>8} {co:>8} {aco:>8}")


def main():
    init_db()
    db = SessionLocal()
    try:
        process_manual_inputs(db)
        mendeley = load_mendeley(db)
        semar = load_semar_monthly(db)
    finally:
        db.close()

    combined = build_combined(mendeley, semar)

    # Save to CSV as cache/compatibility layer
    out_df = combined.reset_index()
    out_df["month"] = out_df["month"].astype(str)
    out_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nGuardado CSV compatible: {OUTPUT_CSV}  ({len(out_df)} filas)")

    # Correlaciones
    corr = compute_correlations(combined)
    corr.to_csv(OUTPUT_CORR, index=False)
    print(f"Correlaciones CSV: {OUTPUT_CORR}")
    
    anomaly_vs_baseline(combined)


if __name__ == "__main__":
    main()
