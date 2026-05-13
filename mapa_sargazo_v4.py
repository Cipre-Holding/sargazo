"""
Mapa v4 — Riesgo ML corregido + NOAA SIR + Lagrangian fBm + SATsum + SEMAR + Pronóstico
"""

import json
import folium
from folium import plugins
import pandas as pd
import numpy as np
from pathlib import Path

ROOT = Path(__file__).parent

m = folium.Map(location=[19.8, -87.3], zoom_start=8,
               tiles='CartoDB Positron', control_scale=True)

# ── 1. Capa: Riesgo ML corregido ─────────────────────────────────────────
with open(ROOT / "noaa_sir_riesgo_ml_corregido.geojson") as f:
    risk_data = json.load(f)

risk_fg = folium.FeatureGroup(name='Riesgo ML corregido', show=True)
for feat in risk_data['features']:
    coords = [[y, x] for x, y in feat['geometry']['coordinates'][0]]
    c = feat['properties']['c']
    rv = feat['properties']['rv']
    folium.Polygon(
        coords, color=c, weight=0.3,
        fill=True, fill_color=c,
        fill_opacity=min(rv * 0.6, 0.4),
        tooltip=f'{feat["properties"]["risk"]} ({rv:.2f})'
    ).add_to(risk_fg)
risk_fg.add_to(m)

# ── 2. Capa: NOAA SIR costero ────────────────────────────────────────────
with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
    sir = json.load(f)
latest = max(f['properties']['date'] for f in sir['features'])
cells = [f for f in sir['features'] if f['properties']['date'] == latest]

coastal_fg = folium.FeatureGroup(name=f'NOAA SIR ({latest})', show=True)
for c in cells:
    coords = [[y, x] for x, y in c['geometry']['coordinates'][0]]
    folium.Polygon(
        coords, color=c['properties']['color'], weight=1,
        fill=True, fill_color=c['properties']['color'], fill_opacity=0.8,
        popup=f'<b>{c["properties"]["risk"].upper()}</b><br>{latest}'
    ).add_to(coastal_fg)
coastal_fg.add_to(m)

# ── 3. Capa: Lagrangian fBm ──────────────────────────────────────────────
try:
    traj = pd.read_csv(ROOT / "lagrangian_fbm_trayectorias.csv")
    lag_fg = folium.FeatureGroup(name='Trayectorias fBm (H=0.8047)', show=False)
    for pid in traj['id'].unique()[:20]:
        pts = traj[traj['id'] == pid].sort_values('step')
        if len(pts) >= 2:
            folium.PolyLine(
                [[r['lat'], r['lon']] for _, r in pts.iterrows()],
                color='#ff6600', weight=1.5, opacity=0.5
            ).add_to(lag_fg)
    
    final = pd.read_csv(ROOT / "lagrangian_fbm_finales.csv")
    for _, r in final.iterrows():
        folium.CircleMarker(
            [r['lat'], r['lon']], radius=3, color='#ff0000',
            fill=True, fill_opacity=0.8,
            popup=f'Final: {r["lat"]:.1f}°N, {r["lon"]:.1f}°W'
        ).add_to(lag_fg)
    lag_fg.add_to(m)
except Exception as e:
    print(f"Lagrangian: {e}")

# ── 4. Capa: Reportes ciudadanos SATsum-Collect ─────────────────────────
# (conexión Epicollect5 - datos de ciencia ciudadana)
epi_fg = folium.FeatureGroup(name='Reportes SATsum-Collect', show=False)
try:
    epi = pd.read_csv(ROOT / "satsum_collect_observaciones.csv")
    for _, r in epi.iterrows():
        color = '#ff4444' if r.get('sargazo_presente', 'no') == 'si' else '#44ff44'
        folium.CircleMarker(
            [r['lat'], r['lon']], radius=5, color=color,
            fill=True, fill_opacity=0.7,
            popup=f'{r.get("fecha","")}<br>{r.get("notas","")}'
        ).add_to(epi_fg)
except:
    folium.Marker(
        [20.51, -86.95],
        icon=folium.DivIcon(html='<span style="color:#888">⬤ SATsum-Collect</span>')
    ).add_to(epi_fg)
epi_fg.add_to(m)

# ── 5. SATsum regions ────────────────────────────────────────────────────
with open(ROOT / "satsum_regiones_geo.json") as f:
    regions = json.load(f)
for name, rgn in regions.items():
    bounds = [[y, x] for x, y in rgn['coords']]
    colors = {'Caribe': '#e41a1c', 'ZEE Mexicana': '#4daf4a', 'Golfo Mexico': '#377eb8'}
    c = colors.get(name, '#333')
    folium.Polygon(
        bounds, color=c, weight=2,
        fill=True, fill_color=c, fill_opacity=0.04,
        popup=rgn.get('label', name)
    ).add_to(m)

# ── 6. SEMAR stations ────────────────────────────────────────────────────
stations = {
    'Cancún': {'coords': [21.16, -86.85], 'cm_ton': 0},
    'Cozumel': {'coords': [20.51, -86.95], 'cm_ton': 51837},
    'Playa del Carmen': {'coords': [20.63, -87.07], 'cm_ton': 0},
    'Tulum': {'coords': [20.21, -87.43], 'cm_ton': 0},
}
for name, info in stations.items():
    coords = info['coords']
    folium.CircleMarker(
        coords, radius=12, color='#2196F3',
        fill=True, fill_opacity=0.6,
        popup=f'<b>{name}</b><br>SEMAR',
        tooltip=f'{name} ({info["cm_ton"]:,} ton)' if info['cm_ton'] else name
    ).add_to(m)

# ── 7. Marcadores interactivos ────────────────────────────────────────────
folium.Marker(
    [20.51, -86.95],
    icon=folium.Icon(color='red', icon='info-sign', prefix='glyphicon'),
    popup='<b>Cozumel</b><br>CM May 2026: 51,837 ton<br>Pronóstico Jun: 46-51 mil ton'
).add_to(m)

# ── 8. Leyenda informativa ────────────────────────────────────────────────
pred_lin = 0.051403; pred_delta = 0.090145; pred_ens = 0.046444
legend = f'''
<div style="position:fixed;bottom:20px;right:20px;width:280px;background:rgba(255,255,255,0.95);
     border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;
     font-size:12px;padding:15px;backdrop-filter:blur(5px);">
    <b style="font-size:15px;">🟢 Sargazo Caribe Mexicano</b>
    <span style="font-size:10px;color:#666;float:right;">v4 · 12 May 2026</span>
    <hr style="margin:6px 0">
    <div style="display:flex;gap:10px;align-items:center;margin:6px 0">
        <div style="width:20px;height:20px;background:red;border-radius:4px;flex-shrink:0"></div>
        <span>Alto · Medio · Warning · Bajo</span>
    </div>
    <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin:4px 0">
        <div style="flex:1;background:red"></div>
        <div style="flex:1;background:orange"></div>
        <div style="flex:1;background:#ff0"></div>
        <div style="flex:1;background:blue"></div>
    </div>
    <span style="color:orange">━</span> Trayectorias fBm (H=0.8047)<br>
    <span style="color:#2196F3">⬤</span> Estaciones SEMAR<br>
    <hr style="margin:6px 0">
    <b>Pronóstico Cozumel — Junio 2026</b><br>
    <table style="width:100%;font-size:11px">
        <tr><td>Regresión lineal:</td><td><b>{pred_lin*1000:.0f} ton</b></td><td style="color:#e41a1c">■</td></tr>
        <tr><td>Delta:</td><td><b>{pred_delta*1000:.0f} ton</b></td><td style="color:#4daf4a">■</td></tr>
        <tr><td>Ensemble:</td><td><b>{pred_ens*1000:.0f} ton</b></td><td style="color:#377eb8">■</td></tr>
    </table>
    <hr style="margin:6px 0">
    <span style="font-size:10px;color:#888">
        Fuentes: NOAA SIR · SATsum CONABIO · SEMAR · USF SaWS · OpenDrift
    </span>
</div>
'''
m.get_root().html.add_child(folium.Element(legend))

# ── 9. Controles ──────────────────────────────────────────────────────────
plugins.Fullscreen().add_to(m)
folium.LayerControl(collapsed=True, position='topright').add_to(m)

# ── 10. Guardar ───────────────────────────────────────────────────────────
out = ROOT / "mapa_sargazo_v4.html"
m.save(out)
size = out.stat().st_size / 1e6
print(f"✅ Mapa v4: {out}")
print(f"   Tamaño: {size:.1f} MB")
print(f"   Capas: {len(m._children)}")
