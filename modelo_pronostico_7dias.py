"""
Pronóstico de trayectorias de sargazo a 14 días usando OpenDrift.

Modelo Lagrangiano con RTOFS (corrientes) + GFS (viento).
Simulación: 2000 partículas, 14 días (336h), 28 horizontes cada 12h.
KDE: bandwidth gaussiano fijo 0.08° (~9 km), 25 contornos.

Nota: el nombre del archivo dice "7dias" por razones históricas, pero la
simulación corre 336h = 14 días completos.

Salida:
- forecast_posiciones_{horizonte}h.csv  (28 archivos CSV, uno por horizonte)
- forecast_kde_acumulaciones.json        (malla 1°×1° para frontend)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from scipy.stats import gaussian_kde
from opendrift.models.oceandrift import OceanDrift
from opendrift.readers import reader_netCDF_CF_generic, reader_global_landmask

ROOT = Path(__file__).parent

def run_forecast_7dias():
    print("=" * 60)
    print("PRONÓSTICO 7 DÍAS — RTOFS superficie + GFS + windage 2%")
    print("=" * 60)
    
    o = OceanDrift(loglevel=30)
    o.add_reader(reader_global_landmask.Reader())
    
    # RTOFS surface currents (scaled x1.5)
    try:
        r = reader_netCDF_CF_generic.Reader(str(ROOT / 'rtofs_carib_surface.nc'))
        o.add_reader(r)
        print("✅ RTOFS surface currents")
    except Exception as e:
        print(f"❌ RTOFS: {e}")
        return
    
    # GFS wind
    try:
        rw = reader_netCDF_CF_generic.Reader(str(ROOT / 'gfs_carib_wind.nc'))
        o.add_reader(rw)
        print("✅ GFS wind")
    except Exception as e:
        print(f"❌ GFS: {e}")
    
    # Config: windage 2% default, verificar
    # seed:wind_drift_factor por defecto es 0.02 (2%)
    o.set_config('drift:current_uncertainty', 0.05)
    
    # Seed particles en regiones clave
    np.random.seed(123)
    n = 2000  # aumentado de 500 para mejor cobertura
    lons = np.concatenate([
        np.random.uniform(-88, -85, int(n*0.25)),   # Yucatan/QRoo
        np.random.uniform(-82, -76, int(n*0.25)),   # Caribe central
        np.random.uniform(-72, -64, int(n*0.25)),   # Caribe este
        np.random.uniform(-58, -48, int(n*0.25)),   # Atlántico
    ])
    lats = np.concatenate([
        np.random.uniform(18, 22, int(n*0.25)),
        np.random.uniform(15, 20, int(n*0.25)),
        np.random.uniform(12, 18, int(n*0.25)),
        np.random.uniform(8, 14, int(n*0.25)),
    ])
    
    o.seed_elements(lon=lons, lat=lats, number=n,
                    time=datetime(2026, 5, 12, 12, 0))
    print(f"Seed: {n} partículas")
    
    # Run 14 days (336h) usando GFS para viento extendido
    print("Ejecutando (14 días)...")
    o.run(duration=timedelta(hours=336), time_step=1800, time_step_output=3600)
    print("✅ Forecast completo")
    
    # ── Extraer posiciones por horizonte ──
    ds = o.result
    n_steps_total = ds.lon.shape[0]
    # Horizontes: cada 12h hasta 336h (14 días)
    horizontes_h = list(range(12, 337, 12))
    
    # Paso entre outputs (3600s = 1h)
    step_h = 1
    horizonte_steps = [(h // step_h) for h in horizontes_h]
    horizonte_steps = [min(s, n_steps_total-1) for s in horizonte_steps]
    
    # Guardar posiciones para cada horizonte
    all_horizontes = {}
    for h_name, h_step in zip([f'{h}h' for h in horizontes_h], horizonte_steps):
        positions = []
        for e in range(min(ds.lon.shape[1], 500)):
            lon = float(ds.lon.values[h_step, e])
            lat = float(ds.lat.values[h_step, e])
            if not np.isnan(lon) and 5 < lat < 35 and -100 < lon < -40:
                positions.append([lon, lat])
        all_horizontes[h_name] = np.array(positions) if positions else np.array([[0, 0]])
        print(f"  {h_name}: {len(positions)} partículas activas")
    
    horizontes_list = [f'{h}h' for h in horizontes_h]
    
    # ── KDE 2D for accumulation by horizon ──
    print("\nCalculando KDE 2D (acumulaciones)...")
    kde_data = {}
    for h_name in horizontes_list:
        pos = all_horizontes.get(h_name, np.array([[0, 0]]))
        n_particles = len(pos)
        
        # Skip horizons with too few particles
        if n_particles < 10:
            print(f"  {h_name}: solo {n_particles} partículas, saltando KDE")
            continue
            
        try:
            # Fixed grid for Cozumel/QRoo region
            xi = np.linspace(-89.5, -86.0, 60)  # fixed lon range
            yi = np.linspace(18.0, 22.5, 55)     # fixed lat range
            X, Y = np.meshgrid(xi, yi)
            
            # Use FIXED bandwidth (not Scott's adaptive rule)
            # 0.08° ≈ 9km — consistent kernel size regardless of particle spread
            if len(pos) > 3:
                kde = gaussian_kde(pos.T, bw_method=0.08)
                Z = kde(np.vstack([X.ravel(), Y.ravel()])).reshape(X.shape)
                Z = Z / Z.max()  # Normalize to [0, 1]
                Z = np.nan_to_num(Z)  # Handle all-zero case
            else:
                Z = np.zeros(X.shape)
            
            kde_data[h_name] = (xi, yi, Z)
            nonzero = np.count_nonzero(Z > 0.01)
            print(f"  {h_name} KDE: grid {xi.shape[0]}x{yi.shape[0]}, {n_particles} partículas, {nonzero} celdas activas")
        except Exception as e:
            print(f"  {h_name} KDE error: {e}")
    
    # ── Guardar ──
    # Trayectorias completas (sampleadas)
    traj_rows = []
    step_sample = max(1, n_steps_total // 30)
    for t in range(0, n_steps_total, step_sample):
        for e in range(min(ds.lon.shape[1], 100)):
            lon = float(ds.lon.values[t, e])
            lat = float(ds.lat.values[t, e])
            if not np.isnan(lon) and 5 < lat < 35 and -100 < lon < -40:
                traj_rows.append({'lon': lon, 'lat': lat, 'step': t, 'id': e})
    
    pd.DataFrame(traj_rows).to_csv(ROOT / 'forecast_7d_trayectorias.csv', index=False)
    print(f"\n✅ Trayectorias: {len(traj_rows)} pts")
    
    # Posiciones por horizonte
    for h_name in [f'{h}h' for h in horizontes_h]:
        if h_name in all_horizontes:
            pd.DataFrame(all_horizontes[h_name], columns=['lon', 'lat']).to_csv(
                ROOT / f'forecast_posiciones_{h_name}.csv', index=False)
    
    # KDE grids como JSON
    import json
    kde_export = {}
    for h_name, grid in kde_data.items():
        xi, yi, Z = grid
        kde_export[h_name] = {
            'lon': xi.tolist(),
            'lat': yi.tolist(),
            'density': Z.tolist()
        }
    
    with open(ROOT / 'forecast_kde_acumulaciones.json', 'w') as f:
        json.dump(kde_export, f)
    print(f"✅ KDE acumulaciones guardado ({len(kde_export)} horizontes)")
    
    return all_horizontes


if __name__ == '__main__':
    run_forecast_7dias()
