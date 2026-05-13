"""
Mapa unificado v2 — Sargazo Caribe
Capas:
  1. NOAA SIR riesgo costero (KMZ → GeoJSON)
  2. SATsum regiones (Caribe, ZEE Mex, GoM)
  3. Trayectorias Lagrangienses
  4. Estaciones SEMAR
  5. Pronóstico Cozumel
"""

import folium
from folium import plugins
import pandas as pd
import numpy as np
import json
from pathlib import Path

ROOT = Path(__file__).parent

print("Construyendo mapa unificado v2...")

# ── 1. Cargar NOAA SIR data ──────────────────────────────────────────────
sir_path = ROOT / "noaa_sir_riesgo_costero_qroo.geojson"
if sir_path.exists():
    with open(sir_path) as f:
        sir_data = json.load(f)
    print(f"NOAA SIR: {len(sir_data['features'])} features")
else:
    sir_data = None
    print("NOAA SIR: NO DISPONIBLE")

# ── 2. Cargar SATsum ─────────────────────────────────────────────────────
try:
    caribe = pd.read_csv(ROOT / "satsum_caribe_mensual.csv")
    zee = pd.read_csv(ROOT / "satsum_zee_mex_mensual.csv")
    caribe['date'] = pd.to_datetime(caribe['year'].astype(str) + '-' + caribe['month'].astype(str))
    zee['date'] = pd.to_datetime(zee['year'].astype(str) + '-' + zee['month'].astype(str))
    print(f"SATsum: {len(caribe)+len(zee)} pts")
except Exception as e:
    print(f"SATsum: ERROR {e}")
    caribe = zee = None

with open(ROOT / "satsum_regiones_geo.json") as f:
    regions = json.load(f)

# ── 3. Cargar trayectorias Lagrangienses ─────────────────────────────────
try:
    traj = pd.read_csv(ROOT / "lagrangian_hycom_trayectorias.csv")
    final = pd.read_csv(ROOT / "lagrangian_hycom_finales.csv")
    print(f"Lagrangian: {len(traj)} pts, {len(final)} finales")
except:
    try:
        traj = pd.read_csv(ROOT / "lagrangian_trajectories.csv")
        final = pd.read_csv(ROOT / "lagrangian_final_positions.csv")
        print(f"Lagrangian (fallback): {len(traj)} pts")
    except:
        traj = final = None
        print("Lagrangian: NO DISPONIBLE")

# ── 4. SEMAR stations ────────────────────────────────────────────────────
master = pd.read_csv(ROOT / "boletines_sargazo_MASTER.csv", low_memory=False)
master['fecha_dt'] = pd.to_datetime(master['fecha'])

stations = {
    'Cancún': [21.16, -86.85],
    'Playa del Carmen': [20.63, -87.07],
    'Cozumel': [20.51, -86.95],
    'Puerto Morelos': [20.85, -86.87],
    'Tulum': [20.21, -87.43],
}

# ── 5. Crear mapa ────────────────────────────────────────────────────────
m = folium.Map(location=[19.5, -87.5], zoom_start=8,
               tiles='CartoDB Positron', control_scale=True)

# ── 5a. NOAA SIR risk polygons (latest day first) ────────────────────────
if sir_data:
    # Show latest day prominently, others faded
    features_by_date = {}
    for feat in sir_data['features']:
        d = feat['properties']['date']
        if d not in features_by_date:
            features_by_date[d] = []
        features_by_date[d].append(feat)
    
    latest_date = max(features_by_date.keys())
    latest_features = features_by_date[latest_date]
    
    print(f"NOAA SIR mostrando último día: {latest_date} ({len(latest_features)} celdas)")
    
    # Add latest day with full opacity
    risk_fg = folium.FeatureGroup(name=f'Riesgo costero NOAA ({latest_date})', show=True)
    for feat in latest_features:
        risk = feat['properties']['risk']
        color = feat['properties']['color']
        coords = feat['geometry']['coordinates'][0]
        folium.Polygon(
            [[y, x] for x, y in coords],
            color=color, weight=1, fill=True,
            fill_color=color, fill_opacity=0.6,
            popup=f'Riesgo: {risk.upper()}<br>{latest_date}',
            tooltip=f'NOAA SIR: {risk}'
        ).add_to(risk_fg)
    risk_fg.add_to(m)

# ── 5b. SATsum regions ────────────────────────────────────────────────────
region_styles = {
    'Caribe': {'color': '#e41a1c', 'fill': '#e41a1c', 'opacity': 0.08},
    'ZEE Mexicana': {'color': '#4daf4a', 'fill': '#4daf4a', 'opacity': 0.12},
    'Golfo Mexico': {'color': '#377eb8', 'fill': '#377eb8', 'opacity': 0.08},
}

satsum_fg = folium.FeatureGroup(name='Regiones SATsum', show=True)
for name, rgn in regions.items():
    style = region_styles.get(name, {})
    bounds = [[y, x] for x, y in rgn['coords']]
    folium.Polygon(
        bounds,
        color=style.get('color', '#333'),
        weight=2,
        fill=True,
        fill_color=style.get('fill', '#333'),
        fill_opacity=style.get('opacity', 0.08),
        popup=f'<b>{rgn["label"]}</b><br>Fuente: SATsum CONABIO'
    ).add_to(satsum_fg)
satsum_fg.add_to(m)

# ── 5c. Lagrangian trajectories ──────────────────────────────────────────
if traj is not None and len(traj) > 0:
    lag_fg = folium.FeatureGroup(name='Trayectorias Lagrangienses', show=False)
    particle_ids = traj['id'].unique()[:25]
    for pid in particle_ids:
        pts = traj[traj['id'] == pid].sort_values('step')
        if len(pts) >= 2:
            coords = [[r['lat'], r['lon']] for _, r in pts.iterrows()]
            folium.PolyLine(
                coords, color='#ff6600', weight=1.5, opacity=0.4
            ).add_to(lag_fg)
    lag_fg.add_to(m)
    print(f"Lagrangian: {len(particle_ids)} trayectorias en mapa")

# ── 5d. SEMAR stations ──────────────────────────────────────────────────
semar_fg = folium.FeatureGroup(name='Estaciones SEMAR', show=True)
for name, coords in stations.items():
    # Get latest biomasa
    station_data = master[master['estacion'].str.contains(name[:5], na=False)] if 'estacion' in master.columns else pd.DataFrame()
    
    if not station_data.empty:
        latest_val = station_data['biomasa_caribe_mexicano_ton'].dropna().iloc[-1] if not station_data['biomasa_caribe_mexicano_ton'].dropna().empty else None
        label = f'{name}: {latest_val:.0f} ton' if latest_val else name
    else:
        label = name
    
    folium.CircleMarker(
        coords, radius=10, color='#2196F3',
        fill=True, fill_opacity=0.5,
        popup=f'<b>{name}</b><br>SEMAR',
        tooltip=label
    ).add_to(semar_fg)
semar_fg.add_to(m)

# ── 5e. Forecast box ────────────────────────────────────────────────────
latest_cm = 0.051837
pred_lin = 0.051403
pred_delta = 0.090145
pred_ens = 0.046444

legend_html = f'''
<div style="position: fixed; bottom: 30px; right: 30px; width: 250px;
     background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
     z-index: 9999; font-size: 12px; padding: 12px;">
    <b style="font-size:14px;">Pronóstico Cozumel</b>
    <span style="font-size:11px;color:#666;float:right;">Junio 2026</span>
    <hr style="margin:4px 0">
    CM conocido (Mayo): <b>{latest_cm*1000:.0f} ton</b><br>
    <span style="color:#e41a1c">■</span> Regresión: <b>{pred_lin*1000:.0f} ton</b><br>
    <span style="color:#4daf4a">■</span> Delta: <b>{pred_delta*1000:.0f} ton</b><br>
    <span style="color:#377eb8">■</span> Ensemble: <b>{pred_ens*1000:.0f} ton</b><br>
    <hr style="margin:4px 0">
    <b style="font-size:11px;">Riesgo costero NOAA</b><br>
    <span style="color:red">⬤</span> Alto &nbsp; <span style="color:orange">⬤</span> Medio<br>
    <span style="color:#ff0">⬤</span> Warning &nbsp; <span style="color:blue">⬤</span> Bajo
</div>
'''
m.get_root().html.add_child(folium.Element(legend_html))

# ── 5f. Title ────────────────────────────────────────────────────────────
title_html = '''
<div style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
     background: white; padding: 8px 20px; border-radius: 8px; 
     box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 9999; text-align: center;">
    <b>Monitoreo y Predicción de Sargazo — Caribe Mexicano</b><br>
    <span style="font-size:10px;color:#666;">
        NOAA SIR · SATsum CONABIO · SEMAR · Modelo Lagrangiano | {latest_date if 'latest_date' in dir() else 'Mayo 2026'}
    </span>
</div>
'''
m.get_root().html.add_child(folium.Element(title_html))

# ── 5g. Layer control ──────────────────────────────────────────────────
plugins.Fullscreen().add_to(m)
folium.LayerControl(collapsed=True).add_to(m)

# ── 6. Guardar ─────────────────────────────────────────────────────────────
out_path = ROOT / "mapa_sargazo_v2.html"
m.save(out_path)
print(f"\n✅ Mapa guardado: {out_path}")
size_mb = out_path.stat().st_size / 1e6
print(f"   Tamaño: {size_mb:.1f} MB")
