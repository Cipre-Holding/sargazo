import React, { useState } from "react"
import { ArrowLeft, Waves, ArrowRight, AlertTriangle, CheckCircle2, X } from "lucide-react"

interface DocsProps {
  type: "methodology" | "layers"
  onBack: () => void
  onEnter: () => void
}

// ── Design tokens (Aaru adapted — lime→#cfb53b, plasma→#0d1b3e) ──────────────
const C = {
  canvas:    "#000000",
  carbon:    "#0a0a0a",
  graphite:  "#18181b",
  frost:     "#ffffff",
  ash:       "#bababa",
  smoke:     "#9d9d9d",
  slate:     "#858484",
  gold:      "#cfb53b",
  goldDim:   "#baa335",
  navy:      "#0d1b3e",
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.14)",
} as const

const FONT: React.CSSProperties = {
  fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontWeight: 300,
}

// Typography helpers
const T = {
  label: { fontSize: 12, letterSpacing: "0.96px", textTransform: "uppercase" as const, color: C.slate },
  labelGold: { fontSize: 12, letterSpacing: "0.96px", textTransform: "uppercase" as const, color: C.gold },
  caption: { fontSize: 11, letterSpacing: "0.88px", textTransform: "uppercase" as const },
  body: { fontSize: 15, lineHeight: 1.5, letterSpacing: "0.3px" },
  bodySm: { fontSize: 13, lineHeight: 1.5, letterSpacing: "0.325px" },
  headingSm: { fontSize: 20, fontWeight: 300, letterSpacing: "-0.5px", lineHeight: 1.25 },
  heading: { fontSize: 30, fontWeight: 300, letterSpacing: "-0.75px", lineHeight: 1.25 },
  mono: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11 },
}

// ── Data ─────────────────────────────────────────────────────────────────────

const PAPERS = [
  {
    num: "01",
    authors: "Allende-Arandia et al. 2023",
    journal: "JGR Oceans",
    subtitle: "Lagrangian Characterization of Surface Transport",
    tag: "Física / Deriva",
    contribution: "Valida la parametrización de deriva superficial en el Caribe Mexicano. Confirma el coeficiente de arrastre de viento (windage 2%) y la trayectoria de corrientes hacia Cozumel. Sustenta el retardo causal ACO→CM que justifica el lag de 1 mes en los modelos predictivos.",
  },
  {
    num: "02",
    authors: "Hu et al. 2023",
    journal: "Remote Sensing of Environment",
    subtitle: "GASB Dataset — Great Atlantic Sargassum Belt",
    tag: "Teledetección / IA",
    contribution: "Dataset de 288 meses en 6 subregiones atlánticas. Describe la red Res-UNet sobre imágenes MODIS/VIIRS para extraer el índice AFAI. Fuente primaria de la variable predictora ACO (Atlántico Central Oeste) que alimenta el ensemble con r = 0.95.",
  },
  {
    num: "03",
    authors: "De Amorim et al. 2025",
    journal: "Harmful Algae",
    subtitle: "Transporte Amazonas–Caribe",
    tag: "Oceanografía",
    contribution: "Valida el mecanismo de transporte desde la pluma del Amazonas hacia el Caribe vía la Corriente del Norte de Brasil (NBC), la corriente de Guyana y la Corriente del Caribe. Sustenta la elección de las 6 subregiones del GASB como predictores remotos.",
  },
  {
    num: "04",
    authors: "Cerdeira-Estrada et al. 2025",
    journal: "SATsum CONABIO",
    subtitle: "Monitoreo Satelital Nacional",
    tag: "Satélite Local",
    contribution: "Sistema SATsum de CONABIO. Imágenes MODIS a 1 km para detección operativa local de acumulaciones costeras. Complementa la cobertura NOAA SIR con mayor resolución en la zona de Quintana Roo y Caribe mexicano.",
  },
  {
    num: "05",
    authors: "Mandelbrot & Van Ness 1968",
    journal: "SIAM Review",
    subtitle: "Fractional Brownian Motion",
    tag: "Matemática Estocástica",
    contribution: "Sustento matemático del movimiento Browniano fraccional. Justifica H = 0.8047 en la serie histórica de sargazo, confirmando memoria persistente de largo plazo — el sistema no es ruido blanco sino un proceso con inercia multi-mensual.",
  },
  {
    num: "06",
    authors: "Davies & Harte 1987",
    journal: "Biometrika",
    subtitle: "Simulación fBm con Covarianza Exacta",
    tag: "Algoritmia",
    contribution: "Método eficiente para simular series de tiempo y desplazamientos fraccionales brownianos con covarianza exacta. Implementado en el generador fOU del pipeline de pronóstico.",
  },
  {
    num: "07",
    authors: "Dagestad et al. 2018",
    journal: "Geoscientific Model Development",
    subtitle: "OpenDrift Framework",
    tag: "Modelado Físico",
    contribution: "Arquitectura de simulación lagrangiana de código abierto. Utilizado para el pronóstico físico de trayectorias con corrientes RTOFS 1/12° y viento GFS 0.25°. 2,000 partículas, 14 días, pasos de 30 min.",
  },
  {
    num: "08",
    authors: "Wendland 1995",
    journal: "Advances in Computational Mathematics",
    subtitle: "Compactly Supported Radial Basis Functions",
    tag: "Geoestadística",
    contribution: "Define las CSRBF — específicamente el kernel Wendland C2 — utilizado en la capa de Riesgo ML para interpolación geoespacial robusta sin singularidades. Radio σ_lon = 0.5°, σ_lat = 0.25° aplicado anisotrópicamente.",
  },
]

const DISCARDED = [
  {
    variable: "Viento como predictor directo (Fase 2)",
    reason: "Correlación parcial débil e inversa (r = −0.22). El viento norte dominante es paralelo a la costa este de Cozumel, sin empuje perpendicular onshore. Combinación ACO + viento: R² = 0.77 vs solo ACO: R² = 0.78.",
  },
  {
    variable: "SST (Temperatura Superficial del Mar)",
    reason: "Incremento marginal de R² de +2.7% sobre ACO con lag de 1 mes. Excluida para mantener parsimonia del modelo (prioridad P9).",
  },
  {
    variable: "ARIMAX con muestra pequeña",
    reason: "No convergió con n = 13. Requiere n ≥ 24 para estimaciones estables de parámetros estacionales.",
  },
  {
    variable: "Prophet Multiplicativo",
    reason: "Estacionalidad aditiva obtuvo mejor ajuste sistemático en el Caribe. Modo multiplicativo eliminado del grid search.",
  },
  {
    variable: "Movimiento Browniano Geométrico (GBM)",
    reason: "Asume H = 0.5 (incrementos independientes). La serie real muestra H = 0.80 — incompatible con GBM que no captura la memoria persistente multi-mensual.",
  },
  {
    variable: "ARIMA con diferenciación entera (d)",
    reason: "No captura la integración fraccional de la serie (d = 0.3047 medido). ARFIMA sería necesario; se optó por fOU que es más interpretable.",
  },
  {
    variable: "Proceso Ornstein-Uhlenbeck simple",
    reason: "Residuos bimodales revelaron dos regímenes de arribo (temporada alta / baja) que el OU simple no puede separar sin un modelo de mezcla.",
  },
]

const LESSONS = [
  {
    title: "Mezcla de Lags entre fuentes",
    error: "Al combinar lags cruzados entre la serie histórica de Mendeley y los reportes de SEMAR, la correlación original se invertía y caía de r = 0.918 a r = 0.47.",
    fix: "Se aisló el cálculo de lags exclusivamente a la serie de boletines homogéneos de SEMAR.",
  },
  {
    title: "Confusión de Regiones GASB",
    error: "El dataset de Mendeley denominaba 'aligned_CM' a una región que en realidad era el Noroeste del Golfo de México (NWGoM). Correlación errónea: r = −0.14.",
    fix: "Se realinearon y verificaron las coordenadas espaciales para garantizar correspondencia con el Caribe Mexicano.",
  },
  {
    title: "Inflación de Correlación por n pequeño",
    error: "Con n = 9 puntos, Pearson se inflaba artificialmente a r = 0.95.",
    fix: "Al expandir la serie a n = 14 puntos validados, la correlación se corrigió a r = 0.89 — más conservadora y robusta.",
  },
  {
    title: "Outliers de Biomasa sin Winsorización",
    error: "Picos atípicos de hasta 82,699 toneladas distorsionaban severamente las regresiones.",
    fix: "Filtro de winsorización al P99 + escalado por medianas robustas. Impacto: RMSE bajó 38%.",
  },
]

// ── LAYERS (actualizado: cobertura geográfica ampliada) ───────────────────────
const LAYERS = [
  {
    num: "01",
    name: "NOAA SIR",
    subtitle: "Sargassum Inundation Risk — Observación Satelital Directa",
    tag: "Satelital · Diario",
    tagColor: C.gold,
    desc: "Segmentos costeros de riesgo reportados diariamente por el Atlantic Oceanographic and Meteorological Laboratory (AOML) de la NOAA. Cubre todo el litoral caribeño desde el Golfo de México hasta las Antillas Menores.",
    coverage: "Todo el Caribe: lat 8°–24.5° N, lon 93°–55° O. Incluye México (Yucatán, QRoo, Campeche, Tabasco), Belice, Honduras, Guatemala, Cuba, Jamaica, La Española y arco de Antillas Menores.",
    format: [
      { k: "Geometría", v: "GeoJSON LineString (segmentos costeros)" },
      { k: "Propiedades", v: "risk (low/warning/medium/high), date (YYYYMMDD)" },
      { k: "Historial", v: "340+ fechas desde julio 2025" },
      { k: "Compuesto", v: "7 días rolling — rellena gaps por nubosidad" },
    ],
    method: "Descarga diaria de KMZ comprimidos. Descompresión en memoria, parseo de Placemarks KML con regex, extracción de coordenadas y etiqueta de riesgo. Los últimos 7 días se conservan como segmentos crudos para el compuesto; el historial completo se indexa en memoria al primer request.",
  },
  {
    num: "02",
    name: "Riesgo ML",
    subtitle: "Diagnóstico de Riesgo Interpolado — Kernel Wendland C2",
    tag: "Modelo Espacial · Continuo",
    tagColor: "#60a5fa",
    desc: "Malla de riesgo costero continuo interpolada espacialmente para resolver los gaps de cobertura nubosa y falta de órbita directa del satélite NOAA. Cubre toda el área procesada del Caribe occidental.",
    coverage: "Caribe occidental: costas de México (QRoo, Yucatán, Campeche), Belice, Honduras, Guatemala y norte de Cuba. Resolución de celda ~4 km (0.04°).",
    format: [
      { k: "Geometría", v: "GeoJSON Polygon (celdas rectangulares 0.04°)" },
      { k: "Propiedades", v: "risk (low/warning/medium/high), rv (0–1 continuo)" },
      { k: "Celdas activas", v: "18,294 celdas con historial ≥ 1 observación" },
      { k: "Actualización", v: "Batch semanal sobre historial acumulado" },
    ],
    method: "338 fechas de NOAA procesadas. Submuestreo espacial con distancia de exclusión 0.04°. Interpolación con kernel Wendland C2 anisotrópico (σ_lon = 0.5°, σ_lat = 0.25°) — proyección preferencial este-oeste alineada con la dinámica de corrientes. Máscara vectorial de tierra para evitar desborde sobre tierra firme.",
  },
  {
    num: "03",
    name: "Densidad KDE",
    subtitle: "Pronóstico de Acumulación a 14 días — Kernel Density Estimation",
    tag: "Estocástico · Predictivo",
    tagColor: "#f97316",
    desc: "Mapa de calor continuo de densidad de probabilidad espacial de acumulación de sargazo sobre el horizonte predictivo. Derivado de las trayectorias lagrangianas simuladas con partículas procedentes del Atlántico Central y el Caribe.",
    coverage: "Desde el Atlántico Central (lon 60°–45° O) hasta las costas del Caribe mexicano. El área efectiva de output es la zona de llegada modelada: canal de Yucatán, Quintana Roo, Belice, Honduras.",
    format: [
      { k: "Geometría", v: "GeoJSON Point (malla densa de probabilidad)" },
      { k: "Renderizado", v: "Capa heatmap WebGL dinámica en cliente" },
      { k: "Bandwidth", v: "0.08° (~9 km) — consistencia en todos los zooms" },
      { k: "Horizontes", v: "25 snapshots entre 12h y 14 días" },
    ],
    method: "A partir de las posiciones de las 2,000 partículas OpenDrift en cada horizonte temporal, se calcula una KDE gaussiana 2D con ancho de banda fijo. La densidad se normaliza al percentil 99 para evitar que outliers dominen la escala de color.",
  },
  {
    num: "04",
    name: "Trayectorias Lagrangianas",
    subtitle: "Forecast de Deriva Física Directa — OpenDrift",
    tag: "Física · Operativo",
    tagColor: "#a855f7",
    desc: "Simulación física individual del movimiento de parcelas de agua con sargazo arrastradas por corrientes oceánicas y viento. Siembra de partículas en la zona de aproximación al Caribe desde el Atlántico Central.",
    coverage: "Zona de siembra: lat 10°–20° N, lon 65°–50° O (Atlántico Central donde el GASB detecta concentraciones). Zona de llegada: canal de Yucatán y arco costero del Caribe mexicano y Centroamérica.",
    format: [
      { k: "Partículas", v: "2,000 por simulación" },
      { k: "Paso de tiempo", v: "30 minutos físicos" },
      { k: "Horizonte", v: "14 días (336 h)" },
      { k: "Forzantes", v: "RTOFS 1/12° (corrientes) + GFS 0.25° (viento)" },
    ],
    method: "Framework OpenDrift (Dagestad et al. 2018). Ecuación de deriva: u_part = 1.5·u_corriente + 0.02·u_viento + ε_difusión. Arrastre de viento calibrado al 2% (windage). Corrientes RTOFS aceleradas a 1.5× para ajustar deriva observada en boletines SEMAR.",
  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export function Docs({ type: initialType, onBack, onEnter }: DocsProps) {
  const [activeTab, setActiveTab] = useState<"methodology" | "layers">(initialType)

  return (
    <div style={{ minHeight: "100vh", color: C.frost, display: "flex", flexDirection: "column", background: C.canvas, ...FONT }}>

      {/* ── Header ── matches Landing nav */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 max(40px, 6vw)",
        height: 56,
        background: C.canvas,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} title="Volver"
            style={{ ...FONT, background: "transparent", border: "none", cursor: "pointer", padding: 0, color: C.slate, display: "flex", alignItems: "center", transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.frost }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.slate }}>
            <ArrowLeft size={14} />
          </button>
          <Waves size={14} style={{ color: C.frost }} />
          <span style={{ fontSize: 13, letterSpacing: "0.52px", color: C.frost, textTransform: "uppercase" }}>
            Documentación Técnica
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setActiveTab("methodology")}
            style={{
              ...FONT, fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase",
              color: activeTab === "methodology" ? C.frost : C.slate,
              border: activeTab === "methodology" ? `1px solid rgba(255,255,255,0.55)` : `1px solid rgba(255,255,255,0.18)`,
              borderRadius: 0, padding: "8px 22px",
              background: activeTab === "methodology" ? "rgba(255,255,255,0.04)" : "transparent",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (activeTab !== "methodology") { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.38)"; el.style.color = "#d4d4d4" } }}
            onMouseLeave={e => { if (activeTab !== "methodology") { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.18)"; el.style.color = C.slate } }}>
            Bases Científicas
          </button>
          <button onClick={() => setActiveTab("layers")}
            style={{
              ...FONT, fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase",
              color: activeTab === "layers" ? "#000000" : C.slate,
              border: "none", borderRadius: 0, padding: "8px 22px",
              background: activeTab === "layers" ? C.gold : "transparent",
              cursor: "pointer", transition: "all 0.15s",
              outline: activeTab === "layers" ? "none" : `1px solid rgba(255,255,255,0.18)`,
              outlineOffset: "-1px",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (activeTab === "layers") el.style.background = C.goldDim; else { el.style.outlineColor = "rgba(255,255,255,0.38)"; el.style.color = "#d4d4d4" } }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (activeTab === "layers") el.style.background = C.gold; else { el.style.outlineColor = "rgba(255,255,255,0.18)"; el.style.color = C.slate } }}>
            Capas y Datos
          </button>
        </div>

        <button onClick={onEnter}
          style={{ ...FONT, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase", color: "#000000", border: "none", borderRadius: 0, padding: "8px 22px", background: C.gold, cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.goldDim }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.gold }}>
          Entrar al Sistema <ArrowRight size={12} />
        </button>
      </header>

      {/* ── Content ── */}
      <main style={{ flex: 1 }}>
        {activeTab === "methodology" ? <MethodologyTab /> : <LayersTab />}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "32px 0", background: C.canvas }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, ...T.label }}>
          <span>© 2026 Cipre Holding · Cozumel, Quintana Roo</span>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", ...T.label, transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.frost }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.slate }}>
              Volver a Inicio
            </button>
            <span style={{ color: C.border }}>·</span>
            <button onClick={onEnter} style={{ background: "transparent", border: "none", cursor: "pointer", ...T.label, transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.gold }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.slate }}>
              Entrar al Sistema
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Methodology Tab ───────────────────────────────────────────────────────────
function MethodologyTab() {
  return (
    <div>
      {/* Hero intro — carbon surface */}
      <div style={{ background: C.carbon, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px max(40px, 6vw) 56px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end" }}>
          <div>
            <p style={{ ...T.labelGold, marginBottom: 20 }}>Bases Científicas</p>
            <h1 style={{ ...T.heading, color: C.frost, margin: 0 }}>
              Sustento Científico<br />y Validación del Sistema
            </h1>
          </div>
          <p style={{ ...T.body, color: C.ash, margin: 0, maxWidth: 480 }}>
            El diseño predictivo integra literatura científica peer-reviewed, modelos estocásticos calibrados y una sistematización de errores depurados para dar certidumbre operativa a las decisiones de gestión costera.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw)" }}>

        {/* ── Section 01: Papers ── */}
        <section style={{ padding: "80px 0 64px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 48 }}>
            <span style={{ ...T.labelGold, fontSize: 10 }}>01 / Literatura Base</span>
            <h2 style={{ ...T.headingSm, color: C.frost, margin: 0 }}>Papers y Referencias Científicas</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(520px, 1fr))", gap: 1, background: C.border }}>
            {PAPERS.map((p) => (
              <div key={p.num} style={{ background: C.canvas, padding: "32px 28px", display: "flex", gap: 24 }}>
                <span style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-1px", color: "rgba(255,255,255,0.12)", lineHeight: 1, flexShrink: 0, width: 48 }}>
                  {p.num}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 400, color: C.frost, margin: "0 0 2px 0", lineHeight: 1.3 }}>{p.authors}</p>
                      <p style={{ ...T.caption, color: C.slate, margin: 0, fontSize: 10 }}>{p.journal}</p>
                    </div>
                    <span style={{ ...T.caption, color: C.slate, fontSize: 10, border: `1px solid rgba(255,255,255,0.12)`, padding: "3px 8px", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                      {p.tag}
                    </span>
                  </div>
                  <p style={{ ...T.bodySm, color: C.ash, margin: "0 0 10px 0", fontStyle: "italic" }}>{p.subtitle}</p>
                  <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{p.contribution}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 02: Discarded ── */}
        <section style={{ padding: "64px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 40 }}>
            <span style={{ ...T.labelGold, fontSize: 10 }}>02 / Parsimonia del Modelo</span>
            <h2 style={{ ...T.headingSm, color: C.frost, margin: 0 }}>Variables y Enfoques Descartados</h2>
          </div>

          <div style={{ border: `1px solid ${C.border}` }}>
            {DISCARDED.map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32, padding: "20px 28px", borderBottom: i < DISCARDED.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <AlertTriangle size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ ...T.bodySm, color: C.ash, lineHeight: 1.4 }}>{d.variable}</span>
                </div>
                <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.6 }}>
                  <span style={{ color: C.smoke, fontWeight: 400 }}>Razón: </span>{d.reason}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 03: Lessons ── */}
        <section style={{ padding: "64px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 40 }}>
            <span style={{ ...T.labelGold, fontSize: 10 }}>03 / Depuración de Sesgos</span>
            <h2 style={{ ...T.headingSm, color: C.frost, margin: 0 }}>Errores Depurados en el Pipeline</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 1, background: C.border }}>
            {LESSONS.map((l, i) => (
              <div key={i} style={{ background: C.canvas, padding: "28px" }}>
                <p style={{ ...T.label, color: C.gold, marginBottom: 16 }}>{l.title}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={{ borderLeft: "2px solid rgba(239,68,68,0.4)", paddingLeft: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <X size={11} style={{ color: "#f87171" }} />
                      <span style={{ ...T.caption, color: "#f87171", fontSize: 10 }}>Sesgo detectado</span>
                    </div>
                    <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{l.error}</p>
                  </div>
                  <div style={{ borderLeft: "2px solid rgba(52,211,153,0.4)", paddingLeft: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <CheckCircle2 size={11} style={{ color: "#34d399" }} />
                      <span style={{ ...T.caption, color: "#34d399", fontSize: 10 }}>Corrección</span>
                    </div>
                    <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{l.fix}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 04: Validation — navy section ── */}
        <section style={{ margin: "0 -max(40px, 6vw)", background: C.navy, padding: "64px max(40px, 6vw)" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 48 }}>
              <span style={{ ...T.label, color: "rgba(255,255,255,0.4)", fontSize: 10 }}>04 / Métricas de Desempeño</span>
              <h2 style={{ ...T.headingSm, color: C.frost, margin: 0 }}>Metodologías de Backtesting y Validación</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.08)" }}>
              {/* Expanding Window */}
              <div style={{ background: C.navy, padding: "32px 28px", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ ...T.label, color: C.gold, marginBottom: 16 }}>Ventana Expandible</p>
                <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: "0 0 20px 0" }}>
                  Implementado en <code style={{ ...T.mono, color: C.ash, background: "rgba(255,255,255,0.08)", padding: "1px 5px" }}>backtest_modelos.py</code>. En cada paso se entrena recursivamente agregando el mes real más reciente y prediciendo el siguiente. Métricas calculadas en escala real (reversa log).
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {["RMSE", "MAE", "SMAPE", "Bias", "Pearson r"].map(m => (
                    <div key={m} style={{ ...T.mono, color: C.ash, background: "rgba(255,255,255,0.05)", padding: "6px 10px", borderLeft: `2px solid ${C.gold}` }}>{m}</div>
                  ))}
                </div>
              </div>

              {/* LOOCV */}
              <div style={{ background: C.navy, padding: "32px 28px" }}>
                <p style={{ ...T.label, color: C.gold, marginBottom: 16 }}>Validación Cruzada LOOCV</p>
                <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, margin: "0 0 20px 0" }}>
                  Implementado en <code style={{ ...T.mono, color: C.ash, background: "rgba(255,255,255,0.08)", padding: "1px 5px" }}>modelos_fase1.py</code> para evaluar sobre n = 14. Los R² LOOCV definen dinámicamente los pesos del ensemble final:
                </p>
                <div style={{ background: "rgba(0,0,0,0.35)", border: `1px solid rgba(255,255,255,0.1)`, padding: "14px 16px", ...T.mono, color: C.ash, lineHeight: 2 }}>
                  <div>peso_j = max(0.05, R²_LOOCV_j)</div>
                  <div style={{ color: C.gold }}>ŷ = Σ(peso_j · ŷ_j) / Σ(peso_j)</div>
                  <div style={{ color: "rgba(255,255,255,0.4)" }}># IC80 = RMSE_cv × 1.28</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div style={{ height: 80 }} />
      </div>
    </div>
  )
}

// ── Layers Tab ────────────────────────────────────────────────────────────────
function LayersTab() {
  return (
    <div>
      {/* Hero intro */}
      <div style={{ background: C.carbon, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px max(40px, 6vw) 56px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end" }}>
          <div>
            <p style={{ ...T.labelGold, marginBottom: 20 }}>Capas y Datos</p>
            <h1 style={{ ...T.heading, color: C.frost, margin: 0 }}>
              Arquitectura de Capas<br />de Monitoreo y Pronóstico
            </h1>
          </div>
          <p style={{ ...T.body, color: C.ash, margin: 0, maxWidth: 480 }}>
            Cuatro capas complementarias con cobertura geográfica extendida a todo el Caribe occidental. Cada capa resuelve una escala temporal y espacial distinta para dar cobertura continua donde otra tiene gaps.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw)" }}>
        {LAYERS.map((layer, i) => (
          <section key={layer.num} style={{ padding: "64px 0", borderBottom: `1px solid ${C.border}` }}>

            {/* Layer header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
              <div style={{ display: "flex", gap: 32, alignItems: "baseline" }}>
                <span style={{ fontSize: 64, fontWeight: 300, letterSpacing: "-2px", color: "rgba(255,255,255,0.08)", lineHeight: 1, flexShrink: 0 }}>
                  {layer.num}
                </span>
                <div>
                  <p style={{ ...T.labelGold, marginBottom: 8 }}>Capa {layer.num}</p>
                  <h2 style={{ fontSize: 24, fontWeight: 300, letterSpacing: "-0.6px", color: C.frost, margin: "0 0 4px 0", lineHeight: 1.2 }}>{layer.name}</h2>
                  <p style={{ ...T.bodySm, color: C.slate, margin: 0 }}>{layer.subtitle}</p>
                </div>
              </div>
              <span style={{ ...T.caption, fontSize: 10, color: "rgba(255,255,255,0.5)", border: `1px solid rgba(255,255,255,0.12)`, padding: "4px 10px", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                {layer.tag}
              </span>
            </div>

            {/* Content grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.border }}>

              {/* Left: description + coverage */}
              <div style={{ background: C.canvas, padding: "28px" }}>
                <p style={{ ...T.label, color: C.slate, marginBottom: 12 }}>Descripción</p>
                <p style={{ ...T.body, color: "rgba(255,255,255,0.65)", margin: "0 0 28px 0", lineHeight: 1.7 }}>{layer.desc}</p>

                <p style={{ ...T.label, color: C.slate, marginBottom: 12 }}>Cobertura Geográfica</p>
                <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.55)", margin: "0 0 28px 0", lineHeight: 1.7 }}>{layer.coverage}</p>

                <p style={{ ...T.label, color: C.slate, marginBottom: 14 }}>Especificaciones Técnicas</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${C.border}` }}>
                  {layer.format.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: fi < layer.format.length - 1 ? `1px solid ${C.border}` : "none", gap: 16 }}>
                      <span style={{ ...T.caption, color: C.slate, fontSize: 10 }}>{f.k}</span>
                      <span style={{ ...T.mono, color: C.ash, textAlign: "right" as const }}>{f.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: methodology — navy for odd layers */}
              <div style={{ background: i % 2 === 0 ? C.graphite : C.navy, padding: "28px" }}>
                <p style={{ ...T.label, color: i % 2 === 0 ? C.gold : "rgba(207,181,59,0.8)", marginBottom: 12 }}>Origen y Procesamiento</p>
                <p style={{ ...T.body, color: i % 2 === 0 ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.8 }}>{layer.method}</p>
              </div>

            </div>
          </section>
        ))}

        {/* Coverage summary strip */}
        <section style={{ padding: "48px 0 80px" }}>
          <p style={{ ...T.label, marginBottom: 32 }}>Cobertura Combinada del Sistema</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border }}>
            {[
              { val: "340+", unit: "días", label: "Historial NOAA SIR" },
              { val: "18,294", unit: "celdas", label: "Malla Riesgo ML" },
              { val: "2,000", unit: "part.", label: "Partículas OpenDrift" },
              { val: "25", unit: "horiz.", label: "Horizontes KDE" },
            ].map(s => (
              <div key={s.label} style={{ background: C.canvas, padding: "28px 24px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-1.25px", color: C.frost, lineHeight: 1 }}>{s.val}</span>
                  <span style={{ fontSize: 13, color: C.gold, letterSpacing: "0.52px" }}>{s.unit}</span>
                </div>
                <span style={{ ...T.label, color: C.slate }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
