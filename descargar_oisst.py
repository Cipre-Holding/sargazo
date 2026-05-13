"""
Descarga SST mensual NOAA OISST v2.1 vía PSL THREDDS OPeNDAP.

Fuente: https://psl.noaa.gov/thredds/dodsC/Datasets/noaa.oisst.v2.highres/sst.mon.mean.nc
Resolución: 0.25°, mensual (1981-presente)
Variable: sst en °C
"""

from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr

ROOT = Path(__file__).resolve().parent
OUTPUT_CSV = ROOT / "sst_cozumel_mensual.csv"

URL = "https://psl.noaa.gov/thredds/dodsC/Datasets/noaa.oisst.v2.highres/sst.mon.mean.nc"

# Región Cozumel/Caribe (longitud 0-360)
LON_MIN, LON_MAX = 268, 276  # -92° a -84°
LAT_MIN, LAT_MAX = 16, 24


def descargar_sst():
    print("Conectando a PSL THREDDS OISST...")
    ds = xr.open_dataset(URL, decode_times=True)
    print(f"  OK: {len(ds.time)} meses ({ds.time.values[0]} → {ds.time.values[-1]})")

    # Subset región Caribe
    ds_reg = ds.sel(lat=slice(LAT_MIN, LAT_MAX), lon=slice(LON_MIN, LON_MAX))
    
    # Promedio espacial sobre toda la región
    sst_mean = ds_reg.mean(dim=['lat', 'lon'])
    
    # Extraer datos 2020-2026 (para ventana de features)
    sst_recent = sst_mean.sel(time=slice('2020-01-01', '2026-12-31'))
    
    rows = []
    for t_idx in range(len(sst_recent.time)):
        t = pd.to_datetime(sst_recent.time.values[t_idx])
        sst_val = float(sst_recent.sst.values[t_idx])
        rows.append({'time': t, 'year': t.year, 'month': t.month,
                     'sst_c': round(sst_val, 2)})
    
    df = pd.DataFrame(rows)
    df['month_key'] = df['year'].astype(str) + "-" + df['month'].astype(str).str.zfill(2)
    
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n✅ SST guardado: {OUTPUT_CSV}")
    print(f"   {len(df)} meses ({df['year'].min()} → {df['year'].max()})")
    print(f"   SST: {df['sst_c'].min():.1f}–{df['sst_c'].max():.1f}°C, media {df['sst_c'].mean():.1f}°C")
    
    # Mostrar overlap SEMAR
    semar = df[df['year'] >= 2024]
    print(f"\n   SST Cozumel 2024-2026:")
    for _, r in semar.iterrows():
        print(f"     {r['month_key']}: {r['sst_c']:.1f}°C")
    
    ds.close()
    return df


if __name__ == "__main__":
    descargar_sst()
