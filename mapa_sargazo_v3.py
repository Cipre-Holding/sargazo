"""
Mapa v3 — Riesgo interpolado ML + NOAA SIR + Lagrangianas + SATsum
"""

import json, numpy as np
from scipy.interpolate import RBFInterpolator
import folium
from folium import plugins
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent

# ── 1. Interpolar riesgo offshore ─────────────────────────────────────────
with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
    sir = json.load(f)

latest = max(f['properties']['date'] for f in sir['features'])
cells = [f for f in sir['features'] if f['properties']['date'] == latest]

risk_map = {'low': 0.15, 'warning': 0.4, 'medium': 0.65, 'high': 0.9}
X_train, y_train = [], []
for c in cells:
    xs, ys = zip(*c['geometry']['coordinates'][0])
    X_train.append([np.mean(xs), np.mean(ys)])
    y_train.append(risk_map.get(c['properties']['risk'], 0))

X_train = np.array(X_train); y_train = np.array(y_train)

grid_res = 0.04
lon_g = np.arange(X_train[:,0].min()-0.8, X_train[:,0].max()+0.8, grid_res)
lat_g = np.arange(X_train[:,1].min()-0.5, X_train[:,1].max()+0.5, grid_res)
lon_m, lat_m = np.meshgrid(lon_g, lat_g)
gp = np.column_stack([lon_m.ravel(), lat_m.ravel()])

interp = RBFInterpolator(X_train, y_train, kernel='thin_plate_spline',
                         epsilon=1.5, smoothing=0.15)
risk_g = np.clip(interp(gp), 0, 1)

# ── 2. Build interpolated GeoJSON ─────────────────────────────────────────
features = []
for i in range(len(gp)):
    rv = float(risk_g[i])
    if rv < 0.1: continue
    lon, lat = gp[i,0], gp[i,1]
    d = grid_res / 2
    if rv > 0.65: color, label = '#ff0000', 'high'
    elif rv > 0.45: color, label = '#ffa500', 'medium'
    elif rv > 0.25: color, label = '#ffff00', 'warning'
    else: color, label = '#0000ff', 'low'
    features.append({
        "type": "Feature",
        "properties": {"risk": label, "rv": round(rv,3), "c": color},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]]]
        }
    })

# Save interpolated
with open(ROOT / "noaa_sir_riesgo_interpolado_qroo.geojson", 'w') as f:
    json.dump({"type":"FeatureCollection","features":features}, f)
print(f"Interpolado: {len(features)} celdas")

# ── 3. Build map ──────────────────────────────────────────────────────────
m = folium.Map(location=[20.0, -87.0], zoom_start=9,
               tiles='CartoDB Positron', control_scale=True)

# Interpolated risk
risk_fg = folium.FeatureGroup(name='Riesgo interpolado (ML)', show=True)
for f in features:
    coords = [[y,x] for x,y in f['geometry']['coordinates'][0]]
    folium.Polygon(coords, color=f['properties']['c'], weight=0.3,
        fill=True, fill_color=f['properties']['c'],
        fill_opacity=min(f['properties']['rv']*0.7, 0.5),
        tooltip=f'{f["properties"]["risk"]} ({f["properties"]["rv"]:.2f})'
    ).add_to(risk_fg)
risk_fg.add_to(m)

# NOAA SIR coastal (overlay)
coastal_fg = folium.FeatureGroup(name=f'NOAA SIR costero ({latest})', show=True)
for c in cells:
    coords = [[y,x] for x,y in c['geometry']['coordinates'][0]]
    folium.Polygon(coords, color=c['properties']['color'], weight=1,
        fill=True, fill_color=c['properties']['color'], fill_opacity=0.8,
        popup=f'<b>{c["properties"]["risk"].upper()}</b><br>{latest}'
    ).add_to(coastal_fg)
coastal_fg.add_to(m)

# SATsum regions
with open(ROOT / "satsum_regiones_geo.json") as f:
    regions = json.load(f)
for name, rgn in regions.items():
    bounds = [[y,x] for x,y in rgn['coords']]
    color = {'Caribe':'#e41a1c','ZEE Mexicana':'#4daf4a','Golfo Mexico':'#377eb8'}.get(name,'#333')
    folium.Polygon(bounds, color=color, weight=2,
        fill=True, fill_color=color, fill_opacity=0.04,
        popup=rgn.get('label',name)
    ).add_to(m)

# Lagrangian
try:
    traj = pd.read_csv(ROOT / "lagrangian_hycom_trayectorias.csv")
    if len(traj) > 0:
        lag_fg = folium.FeatureGroup(name='Trayectorias', show=False)
        for pid in traj['id'].unique()[:20]:
            pts = traj[traj['id']==pid].sort_values('step')
            if len(pts) >= 2:
                folium.PolyLine([[r['lat'],r['lon']] for _,r in pts.iterrows()],
                    color='#ff6600', weight=1.5, opacity=0.4
                ).add_to(lag_fg)
        lag_fg.add_to(m)
except: pass

# SEMAR
for name, coords in {'Cancún':[21.16,-86.85],'Cozumel':[20.51,-86.95],
    'Playa del Carmen':[20.63,-87.07],'Tulum':[20.21,-87.43]}.items():
    folium.CircleMarker(coords, radius=10, color='#2196F3',
        fill=True, fill_opacity=0.6, popup=f'<b>{name}</b><br>SEMAR'
    ).add_to(m)

# Legend
pred_lin=0.051403; pred_ens=0.046444
m.get_root().html.add_child(folium.Element(f'''
<div style="position:fixed;bottom:30px;right:30px;width:250px;background:white;
     border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;
     font-size:12px;padding:12px;">
    <b>Riesgo Sargazo — Interpolación ML</b>
    <span style="font-size:10px;color:#666;float:right;">RBF + NOAA SIR</span>
    <hr style="margin:4px 0">
    <span style="color:red">▨</span> Alto &nbsp; <span style="color:orange">▨</span> Medio<br>
    <span style="color:#ff0">▨</span> Warning &nbsp; <span style="color:blue">▨</span> Bajo<br>
    <hr style="margin:4px 0">
    <span style="color:#2196F3">●</span> Estaciones SEMAR<br>
    <span style="color:#ff6600">━</span> Trayectorias Lagrangienses<br>
    <hr>
    <b>Pronóstico Cozumel Junio:</b><br>
    {pred_lin*1000:.0f} ton | Ensemble: {pred_ens*1000:.0f} ton
</div>'''))

folium.LayerControl(collapsed=True).add_to(m)
plugins.Fullscreen().add_to(m)

out = ROOT / "mapa_sargazo_v3.html"
m.save(out)
size = out.stat().st_size / 1e6
print(f"✅ Mapa v3: {out} ({size:.1f} MB)")
