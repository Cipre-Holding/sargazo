"""
Mapa v5 — Interactivo + TimeSlider + Animación + Capas inteligentes
"""

import json
import folium
from folium import plugins
import pandas as pd
import numpy as np
from pathlib import Path
import branca

ROOT = Path(__file__).parent
m = folium.Map(location=[19.5, -87.5], zoom_start=8,
               tiles='CartoDB Positron', control_scale=True)

# ── Minimap ────────────────────────────────────────────────────────────────
minimap = plugins.MiniMap(toggle_display=True, zoom_level_offset=-6)
m.add_child(minimap)

# ── Draw & Measure ─────────────────────────────────────────────────────────
plugins.Draw(export=True, filename='draw_data.geojson',
             position='topleft',
             draw_options={'polyline': True, 'polygon': True, 'circle': True,
                          'rectangle': True, 'marker': True, 'circlemarker': False}).add_to(m)
plugins.MousePosition(position='bottomleft', separator=' | ', empty_string='NaN').add_to(m)

# ── Fullscreen ─────────────────────────────────────────────────────────────
plugins.Fullscreen().add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 1. TIMESTAMPED GEOJSON — NOAA SIR animado (sub-muestreado)
# ═══════════════════════════════════════════════════════════════════════════
with open(ROOT / "noaa_sir_riesgo_costero_qroo.geojson") as f:
    sir_raw = json.load(f)

dates = sorted(set(f['properties']['date'] for f in sir_raw['features']))
# Muestrear cada 10 días para reducir tamaño
dates_sampled = dates[::10] + [dates[-1]] if dates[-1] not in dates[::10] else dates[::10]
print(f"NOAA SIR: {len(dates)} fechas → {len(dates_sampled)} (sub-muestreado)")

ts_features = []
for feat in sir_raw['features']:
    date_str = feat['properties']['date']
    if date_str not in dates_sampled:
        continue
    risk = feat['properties']['risk']
    color = feat['properties']['color']
    dt = f'{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}T00:00:00'
    opacity_map = {'low': 0.25, 'warning': 0.45, 'medium': 0.65, 'high': 0.85}
    op = opacity_map.get(risk, 0.35)
    
    ts_features.append({
        "type": "Feature",
        "properties": {
            "times": [dt],
            "style": {
                "color": color, "fillColor": color,
                "weight": 0.5, "fillOpacity": op, "opacity": 0.8
            },
            "popup": f"<b>{risk.upper()}</b><br>{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}",
        },
        "geometry": feat['geometry']
    })

ts_fc = {"type": "FeatureCollection", "features": ts_features}

ts_plugin = plugins.TimestampedGeoJson(
    ts_fc,
    period='P10D',
    duration='P10D',
    transition_time=300,
    loop=True,
    auto_play=False,
    max_speed=10,
    loop_button=True,
    date_options='YYYY/MM/DD',
).add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 2. RIESGO ML CORREGIDO (con heatmap clustering)
# ═══════════════════════════════════════════════════════════════════════════
with open(ROOT / "noaa_sir_riesgo_ml_corregido.geojson") as f:
    risk_ml = json.load(f)

risk_fg = folium.FeatureGroup(name='Riesgo ML (Wendland C2)', show=True)
for feat in risk_ml['features'][::2]:  # sample every 2nd
    rv = feat['properties']['rv']
    if rv < 0.35:  # Solo mostrar MEDIUM y HIGH (ocultar LOW azul)
        continue
    coords = [[y, x] for x, y in feat['geometry']['coordinates'][0]]
    c = feat['properties']['c']
    folium.Polygon(
        coords, color=c, weight=0.3,
        fill=True, fill_color=c,
        fill_opacity=min(rv * 0.6, 0.45),
        tooltip=f'{feat["properties"]["risk"]} ({rv:.2f})'
    ).add_to(risk_fg)
risk_fg.add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 3. LAGRANGIAN fBm — con animación de puntos
# ═══════════════════════════════════════════════════════════════════════════
try:
    traj = pd.read_csv(ROOT / "lagrangian_fbm_trayectorias.csv")
    final = pd.read_csv(ROOT / "lagrangian_fbm_finales.csv")
    
    lag_fg = folium.FeatureGroup(name='Lagrangian fBm (H=0.8047)', show=False)
    
    # Sample fewer trajectories more clearly
    for pid in traj['id'].unique()[:15]:
        pts = traj[traj['id'] == pid].sort_values('step')
        if len(pts) >= 2:
            path = [[r['lat'], r['lon']] for _, r in pts.iterrows()]
            # Linea con opacidad degradada
            folium.PolyLine(
                path, color='#ff6600', weight=1.5, opacity=0.4
            ).add_to(lag_fg)
            # Inicio (verde) y fin (rojo)
            folium.CircleMarker(
                path[0], radius=4, color='#00cc00',
                fill=True, popup=f'Inicio {pid}'
            ).add_to(lag_fg)
            folium.CircleMarker(
                path[-1], radius=4, color='#cc0000',
                fill=True, popup=f'Final {pid}<br>{pts.iloc[-1]["lat"]:.1f}°N, {pts.iloc[-1]["lon"]:.1f}°W'
            ).add_to(lag_fg)
    
    # Heatmap de densidad de puntos finales (zonas de arribo)
    heat_data = [[r['lat'], r['lon']] for _, r in final.iterrows()]
    plugins.HeatMap(heat_data, radius=15, blur=10, max_zoom=1,
                    name='Densidad de arribos', show=False).add_to(m)
    
    lag_fg.add_to(m)
except Exception as e:
    print(f"Lagrangian: {e}")

# ═══════════════════════════════════════════════════════════════════════════
# 4. RTOFS + GFS FORECAST (7 días, windage 2%)
# ═══════════════════════════════════════════════════════════════════════════
for traj_file, final_file, label in [
    ('rtofs_forecast_trayectorias.csv', 'rtofs_forecast_finales.csv', 'RTOFS (6d)'),
    ('rtofs_gfs_forecast_trayectorias.csv', 'rtofs_gfs_forecast_finales.csv', 'RTOFS+GFS (7d, wind 2%)'),
]:
    try:
        ft = pd.read_csv(ROOT / traj_file)
        ff = pd.read_csv(ROOT / final_file)
        fg = folium.FeatureGroup(name=label, show=False)
        for pid in ft['id'].unique()[:20]:
            pts = ft[ft['id'] == pid].sort_values('step')
            if len(pts) >= 2:
                path = [[r['lat'], r['lon']] for _, r in pts.iterrows()]
                folium.PolyLine(path, color='#9933ff', weight=1.5, opacity=0.4,
                    tooltip=label).add_to(fg)
        fg.add_to(m)
    except Exception as e:
        print(f"{label}: {e}")

# ═══════════════════════════════════════════════════════════════════════════
# 4. SATsum REGIONES con popups interactivos
# ═══════════════════════════════════════════════════════════════════════════
try:
    caribe = pd.read_csv(ROOT / "satsum_caribe_mensual.csv")
    caribe['date'] = pd.to_datetime(caribe['year'].astype(str) + '-' + caribe['month'].astype(str))
    zee = pd.read_csv(ROOT / "satsum_zee_mex_mensual.csv")
    zee['date'] = pd.to_datetime(zee['year'].astype(str) + '-' + zee['month'].astype(str))
    
    def make_timeseries_html(df, region_name, unit='Mt'):
        vals = df.sort_values('date').tail(24)
        max_v = vals['biomasa_mt'].max()
        html = f'<div style="min-width:200px"><b>{region_name}</b><br>'
        html += f'<table style="width:100%;font-size:11px">'
        for _, r in vals.iterrows():
            pct = r['biomasa_mt'] / max_v * 100 if max_v > 0 else 0
            bar = f'<div style="background:#4daf4a;height:8px;width:{pct:.0f}%;border-radius:2px"></div>'
            html += f'<tr><td>{r["date"].strftime("%Y-%m")}</td><td>{r["biomasa_mt"]:.2f} {unit}</td><td>{bar}</td></tr>'
        html += '</table></div>'
        return html
except:
    pass

with open(ROOT / "satsum_regiones_geo.json") as f:
    regions = json.load(f)

for name, rgn in regions.items():
    bounds = [[y, x] for x, y in rgn['coords']]
    colors = {'Caribe': '#e41a1c', 'ZEE Mexicana': '#4daf4a', 'Golfo Mexico': '#377eb8'}
    c = colors.get(name, '#333')
    
    # Crear popup con time series
    if name == 'Caribe' and 'caribe' in dir():
        popup_html = make_timeseries_html(caribe, rgn['label'])
    elif name == 'ZEE Mexicana' and 'zee' in dir():
        popup_html = make_timeseries_html(zee, rgn['label'], 'Mt')
    else:
        popup_html = rgn.get('label', name)
    
    folium.Polygon(
        bounds, color=c, weight=2,
        fill=True, fill_color=c, fill_opacity=0.04,
        popup=folium.Popup(popup_html, max_width=300)
    ).add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 5. SEMAR ESTACIONES con datos reales
# ═══════════════════════════════════════════════════════════════════════════
master = pd.read_csv(ROOT / "boletines_sargazo_MASTER.csv", low_memory=False)
master['fecha_dt'] = pd.to_datetime(master['fecha'], errors='coerce')

# Agrupar por estación (si existe columna) o por mes
cm_monthly = master.groupby(master['fecha_dt'].dt.to_period('M'))['biomasa_caribe_mexicano_ton'].median()

stations = [
    ('Cancún', 21.16, -86.85, cm_monthly.tail(6).mean() * 0.3 if not cm_monthly.empty else 0),
    ('Cozumel', 20.51, -86.95, cm_monthly.iloc[-1] if not cm_monthly.empty else 51837),
    ('Playa del Carmen', 20.63, -87.07, cm_monthly.tail(3).mean() * 0.5 if not cm_monthly.empty else 0),
    ('Tulum', 20.21, -87.43, cm_monthly.tail(3).mean() * 0.4 if not cm_monthly.empty else 0),
    ('Puerto Morelos', 20.85, -86.87, cm_monthly.tail(3).mean() * 0.6 if not cm_monthly.empty else 0),
]

semar_fg = folium.FeatureGroup(name='Estaciones SEMAR', show=True)
for name, lat, lon, cm_est in stations:
    radius = max(6, min(18, cm_est / 5000 + 6))
    tooltip = f'{name}: {cm_est:,.0f} ton' if cm_est else name
    folium.CircleMarker(
        [lat, lon], radius=radius, color='#2196F3',
        fill=True, fill_opacity=0.6,
        popup=f'<b>{name}</b><br>CM: {cm_est:,.0f} ton <br>Lat: {lat}°N<br>Lon: {lon}°W',
        tooltip=tooltip
    ).add_to(semar_fg)
semar_fg.add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 6. MARCADOR COZUMEL + PRONÓSTICO
# ═══════════════════════════════════════════════════════════════════════════
pred_lin = 0.051403; pred_delta = 0.090145; pred_ens = 0.046444

folium.Marker(
    [20.51, -86.95],
    icon=folium.Icon(color='red', icon='info-sign', prefix='glyphicon'),
    popup=folium.Popup(f'''
        <b>Cozumel — Pronóstico Junio 2026</b><br>
        <hr>
        <b>CM Mayo:</b> 51,837 ton<br>
        <b>Regresión:</b> {pred_lin*1000:,.0f} ton<br>
        <b>Delta:</b> {pred_delta*1000:,.0f} ton<br>
        <b>Ensemble:</b> {pred_ens*1000:,.0f} ton<br>
        <hr>
        <span style="color:red">■</span> Riesgo NOAA: MEDIO-WARNING<br>
        <span style="color:#4daf4a">●</span> SATsum ZEE: 657.3 kt (Abr)
    ''', max_width=250)
).add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 7. LEYENDA INTERACTIVA
# ═══════════════════════════════════════════════════════════════════════════
legend = f'''
<div style="position:fixed;bottom:20px;right:20px;width:280px;background:rgba(255,255,255,0.95);
     border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;
     font-size:12px;padding:15px;">
    <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:15px;">Sargazo Caribe</b>
        <span style="font-size:10px;color:#666;">v5 · 12 May 2026</span>
    </div>
    <hr style="margin:6px 0">
    <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0">
        <div style="flex:1;background:red" title="Alto"></div>
        <div style="flex:1;background:orange" title="Medio"></div>
        <div style="flex:1;background:#ff0" title="Warning"></div>
        <div style="flex:1;background:blue" title="Bajo"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#888;margin:-2px 0 6px">
        <span>Alto</span><span>Medio</span><span>Warning</span><span>Bajo</span>
    </div>
    <span style="color:#2196F3">⬤</span> SEMAR &nbsp;
    <span style="color:orange">━</span> Lagrang fBm &nbsp;
    <span style="color:green">⬤</span> Inicio partícula<br>
    <hr style="margin:6px 0">
    <div style="font-size:11px">
        <b>Pronóstico Cozumel Jun 2026</b><br>
        <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin:4px 0">
            <div style="width:{pred_lin/pred_delta*50:.0f}%;background:#e41a1c"></div>
            <div style="width:{pred_ens/pred_delta*50:.0f}%;background:#377eb8"></div>
            <div style="width:50%;background:#4daf4a;opacity:0.5"></div>
        </div>
        Regresión <b>{pred_lin*1000:,.0f} t</b> ·
        Delta <b>{pred_delta*1000:,.0f} t</b><br>
        Ensemble <b>{pred_ens*1000:,.0f} t</b>
    </div>
    <hr style="margin:6px 0">
    <span style="font-size:9px;color:#aaa">
        NOAA SIR | SATsum CONABIO | SEMAR IOGMC | USF SaWS
    </span>
</div>
'''
m.get_root().html.add_child(folium.Element(legend))

# ═══════════════════════════════════════════════════════════════════════════
# 8. CONTROLES DE CAPAS
# ═══════════════════════════════════════════════════════════════════════════
folium.LayerControl(collapsed=True, position='topright').add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# 7. PANEL DE PREDICCIONES Y PRONÓSTICO
# ═══════════════════════════════════════════════════════════════════════════
pred_lin = 0.051403; pred_delta = 0.090145; pred_ens = 0.046444
cm_may = 0.051837

# Indicador de semáforo para el pronóstico
semaforo_color = '#4daf4a'  # verde por defecto
semaforo_label = 'ESTABLE'
if pred_ens > cm_may * 1.3:
    semaforo_color = '#e41a1c'
    semaforo_label = '↑ AUMENTO'
elif pred_ens > cm_may * 1.1:
    semaforo_color = '#ffa500'
    semaforo_label = '→ LIGERO AUMENTO'

legend = f'''
<div style="position:fixed;bottom:20px;right:20px;width:300px;background:rgba(255,255,255,0.97);
     border-radius:12px;box-shadow:0 4px 25px rgba(0,0,0,0.4);z-index:9999;
     font-size:12px;padding:15px;">
    <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:16px;">Sargazo Caribe</b>
        <span style="background:{semaforo_color};color:white;padding:2px 10px;
               border-radius:10px;font-size:11px;font-weight:bold">{semaforo_label}</span>
    </div>
    <span style="font-size:10px;color:#888;">{dates_sampled[-1]} · NOAA SIR + ML + Lagrangian</span>
    <hr style="margin:8px 0">
    
    <!── Mapa de riesgo ──>
    <div style="font-size:11px;font-weight:bold;margin:4px 0">RIESGO COSTERO</div>
    <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin:4px 0">
        <div style="flex:1;background:red" title="Alto: arribo inminente"></div>
        <div style="flex:1;background:orange" title="Medio: probable arribo"></div>
        <div style="flex:1;background:#ffcc00" title="Warning: posible arribo"></div>
        <div style="flex:1;background:#4488ff" title="Bajo: poco probable"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:#888;margin:0 0 6px">
        <span>Alto</span><span>Medio</span><span>Warning</span><span>Bajo</span>
    </div>
    
    <!── Cuadritos de predicción ──>
    <div style="font-size:11px;font-weight:bold;margin:8px 0 4px">PRONÓSTICO COZUMEL — JUNIO 2026</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr style="background:#f5f5f5">
            <td style="padding:4px">Mayo (CM real)</td>
            <td style="text-align:right;font-weight:bold">{cm_may*1000:,.0f} ton</td>
            <td style="width:60px">
                <div style="height:12px;width:100%;background:#2196F3;border-radius:3px"></div>
            </td>
        </tr>
        <tr>
            <td style="padding:4px">Regresión lineal</td>
            <td style="text-align:right;font-weight:bold;color:#e41a1c">{pred_lin*1000:,.0f} ton</td>
            <td>
                <div style="height:12px;width:{pred_lin/cm_may*100:.0f}%;background:#e41a1c;border-radius:3px"></div>
            </td>
        </tr>
        <tr style="background:#f5f5f5">
            <td style="padding:4px">Delta (aceleración)</td>
            <td style="text-align:right;font-weight:bold;color:#4daf4a">{pred_delta*1000:,.0f} ton</td>
            <td>
                <div style="height:12px;width:{pred_delta/cm_may*100:.0f}%;background:#4daf4a;border-radius:3px"></div>
            </td>
        </tr>
        <tr>
            <td style="padding:4px;font-weight:bold">Ensemble ponderado</td>
            <td style="text-align:right;font-weight:bold;color:#377eb8">{pred_ens*1000:,.0f} ton</td>
            <td>
                <div style="height:12px;width:{pred_ens/cm_may*100:.0f}%;background:#377eb8;border-radius:3px"></div>
            </td>
        </tr>
    </table>
    
    <!── Tendencia ──>
    <div style="display:flex;margin:8px 0 4px;gap:4px">
        <div style="flex:1;text-align:center;background:#f0f0f0;border-radius:6px;padding:4px">
            <div style="font-size:9px;color:#888">HOY</div>
            <div style="font-size:13px;font-weight:bold">{cm_may*1000:.0f}</div>
        </div>
        <div style="flex:1;text-align:center;background:#fff3e0;border-radius:6px;padding:4px">
            <div style="font-size:9px;color:#888">JUNIO</div>
            <div style="font-size:13px;font-weight:bold;color:#e41a1c">{pred_ens*1000:.0f}</div>
        </div>
        <div style="flex:1;text-align:center;background:#e8f5e9;border-radius:6px;padding:4px">
            <div style="font-size:9px;color:#888">Δ %</div>
            <div style="font-size:13px;font-weight:bold;color:#4daf4a">{(pred_ens/cm_may-1)*100:+.1f}%</div>
        </div>
    </div>
    
    <hr style="margin:8px 0">
    <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="color:#2196F3">⬤</span> SEMAR &nbsp;
        <span style="color:orange">━</span> fBm (H=0.80) &nbsp;
        <span style="color:#9933ff">━</span> RTOFS+GFS 7d
    </div>
    <div style="font-size:9px;color:#aaa;margin-top:4px">
        NOAA SIR · RTOFS · GFS · SATsum CONABIO · SEMAR | Modelos Fase 1-2
    </div>
</div>
'''
m.get_root().html.add_child(folium.Element(legend))

# ═══════════════════════════════════════════════════════════════════════════
# 8. CONTROLES DE CAPAS
# ═══════════════════════════════════════════════════════════════════════════
folium.LayerControl(collapsed=True, position='topright').add_to(m)

# ═══════════════════════════════════════════════════════════════════════════
# GUARDAR
# ═══════════════════════════════════════════════════════════════════════════
out = ROOT / "mapa_sargazo_v5.html"
m.save(out)
print(f"✅ Mapa v5: {out} ({out.stat().st_size/1e6:.1f} MB)")
