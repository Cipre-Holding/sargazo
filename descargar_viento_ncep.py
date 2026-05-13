"""
Descarga datos de viento NCEP/NCAR Reanalysis (U/V 10m) vía PSL THREDDS.

Fuente: https://psl.noaa.gov/data/gridded/data.ncep.reanalysis.derived.html
Variables: uwnd.10m (componente E/W), vwnd.10m (componente N/S)
Resolución: 2.5° (~250 km), mensual (1948-presente)
"""

from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr

ROOT = Path(__file__).resolve().parent
OUTPUT_CSV = ROOT / "viento_cozumel_mensual.csv"

UWND_URL = "https://psl.noaa.gov/thredds/dodsC/Datasets/ncep.reanalysis.derived/surface_gauss/uwnd.10m.mon.mean.nc"
VWND_URL = "https://psl.noaa.gov/thredds/dodsC/Datasets/ncep.reanalysis.derived/surface_gauss/vwnd.10m.mon.mean.nc"

# Cozumel region
LON_MIN, LON_MAX = 268, 276  # 0-360
LAT_MIN, LAT_MAX = 16, 24


def descargar_viento():
    print("Conectando a PSL THREDDS NCEP Reanalysis...")
    
    u_ds = xr.open_dataset(UWND_URL, decode_times=True)
    v_ds = xr.open_dataset(VWND_URL, decode_times=True)
    print(f"  UWND: {len(u_ds.time)} meses ({u_ds.time.values[0]} → {u_ds.time.values[-1]})")
    
    # NCEP usa latitud descendente. Usar isel para slice correcto.
    lat_idx = range(len(u_ds.lat))
    lat_vals = u_ds.lat.values
    lat_mask = (lat_vals >= LAT_MIN) & (lat_vals <= LAT_MAX)
    lon_mask = (u_ds.lon.values >= LON_MIN) & (u_ds.lon.values <= LON_MAX)
    
    u_reg = u_ds.isel(lat=lat_mask, lon=lon_mask).mean(dim=['lat', 'lon'])
    v_reg = v_ds.isel(lat=lat_mask, lon=lon_mask).mean(dim=['lat', 'lon'])
    
    # Extraer datos 2020-2026
    u_recent = u_reg.sel(time=slice('2020-01-01', '2026-12-31'))
    v_recent = v_reg.sel(time=slice('2020-01-01', '2026-12-31'))
    
    rows = []
    for t_idx in range(len(u_recent.time)):
        t = pd.to_datetime(u_recent.time.values[t_idx])
        u_val = float(u_recent.uwnd.values[t_idx])
        v_val = float(v_recent.vwnd.values[t_idx])
        
        # Calcular dirección y velocidad del viento
        wspd = np.sqrt(u_val**2 + v_val**2)
        wdir = np.degrees(np.arctan2(v_val, u_val)) % 360  # 0°=E, 90°=N
        
        # Componente onshore para Cozumel (costa este, orientación ~NE)
        # Costa este de Cozumel enfrenta ~135° (SE). Onshore = viento desde 135°
        # Ángulo costa ~45°, normal onshore ~315°
        # onshore = viento del E (u > 0) + viento del N (v > 0)
        onshore_cozumel = (u_val * 0.7 + v_val * 0.7)  # NE component
        
        rows.append({
            'time': t, 'year': t.year, 'month': t.month,
            'uwnd_ms': round(u_val, 2),     # E/W component
            'vwnd_ms': round(v_val, 2),     # N/S component
            'wspd_ms': round(wspd, 2),      # wind speed (m/s)
            'wdir_deg': round(wdir, 1),     # direction (degrees from E)
            'onshore_cozumel_ms': round(onshore_cozumel, 2),  # onshore component
        })
    
    df = pd.DataFrame(rows)
    df['month_key'] = df['year'].astype(str) + "-" + df['month'].astype(str).str.zfill(2)
    
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n✅ Viento guardado: {OUTPUT_CSV}")
    print(f"   {len(df)} meses ({df['year'].min()} → {df['year'].max()})")
    print(f"   U wind (E/W): {df['uwnd_ms'].min():.1f}–{df['uwnd_ms'].max():.1f} m/s")
    print(f"   V wind (N/S): {df['vwnd_ms'].min():.1f}–{df['vwnd_ms'].max():.1f} m/s")
    print(f"   Onshore Cozumel: {df['onshore_cozumel_ms'].min():.1f}–{df['onshore_cozumel_ms'].max():.1f} m/s")
    
    u_ds.close()
    v_ds.close()
    return df


if __name__ == "__main__":
    descargar_viento()
