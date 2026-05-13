"""
Modelo Lagrangiano con HYCOM real — THREDDS OPeNDAP.
Corrientes oceánicas superficiales del Global HYCOM 1/12°.
Simulación de 6 meses: partículas desde el Atlántico hacia el Caribe.
"""

import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).parent

def run_hycom_simulation():
    """Ejecuta simulación Lagrangiana con HYCOM via OpenDrift."""
    from opendrift.models.oceandrift import OceanDrift
    from opendrift.readers import reader_from_url, reader_global_landmask
    
    print("=" * 60)
    print("SIMULACIÓN LAGRANGIANA — HYCOM REAL")
    print("=" * 60)
    
    o = OceanDrift(loglevel=30)
    o.add_reader(reader_global_landmask.Reader())
    
    # HYCOM Global Analysis 1/12° via OPeNDAP (experimento 93.0)
    # El catálogo muestra disponibles múltiples datasets
    hycom_urls = [
        "https://tds.hycom.org/thredds/dodsC/GLBy0.08/expt_93.0/",
        "https://tds.hycom.org/thredds/dodsC/GLBv0.08/expt_93.0/",
    ]
    
    hycom_reader = None
    for url in hycom_urls:
        try:
            print(f"Conectando a HYCOM: {url}")
            reader = reader_from_url(url)
            o.add_reader(reader)
            hycom_reader = reader
            print(f"  ✅ Conexión exitosa")
            break
        except Exception as e:
            print(f"  ❌ {e}")
    
    if hycom_reader is None:
        print("\nHYCOM no disponible. Usando corrientes sintéticas del Caribe.")
        from opendrift.readers import reader_constant
        reader_current = reader_constant.Reader({
            'x_sea_water_velocity': -0.3,
            'y_sea_water_velocity': 0.02,
        })
        o.add_reader(reader_current)
        print("Usando corriente constante Caribe (0.3 m/s W, 0.02 m/s N)")
    
    # Seed particles
    np.random.seed(42)
    num_particles = 500
    
    # Source region: East of Lesser Antilles + tropical Atlantic (GASB entry points)
    lons = np.random.uniform(-58, -42, num_particles)
    lats = np.random.uniform(8, 20, num_particles)
    
    o.seed_elements(
        lon=lons, lat=lats,
        radius=0, number=num_particles,
        time=datetime(2026, 1, 1)
    )
    print(f"\nSeed: {num_particles} partículas desde Atlántico tropical")
    
    # Run for 6 months
    print("Ejecutando simulación (6 meses)...")
    o.run(duration=timedelta(days=180), time_step=3600, time_step_output=86400)
    
    print(f"\n✅ Simulación completa")
    print(f"  Activas: {o.num_elements_active}")
    print(f"  Varadas: {o.num_elements_deactivated}")
    
    # Extract trajectories
    ds = o.result
    lons_data = ds['lon'].values
    lats_data = ds['lat'].values
    
    # Save trajectories
    import pandas as pd
    rows = []
    step_sample = max(1, lons_data.shape[0] // 60)  # ~60 time steps
    part_sample = min(200, lons_data.shape[1])  # max 200 particles
    
    for t_idx in range(0, lons_data.shape[0], step_sample):
        for e_idx in range(part_sample):
            lon = lons_data[t_idx, e_idx]
            lat = lats_data[t_idx, e_idx]
            if not np.isnan(lon) and lat > 5:
                rows.append({'lon': float(lon), 'lat': float(lat), 
                           'step': t_idx, 'id': e_idx})
    
    traj_df = pd.DataFrame(rows)
    traj_df.to_csv(ROOT / "lagrangian_hycom_trayectorias.csv", index=False)
    print(f"  Trayectorias: {len(traj_df)} puntos")
    
    # Final positions
    final = traj_df.groupby('id').last().reset_index()
    final = final[final['lon'] < -50]  # Entered Caribbean area
    final.to_csv(ROOT / "lagrangian_hycom_finales.csv", index=False)
    print(f"  Posiciones finales: {len(final)}")
    
    # Count reaching QRoo area
    qroo = final[(final['lon'] < -86) & (final['lat'] > 18) & (final['lat'] < 22)]
    print(f"  Partículas que alcanzaron QRoo: {len(qroo)}")
    
    # Save densities
    try:
        o.write_netcdf(ROOT / "lagrangian_hycom.nc")
        print("  ✅ NetCDF guardado")
    except Exception:
        pass
    
    return len(traj_df), len(final)


if __name__ == "__main__":
    run_hycom_simulation()
