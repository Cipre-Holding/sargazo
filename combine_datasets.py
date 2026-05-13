"""
Combina el dataset Mendeley (Hu et al. 2023) con los boletines SEMAR/IOGMC
para crear una serie temporal de biomasa 2000-2026.

Mapeo de regiones:
  Mendeley GASB  ↔  SEMAR ACO  (Atlántico Central/Gran Cinturón de Sargazo)
  Mendeley ACR   ↔  SEMAR CO   (Caribe Oriental / Corriente Antillana)
  Mendeley NW_GoM↔  SEMAR CM   (Caribe Mexicano, aproximado)
  SEMAR CC       —  sin equivalente Mendeley (Caribe Central)

Unidades: ambos datasets normalizados a millones de toneladas métricas (Mt)
"""

import re
import pandas as pd
import numpy as np
from pathlib import Path

MASTER_CSV = Path(__file__).parent / "boletines_sargazo_MASTER.csv"
MENDELEY_XLSX = Path(__file__).parent / "Sargassum_biomass_subregions.xlsx"
OUTPUT_CSV = Path(__file__).parent / "sargazo_combinado_2000_2026.csv"
OUTPUT_CORR = Path(__file__).parent / "sargazo_correlaciones_lag.csv"

SEMAR_COLS = {
    "biomasa_caribe_mexicano_ton": "SEMAR_CM_Mt",
    "biomasa_caribe_central_ton": "SEMAR_CC_Mt",
    "biomasa_caribe_oriental_ton": "SEMAR_CO_Mt",
    "biomasa_atlantico_central_ton": "SEMAR_ACO_Mt",
}

MENDELEY_COLS = {
    "NSS biomass": "Mend_NSS_Mt",
    "SSS biomass": "Mend_SSS_Mt",
    "GSR biomass": "Mend_GSR_Mt",
    "ACR biomass": "Mend_ACR_Mt",
    "GASB biomass": "Mend_GASB_Mt",
    "NW_GoM biomass": "Mend_NWGoM_Mt",
}


def load_mendeley() -> pd.DataFrame:
    df = pd.read_excel(MENDELEY_XLSX)
    df = df[["Time (mm-yyyy)"] + list(MENDELEY_COLS.keys())].copy()
    df.rename(columns=MENDELEY_COLS, inplace=True)
    # Parse mm-yyyy → period
    df["month"] = pd.to_datetime(df["Time (mm-yyyy)"], format="%m-%Y").dt.to_period("M")
    df.drop(columns=["Time (mm-yyyy)"], inplace=True)
    df = df.set_index("month").sort_index()
    print(f"Mendeley: {len(df)} meses  ({df.index[0]} → {df.index[-1]})")
    return df


def _mode_or_nan(s: pd.Series):
    v = s.dropna()
    return v.mode().iloc[0] if len(v) > 0 else np.nan


def load_semar_monthly() -> pd.DataFrame:
    df = pd.read_csv(MASTER_CSV, parse_dates=["fecha"])
    df["month"] = df["fecha"].dt.to_period("M")

    # corrientes: float (nudos); vientos: rango string ("3-6") → tratar como categórica
    corriente_nudos = [c for c in df.columns if c.startswith("corriente_") and c.endswith("_nudos")]
    viento_nudos    = [c for c in df.columns if c.startswith("viento_") and c.endswith("_nudos")]

    # Winsorizar biomasa diaria al P99 antes de agregar (protección contra outliers extremos)
    bio_cols = list(SEMAR_COLS.keys())
    for c in bio_cols:
        p99 = df[c].quantile(0.99)
        df[c] = df[c].clip(upper=p99)

    # --- columnas numéricas: mediana mensual (robusta a outliers en biomasa) ---
    num_cols = bio_cols + ["num_conglomerados"] + corriente_nudos
    num_agg = df.groupby("month")[num_cols].median()

    # biomasa: tons → Mt
    for raw, renamed in SEMAR_COLS.items():
        num_agg[renamed] = num_agg.pop(raw) / 1_000_000

    # --- columnas categóricas: moda mensual ---
    cat_cols = (
        ["semaforo", "conglomerado_cozumel"]
        + viento_nudos                                       # rangos "3-6" → moda
        + [c for c in df.columns if c.endswith("_dir")]     # corrientes + vientos dir (8)
    )
    cat_agg = df.groupby("month")[cat_cols].agg(_mode_or_nan)
    cat_agg.rename(columns={"semaforo": "semaforo_mensual"}, inplace=True)

    monthly = num_agg.join(cat_agg, how="left").sort_index()
    print(f"SEMAR mensual: {len(monthly)} meses  ({monthly.index[0]} → {monthly.index[-1]})")
    valid_bio = monthly["SEMAR_CM_Mt"].notna().sum()
    print(f"  → Meses con biomasa CM no-nula: {valid_bio}/{len(monthly)}")
    return monthly


def build_combined(mendeley: pd.DataFrame, semar: pd.DataFrame) -> pd.DataFrame:
    combined = mendeley.join(semar, how="outer")
    combined = combined.sort_index()

    # Columnas alineadas (región homóloga)
    combined["aligned_CM"]  = combined["Mend_NWGoM_Mt"].fillna(combined["SEMAR_CM_Mt"])
    combined["aligned_ACO"] = combined["Mend_GASB_Mt"].fillna(combined["SEMAR_ACO_Mt"])
    combined["aligned_CO"]  = combined["Mend_ACR_Mt"].fillna(combined["SEMAR_CO_Mt"])

    # Fuente del registro
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
    """Correlación de Pearson con lag 0..max_lag meses."""
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
    """
    Anomalía GASB 2024 vs histórico (Mendeley), y semáforo SEMAR 2024-2026.
    Nota: SEMAR ACO ≠ GASB → no se comparan directamente.
    """
    hist_df = combined[combined.index.year < 2024].reset_index()
    hist_df["mes"] = hist_df["month"].dt.month
    baseline_gasb = hist_df.groupby("mes")["Mend_GASB_Mt"].agg(["mean", "std"])
    baseline_acr  = hist_df.groupby("mes")["Mend_ACR_Mt"].agg(["mean", "std"])

    # 2024-02 son los últimos datos Mendeley — se comparan contra baseline
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

    # ACR anomaly (funnel to Caribbean)
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

    # SEMAR 2024-2026: semáforo + biomasa disponible
    print("\n=== Semáforo SEMAR 2024-2026 (biomasa en Mt cuando disponible) ===")
    semar_rows = combined[combined.index.year >= 2024].reset_index()
    print(f"{'Mes':<9} {'Semáforo':<12} {'CM_Mt':>8} {'CO_Mt':>8} {'ACO_Mt':>8}")
    for _, row in semar_rows.iterrows():
        sem  = row.get("semaforo_mensual", "")
        cm   = f"{row['SEMAR_CM_Mt']:.4f}"  if pd.notna(row.get("SEMAR_CM_Mt")) else "—"
        co   = f"{row['SEMAR_CO_Mt']:.4f}"  if pd.notna(row.get("SEMAR_CO_Mt")) else "—"
        aco  = f"{row['SEMAR_ACO_Mt']:.4f}" if pd.notna(row.get("SEMAR_ACO_Mt")) else "—"
        print(f"{str(row['month']):<9} {str(sem):<12} {cm:>8} {co:>8} {aco:>8}")


def main():
    mendeley = load_mendeley()
    semar = load_semar_monthly()
    combined = build_combined(mendeley, semar)

    # Guardar dataset combinado — advertir si LibreOffice tiene el archivo abierto
    lock_file = OUTPUT_CSV.parent / f".~lock.{OUTPUT_CSV.name}#"
    if lock_file.exists():
        print(f"⚠  ADVERTENCIA: {lock_file.name} existe — LibreOffice tiene {OUTPUT_CSV.name} abierto.")
        print("   El archivo CSV se sobreescribirá de todas formas; cierra LibreOffice para evitar conflictos.")
    out_df = combined.reset_index()
    out_df["month"] = out_df["month"].astype(str)
    out_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nGuardado: {OUTPUT_CSV}  ({len(out_df)} filas, {len(out_df.columns)} columnas)")

    # Correlaciones con lag
    corr = compute_correlations(combined)
    corr.to_csv(OUTPUT_CORR, index=False)
    print(f"Correlaciones: {OUTPUT_CORR}")
    print("\n=== Mejor lag por par ===")
    for par, grp in corr.groupby("par"):
        best = grp.loc[grp["r"].abs().idxmax()]
        print(f"  {par}: r={best['r']:.3f}  lag={int(best['lag_meses'])} meses  (n={int(best['n'])})")

    # Anomalía 2026
    anomaly_vs_baseline(combined)

    print("\nColumnas del CSV combinado:")
    print(out_df.columns.tolist())


if __name__ == "__main__":
    main()
