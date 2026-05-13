"""
Mapa v6 — Selector de horizonte + Acumulaciones KDE + Capas corregidas
"""

import json
import folium
from folium import plugins
import pandas as pd
import numpy as np
from pathlib import Path

ROOT = Path(__file__).parent

m = folium.Map(location=[19.5, -87.5], zoom_start=8,
               tiles='CartoDB Positron', control_scale=True)

# ── Controles base ─────────────────────────────────────────────────────────
minimap = plugins.MiniMap(toggle_display=True, zoom_level_offset=-6)
m.add_child(minimap)
plugins.Draw(export=True, filename='draw_data.geojson', position='topleft').add_to(m)
plugins.MousePosition(position='bottomleft', separator=' | ').add_to(m)
plugins.Fullscreen().add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 1. NOAA SIR — TimestampedGeoJson animado
# ═══════════════════════════════════════════════════════════════════════════
with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
    sir_raw = json.load(f)

dates = sorted(set(f['properties']['date'] for f in sir_raw['features']))
dates_sampled = dates[::10] + ([dates[-1]] if dates[-1] not in dates[::10] else [])

ts_features = []
for feat in sir_raw['features']:
    if feat['properties']['date'] not in dates_sampled:
        continue
    risk = feat['properties']['risk']
    color = feat['properties']['color']
    dt = f'{feat["properties"]["date"][:4]}-{feat["properties"]["date"][4:6]}-{feat["properties"]["date"][6:8]}T00:00:00'
    op = {'low': 0.25, 'warning': 0.45, 'medium': 0.65, 'high': 0.85}.get(risk, 0.35)
    ts_features.append({
        "type": "Feature",
        "properties": {
            "times": [dt],
            "style": {"color": color, "fillColor": color, "weight": 0.5, "fillOpacity": op, "opacity": 0.8},
            "popup": f"<b>{risk.upper()}</b><br>{feat['properties']['date'][:4]}-{feat['properties']['date'][4:6]}-{feat['properties']['date'][6:8]}",
        },
        "geometry": feat['geometry']
    })

plugins.TimestampedGeoJson(
    {"type": "FeatureCollection", "features": ts_features},
    period='P10D', duration='P10D', transition_time=300,
    loop=True, auto_play=False, max_speed=10, loop_button=True,
    date_options='YYYY/MM/DD',
).add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 2. Riesgo ML corregido
# ═══════════════════════════════════════════════════════════════════════════
try:
    with open(ROOT / "noaa_sir_riesgo_ml_corregido.geojson") as f:
        risk_ml = json.load(f)
    risk_fg = folium.FeatureGroup(name='Riesgo ML', show=True)
    for feat in risk_ml['features'][::2]:
        rv = feat['properties']['rv']
        if rv < 0.35:
            continue
        coords = [[y, x] for x, y in feat['geometry']['coordinates'][0]]
        folium.Polygon(
            coords, color=feat['properties']['c'], weight=0.3,
            fill=True, fill_color=feat['properties']['c'],
            fill_opacity=min(rv * 0.6, 0.45),
            tooltip=f'{feat["properties"]["risk"]} ({rv:.2f})'
        ).add_to(risk_fg)
    risk_fg.add_to(m)
except: pass

# ═══════════════════════════════════════════════════════════════════════════
# 3. Acumulaciones KDE por horizonte (selector de tiempo)
# ═══════════════════════════════════════════════════════════════════════════
try:
    with open(ROOT / 'forecast_kde_acumulaciones.json') as f:
        kde_all = json.load(f)
    
    for h_name in sorted(kde_all.keys()):
        kde = kde_all[h_name]
        lon_grid = np.array(kde['lon'])
        lat_grid = np.array(kde['lat'])
        Z = np.array(kde['density'])
        
        # Normalizar y escalar
        Z = np.clip(Z, 0, 1) ** 0.5  # sqrt para mejor contraste visual
        
        # Convertir grid a polígonos (sampleados para rendimiento)
        step = max(1, Z.shape[0] // 15)
        fg = folium.FeatureGroup(name=f'Acumulación {h_name}', show=(h_name == '24h'))
        
        for i in range(0, Z.shape[0], step):
            for j in range(0, Z.shape[1], step):
                z = float(Z[i, j])
                if z < 0.15:
                    continue
                d = (lon_grid[1] - lon_grid[0]) * step / 2
                lon_c, lat_c = lon_grid[j], lat_grid[i]
                # Color: green → yellow → red
                if z > 0.6: color = '#ff0000'
                elif z > 0.4: color = '#ffa500'
                else: color = '#ffdd00'
                
                folium.Rectangle(
                    [(lat_c-d, lon_c-d), (lat_c+d, lon_c+d)],
                    color=color, weight=0.5,
                    fill=True, fill_color=color,
                    fill_opacity=min(z * 0.8, 0.6),
                    tooltip=f'{h_name}: {z:.2f}'
                ).add_to(fg)
        fg.add_to(m)
except Exception as e:
    print(f"KDE: {e}")

# ═══════════════════════════════════════════════════════════════════════════
# 4. Forecast trayectorias
# ═══════════════════════════════════════════════════════════════════════════
for traj_file, label, color in [
    ('forecast_7d_trayectorias.csv', 'Trayectorias 7d', '#9933ff'),
]:
    try:
        df = pd.read_csv(ROOT / traj_file)
        fg = folium.FeatureGroup(name=label, show=False)
        for pid in df['id'].unique()[:20]:
            pts = df[df['id'] == pid].sort_values('step')
            if len(pts) >= 2:
                folium.PolyLine(
                    [[r['lat'], r['lon']] for _, r in pts.iterrows()],
                    color=color, weight=1.5, opacity=0.4
                ).add_to(fg)
        fg.add_to(m)
    except: pass

# ═══════════════════════════════════════════════════════════════════════════
# 5. SATsum regiones
# ═══════════════════════════════════════════════════════════════════════════
try:
    caribe = pd.read_csv(ROOT / "satsum_caribe_mensual.csv")
    caribe['date'] = pd.to_datetime(caribe['year'].astype(str) + '-' + caribe['month'].astype(str))
    zee = pd.read_csv(ROOT / "satsum_zee_mex_mensual.csv")
    zee['date'] = pd.to_datetime(zee['year'].astype(str) + '-' + zee['month'].astype(str))
except: pass

with open(ROOT / "satsum_regiones_geo.json") as f:
    regions = json.load(f)
for name, rgn in regions.items():
    bounds = [[y, x] for x, y in rgn['coords']]
    colors = {'Caribe': '#e41a1c', 'ZEE Mexicana': '#4daf4a', 'Golfo Mexico': '#377eb8'}
    folium.Polygon(
        bounds, color=colors.get(name, '#333'), weight=2,
        fill=True, fill_color=colors.get(name, '#333'), fill_opacity=0.04
    ).add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 6. SEMAR + Predicciones desde JSON
# ═══════════════════════════════════════════════════════════════════════════
try:
    with open(ROOT / "predicciones_fase0.json") as f:
        p0 = json.load(f)
    with open(ROOT / "predicciones_fase1.json") as f:
        p1_data = json.load(f)
    pred_lin = p0.get('0.1_regresion', {}).get('prediccion_junio', {}).get('cm_mt', 0.051)
    pred_delta = p0.get('0.2_delta', {}).get('prediccion_junio', {}).get('cm_mt', 0.090)
    pred_ens = p1_data.get('ensemble', {}).get('prediccion_junio', {}).get('cm_mt', 0.046)
except:
    pred_lin, pred_delta, pred_ens = 0.051, 0.090, 0.046

cm_may = 0.051837

# SEMAR stations (desde datos reales)
master = pd.read_csv(ROOT / "boletines_sargazo_MASTER.csv", low_memory=False)
master['fecha_dt'] = pd.to_datetime(master['fecha'], errors='coerce')
cm_monthly = master.groupby(master['fecha_dt'].dt.to_period('M'))['biomasa_caribe_mexicano_ton'].median()

stations_data = {
    'Cozumel': {'coords': [20.51, -86.95], 'cm': cm_monthly.iloc[-1] if not cm_monthly.empty else 51837},
}
for name, coords in [('Cancún', [21.16, -86.85]), ('Playa del Carmen', [20.63, -87.07]), ('Tulum', [20.21, -87.43])]:
    stations_data[name] = {'coords': coords, 'cm': 0}

for name, info in stations_data.items():
    r = max(6, min(18, info['cm'] / 5000 + 6)) if info['cm'] else 8
    folium.CircleMarker(
        info['coords'], radius=r, color='#2196F3',
        fill=True, fill_opacity=0.6,
        popup=f'<b>{name}</b><br>CM: {info["cm"]:,.0f} ton',
        tooltip=f'{name}: {info["cm"]:,.0f} ton' if info['cm'] else name
    ).add_to(m)

# Marcador Cozumel + predicción
folium.Marker(
    [20.51, -86.95],
    icon=folium.Icon(color='red', icon='info-sign', prefix='glyphicon'),
    popup=folium.Popup(
        f'<b>Cozumel</b><br>CM May: {cm_may*1000:,.0f} ton<br>'
        f'Regresión Jun: {pred_lin*1000:,.0f} ton<br>'
        f'Delta: {pred_delta*1000:,.0f} ton<br>'
        f'Ensemble: {pred_ens*1000:,.0f} ton',
        max_width=250)
).add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 7. Panel único de control
# ═══════════════════════════════════════════════════════════════════════════
semaforo = '🟢 ESTABLE'
semaforo_color = '#4daf4a'
if pred_ens > cm_may * 1.3:
    semaforo, semaforo_color = '🔴 ↑ AUMENTO', '#e41a1c'
elif pred_ens > cm_may * 1.1:
    semaforo, semaforo_color = '🟡 → LIGERO', '#ffa500'

legend = f'''
<div style="position:fixed;bottom:20px;right:20px;width:300px;background:rgba(255,255,255,0.97);
     border-radius:12px;box-shadow:0 4px 25px rgba(0,0,0,0.4);z-index:9999;
     font-size:12px;padding:15px;">
    <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:16px;">Sargazo Caribe</b>
        <span style="background:{semaforo_color};color:white;padding:2px 10px;
               border-radius:10px;font-size:11px;font-weight:bold">{semaforo}</span>
    </div>
    <span style="font-size:10px;color:#888;">Pronóstico 7 días · RTOFS + GFS + Windage 2%</span>
    <hr style="margin:8px 0">
    
    <b>Selector de horizonte</b><br>
    <div style="display:flex;gap:4px;margin:6px 0">
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">24h</div>
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">48h</div>
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">72h</div>
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">96h</div>
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">120h</div>
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">144h</div>
        <div style="flex:1;text-align:center;padding:4px;background:#e8f5e9;border-radius:6px;font-size:11px">168h</div>
    </div>
    
    <hr style="margin:8px 0">
    <div style="display:flex;gap:10px;margin:4px 0">
        <div style="flex:1;background:red;height:8px;border-radius:4px"></div>
        <div style="flex:1;background:orange;height:8px;border-radius:4px"></div>
        <div style="flex:1;background:#ffdd00;height:8px;border-radius:4px"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:#888">
        <span>Alta</span><span>Media</span><span>Baja</span>
    </div>
    
    <hr style="margin:8px 0">
    <table style="width:100%;font-size:11px;border-collapse:collapse">
        <tr><td>CM Mayo</td><td><b>{cm_may*1000:,.0f} ton</b></td><td style="color:#2196F3">⬤</td></tr>
        <tr><td>Regresión Jun</td><td><b>{pred_lin*1000:,.0f} ton</b></td><td style="color:#e41a1c">⬤</td></tr>
        <tr><td>Delta</td><td><b>{pred_delta*1000:,.0f} ton</b></td><td style="color:#4daf4a">⬤</td></tr>
        <tr><td>Ensemble</td><td><b>{pred_ens*1000:,.0f} ton</b></td><td style="color:#377eb8">⬤</td></tr>
    </table>
    
    <hr style="margin:8px 0">
    <div style="font-size:10px;color:#888">
        <span style="color:#9933ff">━</span> Trayectorias 7d &nbsp;
        <span style="color:#2196F3">⬤</span> SEMAR
    </div>
    <div style="font-size:9px;color:#aaa;margin-top:4px">
        NOAA SIR · RTOFS · GFS · SATsum CONABIO · SEMAR | Modelos Fase 1-2
    </div>
</div>'''
m.get_root().html.add_child(folium.Element(legend))

# ═══════════════════════════════════════════════════════════════════════════
# 8. Layer control
# ═══════════════════════════════════════════════════════════════════════════
folium.LayerControl(collapsed=True, position='topright').add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# GUARDAR
# ═══════════════════════════════════════════════════════════════════════════
out = ROOT / "mapa_sargazo_v6.html"
m.save(str(out))
print(f"✅ Mapa v6: {out} ({out.stat().st_size/1e6:.1f} MB)")
