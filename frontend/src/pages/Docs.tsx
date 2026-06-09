import React, { useState, useEffect, useRef } from "react"
import { ArrowLeft, Waves, ArrowRight, AlertTriangle, CheckCircle2, X, RefreshCw, Database, HardDrive, FileText, Calendar, Activity, Info, Check, Loader2, Server, Sliders, Target, ChevronLeft, ChevronRight, Globe, Map as LucideMap, Compass, Anchor, MapPin, SlidersHorizontal, Download, Eye, BarChart3 } from "lucide-react"
import { Map, MapControls } from "@/components/ui/map"
import { SirLayer } from "@/components/map/SirLayer"
import { MlRiskLayer } from "@/components/map/MlRiskLayer"
import { KdeLayer } from "@/components/map/KdeLayer"
import { TrajectoryLayer } from "@/components/map/TrajectoryLayer"
import { useApi } from "@/hooks/useApi"

interface DocsProps {
  type: "methodology" | "layers" | "catalog"
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

// ── Data sources ─────────────────────────────────────────────────────────────
const DATA_SOURCES = [
  {
    name: "Boletines SEMAR",
    provider: "Secretaría de Marina — Armada de México",
    period: "2014 – 2026",
    records: "604 reportes",
    provides: "Observaciones semanales de biomasa, semáforo de alerta, corrientes costeras y conglomerados de sargazo en el Caribe Mexicano. Fuente primaria de la serie de entrenamiento del ensemble.",
    url: "https://www.gob.mx/semar",
  },
  {
    name: "NOAA SIR (KMZ diario)",
    provider: "AOML — Atlantic Oceanographic and Meteorological Laboratory",
    period: "Jul 2025 – presente",
    records: "339 KMZ · 189,815 segmentos",
    provides: "Riesgo costero satelital diario en segmentos LineString para todo el litoral caribeño. Cubre desde el Golfo de México hasta las Antillas Menores con clasificación low / warning / medium / high.",
    url: "https://cwcgom.aoml.noaa.gov/SIR/",
  },
  {
    name: "Mendeley GASB",
    provider: "Hu et al. 2023 — Remote Sensing of Environment",
    period: "2000 – 2022",
    records: "282 meses · 6 subregiones",
    provides: "Biomasa mensual del Gran Cinturón de Sargazo atlántico por subregión. Variable predictora ACO (Atlántico Central Oeste) con r = 0.95 hacia arribo a Cozumel con lag de 1 mes.",
    url: null,
  },
  {
    name: "SATsum CONABIO",
    provider: "Comisión Nacional para el Conocimiento y Uso de la Biodiversidad",
    period: "2011 – 2024",
    records: "162 meses · 2 regiones",
    provides: "Biomasa mensual derivada de imágenes MODIS para el Caribe mexicano y la ZEE nacional. Resolución 1 km. Complementa el historial GASB en el dominio local.",
    url: null,
  },
  {
    name: "OISST v2.1",
    provider: "NOAA NCEI — National Centers for Environmental Information",
    period: "2000 – 2026",
    records: "316 meses",
    provides: "Temperatura superficial del mar en Cozumel a 0.25°. Evaluada como predictor: incremento marginal de R² +2.7% sobre ACO — excluida por parsimonia.",
    url: "https://www.ncei.noaa.gov/products/optimum-interpolation-sst",
  },
  {
    name: "NCEP/NCAR Reanalysis",
    provider: "NOAA PSL — Physical Sciences Laboratory",
    period: "2000 – 2026",
    records: "316 meses",
    provides: "Componentes de viento (u, v) a 2.5°. Cálculo del onshore wind component en Cozumel. Evaluado como predictor: correlación parcial débil r = −0.22 — excluido del ensemble final.",
    url: "https://psl.noaa.gov/data/reanalysis/reanalysis.shtml",
  },
  {
    name: "RTOFS 1/12°",
    provider: "NCEP — National Centers for Environmental Prediction",
    period: "Tiempo real",
    records: "Operativo (14 días)",
    provides: "Corrientes oceánicas diarias para el modelo de transporte lagrangiano OpenDrift. Aceleradas 1.5× para ajustar deriva observada en boletines SEMAR. Paso de integración 30 min.",
    url: null,
  },
  {
    name: "GFS 0.25°",
    provider: "NCEP / NOAA",
    period: "Tiempo real",
    records: "Operativo (14 días)",
    provides: "Campo de viento global. Arrastre de viento calibrado al 2% (windage) para las 2,000 partículas OpenDrift. Componente clave en el desvío hacia la costa oriental de Cozumel.",
    url: null,
  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export function Docs({ type: initialType, onBack, onEnter }: DocsProps) {
  const [activeTab, setActiveTab] = useState<"methodology" | "layers" | "catalog">(initialType)

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
              color: activeTab === "layers" ? (activeTab === "layers" ? "#000000" : C.frost) : C.slate,
              border: activeTab === "layers" ? "none" : `1px solid rgba(255,255,255,0.18)`, borderRadius: 0, padding: "8px 22px",
              background: activeTab === "layers" ? C.gold : "transparent",
              cursor: "pointer", transition: "all 0.15s",
              outline: activeTab === "layers" ? "none" : "none",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (activeTab === "layers") el.style.background = C.goldDim; else { el.style.borderColor = "rgba(255,255,255,0.38)"; el.style.color = "#d4d4d4" } }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (activeTab === "layers") el.style.background = C.gold; else { el.style.borderColor = "rgba(255,255,255,0.18)"; el.style.color = C.slate } }}>
            Capas y Datos
          </button>
          <button onClick={() => setActiveTab("catalog")}
            style={{
              ...FONT, fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase",
              color: activeTab === "catalog" ? "#000000" : C.slate,
              border: "none", borderRadius: 0, padding: "8px 22px",
              background: activeTab === "catalog" ? C.gold : "transparent",
              cursor: "pointer", transition: "all 0.15s",
              outline: activeTab === "catalog" ? "none" : `1px solid rgba(255,255,255,0.18)`,
              outlineOffset: "-1px",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (activeTab === "catalog") el.style.background = C.goldDim; else { el.style.outlineColor = "rgba(255,255,255,0.38)"; el.style.color = "#d4d4d4" } }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (activeTab === "catalog") el.style.background = C.gold; else { el.style.outlineColor = "rgba(255,255,255,0.18)"; el.style.color = C.slate } }}>
            Centro de Datos
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
        {activeTab === "methodology" ? (
          <MethodologyTab />
        ) : activeTab === "layers" ? (
          <LayersTab />
        ) : (
          <CatalogTab />
        )}
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
                  Implementado en <code style={{ ...T.mono, color: C.ash, background: "rgba(255,255,255,0.08)", padding: "1px 5px" }}>backtest_modelos.py</code>. En cada paso se entrena recursivamente agregando el mes real más reciente y prediciendo el siguiente. Métricas calculadas en escala real (reversa log) sobre la serie SEMAR 2014–2026.
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
                  Implementado en <code style={{ ...T.mono, color: C.ash, background: "rgba(255,255,255,0.08)", padding: "1px 5px" }}>modelos_fase1.py</code> para evaluar sobre n = 14 puntos independientes. Los R² LOOCV definen dinámicamente los pesos del ensemble final:
                </p>
                <div style={{ background: "rgba(0,0,0,0.35)", border: `1px solid rgba(255,255,255,0.1)`, padding: "14px 16px", ...T.mono, color: C.ash, lineHeight: 2 }}>
                  <div>peso_j = max(0.05, R²_LOOCV_j)</div>
                  <div style={{ color: C.gold }}>ŷ = Σ(peso_j · ŷ_j) / Σ(peso_j)</div>
                  <div style={{ color: "rgba(255,255,255,0.4)" }}># IC80 = RMSE_cv × 1.28</div>
                </div>
              </div>
            </div>

            {/* Results strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(255,255,255,0.08)", marginTop: 1 }}>
              {[
                { metric: "r = 0.95", label: "ACO→CM predictor (lag 1 mes)" },
                { metric: "n = 14", label: "Puntos validados LOOCV" },
                { metric: "IC 80%", label: "RMSE_cv × 1.28 calibrado" },
                { metric: "26 años", label: "Serie histórica 2000–2026" },
              ].map(r => (
                <div key={r.label} style={{ background: C.navy, padding: "20px 24px" }}>
                  <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.75px", color: C.gold, marginBottom: 6, lineHeight: 1 }}>{r.metric}</div>
                  <span style={{ ...T.label, color: "rgba(255,255,255,0.45)", fontSize: 10 }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 05: Data Sources ── */}
        <section style={{ padding: "64px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 48 }}>
            <span style={{ ...T.labelGold, fontSize: 10 }}>05 / Corpus de Entrenamiento</span>
            <h2 style={{ ...T.headingSm, color: C.frost, margin: 0 }}>Fuentes de Datos e Insumos</h2>
          </div>

          {/* Volume callout */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, marginBottom: 40 }}>
            {[
              { val: "~2,200", unit: "registros", label: "Total desde 7 fuentes independientes" },
              { val: "26", unit: "años", label: "Serie histórica 2000–2026" },
              { val: "189,815", unit: "segmentos", label: "Features geoespaciales NOAA" },
            ].map(s => (
              <div key={s.label} style={{ background: C.graphite, padding: "24px 20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-1px", color: C.frost, lineHeight: 1 }}>{s.val}</span>
                  <span style={{ fontSize: 12, color: C.gold, letterSpacing: "0.52px" }}>{s.unit}</span>
                </div>
                <span style={{ ...T.label, color: C.slate }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Sources table */}
          <div style={{ border: `1px solid ${C.border}` }}>
            {DATA_SOURCES.map((src, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "220px 1fr 160px", gap: 24, padding: "20px 28px", borderBottom: i < DATA_SOURCES.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "start" }}>
                <div>
                  {src.url ? (
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      style={{ ...T.bodySm, color: C.gold, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, transition: "color 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.frost }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.gold }}>
                      {src.name} ↗
                    </a>
                  ) : (
                    <span style={{ ...T.bodySm, color: C.ash }}>{src.name}</span>
                  )}
                  <p style={{ ...T.caption, color: C.slate, margin: "4px 0 0 0", fontSize: 10, lineHeight: 1.4 }}>{src.provider}</p>
                </div>
                <p style={{ ...T.bodySm, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{src.provides}</p>
                <div style={{ textAlign: "right" as const }}>
                  <span style={{ ...T.mono, color: C.gold, display: "block", marginBottom: 4 }}>{src.records}</span>
                  <span style={{ ...T.caption, color: C.slate, fontSize: 10 }}>{src.period}</span>
                </div>
              </div>
            ))}
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

const REGION_RELEVANT_COLS: Record<number, string[]> = {
  1: ["SEMAR_CM_Mt", "biomasa_caribe_mexicano_ton", "aligned_CM"],                                                            // Cozumel
  3: ["SEMAR_CM_Mt", "biomasa_caribe_mexicano_ton", "aligned_CM"],                                                            // Cancún
  4: ["SEMAR_CM_Mt", "biomasa_caribe_mexicano_ton", "corriente_tulum_nudos", "corriente_playa_carmen_nudos"],                 // Tulum
}

const TABLE_EXPLANATIONS: Record<string, { title: string; desc: string; role: string; columns: Record<string, string> }> = {
  "beach_risk_profiles": {
    title: "Perfiles de Riesgo por Playa",
    desc: "Una fila por playa/zona costera con el perfil de riesgo actual del sistema predictivo.",
    role: "Salida final del pipeline — usado directamente en el mapa interactivo y las alertas.",
    columns: {
      "beach_name": "Nombre de la playa o zona costera monitorizada",
      "municipality": "Municipio de Quintana Roo (Cozumel, Benito Juárez, Tulum…)",
      "risk_score": "Puntuación de riesgo [0-3]: 0=Bajo, 1=Moderado, 2=Alto, 3=Crítico",
      "confidence": "Índice de confianza del pronóstico [0-100%]",
      "forecast_date": "Fecha para la cual aplica el pronóstico",
      "source_model": "Nombre del modelo o ensemble que generó el pronóstico",
      "lat": "Latitud decimal del centroide de la playa",
      "lon": "Longitud decimal del centroide de la playa"
    }
  },
  "semar_observations": {
    title: "Observaciones SEMAR",
    desc: "Registros extraídos vía OCR de los boletines oficiales de SEMAR. 604+ registros 2024–2026.",
    role: "Fuente primaria de datos de campo. Base del predictor ACO→CM y del semáforo.",
    columns: {
      "fecha": "Fecha del boletín SEMAR (ISO 8601)",
      "num_boletin": "Número consecutivo del boletín oficial",
      "caribe_oriental_mt": "Biomasa estimada en Caribe Oriental (ACO) en miles de toneladas — predictor lag-1",
      "caribe_mexicano_mt": "Biomasa en Caribe Mexicano (CM) — variable objetivo del modelo",
      "golfo_mexico_mt": "Biomasa en Golfo de México",
      "atlantico_norte_mt": "Biomasa en Atlántico Norte",
      "semaforo_qroo": "Clasificación de riesgo para Quintana Roo: BAJO/NORMAL/ALTO/CRÍTICO",
      "pdf_filename": "Nombre del archivo PDF fuente del que se extrajo el registro"
    }
  },
  "forecast_runs": {
    title: "Corridas de Pronóstico",
    desc: "Historial de cada ejecución del pipeline predictivo semanal.",
    role: "Trazabilidad del sistema — permite auditar qué modelos se ejecutaron y cuándo.",
    columns: {
      "run_id": "UUID único de la corrida",
      "started_at": "Timestamp de inicio (UTC)",
      "completed_at": "Timestamp de fin (UTC)",
      "status": "Estado: running / completed / error",
      "ensemble_r2": "R² del ensemble en validación LOOCV de esta corrida",
      "model_count": "Número de modelos activos en el ensemble"
    }
  },
  "pipeline_logs": {
    title: "Logs del Pipeline",
    desc: "Registro detallado de cada paso del pipeline de 11 etapas.",
    role: "Diagnóstico y depuración del sistema de actualización de datos.",
    columns: {
      "log_id": "ID autoincremental del log",
      "run_id": "FK a forecast_runs — la corrida a la que pertenece",
      "step_name": "Nombre del paso (noaa_sir, semar_extract, combine, features…)",
      "status": "ok / error / skipped",
      "message": "Mensaje descriptivo o traza de error",
      "duration_s": "Duración del paso en segundos",
      "timestamp": "Timestamp del evento (UTC)"
    }
  },
  "noaa_segments": {
    title: "Segmentos NOAA SIR",
    desc: "Segmentos de riesgo satelital AFAI de NOAA para la costa de Quintana Roo. ~189,815 registros históricos.",
    role: "Capa satelital en el mapa. Compuesto 7 días usado para el índice de confianza.",
    columns: {
      "segment_id": "ID único del segmento",
      "date": "Fecha de la imagen satelital (UTC)",
      "risk": "Nivel: low / warning / medium / high",
      "geometry": "LineString GeoJSON de la traza de riesgo costero (~1 km resolución)",
      "source_kmz": "Nombre del archivo KMZ fuente de NOAA"
    }
  },
  "model_metadata": {
    title: "Metadatos de Modelos",
    desc: "Parámetros estimados de cada modelo del ensemble en la última calibración.",
    role: "Transparencia del modelo — permite auditar coeficientes, hiperparámetros y métricas.",
    columns: {
      "model_id": "Identificador único del modelo (p.ej. 0.1_regression, 1.1_ridge)",
      "phase": "Fase del pipeline (0=estacional, 1=deriva)",
      "r2_loocv": "R² en validación LOOCV — métrica de selección del ensemble",
      "weight": "Peso asignado en el ensemble ponderado",
      "params_json": "Coeficientes estimados en JSON (β₀, β₁, λ, etc.)",
      "calibrated_at": "Timestamp de la última calibración"
    }
  },
  "boletines_sargazo_MASTER.csv": {
    title: "Boletines SEMAR — CSV Maestro",
    desc: "CSV consolidado de todos los boletines SEMAR procesados por OCR. 604+ filas 2024–2026.",
    role: "Fuente de verdad para el predictor estadístico. Columna aligned_ACO es el predictor principal.",
    columns: {
      "fecha": "Fecha del boletín",
      "num_boletin": "Número del boletín",
      "ACO_Mt": "Acumulación Caribe Oriental en millones de toneladas",
      "CM_Mt": "Caribe Mexicano en millones de toneladas",
      "semaforo": "Semáforo de riesgo QROO",
      "pdf_filename": "Archivo PDF fuente"
    }
  },
  "sargazo_combinado_2000_2026.csv": {
    title: "Serie Histórica Combinada 2000–2026",
    desc: "Serie mensual combinando Mendeley GASB (2000–2024) y SEMAR ACO desde 2024. Base del análisis de Hurst.",
    role: "Base del modelo fOU (H=0.8047). Variable aligned_ACO: GASB pre-2024, SEMAR ACO post-2024.",
    columns: {
      "fecha": "Año-mes (YYYY-MM)",
      "GASB_Mt": "Biomasa Gran Zona Atlántica (Mendeley/Hu et al. 2023) en millones ton",
      "SEMAR_ACO_Mt": "Biomasa Caribe Oriental de SEMAR en millones ton",
      "aligned_ACO": "Variable unificada: GASB pre-2024, SEMAR_ACO post-2024",
      "CM_Mt": "Caribe Mexicano (SEMAR) en millones ton",
      "ONI": "Índice de El Niño Oceánico (NOAA)"
    }
  },
  "features_fuente.csv": {
    title: "Features de Fuente",
    desc: "Dataset de características derivadas de fuentes externas: SST, vientos, NOAA SIR, SEMAR.",
    role: "Entrada al pipeline de modelado. Contiene variables físicas y satelitales por fecha.",
    columns: {
      "fecha": "Fecha de la observación",
      "sst_anomaly": "Anomalía de temperatura superficial respecto a climatología (°C)",
      "wind_u": "Componente U del viento (m/s, oeste-este)",
      "wind_v": "Componente V del viento (m/s, sur-norte)",
      "sir_high_days": "Días con riesgo HIGH en NOAA SIR en la ventana de 7 días",
      "sir_coverage_pct": "% de la costa de QROO con señal SIR detectada"
    }
  },
  "features_prediccion_cm.csv": {
    title: "Features para Predicción CM",
    desc: "Variables de entrada preparadas para el predictor ACO→CM lag-1.",
    role: "Alimenta Phase 0 y Phase 1 del ensemble. Contiene el predictor principal log(ACO_{t-1}).",
    columns: {
      "fecha": "Fecha objetivo del pronóstico",
      "log_ACO_lag1": "log(ACO del mes anterior) — predictor principal",
      "log_CM_obs": "log(CM observado) — variable objetivo (cuando disponible)",
      "CM_pred_phase0": "Predicción de Phase 0 (modelos estacionales)",
      "CI_lower": "Límite inferior del intervalo de confianza 80%",
      "CI_upper": "Límite superior del intervalo de confianza 80%"
    }
  },
  "features_semaforo.csv": {
    title: "Features del Semáforo",
    desc: "Variables procesadas para la clasificación ordinal del semáforo de riesgo.",
    role: "Entrada al modelo logístico ordinal de 4 categorías (BAJO/NORMAL/ALTO/CRÍTICO).",
    columns: {
      "fecha": "Fecha",
      "CM_pred_ensemble": "Predicción del ensemble en escala lineal (Mt)",
      "SIR_composite_score": "Score del compuesto NOAA SIR 7 días [0-3]",
      "fOU_residual": "Residuo del proceso fOU (desviación de la media de largo plazo)",
      "semaforo_pred": "Categoría predicha: 0=BAJO, 1=NORMAL, 2=ALTO, 3=CRÍTICO"
    }
  },
  "residuos_estocasticos.csv": {
    title: "Residuos Estocásticos (fOU)",
    desc: "Residuos del modelo fOU calibrado sobre log(GASB). Usados para la simulación Monte Carlo.",
    role: "Componente estocástico del pronóstico. Mueve los intervalos de confianza con H=0.8047.",
    columns: {
      "fecha": "Fecha",
      "log_GASB": "log(GASB_Mt) observado",
      "log_GASB_pred_fOU": "Predicción del proceso fOU (media condicional)",
      "residuo": "Residuo = log_GASB - log_GASB_pred_fOU",
      "fBm_component": "Componente fBm estimado (Davies-Harte FFT)"
    }
  },
  "noaa_sir_resumen_diario.csv": {
    title: "Resumen Diario NOAA SIR",
    desc: "Resumen agregado por día del riesgo satelital de la costa de Quintana Roo.",
    role: "Feature de densidad de detección satelital. Entrada al índice de confianza.",
    columns: {
      "date": "Fecha de la imagen NOAA (UTC)",
      "total_segments": "Total de segmentos detectados en QROO",
      "high_count": "Segmentos con riesgo HIGH",
      "medium_count": "Segmentos con riesgo MEDIUM",
      "warning_count": "Segmentos con riesgo WARNING",
      "low_count": "Segmentos con riesgo LOW",
      "coverage_km": "Longitud total de costa con señal SIR (km estimados)"
    }
  },
  "satsum_caribe_mensual.csv": {
    title: "SATsum Caribe Mensual",
    desc: "Biomasa de sargazo flotante detectada por satélite (CONABIO SATsum) en el Caribe Mexicano.",
    role: "Feature satelital independiente de SEMAR. Complementa el predictor ACO→CM.",
    columns: {
      "fecha": "Año-mes",
      "satsum_km2": "Área de sargazo flotante detectada en km²",
      "satsum_index": "Índice normalizado [0-1] respecto al máximo histórico",
      "cloud_cover_pct": "Cobertura de nubes en el período (limita confiabilidad)"
    }
  },
  "sst_cozumel_mensual.csv": {
    title: "SST Cozumel Mensual",
    desc: "Temperatura Superficial del Mar en la zona de Cozumel. Fuente: OISST v2.1 (NOAA).",
    role: "Feature de condición termal. SST > 28°C correlaciona con proliferación de sargazo.",
    columns: {
      "fecha": "Año-mes",
      "sst_mean": "SST promedio mensual (°C)",
      "sst_anomaly": "Anomalía respecto a climatología 1982–2010 (°C)",
      "sst_max": "SST máxima en el mes"
    }
  },
  "viento_cozumel_mensual.csv": {
    title: "Vientos Cozumel Mensual",
    desc: "Viento superficial promedio en el Canal de Yucatán. Fuente: NCEP/NCAR Reanalysis.",
    role: "Feature dinámica de transporte. Dirección y magnitud del viento determinan la deriva del sargazo.",
    columns: {
      "fecha": "Año-mes",
      "u_mean": "Componente U promedio (m/s, +este/-oeste)",
      "v_mean": "Componente V promedio (m/s, +norte/-sur)",
      "speed_mean": "Velocidad media del viento (m/s)",
      "direction_deg": "Dirección meteorológica promedio (grados desde norte)"
    }
  },
  "satsum_zee_mex_mensual.csv": {
    title: "SATsum ZEE México Mensual",
    desc: "Cobertura satelital de sargazo en la Zona Económica Exclusiva de México.",
    role: "Visión macro del sargazo en aguas mexicanas. Antecede la señal en Cozumel ~1-2 meses.",
    columns: {
      "fecha": "Año-mes",
      "satsum_zee_km2": "Área de sargazo en ZEE México (km²)",
      "pct_change_mom": "Variación porcentual mes a mes"
    }
  },
  "forecast_7d_trayectorias.csv": {
    title: "Trayectorias 7 Días (OpenDrift)",
    desc: "Trayectorias de 2,000 partículas de sargazo simuladas con RTOFS + GFS a 14 días.",
    role: "Base del mapa de probabilidad de arribo costero. Windage 2%, sin Stokes drift.",
    columns: {
      "particle_id": "ID de la partícula [0–1999]",
      "time_step": "Paso temporal (horas desde t=0)",
      "lon": "Longitud de la partícula",
      "lat": "Latitud de la partícula",
      "active": "1 = flotando, 0 = encallada o fuera del dominio",
      "distance_to_coast_km": "Distancia a la costa más cercana (km)"
    }
  },
  "lagrangian_fbm_finales.csv": {
    title: "Posiciones Finales — Modelo fBm",
    desc: "Posiciones finales de partículas en la simulación lagrangiana con ruido fBm (H=0.8047). Modelo analítico.",
    role: "Análisis estocástico offline. NO usado para pronóstico operacional (solo investigación).",
    columns: {
      "particle_id": "ID de partícula",
      "lon_final": "Longitud final",
      "lat_final": "Latitud final",
      "beached": "Si la partícula alcanzó la costa (bool)",
      "transit_days": "Días de tránsito hasta encallar"
    }
  },
  "lagrangian_fbm_trayectorias.csv": {
    title: "Trayectorias — Modelo fBm",
    desc: "Trayectorias completas de la simulación con corrientes paramétricas + ruido fBm. Modelo analítico.",
    role: "Investigación estocástica. Permite analizar distribución de tiempos de tránsito bajo incertidumbre.",
    columns: {
      "particle_id": "ID de partícula",
      "step": "Paso de tiempo",
      "lon": "Longitud",
      "lat": "Latitud",
      "fbm_perturbation": "Perturbación fBm aplicada en este paso"
    }
  },
  "sargazo_correlaciones_lag.csv": {
    title: "Correlaciones Cruzadas ACO→CM",
    desc: "Tabla de correlaciones de Pearson entre log(ACO_{t-k}) y log(CM_t) para lags k=0…6.",
    role: "Evidencia empírica del lag-1. Valida el predictor principal del ensemble (r=0.95 en lag-1).",
    columns: {
      "lag_months": "Lag en meses (0 = contemporáneo, 1 = mes previo…)",
      "pearson_r": "Coeficiente de correlación de Pearson",
      "p_value": "Valor p (permutación, n=14)",
      "n_pairs": "Número de pares disponibles para ese lag"
    }
  },
  "risk_by_beach.json": {
    title: "Riesgo por Playa (JSON)",
    desc: "Perfil de riesgo actual por cada playa o zona costera monitorizada en Quintana Roo.",
    role: "Datos del mapa interactivo de playas. Incluye coordenadas GeoJSON y nivel semáforo.",
    columns: {
      "name": "Nombre de la playa o zona",
      "risk_level": "Nivel de riesgo: low / moderate / high / critical",
      "score": "Score numérico [0–3]",
      "lat": "Latitud",
      "lon": "Longitud",
      "last_updated": "Timestamp de la última actualización"
    }
  },
  "noaa_sir_composite_7d.geojson": {
    title: "Compuesto NOAA SIR — 7 Días",
    desc: "GeoJSON con los segmentos de riesgo satelital de los últimos 7 días ('mayor riesgo gana').",
    role: "Capa SIR del mapa interactivo. Política conservadora: mantiene el máximo riesgo de la semana.",
    columns: {
      "risk": "Nivel de riesgo del segmento: low / warning / medium / high",
      "date": "Fecha de la imagen que aportó este segmento",
      "geometry": "LineString de la traza de riesgo (~1 km resolución)"
    }
  },
  "noaa_sir_riesgo_costero_qroo_reduced.geojson": {
    title: "NOAA SIR — Costa QROO Reducida",
    desc: "GeoJSON simplificado (bbox Quintana Roo) del histórico completo de segmentos SIR. ~8 MB.",
    role: "Archivo de referencia histórica. Usado para análisis de tendencias y densidad satelital.",
    columns: {
      "risk": "Nivel de riesgo",
      "date": "Fecha de detección",
      "geometry": "Geometría de la línea de riesgo"
    }
  }
}

function CatalogTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [polling, setPolling] = useState(false)

  // Map layers states
  const [mapLayers, setMapLayers] = useState<Record<string, boolean>>({
    mlrisk: true,
    sir: true,
    kde: false,
    trajectories: false,
  })
  const [mapHorizon, setMapHorizon] = useState("48h")
  const [mapSirDate, setMapSirDate] = useState("")

  // Catalog sub-tabs organization
  const [activeSubTab, setActiveSubTab] = useState<"map" | "browser" | "cronologia" | "pipeline" | "architecture">("cronologia")

  // Regional quick-jump states
  const [activeRegionIndex, setActiveRegionIndex] = useState<number>(0)

  const regions = [
    {
      name: "General Caribe",
      center: [-86.8, 19.8],
      zoom: 7.0,
      desc: "Litoral de Quintana Roo",
      icon: Globe,
      riskLevel: "MODERADO",
      riskVal: 1.76,
      beaches: ["Isla Mujeres", "Cancún / Puerto Juárez", "Puerto Morelos", "Cozumel Norte", "Playa del Carmen", "Tulum", "Sian Ka'an / Punta Allen", "Costa Central / Muyil", "Chetumal / Xcalak"],
      scope: "Todo el Canal de Yucatán, Cozumel, y la Riviera Maya en una vista agregada de arribos y deriva.",
      dataStreams: ["NOAA SIR Satelital", "Simulación Lagrangian 14d", "Boletines de Marina (SEMAR)"]
    },
    {
      name: "Cozumel Este/Oeste",
      center: [-86.91, 20.42],
      zoom: 9.8,
      desc: "Isla de Cozumel",
      icon: Anchor,
      riskLevel: "MODERADO",
      riskVal: 1.88,
      beaches: ["Cozumel Norte", "Cozumel Sur"],
      scope: "Doble perfil costero: Costa Este expuesta a arribos masivos; Costa Oeste bajo la sombra de la isla.",
      dataStreams: ["Temperatura Superficial (SST)", "Vientos del Canal (NCEP)", "Detección NOAA SIR"]
    },
    {
      name: "Yucatán Costa Norte",
      center: [-87.6, 21.4],
      zoom: 8.2,
      desc: "Holbox a Progreso",
      icon: Compass,
      riskLevel: "BAJO",
      riskVal: 1.15,
      beaches: [],
      scope: "Litoral norte de la península de Yucatán. Zonas de transporte de sargazo hacia el Golfo de México.",
      dataStreams: ["Simulación de Deriva", "Celdas Satelitales Reducidas", "Corrientes Superficiales (RTOFS)"]
    },
    {
      name: "Cancún / I. Mujeres",
      center: [-86.78, 21.18],
      zoom: 9.8,
      desc: "Norte de Quintana Roo",
      icon: Waves,
      riskLevel: "ALTO",
      riskVal: 2.01,
      beaches: ["Isla Mujeres", "Cancún / Puerto Juárez", "Puerto Morelos"],
      scope: "Zona de alta afluencia turística. Abarca Playa Delfines, Puerto Juárez e Isla Mujeres oriental.",
      dataStreams: ["Perfiles de Susceptibilidad", "Composiciones NOAA 7 Días", "Monitoreo SEMAR"]
    },
    {
      name: "Tulum / Riviera",
      center: [-87.4, 20.15],
      zoom: 9.5,
      desc: "Centro de Quintana Roo",
      icon: MapPin,
      riskLevel: "MODERADO",
      riskVal: 1.62,
      beaches: ["Tulum", "Playa del Carmen", "Sian Ka'an / Punta Allen", "Costa Central / Muyil"],
      scope: "Área costera ecológicamente sensible, desde Playa del Carmen hasta la Reserva de la Biosfera Sian Ka'an.",
      dataStreams: ["Densidad KDE acumulativa", "Trayectorias Lagrangianas", "Entrada Manual (Admin)"]
    }
  ];

  // Inline table browser states
  const [activeBrowserTable, setActiveBrowserTable] = useState<string>("beach_risk_profiles")
  const [browserPage, setBrowserPage] = useState<number>(1)
  const [browserData, setBrowserData] = useState<any>(null)
  const [browserLoading, setBrowserLoading] = useState<boolean>(false)
  const [browserError, setBrowserError] = useState<string | null>(null)
  const [browserSearch, setBrowserSearch] = useState<string>("")
  // Browser sort + date filter + export
  const [sortState, setSortState] = useState<{ col: string; dir: "asc" | "desc" } | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // Chart data for time-series tables
  const [chartData, setChartData] = useState<any[] | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  // OCR search inside bulletin text
  const [ocrSearch, setOcrSearch] = useState("")
  // Copy-to-clipboard toast
  const [copyToast, setCopyToast] = useState(false)

  // File search filters
  const [noaaSearch, setNoaaSearch] = useState("")
  const [noaaExpandedMonth, setNoaaExpandedMonth] = useState<string | null>(null)
  const [semarGridYear, setSemarGridYear] = useState<string>("2026")
  // SEMAR bulletin visualizer states
  const [selectedBulletin, setSelectedBulletin] = useState<{ name: string, num: string, year: string } | null>(null)
  const [bulletinImages, setBulletinImages] = useState<string[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [activeImgIdx, setActiveImgIdx] = useState(0)
  const [galleryTab, setGalleryTab] = useState<"images" | "text" | "tables">("images")
  const [bulletinText, setBulletinText] = useState<string>("")
  const [textLoading, setTextLoading] = useState(false)
  const [bulletinTables, setBulletinTables] = useState<any>(null)
  const [tablesLoading, setTablesLoading] = useState(false)

  useEffect(() => {
    if (!selectedBulletin) {
      setBulletinImages([]);
      setBulletinText("");
      setBulletinTables(null);
      setGalleryTab("images");
      return;
    }
    setGalleryTab("images");
    setBulletinText("");
    setBulletinTables(null);
    setImagesLoading(true);
    fetch(`/api/download/boletin-images/${selectedBulletin.year}/${selectedBulletin.num}`)
      .then(res => res.json())
      .then(json => {
        setBulletinImages(json.images || []);
        setActiveImgIdx(0);
      })
      .catch(err => {
        console.error("Error loading images", err);
      })
      .finally(() => {
        setImagesLoading(false);
      });
  }, [selectedBulletin])

  useEffect(() => {
    if (!selectedBulletin) return;

    if (galleryTab === "text" && !bulletinText) {
      setTextLoading(true);
      fetch(`/api/download/boletin-text/${selectedBulletin.year}/${selectedBulletin.num}`)
        .then(res => res.json())
        .then(json => {
          setBulletinText(json.text || "No hay texto disponible.");
        })
        .catch(err => {
          console.error("Error loading text", err);
          setBulletinText("Error al cargar el texto.");
        })
        .finally(() => {
          setTextLoading(false);
        });
    }

    if (galleryTab === "tables" && !bulletinTables) {
      setTablesLoading(true);
      fetch(`/api/download/boletin-tables/${selectedBulletin.year}/${selectedBulletin.num}`)
        .then(res => res.json())
        .then(json => {
          setBulletinTables(json.tables || {});
        })
        .catch(err => {
          console.error("Error loading tables", err);
          setBulletinTables({});
        })
        .finally(() => {
          setTablesLoading(false);
        });
    }
  }, [selectedBulletin, galleryTab, bulletinText, bulletinTables])

  const parseSemarFileName = (fileName: string) => {
    const parts = fileName.replace(".pdf", "").split("_");
    if (parts.length >= 5) {
      return {
        num: parts[1],
        year: parts[parts.length - 1]
      };
    }
    return { num: "", year: "2026" };
  };

  const [semarSearch, setSemarSearch] = useState("")
  const [semarMonthFilter, setSemarMonthFilter] = useState("")
  const [boletinList, setBoletinList] = useState<Record<string, { num: string; has_image: boolean; has_text: boolean }[]>>({})
  const [noaaKmzFiles, setNoaaKmzFiles] = useState<string[]>([])
  const [boletinDates, setBoletinDates] = useState<Record<string, { fecha: string; semaforo: string; aco_mt: string; cm_mt: string }>>({})
  const [noaaDailyRisk, setNoaaDailyRisk] = useState<Record<string, { high: number; medium: number; warning: number; low: number; total: number }>>({})
  // Cronología sub-tab state
  const [cronoMonth, setCronoMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [cronoSelectedDay, setCronoSelectedDay] = useState<string | null>(null)
  const [regionSummaryExpanded, setRegionSummaryExpanded] = useState(false)
  const [cronoHintDismissed, setCronoHintDismissed] = useState(false)
  const [cronoView, setCronoView] = useState<"calendar" | "backtest">("calendar")
  const [btHover, setBtHover] = useState<number | null>(null)
  const [mapCoords, setMapCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [mapGuideOpen, setMapGuideOpen] = useState(true)

  useEffect(() => {
    fetch("/api/download/boletin-list")
      .then(r => r.json())
      .then(j => setBoletinList(j.years || {}))
      .catch(() => {})
    fetch("/api/download/noaa-kmz-list")
      .then(r => r.json())
      .then(j => setNoaaKmzFiles(j.files || []))
      .catch(() => {})
    fetch("/api/download/boletin-dates")
      .then(r => r.json())
      .then(j => {
        const map: Record<string, any> = {}
        ;(j.records || []).forEach((rec: any) => { map[String(rec.num)] = rec })
        setBoletinDates(map)
      })
      .catch(() => {})
    fetch("/api/download/noaa-daily-risk")
      .then(r => r.json())
      .then(j => {
        const map: Record<string, any> = {}
        ;(j.records || []).forEach((rec: any) => { map[rec.date] = rec })
        setNoaaDailyRisk(map)
      })
      .catch(() => {})
  }, [])

  // Fetch geo data using useApi
  const { data: sirDates } = useApi<string[]>("/forecast/geodata/sir/dates")
  const { data: sirGeo } = useApi<any>(
    mapLayers.sir ? (mapSirDate ? `/forecast/geodata/sir?date=${mapSirDate}` : "/forecast/geodata/sir") : null
  )
  const { data: mlRiskGeo } = useApi<any>(mapLayers.mlrisk ? "/forecast/geodata/ml-risk" : null)
  const { data: kdeGeo } = useApi<any>(mapLayers.kde ? "/forecast/kde" : null)
  const { data: trajectoriesGeo } = useApi<any[]>(mapLayers.trajectories ? "/forecast/trajectories" : null)

  const mapRef = useRef<any>(null)

  // Initialize NOAA date
  useEffect(() => {
    if (sirDates && sirDates.length > 0 && !mapSirDate) {
      setMapSirDate(sirDates[sirDates.length - 1])
    }
  }, [sirDates, mapSirDate])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/download/catalog")
      if (!res.ok) throw new Error("Error al obtener catálogo")
      const json = await res.json()
      setData(json)
      setError(null)
      if (json.pipeline?.status === "running") {
        setPolling(true)
      } else {
        setPolling(false)
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(() => {
      fetchData()
    }, 3000)
    return () => clearInterval(interval)
  }, [polling])

  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(browserSearch)
      setBrowserPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [browserSearch])

  // Reset page on filter/sort changes (M6c)
  useEffect(() => {
    setBrowserPage(1)
  }, [dateFrom, dateTo, sortState])

  // M2a: Auto-navigate Cronología to dateFrom month when global filter changes
  useEffect(() => {
    if (dateFrom && dateFrom.length === 7) {
      setCronoMonth(dateFrom)
      setCronoSelectedDay(null)
    }
  }, [dateFrom])

  // Fetch inline table browser data
  useEffect(() => {
    setBrowserLoading(true)
    setBrowserError(null)
    let url = `/api/download/table/${activeBrowserTable}?limit=15&page=${browserPage}`
    if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`
    if (dateFrom) url += `&date_from=${encodeURIComponent(dateFrom)}`
    if (dateTo) url += `&date_to=${encodeURIComponent(dateTo)}`
    if (sortState) url += `&sort_col=${encodeURIComponent(sortState.col)}&sort_dir=${sortState.dir}`
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Error al obtener registros del dataset")
        return res.json()
      })
      .then(json => {
        setBrowserData(json)
      })
      .catch(err => {
        setBrowserError(err.message || "Error al cargar los datos")
      })
      .finally(() => {
        setBrowserLoading(false)
      })
  }, [activeBrowserTable, browserPage, debouncedSearch, dateFrom, dateTo, sortState])

  // Map flying coordination on active subtab / active region change
  useEffect(() => {
    if (activeSubTab === "map" && mapRef.current) {
      const region = regions[activeRegionIndex]
      const timer = setTimeout(() => {
        mapRef.current.flyTo({ center: region.center, zoom: region.zoom, duration: 1200 })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [activeSubTab, activeRegionIndex])

  // Live map coordinate tracker
  useEffect(() => {
    if (activeSubTab !== "map" || !mapRef.current) return
    const update = () => {
      const c = mapRef.current.getCenter()
      setMapCoords({ lat: c.lat, lon: c.lng })
    }
    mapRef.current.on("move", update)
    update()
    return () => { mapRef.current?.off("move", update) }
  }, [activeSubTab, mapRef.current])

  // Reset coords when region changes
  useEffect(() => {
    const c = regions[activeRegionIndex].center
    setMapCoords({ lat: c[1], lon: c[0] })
  }, [activeRegionIndex])

  const handleTableChange = (tableName: string) => {
    setActiveBrowserTable(tableName)
    setBrowserPage(1)
    setBrowserSearch("")
    setDebouncedSearch("")
    setSortState(null)
    setDateFrom("")
    setDateTo("")
    setChartData(null)
    setOcrSearch("")
  }

  // Chart config for time-series tables (M2)
  const CHART_CONFIG: Record<string, { keys: string[]; colors: string[]; type: "line" | "bar" | "area-stacked" }> = {
    "sargazo_combinado_2000_2026.csv": { keys: ["SEMAR_ACO_Mt", "SEMAR_CM_Mt"], colors: ["#f97316", "#60a5fa"], type: "line" },
    "noaa_sir_resumen_diario.csv": { keys: ["count_high", "count_medium", "count_warning", "count_low"], colors: ["#ef4444", "#f97316", "#eab308", "#22c55e"], type: "area-stacked" },
    "boletines_sargazo_MASTER.csv": { keys: ["biomasa_caribe_mexicano_ton"], colors: ["#cfb53b"], type: "bar" },
    "features_prediccion_cm.csv": { keys: ["log_cm"], colors: ["#cfb53b"], type: "line" },
  }

  // Fetch chart data when table changes (M2)
  useEffect(() => {
    if (!CHART_CONFIG[activeBrowserTable]) { setChartData(null); return }
    setChartLoading(true)
    fetch(`/api/download/table/${activeBrowserTable}?limit=999&page=1`)
      .then(r => r.json())
      .then(j => setChartData(j.rows || []))
      .catch(() => setChartData(null))
      .finally(() => setChartLoading(false))
  }, [activeBrowserTable])

  const handleRunPipeline = async () => {
    if (triggering || data?.pipeline?.status === "running") return
    setTriggering(true)
    try {
      const res = await fetch("/api/download/run", { method: "POST" })
      if (!res.ok) throw new Error("Error al iniciar pipeline")
      setPolling(true)
      await fetchData()
    } catch (err: any) {
      alert("Error al iniciar pipeline: " + err.message)
    } finally {
      setTriggering(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 0", gap: 16 }}>
        <Loader2 className="animate-spin" size={32} style={{ color: C.gold }} />
        <span style={{ ...T.label, color: C.ash }}>Cargando catálogo de datos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px max(40px, 6vw)", gap: 24, maxWidth: 600, margin: "0 auto" }}>
        <AlertTriangle size={48} style={{ color: "#ef4444" }} />
        <div style={{ textAlign: "center" }}>
          <h2 style={{ ...T.headingSm, color: C.frost, marginBottom: 8 }}>Error al cargar catálogo</h2>
          <p style={{ ...T.body, color: C.smoke, margin: 0 }}>{error}</p>
        </div>
        <button onClick={fetchData} style={{ ...FONT, fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase", color: "#000000", border: "none", borderRadius: 0, padding: "8px 22px", background: C.gold, cursor: "pointer" }}>
          Reintentar
        </button>
      </div>
    )
  }

  const pipeline = data?.pipeline || { status: "never_run" }
  const files = data?.files || {}
  const dbStats = data?.database || { size_bytes: 0, last_modified: null, tables: [] }

  const stepLabels: Record<string, string> = {
    noaa_sir: "Descarga/Procesamiento NOAA SIR",
    semar_download: "Descarga Boletines SEMAR (PDF)",
    semar_extract: "Extracción de Texto SEMAR",
    combine: "Consolidación de Datasets",
    features: "Modelado de Características (Lagged Features)",
    predict_phase0: "Inferencia Modelo Estacional (Fase 0)",
    predict_phase1: "Inferencia Modelo Deriva (Fase 1)",
    confidence: "Cálculo de Índice de Confianza",
    ml_risk: "Interpolación Geostadística (Riesgo ML)",
    beach_risk: "Perfiles de Riesgo por Playa",
    trajectory_forecast: "Simulación de Trayectorias OpenDrift (14d)"
  }

  const stepsKeys = Object.keys(stepLabels)
  const stepStatuses = pipeline.steps || {}
  const completedStepsCount = stepsKeys.filter(k => stepStatuses[k] === "ok").length
  const progressPercent = Math.round((completedStepsCount / stepsKeys.length) * 100)

  function formatDate(isoStr: string | null) {
    if (!isoStr) return "N/D"
    try {
      const d = new Date(isoStr)
      return d.toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch (e) {
      return isoStr
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const toggleMapLayer = (id: string) => {
    setMapLayers(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Row filtering by active region context
  const getBeachName = (row: any) => {
    return row.beach_name || row.name || "";
  };

  const getFilteredRowsForRegion = (rows: any[]) => {
    if (activeRegionIndex === 0) return rows;
    if (activeBrowserTable !== "beach_risk_profiles" && activeBrowserTable !== "risk_by_beach.json") return rows;

    return rows.filter(row => {
      const name = getBeachName(row).toLowerCase();
      if (activeRegionIndex === 1) { // Cozumel
        return name.includes("cozumel");
      }
      if (activeRegionIndex === 3) { // Cancún
        return name.includes("mujeres") || name.includes("cancún") || name.includes("cancun") || name.includes("morelos");
      }
      if (activeRegionIndex === 4) { // Tulum / Riviera
        return name.includes("tulum") || name.includes("carmen") || name.includes("muyil") || name.includes("sian");
      }
      if (activeRegionIndex === 2) { // Yucatán Costa Norte
        return false; // No beaches for Yucatán Costa Norte in the list
      }
      return true;
    });
  };

  const currentDisplayRows = getFilteredRowsForRegion(browserData?.rows || []);
  const currentDisplayCount = (activeBrowserTable === "beach_risk_profiles" || activeBrowserTable === "risk_by_beach.json")
    ? currentDisplayRows.length
    : (browserData?.total_count || 0);

  const totalPages = Math.ceil(currentDisplayCount / 15) || 1

  // Filter files
  const filteredNoaaFiles = files.noaa_sir_kmz?.latest_files?.filter((f: any) =>
    f.name.toLowerCase().includes(noaaSearch.toLowerCase())
  ) || []

  const filteredSemarFiles = files.boletines_semar?.latest_files?.filter((f: any) =>
    f.name.toLowerCase().includes(semarSearch.toLowerCase())
  ) || []

  // Check relevance of table/file to the active region
  const isTableRelevantToRegion = (tableName: string) => {
    if (activeRegionIndex === 0) return true;
    if (activeRegionIndex === 1) { // Cozumel
      return ["beach_risk_profiles", "risk_by_beach.json", "sst_cozumel_mensual.csv", "viento_cozumel_mensual.csv"].includes(tableName);
    }
    if (activeRegionIndex === 2) { // Yucatán
      return ["forecast_7d_trayectorias.csv", "noaa_sir_riesgo_costero_qroo_reduced.geojson"].includes(tableName);
    }
    if (activeRegionIndex === 3) { // Cancún
      return ["beach_risk_profiles", "risk_by_beach.json", "noaa_sir_composite_7d.geojson"].includes(tableName);
    }
    if (activeRegionIndex === 4) { // Tulum
      return ["beach_risk_profiles", "risk_by_beach.json", "forecast_7d_trayectorias.csv", "noaa_sir_riesgo_costero_qroo_reduced.geojson"].includes(tableName);
    }
    return false;
  };

  const renderMapSection = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Selected Region Map Context Header */}
        <div style={{ padding: "14px 18px", background: "rgba(207,181,59,0.03)", borderLeft: `3px solid ${C.gold}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 13, color: C.frost, fontWeight: "bold" }}>Monitoreando: {regions[activeRegionIndex].name}</span>
            <p style={{ fontSize: 11.5, color: C.slate, margin: "4px 0 0 0" }}>{regions[activeRegionIndex].scope}</p>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <MapPin size={11} style={{ color: C.gold }} />
              <span style={{ ...T.mono, fontSize: 10.5, color: C.gold }}>
                {mapCoords
                  ? `${mapCoords.lat.toFixed(4)}°N  ${Math.abs(mapCoords.lon).toFixed(4)}°W`
                  : `${regions[activeRegionIndex].center[1].toFixed(4)}°N  ${Math.abs(regions[activeRegionIndex].center[0]).toFixed(4)}°W`}
              </span>
            </div>
            <span style={{ fontSize: 8, color: C.slate }}>
              ZOOM {regions[activeRegionIndex].zoom.toFixed(1)}x · centro del mapa
            </span>
          </div>
        </div>

        {/* Map visualizer section */}
        <section id="mapa-visualizador">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, background: C.graphite, border: `1px solid ${C.border}`, padding: 24 }}>
            {/* Map Column */}
            <div style={{ position: "relative", height: 500, background: "#050505", border: `1px solid ${C.border}` }}>
              <Map
                ref={mapRef}
                center={regions[activeRegionIndex].center as [number, number]}
                zoom={regions[activeRegionIndex].zoom}
                theme="dark"
              >
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => mapRef.current?.flyTo({ center: [-86.91, 20.42], zoom: 9.8, duration: 1000 })}
                    style={{
                      display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center",
                      background: "rgba(10,10,10,0.85)", border: `1px solid ${C.borderMid}`, color: C.frost,
                      cursor: "pointer", borderRadius: 0
                    }}
                    title="Centrar en Cozumel"
                  >
                    <Target size={14} />
                  </button>
                  <button
                    onClick={() => mapRef.current?.flyTo({ center: [-86.8, 19.8], zoom: 7.0, duration: 1000 })}
                    style={{
                      display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center",
                      background: "rgba(10,10,10,0.85)", border: `1px solid ${C.borderMid}`, color: C.frost,
                      cursor: "pointer", borderRadius: 0
                    }}
                    title="Ver Todo el Caribe"
                  >
                    <Globe size={14} />
                  </button>
                </div>
                <MapControls position="bottom-right" showZoom showCompass />
                {/* Floating coordinate overlay */}
                <div style={{
                  position: "absolute", bottom: 36, left: 8, zIndex: 10, pointerEvents: "none",
                  background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.08)",
                  padding: "3px 9px", display: "flex", alignItems: "center", gap: 6
                }}>
                  <Compass size={10} style={{ color: C.gold, flexShrink: 0 }} />
                  <span style={{ ...T.mono, fontSize: 9.5, color: C.gold }}>
                    {mapCoords
                      ? `${mapCoords.lat.toFixed(5)}°N  ${Math.abs(mapCoords.lon).toFixed(5)}°W`
                      : `${regions[activeRegionIndex].center[1].toFixed(5)}°N  ${Math.abs(regions[activeRegionIndex].center[0]).toFixed(5)}°W`}
                  </span>
                </div>

                <SirLayer
                  geojson={sirGeo as any}
                  visible={mapLayers.sir}
                  selectedDate={mapSirDate || undefined}
                  onDatesAvailable={() => {}}
                />
                <MlRiskLayer geojson={mlRiskGeo as any} visible={mapLayers.mlrisk} />
                <KdeLayer kdeData={kdeGeo as any} horizon={mapHorizon} visible={mapLayers.kde} />
                <TrajectoryLayer trajectories={trajectoriesGeo as any} visible={mapLayers.trajectories} horizon={mapHorizon} setHorizon={setMapHorizon} />
              </Map>
            </div>

            {/* Controls Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* M4: Guide card */}
              {mapGuideOpen && (
                <div style={{
                  padding: "10px 14px", background: "rgba(207,181,59,0.04)",
                  border: "1px solid rgba(207,181,59,0.15)", borderLeft: `3px solid ${C.gold}`,
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {([
                      ["Riesgo ML",    "Interpolación continua de riesgo — modelo geostadístico sobre NOAA SIR"],
                      ["NOAA SIR",     "Sargazo observado por satélite · navega fechas con el slider"],
                      ["KDE 14d",      "Probabilidad de arribo futuro · ajusta horizonte 12h → 14d"],
                      ["Trayectorias", "Deriva física de 2,000 partículas Lagrangianas (RTOFS + GFS)"],
                    ] as const).map(([cap, desc]) => (
                      <div key={cap} style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 9, color: C.gold, flexShrink: 0, minWidth: 68, fontWeight: "bold" }}>{cap}</span>
                        <span style={{ fontSize: 9, color: C.slate }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setMapGuideOpen(false)}
                    style={{ ...FONT, fontSize: 9, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "2px 8px", cursor: "pointer", outline: "none", flexShrink: 0 }}
                  >
                    Entendido
                  </button>
                </div>
              )}

              {/* Layer controls header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ ...FONT, fontSize: 15, fontWeight: "bold", color: C.frost, margin: "0 0 2px 0" }}>Control de Capas</h3>
                  <p style={{ ...T.bodySm, color: C.smoke, margin: 0, fontSize: 11 }}>Quintana Roo y Yucatán</p>
                </div>
                {!mapGuideOpen && (
                  <button
                    onClick={() => setMapGuideOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 4, ...FONT, fontSize: 9, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 8px", cursor: "pointer", outline: "none" }}
                    title="Ver guía de capas"
                  >
                    <Info size={10} /> Guía
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "mlrisk",      label: "Riesgo ML (Continuo)",    desc: "Malla interpolada geostadística",  color: C.gold     },
                  { id: "sir",         label: "NOAA SIR (Satelital)",    desc: "Observaciones satelitales diarias", color: "#f87171"  },
                  { id: "kde",         label: "Densidad KDE (14d)",      desc: "Probabilidad futura de arribo",    color: "#34d399"  },
                  { id: "trajectories",label: "Trayectorias Lagrangianas",desc: "Simulación de deriva física",     color: "#60a5fa"  },
                ].map(l => (
                  <button
                    key={l.id}
                    onClick={() => toggleMapLayer(l.id)}
                    title={l.desc}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                      background: mapLayers[l.id] ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.15)",
                      border: `1px solid ${mapLayers[l.id] ? l.color : C.border}`,
                      textAlign: "left" as const, cursor: "pointer", transition: "all 0.1s", borderRadius: 0, outline: "none"
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, flexShrink: 0,
                      background: mapLayers[l.id] ? l.color : "transparent",
                      border: `1px solid ${mapLayers[l.id] ? "transparent" : C.slate}`
                    }} />
                    <div>
                      <div style={{ ...FONT, fontSize: 12.5, fontWeight: "bold", color: mapLayers[l.id] ? C.frost : C.ash }}>{l.label}</div>
                      <div style={{ ...T.caption, fontSize: 8.5, color: C.slate, margin: 0 }}>{l.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Date Slider — NOAA SIR */}
              {mapLayers.sir && sirDates && sirDates.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, ...T.caption, fontSize: 9, color: C.slate }}>
                    <span>Fecha NOAA SIR:</span>
                    <span style={{ color: C.gold, fontFamily: "monospace" }}>
                      {mapSirDate
                        ? `${mapSirDate.slice(0,4)}-${mapSirDate.slice(4,6)}-${mapSirDate.slice(6,8)}`
                        : "—"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={sirDates.length - 1}
                    value={sirDates.indexOf(mapSirDate)}
                    onChange={e => setMapSirDate(sirDates[parseInt(e.target.value)])}
                    style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }}
                    title="Navega entre las 315 fechas disponibles de NOAA SIR"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: C.slate, marginTop: 4 }}>
                    <span>{sirDates[0]?.slice(0,4)}-{sirDates[0]?.slice(4,6)}-{sirDates[0]?.slice(6,8)}</span>
                    <span>{sirDates[sirDates.length - 1]?.slice(0,4)}-{sirDates[sirDates.length - 1]?.slice(4,6)}-{sirDates[sirDates.length - 1]?.slice(6,8)}</span>
                  </div>
                </div>
              )}

              {/* Horizon select — KDE / Trajectories */}
              {(mapLayers.kde || mapLayers.trajectories) && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, ...T.caption, fontSize: 9, color: C.slate }}>
                    <span>Horizonte Temporal:</span>
                    <span style={{ color: C.gold, fontFamily: "monospace" }}>{mapHorizon}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                    {(["12h","24h","48h","72h","144h","336h"] as const).map(h => (
                      <button
                        key={h}
                        onClick={() => setMapHorizon(h)}
                        title={h === "12h" ? "Pronóstico 12 horas" : h === "24h" ? "Pronóstico 24 horas" : h === "48h" ? "Pronóstico 48 horas" : h === "72h" ? "Pronóstico 3 días" : h === "144h" ? "Pronóstico 6 días" : "Pronóstico 14 días"}
                        style={{
                          ...FONT, fontSize: 9, padding: "4px 0", border: `1px solid ${mapHorizon === h ? C.gold : "rgba(255,255,255,0.1)"}`,
                          background: mapHorizon === h ? C.gold : "rgba(0,0,0,0.2)",
                          color: mapHorizon === h ? "#000000" : C.ash, cursor: "pointer",
                          textAlign: "center" as const, borderRadius: 0, outline: "none"
                        }}
                      >
                        {h === "144h" ? "6d" : h === "336h" ? "14d" : h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* M5: Geographic bounds of active layers */}
              {Object.values(mapLayers).some(Boolean) && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={11} style={{ color: C.gold }} />
                    <span style={{ ...T.labelGold, fontSize: 8.5 }}>ÁMBITO GEOGRÁFICO</span>
                  </div>
                  {[
                    {
                      id: "mlrisk", label: "Riesgo ML", color: C.gold,
                      rows: [["Zona","17.5–22.0°N · 85.5–90.5°W"],["Resolución","Wendland C2 continua"],["Fuente","NOAA SIR + interpolación ML"]],
                    },
                    {
                      id: "sir", label: "NOAA SIR", color: "#f87171",
                      rows: [["Zona","17.5–22.0°N · 85.5–90.5°W"],["Celda","0.1°×0.1° (~11 km)"],
                        ["Fecha activa", mapSirDate ? `${mapSirDate.slice(0,4)}-${mapSirDate.slice(4,6)}-${mapSirDate.slice(6,8)}` : "—"],
                        ["Histórico","315 fechas (2024–2026)"]],
                    },
                    {
                      id: "kde", label: "KDE Predicción", color: "#34d399",
                      rows: [["Zona","8.0–24.8°N · 55.0–93.0°W"],["Grid","150×100 puntos"],["Horizonte",mapHorizon],["Fuente","RTOFS + GFS corrientes"]],
                    },
                    {
                      id: "trajectories", label: "Trayectorias", color: "#60a5fa",
                      rows: [["Zona","8.0–25.0°N · 55.0–93.0°W"],["Partículas","2,000 Lagrangianas"],["Horizonte",mapHorizon],["Pasos","31 (0h→330h, c/11h)"]],
                    },
                  ].filter(l => mapLayers[l.id]).map(({ label, rows, color }) => (
                    <div key={label}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <div style={{ width: 6, height: 6, background: color, borderRadius: "50%", flexShrink: 0 }} />
                        <span style={{ fontSize: 9, color, fontWeight: "bold" }}>{label}</span>
                      </div>
                      {rows.map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingLeft: 11 }}>
                          <span style={{ fontSize: 8, color: C.slate }}>{k}</span>
                          <span style={{ ...T.mono, fontSize: 8, color: C.ash }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  const renderBrowserSection = () => {
    // M5b: Compute zone-relevant column highlight
    const relevantCols = REGION_RELEVANT_COLS[activeRegionIndex] || []
    const hasRelevantCols = relevantCols.length > 0 &&
      !!(browserData?.columns?.some((c: string) => relevantCols.includes(c)))

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 300, color: C.frost, margin: "0 0 4px 0" }}>Explorador de Datos Regional</h2>
          <p style={{ ...T.bodySm, color: C.ash, margin: 0, fontSize: 13 }}>
            Consulte y busque registros. Los datasets recomendados para <strong>{regions[activeRegionIndex].name}</strong> están marcados con <span style={{ color: C.gold }}>★</span>.
          </p>
        </div>

        <div style={{ background: C.graphite, border: `1px solid ${C.border}`, padding: 20 }}>
          {/* Main workspace layout (3 Columns) */}
          <div style={{ display: "grid", gridTemplateColumns: "250px 1.8fr 1.2fr", gap: 20, alignItems: "start" }}>

            {/* Panel 1: Table Selector List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, fontWeight: "bold", color: C.slate }}>DATASETS Y TABLAS</span>
                {activeRegionIndex !== 0 && (
                  <span style={{ fontSize: 8.5, color: C.gold, border: `1px solid rgba(207,181,59,0.2)`, padding: "1px 4px" }}>
                    Filtro Activo
                  </span>
                )}
              </div>

              <div style={{ maxHeight: "550px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, paddingRight: 4 }}>
                {/* SQLite group */}
                <div style={{ fontSize: 9, color: C.gold, fontWeight: "bold", padding: "6px 4px 2px", letterSpacing: "0.5px" }}>
                  SQLITE RELACIONAL
                </div>
                {dbStats.tables.map((table: any) => {
                  const isRec = isTableRelevantToRegion(table.name);
                  const isSel = activeBrowserTable === table.name;
                  return (
                    <button
                      key={table.name}
                      onClick={() => handleTableChange(table.name)}
                      style={{
                        padding: "8px 10px", textAlign: "left", background: isSel ? "rgba(207,181,59,0.08)" : isRec && activeRegionIndex !== 0 ? "rgba(255,255,255,0.015)" : "transparent",
                        border: `1px solid ${isSel ? C.gold : "transparent"}`, color: isSel ? C.frost : C.ash,
                        cursor: "pointer", transition: "all 0.1s", fontSize: 11.5, ...FONT,
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                      onMouseEnter={e => { if(!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                      onMouseLeave={e => { if(!isSel) e.currentTarget.style.background = isSel ? "rgba(207,181,59,0.08)" : isRec && activeRegionIndex !== 0 ? "rgba(255,255,255,0.015)" : "transparent" }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {table.name}
                      </span>
                      {isRec && activeRegionIndex !== 0 && (
                        <span style={{ color: C.gold, fontSize: 10 }} title="Recomendado para esta región">★</span>
                      )}
                    </button>
                  );
                })}

                {/* Outputs group */}
                <div style={{ fontSize: 9, color: C.gold, fontWeight: "bold", padding: "14px 4px 2px", letterSpacing: "0.5px" }}>
                  ARCHIVOS EN DISCO
                </div>
                {files.outputs?.filter((out: any) => out.name !== "noaa_sir_riesgo_costero_qroo.geojson").map((out: any) => {
                  const isRec = isTableRelevantToRegion(out.name);
                  const isSel = activeBrowserTable === out.name;
                  return (
                    <button
                      key={out.name}
                      onClick={() => handleTableChange(out.name)}
                      style={{
                        padding: "8px 10px", textAlign: "left", background: isSel ? "rgba(207,181,59,0.08)" : isRec && activeRegionIndex !== 0 ? "rgba(255,255,255,0.015)" : "transparent",
                        border: `1px solid ${isSel ? C.gold : "transparent"}`, color: isSel ? C.frost : C.ash,
                        cursor: "pointer", transition: "all 0.1s", fontSize: 11.5, ...FONT,
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                      onMouseEnter={e => { if(!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                      onMouseLeave={e => { if(!isSel) e.currentTarget.style.background = isSel ? "rgba(207,181,59,0.08)" : isRec && activeRegionIndex !== 0 ? "rgba(255,255,255,0.015)" : "transparent" }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                        {out.name.replace(".csv", "").replace(".geojson", "").replace(".json", "")}
                      </span>
                      {isRec && activeRegionIndex !== 0 && (
                        <span style={{ color: C.gold, fontSize: 10 }} title="Recomendado para esta región">★</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel 2: Table Data Viewer */}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Toolbar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                {/* Table name + region badge */}
                <span style={{ ...FONT, fontSize: 12, color: C.frost, fontWeight: "bold", flex: "1 1 auto", minWidth: 120 }}>
                  {activeBrowserTable}
                  {activeRegionIndex !== 0 && (activeBrowserTable === "beach_risk_profiles" || activeBrowserTable === "risk_by_beach.json") && (
                    <span style={{ color: C.gold, fontSize: 10, fontWeight: "normal", marginLeft: 6 }}>
                      ({regions[activeRegionIndex].name})
                    </span>
                  )}
                </span>

                {/* M5d: Zone-relevant columns tip */}
                {hasRelevantCols && (
                  <span style={{ fontSize: 9, color: C.gold, border: "1px solid rgba(207,181,59,0.2)", padding: "2px 8px", background: "rgba(207,181,59,0.04)", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                    Columnas de {regions[activeRegionIndex].name}
                  </span>
                )}

                {/* Date chip — shows active global date filter; use the global bar above to change */}
                {(dateFrom || dateTo) && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", background: "rgba(207,181,59,0.04)", border: "1px solid rgba(207,181,59,0.2)", flexShrink: 0 }}
                    title="Filtro global activo — aplica a todas las secciones. Usa la barra RANGO GLOBAL arriba para cambiarlo."
                  >
                    <span style={{ fontSize: 9, color: C.gold }}>{dateFrom || "inicio"} → {dateTo || "fin"}</span>
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); setSortState(null); setBrowserPage(1); setSemarMonthFilter("") }}
                      style={{ ...FONT, fontSize: 9, color: C.slate, background: "transparent", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                      title="Quitar filtro de fecha"
                    >✕</button>
                  </div>
                )}
                {sortState && !dateFrom && !dateTo && (
                  <button
                    onClick={() => { setSortState(null); setBrowserPage(1) }}
                    title="Limpiar orden"
                    style={{ ...FONT, fontSize: 10, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 7px", cursor: "pointer", outline: "none" }}
                  >✕ orden</button>
                )}

                {/* Search */}
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={browserSearch}
                  onChange={e => setBrowserSearch(e.target.value)}
                  style={{
                    background: C.canvas, border: `1px solid ${C.borderMid}`, color: C.frost,
                    padding: "4px 10px", ...FONT, fontSize: 11, outline: "none", width: 140
                  }}
                />

                {/* CSV Export */}
                <a
                  href={`/api/download/table/${activeBrowserTable}?export=true${dateFrom ? `&date_from=${encodeURIComponent(dateFrom)}` : ""}${dateTo ? `&date_to=${encodeURIComponent(dateTo)}` : ""}${sortState ? `&sort_col=${encodeURIComponent(sortState.col)}&sort_dir=${sortState.dir}` : ""}`}
                  download
                  title="Descargar CSV filtrado"
                  style={{ display: "flex", alignItems: "center", gap: 4, color: C.gold, fontSize: 10, ...FONT, border: `1px solid ${C.border}`, padding: "4px 8px", textDecoration: "none" }}
                >
                  <Download size={11} /> CSV
                </a>
              </div>

              {/* Mini chart (M2) */}
              {(() => {
                const cfg = CHART_CONFIG[activeBrowserTable]
                if (!cfg) return null
                if (chartLoading) return (
                  <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}`, marginBottom: 8, background: C.canvas }}>
                    <Loader2 className="animate-spin" size={18} style={{ color: C.gold }} />
                  </div>
                )
                if (!chartData || chartData.length === 0) return null

                const W = 800, H = 120
                const keys = cfg.keys.filter(k => chartData.some(r => r[k] != null && r[k] !== ""))

                // Find date key for x-axis labels
                const DATE_COLS = ["fecha", "date", "month"]
                const dateKey = DATE_COLS.find(k => chartData[0]?.[k] != null) || null

                // Convert values to numbers
                const numData = chartData.map(r => {
                  const o: Record<string, number> = {}
                  keys.forEach(k => { o[k] = parseFloat(r[k]) || 0 })
                  return o
                })

                if (cfg.type === "area-stacked") {
                  // Stacked area: compute cumulative per row
                  const maxTotal = Math.max(...numData.map(r => keys.reduce((s, k) => s + (r[k] || 0), 0)), 1)
                  const pad = { l: 8, r: 8, t: 8, b: 8 }
                  const xStep = (W - pad.l - pad.r) / Math.max(numData.length - 1, 1)
                  const yScale = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / maxTotal)

                  // Build stacked paths
                  const paths = keys.map((k, ki) => {
                    const topPoints = numData.map((r, i) => {
                      const cumTop = keys.slice(0, ki + 1).reduce((s, kk) => s + (r[kk] || 0), 0)
                      return [pad.l + i * xStep, yScale(cumTop)] as [number, number]
                    })
                    const botPoints = numData.map((r, i) => {
                      const cumBot = ki === 0 ? 0 : keys.slice(0, ki).reduce((s, kk) => s + (r[kk] || 0), 0)
                      return [pad.l + i * xStep, yScale(cumBot)] as [number, number]
                    })
                    const d = `M ${topPoints[0][0]},${topPoints[0][1]} ` +
                      topPoints.slice(1).map(([x, y]) => `L ${x},${y}`).join(" ") + " " +
                      botPoints.slice().reverse().map(([x, y]) => `L ${x},${y}`).join(" ") + " Z"
                    return { d, color: cfg.colors[ki] }
                  })

                  return (
                    <div style={{ border: `1px solid ${C.border}`, marginBottom: 8, background: C.canvas, padding: "6px 4px 2px" }}>
                      <div style={{ fontSize: 9, color: C.slate, marginBottom: 4, paddingLeft: 8, display: "flex", gap: 12, alignItems: "center" }}>
                        {keys.map((k, i) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 2, background: cfg.colors[i], display: "inline-block" }} />{k}</span>)}
                      </div>
                      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 100, display: "block" }}>
                        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity={0.7} />)}
                      </svg>
                    </div>
                  )
                }

                if (cfg.type === "bar") {
                  const k0 = keys[0]
                  const maxV = Math.max(...numData.map(r => r[k0] || 0), 1)
                  const pad = { l: 8, r: 8, t: 8, b: 8 }
                  const barW = Math.max(1, (W - pad.l - pad.r) / numData.length - 1)
                  const yScale = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / maxV)
                  return (
                    <div style={{ border: `1px solid ${C.border}`, marginBottom: 8, background: C.canvas, padding: "6px 4px 2px" }}>
                      <div style={{ fontSize: 9, color: C.slate, marginBottom: 4, paddingLeft: 8 }}>{k0}</div>
                      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 100, display: "block" }}>
                        {numData.map((r, i) => {
                          const x = pad.l + i * ((W - pad.l - pad.r) / numData.length)
                          const y = yScale(r[k0])
                          return <rect key={i} x={x} y={y} width={barW} height={H - pad.b - y} fill={cfg.colors[0]} opacity={0.8} />
                        })}
                      </svg>
                    </div>
                  )
                }

                // Line chart
                const maxV = Math.max(...keys.flatMap(k => numData.map(r => r[k] || 0)), 1)
                const minV = Math.min(...keys.flatMap(k => numData.map(r => r[k] || 0)), 0)
                const range = maxV - minV || 1
                const pad = { l: 8, r: 8, t: 8, b: 8 }
                const xStep = (W - pad.l - pad.r) / Math.max(numData.length - 1, 1)
                const yScale = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - minV) / range)

                return (
                  <div style={{ border: `1px solid ${C.border}`, marginBottom: 8, background: C.canvas, padding: "6px 4px 2px" }}>
                    <div style={{ fontSize: 9, color: C.slate, marginBottom: 4, paddingLeft: 8, display: "flex", gap: 12, alignItems: "center" }}>
                      {keys.map((k, i) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 2, background: cfg.colors[i], display: "inline-block" }} />{k}</span>)}
                      {dateKey && chartData.length > 1 && (
                        <span style={{ marginLeft: "auto", paddingRight: 8 }}>
                          {String(chartData[0]?.[dateKey] || "").substring(0, 7)} – {String(chartData[chartData.length - 1]?.[dateKey] || "").substring(0, 7)}
                        </span>
                      )}
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 100, display: "block" }}>
                      {/* Grid lines */}
                      {[0, 0.5, 1].map(t => {
                        const y = pad.t + (H - pad.t - pad.b) * t
                        return <line key={t} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke={C.border} strokeWidth="0.5" />
                      })}
                      {keys.map((k, ki) => {
                        const pts = numData.map((r, i) => `${pad.l + i * xStep},${yScale(r[k])}`).join(" ")
                        // Area fill
                        const firstX = pad.l, lastX = pad.l + (numData.length - 1) * xStep
                        const baseline = yScale(Math.max(minV, 0))
                        const areaD = `M ${firstX},${baseline} L ${numData.map((r, i) => `${pad.l + i * xStep},${yScale(r[k])}`).join(" L ")} L ${lastX},${baseline} Z`
                        return (
                          <g key={k}>
                            <path d={areaD} fill={cfg.colors[ki]} opacity={0.12} />
                            <polyline points={pts} fill="none" stroke={cfg.colors[ki]} strokeWidth="1.5" />
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                )
              })()}

              {/* Data Grid */}
              <div style={{ minHeight: 400, border: `1px solid ${C.border}`, background: C.canvas, overflow: "auto" }}>
                {browserLoading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
                    <Loader2 className="animate-spin" size={28} style={{ color: C.gold }} />
                    <span style={{ ...T.label, color: C.slate }}>Cargando datos...</span>
                  </div>
                )}

                {browserError && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16, color: "#ef4444" }}>
                    <AlertTriangle size={36} />
                    <span>{browserError}</span>
                    <button onClick={() => handleTableChange(activeBrowserTable)} style={{ ...FONT, background: C.gold, border: "none", color: "#000000", padding: "8px 16px", cursor: "pointer", fontSize: 11, textTransform: "uppercase" }}>
                      Reintentar
                    </button>
                  </div>
                )}

                {!browserLoading && !browserError && browserData && (
                  <div>
                    {currentDisplayRows.length === 0 ? (
                      <div style={{ padding: "80px 40px", textAlign: "center", color: C.slate, ...T.bodySm }}>
                        {activeRegionIndex === 2 && (activeBrowserTable === "beach_risk_profiles" || activeBrowserTable === "risk_by_beach.json") ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", maxWidth: 360, margin: "0 auto" }}>
                            <Info size={24} style={{ color: C.gold }} />
                            <span>Esta región de Yucatán Costa Norte se monitorea vía celdas satelitales y deriva lagrangiana en el mapa. No cuenta con perfiles de playa específicos en este dataset.</span>
                          </div>
                        ) : (
                          "No se encontraron registros."
                        )}
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", ...T.mono, fontSize: 11, textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.border}` }}>
                            {browserData.columns?.map((col: string) => (
                              <th
                                key={col}
                                onClick={() => {
                                  setSortState(prev =>
                                    prev?.col === col
                                      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
                                      : { col, dir: "asc" }
                                  )
                                  setBrowserPage(1)
                                }}
                                style={{ padding: "10px 14px", color: sortState?.col === col || relevantCols.includes(col) ? C.gold : C.smoke, borderRight: `1px solid ${C.border}`, fontWeight: "bold", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: relevantCols.includes(col) ? "rgba(207,181,59,0.07)" : "transparent", borderBottom: relevantCols.includes(col) ? "2px solid rgba(207,181,59,0.4)" : undefined }}
                                title={`Ordenar por ${col}`}
                              >
                                {col}{sortState?.col === col ? (sortState.dir === "asc" ? " ↑" : " ↓") : ""}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentDisplayRows.map((row: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: idx < currentDisplayRows.length - 1 ? `1px solid ${C.border}` : "none", background: idx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                              {browserData.columns?.map((col: string) => {
                                const val = row[col];
                                if (col === "archivo" && val && String(val).endsWith(".pdf")) {
                                  const fname = String(val);
                                  const p = parseSemarFileName(fname);
                                  return (
                                    <td key={col} style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <a href={`/api/download/file/semar/${fname}`} download style={{ color: C.gold, textDecoration: "none", fontWeight: "bold" }}>
                                          {fname}
                                        </a>
                                        <button
                                          onClick={() => setSelectedBulletin({ name: fname, num: p.num, year: p.year })}
                                          style={{
                                            background: "transparent", border: `1px solid ${C.borderMid}`, color: C.frost,
                                            padding: "2px 6px", cursor: "pointer", fontSize: 9.5, display: "inline-flex", alignItems: "center", gap: 4,
                                            borderRadius: 0, outline: "none"
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                                          onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMid}
                                        >
                                          <Eye size={10} style={{ color: C.gold }} /> Imágenes
                                        </button>
                                      </div>
                                    </td>
                                  );
                                }
                                let displayVal = String(val === null ? "NULL" : val);
                                if (displayVal.length > 80) displayVal = displayVal.substring(0, 77) + "...";
                                return (
                                  <td
                                    key={col}
                                    onClick={() => {
                                      navigator.clipboard.writeText(String(val ?? "")).catch(() => {})
                                      setCopyToast(true)
                                      setTimeout(() => setCopyToast(false), 1500)
                                    }}
                                    style={{ padding: "10px 14px", color: val === null ? C.slate : C.ash, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px", cursor: "copy" }}
                                    title={`${String(val)} — clic para copiar`}
                                  >
                                    {displayVal}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {!browserLoading && !browserError && browserData && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, ...T.caption, fontSize: 10, color: C.slate }}>
                  <div>
                    Mostrando <span style={{ color: C.frost }}>{((browserPage - 1) * 15) + 1}</span> a <span style={{ color: C.frost }}>{Math.min(browserPage * 15, currentDisplayCount)}</span> de <span style={{ color: C.gold }}>{currentDisplayCount.toLocaleString("es-MX")}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      disabled={browserPage === 1}
                      onClick={() => setBrowserPage(p => Math.max(1, p - 1))}
                      style={{
                        background: "transparent", border: `1px solid ${C.borderMid}`, color: browserPage === 1 ? C.slate : C.frost,
                        padding: "4px 10px", cursor: browserPage === 1 ? "not-allowed" : "pointer", opacity: browserPage === 1 ? 0.4 : 1,
                        borderRadius: 0, outline: "none"
                      }}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span style={{ display: "flex", alignItems: "center", padding: "0 6px" }}>Pág. {browserPage} de {totalPages}</span>
                    <button
                      disabled={browserPage >= totalPages}
                      onClick={() => setBrowserPage(p => Math.min(totalPages, p + 1))}
                      style={{
                        background: "transparent", border: `1px solid ${C.borderMid}`, color: browserPage >= totalPages ? C.slate : C.frost,
                        padding: "4px 10px", cursor: browserPage >= totalPages ? "not-allowed" : "pointer", opacity: browserPage >= totalPages ? 0.4 : 1,
                        borderRadius: 0, outline: "none"
                      }}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Panel 3: Metadata Card */}
            <div style={{ background: "rgba(255,255,255,0.01)", border: `1px solid ${C.border}`, padding: 16, height: "fit-content" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ ...T.labelGold, fontSize: 9 }}>Detalles del Dataset</span>

                {/* Download complete dataset button if it is a file */}
                {files.outputs?.some((out: any) => out.name === activeBrowserTable) ? (
                  <a
                    href={`/api/download/file/output/${activeBrowserTable}`}
                    download
                    title="Descargar archivo completo"
                    style={{ color: C.gold, cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Download size={14} />
                  </a>
                ) : (
                  <span style={{ fontSize: 8.5, color: C.slate, border: `1px solid ${C.border}`, padding: "1px 4px" }}>
                    SQLite
                  </span>
                )}
              </div>

              <h3 style={{ ...FONT, fontSize: 14.5, fontWeight: "bold", color: C.frost, margin: "0 0 8px 0" }}>
                {TABLE_EXPLANATIONS[activeBrowserTable]?.title || activeBrowserTable}
              </h3>
              <p style={{ ...T.bodySm, color: C.ash, margin: "0 0 14px 0", lineHeight: 1.4, fontSize: 11.5 }}>
                {TABLE_EXPLANATIONS[activeBrowserTable]?.desc}
              </p>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 12 }}>
                <span style={{ ...T.caption, color: C.slate, fontSize: 8.5, display: "block", marginBottom: 4 }}>Rol en el Modelo</span>
                <p style={{ ...T.bodySm, color: C.smoke, margin: 0, fontStyle: "italic", lineHeight: 1.3, fontSize: 11.5 }}>
                  {TABLE_EXPLANATIONS[activeBrowserTable]?.role}
                </p>
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <span style={{ ...T.caption, color: C.slate, fontSize: 8.5, display: "block", marginBottom: 6 }}>Columnas Clave</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                  {TABLE_EXPLANATIONS[activeBrowserTable] && Object.entries(TABLE_EXPLANATIONS[activeBrowserTable].columns).map(([colName, colDesc]) => (
                    <div key={colName} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ ...T.mono, fontSize: 10, color: C.gold, fontWeight: "bold" }}>{colName}</span>
                      <span style={{ fontSize: 11, color: C.smoke, lineHeight: 1.25 }}>{colDesc as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  const renderPipelineSection = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 300, color: C.frost, margin: "0 0 6px 0" }}>Orquestación y Sincronización</h2>
          <p style={{ ...T.bodySm, color: C.ash, margin: 0, fontSize: 13 }}>Administre la recolección y actualización de datos satelitales de NOAA y boletines oficiales de SEMAR.</p>
        </div>

        {/* Status card */}
        <div style={{ background: "rgba(34,197,94,0.03)", border: "1px solid rgba(34,197,94,0.2)", padding: 24, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 500px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <CheckCircle2 size={20} style={{ color: "#22c55e" }} />
              <span style={{ fontSize: 18, fontWeight: "bold", color: C.frost }}>Datos Locales Operativos</span>
            </div>
            <p style={{ ...T.bodySm, color: C.ash, margin: 0, lineHeight: 1.6 }}>
              Todos los históricos y predicciones se almacenan y ejecutan de manera local. Esto permite que el sistema funcione a alta velocidad sin recurrir a llamadas externas repetitivas.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, ...T.caption, fontSize: 10, color: C.slate }}>
              <div>BD SQLITE: <span style={{ color: C.gold }}>{formatBytes(dbStats.size_bytes)}</span></div>
              <div>ÚLTIMA MODIFICACIÓN: <span style={{ color: C.gold }}>{formatDate(dbStats.last_modified)}</span></div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button
              onClick={handleRunPipeline}
              disabled={triggering || pipeline.status === "running"}
              style={{
                ...FONT,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 11,
                letterSpacing: "0.48px",
                textTransform: "uppercase",
                color: (triggering || pipeline.status === "running") ? C.slate : "#000000",
                border: "none",
                borderRadius: 0,
                padding: "12px 22px",
                background: (triggering || pipeline.status === "running") ? "rgba(255,255,255,0.05)" : C.gold,
                cursor: (triggering || pipeline.status === "running") ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                outline: "none"
              }}
            >
              {(triggering || pipeline.status === "running") ? (
                <>
                  <RefreshCw className="animate-spin" size={12} />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  Actualizar Servidor
                </>
              )}
            </button>
            {pipeline.status === "running" && (
              <span style={{ ...T.caption, fontSize: 9, color: C.gold }}>Progreso: {progressPercent}%</span>
            )}
          </div>
        </div>

        {pipeline.status === "running" && (
          <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.05)", marginTop: -12 }}>
            <div style={{ width: `${progressPercent}%`, height: "100%", background: C.gold, transition: "width 0.3s" }} />
          </div>
        )}

        {/* Steps chronological timeline stepper */}
        <div style={{ background: C.carbon, border: `1px solid ${C.border}`, padding: 24 }}>
          <h3 style={{ ...FONT, fontSize: 16, fontWeight: "bold", color: C.frost, margin: "0 0 20px 0" }}>Flujo Cronológico y Estado del Pipeline</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {/* Vertical connector line */}
            <div style={{ position: "absolute", top: 12, bottom: 12, left: 19, width: 2, background: C.borderMid, zIndex: 0 }} />

            {stepsKeys.map((k, idx) => {
              const status = stepStatuses[k] || "pending";
              const label = stepLabels[k];

              // Pipeline step to corresponding dataset map
              const stepDatasets: Record<string, string> = {
                noaa_sir: "noaa_sir_resumen_diario.csv",
                semar_download: "boletines_sargazo_MASTER.csv",
                semar_extract: "boletines_sargazo_MASTER.csv",
                combine: "sargazo_combinado_2000_2026.csv",
                features: "features_fuente.csv",
                predict_phase0: "model_predictions",
                predict_phase1: "model_predictions",
                confidence: "model_predictions",
                ml_risk: "noaa_sir_riesgo_ml_corregido.geojson",
                beach_risk: "beach_risk_profiles",
                trajectory_forecast: "forecast_7d_trayectorias.csv"
              };

              const targetDataset = stepDatasets[k];

              return (
                <div key={k} style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  padding: "16px 0", position: "relative", zIndex: 1
                }}>
                  {/* Circle number / status icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: status === "ok" ? "rgba(34,197,94,0.1)" : status === "running" ? "rgba(207,181,59,0.1)" : status === "error" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${status === "ok" ? "#22c55e" : status === "running" ? C.gold : status === "error" ? "#ef4444" : C.borderMid}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {status === "ok" && <Check size={16} style={{ color: "#22c55e" }} />}
                    {status === "running" && <Loader2 className="animate-spin" size={16} style={{ color: C.gold }} />}
                    {status === "error" && <AlertTriangle size={16} style={{ color: "#ef4444" }} />}
                    {status === "pending" && <span style={{ fontSize: 12, color: C.slate, fontWeight: "bold" }}>{idx + 1}</span>}
                  </div>

                  {/* Stepper info card */}
                  <div style={{
                    flex: 1, background: "rgba(255,255,255,0.01)", border: `1px solid ${C.border}`,
                    padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: "bold", color: C.frost, display: "block" }}>{label}</span>
                      <span style={{ fontSize: 9.5, color: C.slate, textTransform: "uppercase", display: "block", marginTop: 4 }}>ID: {k}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{
                        fontSize: 11, fontWeight: "bold",
                        color: status === "ok" ? "#22c55e" : status === "running" ? C.gold : status === "error" ? "#ef4444" : C.slate
                      }}>
                        {status === "ok" ? "Completado" : status === "running" ? "Procesando..." : status === "error" ? "Error" : "Pendiente"}
                      </span>

                      {targetDataset && (
                        <button
                          onClick={() => {
                            handleTableChange(targetDataset);
                            setActiveSubTab("browser");
                          }}
                          style={{
                            ...FONT, background: "transparent", border: `1px solid ${C.borderMid}`, color: C.gold,
                            fontSize: 10, padding: "6px 12px", cursor: "pointer", textTransform: "uppercase",
                            borderRadius: 0, outline: "none", display: "inline-flex", alignItems: "center", gap: 4
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMid; }}
                        >
                          <Eye size={10} /> Ver Datos
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )
  }

  
  const renderGalleryModal = () => {
    if (!selectedBulletin) return null;
    
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24
      }}>
        <div style={{
          width: "100%", maxWidth: 1100, height: "85vh",
          background: C.carbon, border: `1px solid ${C.gold}`,
          display: "flex", flexDirection: "column", position: "relative"
        }}>
          {/* Close button */}
          <button
            onClick={() => setSelectedBulletin(null)}
            style={{
              position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.5)",
              border: `1px solid ${C.borderMid}`, color: C.frost, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              borderRadius: 0, outline: "none", zIndex: 10
            }}
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ ...T.labelGold, fontSize: 10, display: "block", marginBottom: 2 }}>DOCUMENTO FUENTE OFICIAL (SEMAR)</span>
              <h3 style={{ fontSize: 16, fontWeight: "bold", color: C.frost, margin: 0 }}>
                Boletín Nº {selectedBulletin.num} ({selectedBulletin.year})
              </h3>
            </div>
            <div style={{ marginRight: 32 }}>
              <a
                href={`/api/download/file/semar/${selectedBulletin.name}`}
                download
                style={{
                  ...FONT, textDecoration: "none", color: "#000000", background: C.gold,
                  fontSize: 10, padding: "8px 14px", fontWeight: "bold",
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer"
                }}
              >
                <Download size={12} /> Descargar PDF Original
              </a>
            </div>
          </div>

          {/* Tabs Bar */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: "#0a0a0a", paddingLeft: 12 }}>
            {[
              { id: "images", label: "Imágenes y Mapas", icon: <Globe size={13} /> },
              { id: "text", label: "Texto Extraído (OCR)", icon: <FileText size={13} /> },
              { id: "tables", label: "Tablas Procesadas", icon: <Database size={13} /> }
            ].map(tab => {
              const isActive = galleryTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setGalleryTab(tab.id as any)}
                  style={{
                    padding: "12px 18px",
                    background: isActive ? "rgba(207,181,59,0.05)" : "transparent",
                    border: "none",
                    borderBottom: `2px solid ${isActive ? C.gold : "transparent"}`,
                    color: isActive ? C.gold : C.ash,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: isActive ? "bold" : "normal",
                    ...FONT,
                    outline: "none"
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            {galleryTab === "images" && (
              <>
                {/* Thumbnails Sidebar */}
                <div style={{ width: 180, borderRight: `1px solid ${C.border}`, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "rgba(0,0,0,0.2)" }}>
                  <span style={{ fontSize: 9, color: C.slate, fontWeight: "bold", letterSpacing: "0.5px" }}>VISTAS EXTRAÍDAS</span>
                  {imagesLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                      <Loader2 className="animate-spin" size={20} style={{ color: C.gold }} />
                    </div>
                  ) : bulletinImages.length === 0 ? (
                    <span style={{ fontSize: 10, color: C.slate, fontStyle: "italic" }}>No hay imágenes procesadas para este boletín.</span>
                  ) : (
                    bulletinImages.map((imgName, idx) => {
                      const isPage = imgName.startsWith("page_") && !imgName.includes("_fig_");
                      const label = isPage ? `Página ${imgName.split("_")[1].replace(".png", "")}` : `Mapa / Fig ${imgName.split("_")[3].replace(".png", "")}`;
                      const isSel = activeImgIdx === idx;
                      return (
                        <button
                          key={imgName}
                          onClick={() => setActiveImgIdx(idx)}
                          style={{
                            padding: "6px 8px", background: isSel ? "rgba(207,181,59,0.08)" : "transparent",
                            border: `1px solid ${isSel ? C.gold : C.border}`, color: isSel ? C.gold : C.ash,
                            textAlign: "left", cursor: "pointer", fontSize: 10.5, ...FONT, borderRadius: 0, outline: "none",
                            display: "flex", flexDirection: "column", gap: 4
                          }}
                        >
                          <span style={{ fontWeight: isSel ? "bold" : "normal" }}>{label}</span>
                          <span style={{ fontSize: 8, color: C.slate }}>{isPage ? "Escaneo completo" : "Recorte figura"}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Main Preview Area */}
                <div style={{ flex: 1, background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
                  {imagesLoading ? (
                    <Loader2 className="animate-spin" size={36} style={{ color: C.gold }} />
                  ) : bulletinImages.length > 0 ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 0 }}>
                        <img
                          src={`/api/download/boletin-image/${selectedBulletin.year}/${selectedBulletin.num}/${bulletinImages[activeImgIdx]}`}
                          alt={bulletinImages[activeImgIdx]}
                          style={{
                            maxHeight: "100%", maxWidth: "100%", objectFit: "contain",
                            border: `1px solid ${C.borderMid}`, boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
                          }}
                        />
                      </div>
                      
                      {/* Image details & arrows */}
                      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                        {/* Prev button */}
                        <button
                          disabled={activeImgIdx === 0}
                          onClick={() => setActiveImgIdx(prev => Math.max(0, prev - 1))}
                          style={{
                            background: "transparent", border: `1px solid ${C.borderMid}`, color: activeImgIdx === 0 ? C.slate : C.frost,
                            padding: "6px 12px", cursor: activeImgIdx === 0 ? "not-allowed" : "pointer", opacity: activeImgIdx === 0 ? 0.3 : 1
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 11, color: C.ash, fontFamily: "monospace" }}>{bulletinImages[activeImgIdx]}</span>
                          <span style={{ fontSize: 9, color: C.slate, display: "block", marginTop: 2 }}>
                            IMAGEN {activeImgIdx + 1} DE {bulletinImages.length}
                          </span>
                        </div>

                        {/* Next button */}
                        <button
                          disabled={activeImgIdx >= bulletinImages.length - 1}
                          onClick={() => setActiveImgIdx(prev => Math.min(bulletinImages.length - 1, prev + 1))}
                          style={{
                            background: "transparent", border: `1px solid ${C.borderMid}`, color: activeImgIdx >= bulletinImages.length - 1 ? C.slate : C.frost,
                            padding: "6px 12px", cursor: activeImgIdx >= bulletinImages.length - 1 ? "not-allowed" : "pointer", opacity: activeImgIdx >= bulletinImages.length - 1 ? 0.3 : 1
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: C.slate }}>
                      <FileText size={48} />
                      <span>No se encontraron imágenes extraídas para este boletín.</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {galleryTab === "text" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, overflow: "hidden", background: "#050505", gap: 10 }}>
                {/* OCR search bar */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Buscar en texto OCR..."
                    value={ocrSearch}
                    onChange={e => setOcrSearch(e.target.value)}
                    style={{ flex: 1, background: C.canvas, border: `1px solid ${C.borderMid}`, color: C.frost, padding: "5px 10px", ...FONT, fontSize: 11, outline: "none", colorScheme: "dark" }}
                  />
                  {ocrSearch && (
                    <button onClick={() => setOcrSearch("")} style={{ ...FONT, fontSize: 10, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 8px", cursor: "pointer", outline: "none" }}>✕</button>
                  )}
                  {ocrSearch && bulletinText && (
                    <span style={{ fontSize: 10, color: C.slate }}>
                      {(() => {
                        const re = new RegExp(ocrSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
                        return (bulletinText.match(re) || []).length
                      })()} coincidencias
                    </span>
                  )}
                </div>
                {textLoading ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 className="animate-spin" size={32} style={{ color: C.gold }} />
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${C.border}`, background: "#0a0a0a", padding: 16 }}>
                    <pre style={{ ...FONT, fontSize: 13, lineHeight: "1.6", color: C.frost, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "monospace" }}>
                      {ocrSearch && bulletinText
                        ? (() => {
                            const re = new RegExp(`(${ocrSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
                            const parts = bulletinText.split(re)
                            return parts.map((part, i) =>
                              re.test(part)
                                ? <mark key={i} style={{ background: "#cfb53b", color: "#000", padding: "0 1px" }}>{part}</mark>
                                : part
                            )
                          })()
                        : bulletinText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {galleryTab === "tables" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, overflowY: "auto", background: "#050505", gap: 24 }}>
                {tablesLoading ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 className="animate-spin" size={32} style={{ color: C.gold }} />
                  </div>
                ) : bulletinTables && Object.keys(bulletinTables).length > 0 ? (
                  Object.keys(bulletinTables).map(pageKey => {
                    const pageTbls = bulletinTables[pageKey];
                    return (
                      <div key={pageKey} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <span style={{ fontSize: 11, color: C.gold, fontWeight: "bold", ...FONT, letterSpacing: "1px" }}>TABLAS PÁGINA {pageKey}</span>
                        {pageTbls.map((tbl: string[][], tblIdx: number) => (
                          <div key={tblIdx} style={{ overflowX: "auto", border: `1px solid ${C.border}`, background: "#0a0a0a" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", ...FONT, fontSize: 12, textAlign: "left" }}>
                              <tbody>
                                {tbl.map((row: string[], rowIdx: number) => {
                                  const isEmptyRow = row.every(cell => !cell || cell.trim() === "");
                                  if (isEmptyRow) return null;
                                  
                                  const isHeader = rowIdx === 0;
                                  return (
                                    <tr key={rowIdx} style={{ borderBottom: `1px solid ${C.border}`, background: rowIdx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                                      {row.map((cell: string, cellIdx: number) => {
                                        return (
                                          <td
                                            key={cellIdx}
                                            style={{
                                              padding: "10px 14px",
                                              borderRight: `1px solid ${C.border}`,
                                              color: isHeader ? C.gold : C.ash,
                                              fontWeight: isHeader ? "bold" : "normal",
                                              background: isHeader ? "rgba(207,181,59,0.03)" : "transparent"
                                            }}
                                          >
                                            {cell || "-"}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.slate, gap: 12 }}>
                    <Database size={48} />
                    <span>No se encontraron tablas estructuradas para este boletín.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


const renderCronologiaSection = () => {
    const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    const DAY_NAMES = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]

    const [cyear, cmonth] = cronoMonth.split("-").map(Number)
    const firstDay = new Date(cyear, cmonth - 1, 1)
    const offset = (firstDay.getDay() + 6) % 7  // Monday = 0
    const daysInMonth = new Date(cyear, cmonth, 0).getDate()
    const cells: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ]

    const prevMonth = () => {
      const d = new Date(cyear, cmonth - 2, 1)
      setCronoMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
      setCronoSelectedDay(null)
    }
    const nextMonth = () => {
      const d = new Date(cyear, cmonth, 1)
      setCronoMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
      setCronoSelectedDay(null)
    }

    const semColor = (s: string) => {
      if (!s) return C.slate
      const u = s.toUpperCase()
      if (u.includes("CRÍT") || u.includes("CRIT")) return "#ef4444"
      if (u.includes("ALTO")) return "#f97316"
      if (u.includes("NORMAL") || u.includes("MODERADO")) return "#eab308"
      return "#22c55e"
    }

    // Find SEMAR bulletin for a given date string YYYY-MM-DD
    const semarForDate = (dateStr: string) =>
      Object.entries(boletinDates).find(([_, bd]) => bd.fecha === dateStr)?.[0] || null

    const selectedRisk = cronoSelectedDay ? noaaDailyRisk[cronoSelectedDay] : null
    const selectedDateStr = cronoSelectedDay
      ? `${cronoSelectedDay.slice(0,4)}-${cronoSelectedDay.slice(4,6)}-${cronoSelectedDay.slice(6,8)}`
      : null
    const selectedBuletinNum = selectedDateStr ? semarForDate(selectedDateStr) : null
    const selectedBoletinInfo = selectedBuletinNum ? boletinDates[selectedBuletinNum] : null

    // Month availability summary
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return `${cyear}${String(cmonth).padStart(2,"0")}${String(d).padStart(2,"0")}`
    })
    const noaaDaysCount = monthDays.filter(k => noaaDailyRisk[k]).length
    const semarDaysCount = monthDays.filter(k => {
      const ds = `${k.slice(0,4)}-${k.slice(4,6)}-${k.slice(6,8)}`
      return semarForDate(ds) !== null
    }).length

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Calendar size={18} style={{ color: C.gold }} />
              <h2 style={{ ...FONT, fontSize: 20, fontWeight: "bold", color: C.frost, margin: 0 }}>Cronología de Datos</h2>
            </div>
            <p style={{ ...T.bodySm, color: C.slate, margin: 0 }}>
              {cronoView === "calendar"
                ? "Vista temporal correlacionada: NOAA SIR + Boletines SEMAR por fecha."
                : "Validación del modelo predictivo contra datos históricos reales de SEMAR."}
            </p>
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
            {([
              ["calendar", "Calendario", Calendar],
              ["backtest", "Backtesting", BarChart3],
            ] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setCronoView(v)}
                style={{
                  ...FONT, fontSize: 10, padding: "5px 12px", cursor: "pointer", outline: "none", borderRadius: 0,
                  background: cronoView === v ? C.gold : "transparent",
                  color: cronoView === v ? "#000" : C.slate,
                  border: `1px solid ${cronoView === v ? C.gold : C.border}`,
                  fontWeight: cronoView === v ? "bold" : "normal",
                  marginLeft: v === "calendar" ? 0 : -1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              ><Icon size={12} />{label}</button>
            ))}
          </div>
        </div>

        {/* M2c: Zone context chip */}
        {activeRegionIndex !== 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: C.gold, border: "1px solid rgba(207,181,59,0.25)", padding: "2px 10px", background: "rgba(207,181,59,0.04)" }}>
              ZONA: {regions[activeRegionIndex].name}
            </span>
            <span style={{ fontSize: 9, color: C.slate }}>— NOAA global · SEMAR con biomasa CM disponible</span>
          </div>
        )}

        {/* Calendar view */}
        {cronoView === "calendar" && <>
        {/* M7: Hint card for first-time users */}
        {!cronoHintDismissed && !cronoSelectedDay && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "rgba(207,181,59,0.04)", border: "1px solid rgba(207,181,59,0.15)", borderLeft: `3px solid ${C.gold}` }}>
            <span style={{ fontSize: 11, color: C.ash }}>
              Haz clic en cualquier día del calendario para ver los datos de NOAA y SEMAR de esa fecha.
            </span>
            <button
              onClick={() => setCronoHintDismissed(true)}
              style={{ ...FONT, fontSize: 9.5, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 8px", cursor: "pointer", outline: "none", marginLeft: 16, flexShrink: 0 }}
            >
              Entendido
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 20, alignItems: "start" }}>

          {/* Calendar */}
          <div style={{ flex: 1, background: C.carbon, border: `1px solid ${C.border}` }}>
            {/* Month nav */}
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={prevMonth} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.slate, display: "flex", alignItems: "center", padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = C.frost)} onMouseLeave={e => (e.currentTarget.style.color = C.slate)}>
                <ChevronLeft size={18} />
              </button>
              <div style={{ textAlign: "center" as const }}>
                <div style={{ ...FONT, fontSize: 15, fontWeight: "bold", color: C.frost }}>
                  {MONTH_NAMES_ES[cmonth - 1]} {cyear}
                </div>
                <div style={{ fontSize: 9.5, color: C.slate, marginTop: 2 }}>
                  NOAA: {noaaDaysCount}/{daysInMonth} días · SEMAR: {semarDaysCount} boletines
                </div>
              </div>
              <button onClick={nextMonth} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.slate, display: "flex", alignItems: "center", padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = C.frost)} onMouseLeave={e => (e.currentTarget.style.color = C.slate)}>
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "8px 12px 0" }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{ textAlign: "center" as const, fontSize: 9.5, color: C.slate, padding: "4px 0", fontWeight: "bold" }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "4px 12px 16px" }}>
              {cells.map((d, idx) => {
                if (d === null) return <div key={`e-${idx}`} />
                const dateKey = `${cyear}${String(cmonth).padStart(2,"0")}${String(d).padStart(2,"0")}`
                const dateStr = `${cyear}-${String(cmonth).padStart(2,"0")}-${String(d).padStart(2,"0")}`
                const risk = noaaDailyRisk[dateKey]
                const semNum = semarForDate(dateStr)
                const semInfo = semNum ? boletinDates[semNum] : null
                const isSelected = cronoSelectedDay === dateKey
                const hasAnyData = !!risk || !!semNum

                // M2b: Check if this day is within the global date range
                const isInRange = (() => {
                  if (d === null) return false
                  const dateFromISO = dateFrom ? dateFrom + "-01" : null
                  const dateToISO = dateTo ? dateTo + "-31" : null
                  if (!dateFromISO && !dateToISO) return false
                  return (!dateFromISO || dateStr >= dateFromISO) && (!dateToISO || dateStr <= dateToISO)
                })()

                const riskColor = risk
                  ? risk.high > 0 ? "#ef4444"
                    : risk.medium > 0 ? "#f97316"
                    : risk.warning > 0 ? "#eab308"
                    : "#22c55e"
                  : null

                return (
                  <div
                    key={dateKey}
                    onClick={() => hasAnyData && setCronoSelectedDay(isSelected ? null : dateKey)}
                    style={{
                      position: "relative" as const, minHeight: 52, padding: "4px 4px 3px",
                      border: `1px solid ${isSelected ? C.gold : hasAnyData ? C.border : "transparent"}`,
                      background: isSelected ? "rgba(207,181,59,0.1)" : isInRange ? "rgba(207,181,59,0.035)" : hasAnyData ? "#0a0a0a" : "transparent",
                      cursor: hasAnyData ? "pointer" : "default",
                      transition: "border-color 0.1s",
                      outline: isInRange && !isSelected ? "1px solid rgba(207,181,59,0.18)" : "none",
                      outlineOffset: "-1px",
                    }}
                    onMouseEnter={e => { if (hasAnyData && !isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = C.borderMid }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = hasAnyData ? C.border : "transparent" }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: "bold", color: hasAnyData ? C.ash : C.border, textAlign: "right" as const }}>{d}</div>
                    {/* NOAA risk bar */}
                    {riskColor && (
                      <div style={{ height: 3, background: riskColor, marginTop: 3, borderRadius: 1, opacity: 0.8 }} />
                    )}
                    {/* SEMAR badge */}
                    {semNum && (
                      <div style={{ marginTop: 4, fontSize: 7.5, background: semInfo?.semaforo ? `${semColor(semInfo.semaforo)}22` : "rgba(207,181,59,0.12)", color: semInfo?.semaforo ? semColor(semInfo.semaforo) : C.gold, padding: "1px 3px", textAlign: "center" as const, fontWeight: "bold" }}>
                        S·{semNum}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", gap: 16, flexWrap: "wrap" as const }}>
              {[["#ef4444","HIGH"],["#f97316","MEDIUM"],["#eab308","WARNING"],["#22c55e","LOW"]].map(([c,l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 3, background: c, borderRadius: 1 }} />
                  <span style={{ fontSize: 9, color: C.slate }}>{l}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ fontSize: 8, background: "rgba(207,181,59,0.2)", color: C.gold, padding: "0 4px", fontWeight: "bold" }}>S·N</div>
                <span style={{ fontSize: 9, color: C.slate }}>Boletín SEMAR</span>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div style={{ width: 280, flexShrink: 0, background: C.carbon, border: `1px solid ${C.border}`, minHeight: 300 }}>
            {!cronoSelectedDay ? (
              <div style={{ padding: 24, textAlign: "center" as const, color: C.slate }}>
                <Calendar size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 12, margin: 0 }}>Selecciona un día con datos para ver el detalle</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {/* Day header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ ...FONT, fontSize: 13, fontWeight: "bold", color: C.frost }}>{selectedDateStr}</div>
                  <div style={{ fontSize: 9.5, color: C.slate, marginTop: 2 }}>
                    {MONTH_NAMES_ES[cmonth-1]} {cyear}
                  </div>
                </div>

                {/* NOAA block */}
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Activity size={12} style={{ color: "#60a5fa" }} />
                    <span style={{ fontSize: 10, fontWeight: "bold", color: "#93c5fd" }}>NOAA SIR</span>
                  </div>
                  {selectedRisk ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {[["#ef4444","HIGH",selectedRisk.high],["#f97316","MEDIUM",selectedRisk.medium],["#eab308","WARNING",selectedRisk.warning],["#22c55e","LOW",selectedRisk.low]].map(([c,l,v]) => (
                        <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, background: c as string, borderRadius: "50%", flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: C.ash, flex: 1 }}>{l}</span>
                          <span style={{ ...T.mono, fontSize: 10, color: C.frost }}>{v} seg.</span>
                        </div>
                      ))}
                      {/* Geographic context */}
                      <div style={{ marginTop: 6, padding: "6px 8px", background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                          <MapPin size={9} style={{ color: "#60a5fa" }} />
                          <span style={{ fontSize: 8.5, color: "#60a5fa", fontWeight: "bold" }}>Cobertura satelital</span>
                        </div>
                        {[
                          ["Zona Costa QRoo", "17.5–22.0°N · 85.5–90.5°W"],
                          ["Celda NOAA SIR", "0.1° × 0.1° (~11 km)"],
                          ["Total activas", `${selectedRisk.total} segmentos`],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: 8.5, color: C.slate }}>{k}</span>
                            <span style={{ ...T.mono, fontSize: 8.5, color: C.ash }}>{v}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => { setMapLayers(p => ({ ...p, sir: true })); setMapSirDate(cronoSelectedDay); setActiveSubTab("map"); setTimeout(() => document.getElementById("mapa-visualizador")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100) }}
                        style={{ ...FONT, marginTop: 4, padding: "5px 10px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd", fontSize: 10, cursor: "pointer", outline: "none", borderRadius: 0 }}
                      >
                        Ver en mapa →
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 10, color: C.slate, margin: 0 }}>Sin datos NOAA este día</p>
                  )}
                </div>

                {/* SEMAR block */}
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <FileText size={12} style={{ color: C.gold }} />
                    <span style={{ fontSize: 10, fontWeight: "bold", color: C.gold }}>Boletín SEMAR</span>
                  </div>
                  {selectedBoletinInfo ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {/* thumbnail */}
                        <img
                          src={`/api/download/boletin-image/${boletinDates[selectedBuletinNum!]?.fecha?.slice(0,4) || "2026"}/${selectedBuletinNum}/page_1.png`}
                          alt={`Boletín #${selectedBuletinNum}`}
                          style={{ width: 60, height: 75, objectFit: "cover", border: `1px solid ${C.border}`, flexShrink: 0 }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                        />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ ...T.mono, fontSize: 11, color: C.gold, fontWeight: "bold" }}>#{selectedBuletinNum}</div>
                          {selectedBoletinInfo.semaforo && (
                            <div style={{ fontSize: 9.5, color: semColor(selectedBoletinInfo.semaforo), fontWeight: "bold" }}>
                              ● {selectedBoletinInfo.semaforo}
                            </div>
                          )}
                          {selectedBoletinInfo.aco_mt && (
                            <div style={{ fontSize: 9, color: C.slate }}>ACO: {selectedBoletinInfo.aco_mt} t</div>
                          )}
                          {selectedBoletinInfo.cm_mt && (
                            <div style={{ fontSize: 9, color: C.slate }}>CM: {selectedBoletinInfo.cm_mt} t</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const yr = selectedBoletinInfo.fecha?.slice(0,4) || "2026"
                          setSelectedBulletin({ name: `SARGAZO_${selectedBuletinNum}_${yr}.pdf`, num: selectedBuletinNum!, year: yr })
                        }}
                        style={{ ...FONT, padding: "5px 10px", background: "rgba(207,181,59,0.1)", border: `1px solid rgba(207,181,59,0.3)`, color: C.gold, fontSize: 10, cursor: "pointer", outline: "none", borderRadius: 0 }}
                      >
                        Ver galería →
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: 10, color: C.slate, margin: 0 }}>Sin boletín SEMAR este día</p>
                  )}
                </div>

                {/* 7-day HIGH risk sparkline (M5) */}
                {(() => {
                  const dayNum = parseInt(cronoSelectedDay!.slice(6, 8))
                  const range = [-3,-2,-1,0,1,2,3].map(offset => {
                    const dt = new Date(cyear, cmonth - 1, dayNum + offset)
                    return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}`
                  })
                  const values = range.map(k => noaaDailyRisk[k]?.high || 0)
                  const maxV = Math.max(...values, 1)
                  if (values.every(v => v === 0)) return null
                  const W = 140, H = 40
                  const pts = range.map((_, i) => `${i * 23 + 5},${H - (values[i] / maxV) * (H - 6) - 3}`)
                  const areaD = `M 5,${H} L ${pts.join(" L ")} L ${6*23+5},${H} Z`
                  return (
                    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 9, color: C.slate, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Tendencia 7 días — HIGH Risk</div>
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
                        <path d={areaD} fill="rgba(239,68,68,0.15)" />
                        <polyline points={pts.join(" ")} fill="none" stroke="#ef4444" strokeWidth="1.5" />
                        {/* highlight selected day (index 3) */}
                        <circle cx={3 * 23 + 5} cy={H - (values[3] / maxV) * (H - 6) - 3} r="3" fill="#ef4444" />
                        {/* x-axis date labels */}
                        {[0, 3, 6].map(i => (
                          <text key={i} x={i * 23 + 5} y={H - 1} fill={C.slate} fontSize="6" textAnchor="middle">
                            {range[i].slice(6,8)}
                          </text>
                        ))}
                      </svg>
                    </div>
                  )
                })()}

                {/* Ver en Explorador → (M6e) */}
                <div style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => {
                      const d = selectedDateStr!
                      const ym = d.slice(0, 7)
                      setDateFrom(ym)
                      setDateTo(ym)
                      setActiveBrowserTable("boletines_sargazo_MASTER.csv")
                      setActiveSubTab("browser")
                    }}
                    style={{ ...FONT, fontSize: 10, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "5px 10px", cursor: "pointer", outline: "none", width: "100%" }}
                  >
                    Ver en Explorador →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </>}

        {/* Backtesting view */}
        {cronoView === "backtest" && (() => {
          const BT: { m: string; real: number; ens: number; ridge: number | null }[] = [
            { m: "Jul '25", real: 74342, ens: 34484,  ridge: null  },
            { m: "Ago '25", real: 38585, ens: 124118, ridge: null  },
            { m: "Sep '25", real: 12578, ens: 23618,  ridge: null  },
            { m: "Oct '25", real: 135,   ens: 13606,  ridge: 8402  },
            { m: "Nov '25", real: 34,    ens: 8,      ridge: 13    },
            { m: "Dic '25", real: 45,    ens: 50,     ridge: 6     },
            { m: "Ene '26", real: 7131,  ens: 344,    ridge: 221   },
            { m: "Feb '26", real: 9365,  ens: 5436,   ridge: 7314  },
            { m: "Mar '26", real: 17795, ens: 16374,  ridge: 29593 },
            { m: "Abr '26", real: 32457, ens: 12444,  ridge: 18152 },
            { m: "May '26", real: 51837, ens: 21370,  ridge: null  },
          ]

          // SVG chart helpers (log10 scale)
          const Cx = 65, Cw = 510, CY0 = 185, CH = 165, Nn = 10
          const px = (i: number) => Cx + (i / Nn) * Cw
          const py = (v: number) => CY0 - (Math.log10(Math.max(1, v)) / 5) * CH
          const fmtTon = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`

          const realPts = BT.map((d, i) => `${px(i)},${py(d.real)}`).join(" ")
          const ensPts  = BT.map((d, i) => `${px(i)},${py(d.ens)}`).join(" ")

          const ridgeSegs: string[][] = []
          let seg: string[] = []
          BT.forEach((d, i) => {
            if (d.ridge !== null) { seg.push(`${px(i)},${py(d.ridge)}`) }
            else { if (seg.length > 1) ridgeSegs.push(seg); seg = [] }
          })
          if (seg.length > 1) ridgeSegs.push(seg)

          const hov = btHover !== null ? BT[btHover] : null

          const METRICS = [
            { modelo: "Ridge 1.1 ★",  n: 7,  rmse: "8,143",  smape: "108%", bias: "-0.5k", corr: "0.72", best: true  },
            { modelo: "Regresión",     n: 11, rmse: "20,896", smape: "101%", bias: "-6.5k", corr: "0.62", best: false },
            { modelo: "Ensemble",      n: 11, rmse: "31,043", smape: "90%",  bias: "+0.7k", corr: "0.46", best: false },
            { modelo: "AR1",           n: 10, rmse: "45,197", smape: "133%", bias: "+11k",  corr: "0.46", best: false },
          ]

          const CONF = [
            { label: "Actualidad datos",     pts: 25, max: 30 },
            { label: "Pares ACO+CM",         pts: 20, max: 20 },
            { label: "Concordancia modelos", pts: 10, max: 20 },
            { label: "Precisión histórica",  pts: 19, max: 20 },
            { label: "Ventana temporal",     pts: 10, max: 10 },
          ]

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Methodology strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, border: `1px solid ${C.border}` }}>
                {([
                  ["Método", "Expanding window (walk-forward)", "Entrena con datos hasta mes N → predice N+1 sin ver el futuro"],
                  ["Datos", "609 PDFs SEMAR 2024-2026", "Biomasa CM medida (SEMAR) vs. biomasa CM predicha mes a mes"],
                  ["Período", "Jul 2025 → May 2026 · 11 meses", "Predictor: biomasa ACO del mes anterior (Spearman r=0.89)"],
                ] as const).map(([title, val, sub], i) => (
                  <div key={i} style={{ padding: "14px 16px", background: C.carbon, borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ ...T.labelGold, fontSize: 8.5, display: "block", marginBottom: 4 }}>{title}</span>
                    <span style={{ ...FONT, fontSize: 11.5, color: C.frost, display: "block", fontWeight: "bold", marginBottom: 2 }}>{val}</span>
                    <span style={{ fontSize: 9.5, color: C.slate }}>{sub}</span>
                  </div>
                ))}
              </div>

              {/* Predictor mechanism + data provenance + geographic areas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

                {/* ACO → CM mechanism */}
                <div style={{ background: C.carbon, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Waves size={13} style={{ color: C.gold }} />
                    <span style={{ ...T.labelGold, fontSize: 9 }}>MECANISMO DEL PREDICTOR</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, padding: "8px", background: C.graphite, border: `1px solid ${C.border}`, textAlign: "center" as const }}>
                      <span style={{ fontSize: 9, color: C.gold, display: "block", fontWeight: "bold" }}>ACO</span>
                      <span style={{ fontSize: 8, color: C.slate }}>Atlántico Caribe Occidental</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <span style={{ fontSize: 8, color: C.slate }}>~1 mes</span>
                      <span style={{ fontSize: 14, color: C.gold }}>→</span>
                    </div>
                    <div style={{ flex: 1, padding: "8px", background: "rgba(207,181,59,0.05)", border: `1px solid ${C.gold}`, textAlign: "center" as const }}>
                      <span style={{ fontSize: 9, color: C.gold, display: "block", fontWeight: "bold" }}>CM</span>
                      <span style={{ fontSize: 8, color: C.slate }}>Caribe Mexicano</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {[
                      ["Spearman r", "0.890  (p < 0.00002)"],
                      ["N pares validados", "14 (may 2025 → abr 2026)"],
                      ["Lag óptimo", "1 mes (lag-3 no significativo)"],
                      ["Mecanismo físico", "Corriente Norteecuatorial transporta biomasa desde ACO → costas QRoo"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 8, color: C.slate }}>{k}</span>
                        <span style={{ fontSize: 9.5, color: C.ash }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data provenance */}
                <div style={{ background: C.carbon, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={13} style={{ color: C.gold }} />
                    <span style={{ ...T.labelGold, fontSize: 9 }}>PROVENIENCIA DE LOS DATOS</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[
                      ["Fuente original", "Boletines PDF semanales SEMAR (Secretaría de Marina México)"],
                      ["Procesamiento", "609 PDFs → OCR PaddleOCR → boletines_sargazo_MASTER.csv (604 filas, 27 cols)"],
                      ["Pares de entrenamiento", "14 observaciones ACO+CM simultáneas (mar 2024 – abr 2026)"],
                      ["Primera predicción BT", "Jul 2025, con 3 pares de entrenamiento"],
                      ["Última predicción BT", "May 2026, con 13 pares de entrenamiento"],
                      ["Variable objetivo", "biomasa_caribe_mexicano_ton (CM) del boletín SEMAR"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span style={{ fontSize: 8, color: C.slate, display: "block" }}>{k}</span>
                        <span style={{ fontSize: 9, color: C.ash }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geographic monitoring areas */}
                <div style={{ background: C.carbon, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={13} style={{ color: C.gold }} />
                    <span style={{ ...T.labelGold, fontSize: 9 }}>ÁMBITO GEOGRÁFICO</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      {
                        label: "CM — Objetivo",
                        color: C.gold,
                        rows: [["Caribe Mexicano", "17.5–21.5°N · 85.5–88.0°W"],["Frente costero QRoo", "~650 km lineal"],["Referencia SEMAR", "biomasa medida in situ"]],
                      },
                      {
                        label: "ACO — Predictor",
                        color: "#60a5fa",
                        rows: [["Atlántico Caribe Occ.", "10–25°N · 60–85°W"],["Alta mar, antes de costa", "Biomasa pelágica"],["Desfase temporal", "~30 días de tránsito"]],
                      },
                      {
                        label: "NOAA SIR — Validación",
                        color: "#a78bfa",
                        rows: [["Cuadrícula satelital", "17.5–22.0°N · 85.5–90.5°W"],["Resolución celda", "0.1° × 0.1° (~11 km)"],["Cobertura histórica", "315 fechas (2024–2026)"]],
                      },
                    ].map(({ label, color, rows }) => (
                      <div key={label}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                          <div style={{ width: 6, height: 6, background: color, borderRadius: "50%" }} />
                          <span style={{ fontSize: 9, color, fontWeight: "bold" }}>{label}</span>
                        </div>
                        {rows.map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 6, paddingLeft: 11 }}>
                            <span style={{ fontSize: 8, color: C.slate }}>{k}</span>
                            <span style={{ ...T.mono, fontSize: 8, color: C.ash }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expanding window diagram */}
              <div style={{ background: C.carbon, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Target size={13} style={{ color: C.gold }} />
                  <span style={{ ...T.labelGold, fontSize: 9 }}>CÓMO FUNCIONA EL EXPANDING WINDOW — Validación honesta sin filtración de datos</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
                  {[
                    { train: "mar–may 2025", predict: "jul 2025", n: 3 },
                    { train: "mar–ago 2025", predict: "sep 2025", n: 4 },
                    { train: "mar–sep 2025", predict: "oct 2025", n: 5 },
                    { train: "mar–oct 2025", predict: "nov 2025", n: 6 },
                    { train: "mar 2025–abr 2026", predict: "may 2026", n: 13 },
                  ].map(({ train, predict, n }, i) => (
                    <div key={i} style={{ padding: "8px", background: C.graphite, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(n / 13) * 100}%`, background: "rgba(207,181,59,0.5)" }} />
                      </div>
                      <span style={{ fontSize: 7.5, color: C.slate }}>Entrena: {train}</span>
                      <span style={{ fontSize: 8, color: C.gold, fontWeight: "bold" }}>→ Predice: {predict}</span>
                      <span style={{ fontSize: 7.5, color: C.slate }}>n={n} pares</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 9, color: C.slate, margin: "10px 0 0 0", lineHeight: 1.5 }}>
                  Cada iteración entrena solo con observaciones pasadas y predice la siguiente. El modelo nunca "mira" hacia el futuro durante el entrenamiento.
                  Con n=3 (inicio), el intervalo de confianza es muy amplio; con n=13 (final), el modelo ya tiene suficiente historia para reducir la incertidumbre.
                  Se muestran 5 de las 11 iteraciones; el cursor representa el punto de corte entre datos de entrenamiento (dorado) y datos no vistos (gris).
                </p>
              </div>

              {/* Chart + Confidence */}
              <div style={{ display: "flex", gap: 16, alignItems: "start" }}>

                {/* SVG Chart */}
                <div style={{ flex: 1, background: C.carbon, border: `1px solid ${C.border}`, padding: "16px 16px 8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" as const, gap: 8 }}>
                    <span style={{ ...FONT, fontSize: 12, fontWeight: "bold", color: C.frost }}>Real vs Predicho — Biomasa CM (escala log₁₀)</span>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      {([["Real SEMAR", C.gold, false], ["Ensemble", "#60a5fa", true], ["Ridge 1.1", "#f97316", true]] as const).map(([label, color, dashed]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4,2" : "none"} /></svg>
                          <span style={{ fontSize: 9, color: C.ash }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <svg viewBox="0 0 600 205" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
                    onMouseLeave={() => setBtHover(null)}>
                    {/* Y axis ticks */}
                    {([[1,"1"],[10,"10"],[100,"100"],[1000,"1k"],[10000,"10k"],[100000,"100k"]] as [number,string][]).map(([v, lbl]) => {
                      const y = py(v)
                      return (
                        <g key={lbl}>
                          <line x1={Cx} y1={y} x2={Cx + Cw} y2={y} stroke={C.border} strokeWidth="0.5" />
                          <text x={Cx - 5} y={y + 3} textAnchor="end" fill={C.slate} fontSize="8.5">{lbl}</text>
                        </g>
                      )
                    })}
                    {/* X axis labels */}
                    {BT.map((d, i) => (
                      <text key={i} x={px(i)} y={CY0 + 14} textAnchor="middle" fill={C.slate} fontSize="8.5">{d.m}</text>
                    ))}
                    {/* Hover vertical line */}
                    {btHover !== null && (
                      <line x1={px(btHover)} y1={15} x2={px(btHover)} y2={CY0} stroke={C.border} strokeWidth="1" strokeDasharray="3,2" />
                    )}
                    {/* Soft error fill */}
                    <polygon
                      points={[
                        ...BT.map((d, i) => `${px(i)},${Math.min(py(d.real), py(d.ens))}`),
                        ...[...BT].reverse().map((d, ri, arr) => `${px(arr.length - 1 - ri)},${Math.max(py(d.real), py(d.ens))}`),
                      ].join(" ")}
                      fill="rgba(96,165,250,0.05)"
                    />
                    {/* Ensemble line */}
                    <polyline points={ensPts} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.75" />
                    {/* Ridge segments */}
                    {ridgeSegs.map((pts, si) => (
                      <polyline key={si} points={pts.join(" ")} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,2" opacity="0.75" />
                    ))}
                    {/* Real line */}
                    <polyline points={realPts} fill="none" stroke={C.gold} strokeWidth="2.2" />
                    {/* Hover hit areas + dots */}
                    {BT.map((d, i) => (
                      <g key={i}>
                        <rect x={px(i) - 20} y={15} width={40} height={CH} fill="transparent"
                          onMouseEnter={() => setBtHover(i)} style={{ cursor: "crosshair" }} />
                        <circle cx={px(i)} cy={py(d.real)} r={btHover === i ? 5 : 3}
                          fill={btHover === i ? C.gold : C.carbon} stroke={C.gold} strokeWidth="1.8" />
                        <circle cx={px(i)} cy={py(d.ens)} r={btHover === i ? 4 : 2}
                          fill={btHover === i ? "#60a5fa" : C.carbon} stroke="#60a5fa" strokeWidth="1.5" />
                        {d.ridge !== null && (
                          <circle cx={px(i)} cy={py(d.ridge)} r={btHover === i ? 4 : 2}
                            fill={btHover === i ? "#f97316" : C.carbon} stroke="#f97316" strokeWidth="1.5" />
                        )}
                      </g>
                    ))}
                    {/* Tooltip */}
                    {btHover !== null && hov && (() => {
                      const tx = px(btHover)
                      const tipX = btHover > 7 ? tx - 114 : tx + 10
                      const errPct = Math.round((hov.ens - hov.real) / Math.max(1, hov.real) * 100)
                      const errColor = Math.abs(errPct) < 50 ? "#22c55e" : Math.abs(errPct) < 120 ? "#eab308" : "#ef4444"
                      return (
                        <g>
                          <rect x={tipX} y="18" width="108" height={hov.ridge !== null ? 68 : 55}
                            fill={C.graphite} stroke={C.border} rx="2" />
                          <text x={tipX + 7} y="31" fill={C.gold} fontSize="9.5" fontWeight="bold">{hov.m}</text>
                          <text x={tipX + 7} y="43" fill={C.gold} fontSize="8.5">Real: {fmtTon(hov.real)} ton</text>
                          <text x={tipX + 7} y="54" fill="#60a5fa" fontSize="8.5">Ensemble: {fmtTon(hov.ens)} ton</text>
                          {hov.ridge !== null && <text x={tipX + 7} y="65" fill="#f97316" fontSize="8.5">Ridge: {fmtTon(hov.ridge)} ton</text>}
                          <text x={tipX + 7} y={hov.ridge !== null ? 78 : 66} fill={errColor} fontSize="8.5">
                            Error ens: {errPct > 0 ? "+" : ""}{errPct}%
                          </text>
                        </g>
                      )
                    })()}
                  </svg>
                </div>

                {/* Confidence score panel */}
                <div style={{ width: 210, flexShrink: 0, background: C.carbon, border: `1px solid ${C.border}`, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <span style={{ ...T.labelGold, fontSize: 8.5, display: "block", marginBottom: 8 }}>CONFIANZA DEL MODELO</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ ...FONT, fontSize: 40, fontWeight: "bold", color: C.gold, lineHeight: 1 }}>84</span>
                      <span style={{ fontSize: 14, color: C.slate }}>/100</span>
                    </div>
                    <span style={{ ...FONT, fontSize: 10.5, color: "#22c55e", fontWeight: "bold", marginTop: 2, display: "block" }}>ALTA CONFIANZA</span>
                  </div>
                  {CONF.map((c, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: C.ash }}>{c.label}</span>
                        <span style={{ fontSize: 9, fontWeight: "bold", color: c.pts === c.max ? "#22c55e" : C.gold }}>{c.pts}/{c.max}</span>
                      </div>
                      <div style={{ height: 4, background: C.graphite, borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${(c.pts / c.max) * 100}%`, background: c.pts === c.max ? "#22c55e" : C.gold, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                  {/* Direction accuracy */}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 8.5, color: C.slate, marginBottom: 2 }}>Validación adicional</span>
                    {([["Dirección mensual", "8/10", "80%"], ["Temporada alta/baja", "10/11", "91%"]] as const).map(([label, frac, pct]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 8.5, color: C.ash }}>{label}</span>
                        <div style={{ display: "flex", gap: 5 }}>
                          <span style={{ fontSize: 8.5, color: C.slate }}>{frac}</span>
                          <span style={{ fontSize: 8.5, fontWeight: "bold", color: "#22c55e" }}>{pct}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Metrics comparison table */}
              <div style={{ background: C.carbon, border: `1px solid ${C.border}` }}>
                <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...T.labelGold, fontSize: 9 }}>COMPARACIÓN DE MODELOS — expanding window jul 2025→may 2026</span>
                  <span style={{ fontSize: 9, color: C.slate }}>★ = mejor RMSE absoluto</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                  <thead>
                    <tr style={{ background: C.graphite }}>
                      {(["Modelo","n","RMSE (ton)","SMAPE","Sesgo","Corr","Nota"] as const).map((h, i) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : ("right" as const), ...T.label, fontSize: 8.5, color: C.slate, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m, i) => (
                      <tr key={m.modelo} style={{ borderBottom: i < METRICS.length - 1 ? `1px solid ${C.border}` : "none", background: m.best ? "rgba(207,181,59,0.04)" : "transparent" }}>
                        <td style={{ padding: "10px 12px", ...FONT, fontSize: 11, color: m.best ? C.gold : C.frost, fontWeight: m.best ? "bold" : "normal" }}>{m.modelo}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 10, color: C.ash }}>{m.n}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 11, color: m.best ? "#22c55e" : C.ash, fontWeight: m.best ? "bold" : "normal" }}>{m.rmse}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 11, color: parseFloat(m.smape) < 100 ? "#22c55e" : C.ash }}>{m.smape}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 10, color: m.bias.startsWith("+") ? "#f97316" : "#60a5fa" }}>{m.bias}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" as const, fontSize: 11, color: parseFloat(m.corr) > 0.6 ? "#22c55e" : C.ash }}>{m.corr}</td>
                        <td style={{ padding: "10px 12px", fontSize: 9, color: C.slate }}>
                          {m.modelo.startsWith("Ridge") ? "Menor error absoluto; solo 7 meses de validación" :
                           m.modelo === "Ensemble" ? "Sesgo casi nulo (+686 ton total) — bueno para dirección" :
                           m.modelo.startsWith("Regres") ? "Robusto en toda la ventana con ligero sesgo bajo" :
                           "Sobreestima drásticamente en temporadas de pico"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footnotes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "14px 16px", background: "rgba(255,255,255,0.01)", border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.border}` }}>
                {([
                  ["¿Por qué SMAPE alto?", "La biomasa varía 3 órdenes de magnitud (34→74,000 ton). En escala log, la correlación r=0.62–0.72 muestra que el modelo capta correctamente los meses altos y bajos."],
                  ["¿Por qué expanding window?", "Simula predicción real: el modelo nunca ve datos del futuro. Es más honesto que cross-validation aleatorio porque respeta el orden temporal de los datos."],
                  ["¿Qué mejora la precisión?", "El predictor ACO→CM tiene ventana útil de 1–2 meses. Para horizontes más largos se requieren datos satelitales GASB (Hu et al. 2023, Res-UNet)."],
                ] as const).map(([title, body]) => (
                  <div key={title}>
                    <span style={{ ...T.label, fontSize: 9, color: C.gold, display: "block", marginBottom: 4 }}>{title}</span>
                    <p style={{ fontSize: 9.5, color: C.slate, margin: 0, lineHeight: 1.5 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    )
  }


const renderArchitectureSection = () => {
    const totalRows = dbStats.tables.reduce((s: number, t: any) => s + (t.count || 0), 0)
    const noaaCount = files.noaa_sir_kmz?.count || 0
    const semarCount = files.boletines_semar?.count || 0
    const dbSizeMb = dbStats.size_bytes ? (dbStats.size_bytes / 1024 / 1024).toFixed(1) : "—"

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Summary strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border }}>
          {[
            { label: "Base de Datos", value: `${dbSizeMb} MB`, sub: `${dbStats.tables.length} tablas · ${totalRows.toLocaleString("es-MX")} filas`, icon: Database },
            { label: "Satélite NOAA SIR", value: `${noaaCount}`, sub: "archivos KMZ diarios", icon: Activity },
            { label: "Boletines SEMAR", value: `${semarCount}`, sub: "PDFs oficiales 2024–2026", icon: FileText },
            { label: "Último Pipeline", value: pipeline.status === "never_run" ? "Sin correr" : pipeline.status, sub: pipeline.completed_at ? formatDate(pipeline.completed_at) : "—", icon: RefreshCw },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} style={{ background: C.graphite, padding: "18px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon size={13} style={{ color: C.gold }} />
                <span style={{ ...T.caption, fontSize: 9, color: C.slate, textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 300, color: C.frost, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: C.ash, marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── SQLite tables ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderLeft: `3px solid ${C.gold}`, paddingLeft: 12 }}>
            <Database size={15} style={{ color: C.gold }} />
            <h2 style={{ fontSize: 15, fontWeight: "bold", color: C.frost, margin: 0, letterSpacing: "-0.2px" }}>Base de Datos Relacional — SQLite</h2>
          </div>

          <div style={{ border: `1px solid ${C.border}`, background: C.carbon }}>
            {/* header */}
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 160px 120px", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
              {["Tabla", "Descripción / Rango de fechas", "Filas", ""].map(h => (
                <span key={h} style={{ ...T.caption, fontSize: 9, color: C.slate, textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>{h}</span>
              ))}
            </div>
            {dbStats.tables.map((table: any, idx: number) => (
              <div
                key={table.name}
                style={{
                  display: "grid", gridTemplateColumns: "200px 1fr 160px 120px",
                  padding: "14px 16px", alignItems: "center",
                  borderBottom: idx < dbStats.tables.length - 1 ? `1px solid ${C.border}` : "none",
                  background: activeBrowserTable === table.name ? "rgba(207,181,59,0.04)" : "transparent"
                }}
              >
                <span style={{ ...T.mono, fontSize: 12, color: C.gold, fontWeight: "bold" }}>{table.name}</span>
                <div>
                  <p style={{ ...T.bodySm, color: C.smoke, margin: "0 0 3px 0", fontSize: 12, lineHeight: 1.35 }}>{table.description}</p>
                  {table.min_date && table.max_date && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, color: C.slate }}>
                      <Calendar size={9} />{table.min_date} → {table.max_date}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <span style={{ fontSize: 18, fontWeight: 300, color: C.frost }}>{(table.count || 0).toLocaleString("es-MX")}</span>
                  <span style={{ fontSize: 9, color: C.slate, marginLeft: 4 }}>filas</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { handleTableChange(table.name); setActiveSubTab("browser") }}
                    style={{
                      ...FONT, border: `1px solid ${activeBrowserTable === table.name ? C.gold : C.border}`,
                      color: activeBrowserTable === table.name ? C.gold : C.ash,
                      padding: "5px 10px", fontSize: 9.5, cursor: "pointer",
                      textTransform: "uppercase" as const, letterSpacing: "0.5px",
                      background: activeBrowserTable === table.name ? "rgba(207,181,59,0.1)" : "transparent",
                      borderRadius: 0, outline: "none", display: "flex", alignItems: "center", gap: 5
                    }}
                  >
                    <Eye size={10} /> Explorar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SEMAR: galería de thumbnails ordenada por fecha ── */}
        {(() => {
          const semColor = (s: string) => {
            if (!s) return C.slate
            const u = s.toUpperCase()
            if (u.includes("CRÍT") || u.includes("CRIT")) return "#ef4444"
            if (u.includes("ALTO")) return "#f97316"
            if (u.includes("NORMAL") || u.includes("MODERADO")) return "#eab308"
            return "#22c55e"
          }
          const years = Object.keys(boletinList).sort((a, b) => Number(b) - Number(a))
          const activeYear = semarGridYear || years[0] || "2026"
          // Derive unique YYYY-MM months from boletinDates for the active year
          const uniqueMonths = Array.from(new Set(
            (boletinList[activeYear] || []).map(e => {
              const bd = boletinDates[e.num]
              return bd?.fecha ? bd.fecha.slice(0, 7) : null
            }).filter(Boolean) as string[]
          )).sort().reverse()

          const yearFiles = (boletinList[activeYear] || []).filter(e => {
            if (semarSearch && !e.num.includes(semarSearch)) return false
            const bd = boletinDates[e.num]
            // Global date filter takes priority
            if (dateFrom || dateTo) {
              if (!bd?.fecha || bd.fecha.length < 10) return true
              const afterFrom = !dateFrom || bd.fecha >= dateFrom + "-01"
              const beforeTo = !dateTo || bd.fecha <= dateTo + "-31"
              return afterFrom && beforeTo
            }
            if (semarMonthFilter) return !!bd?.fecha?.startsWith(semarMonthFilter)
            return true
          })

          return (
            <div style={{ background: C.carbon, border: `1px solid ${C.border}` }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={15} style={{ color: C.gold }} />
                  <div>
                    <h3 style={{ ...FONT, fontSize: 14, fontWeight: "bold", color: C.frost, margin: 0 }}>SEMAR — Boletines Oficiales</h3>
                    <span style={{ fontSize: 9.5, color: C.slate }}>Galería de imágenes, texto OCR y tablas · PDF · 2024–2026</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                  {/* year tabs */}
                  <div style={{ display: "flex", gap: 1 }}>
                    {years.map(yr => (
                      <button key={yr} onClick={() => { setSemarGridYear(yr); setSemarMonthFilter("") }}
                        style={{ ...FONT, padding: "5px 12px", fontSize: 11, cursor: "pointer", outline: "none", borderRadius: 0,
                          background: activeYear === yr ? "rgba(207,181,59,0.12)" : "transparent",
                          border: `1px solid ${activeYear === yr ? C.gold : C.border}`,
                          color: activeYear === yr ? C.gold : C.ash }}
                      >{yr}</button>
                    ))}
                  </div>
                  {/* month filter */}
                  <select
                    value={semarMonthFilter}
                    onChange={e => {
                      setSemarMonthFilter(e.target.value)
                      if (e.target.value) { setDateFrom(e.target.value); setDateTo(e.target.value) }
                    }}
                    style={{ ...FONT, background: "transparent", border: `1px solid ${C.border}`, color: semarMonthFilter ? C.frost : C.slate, fontSize: 11, padding: "5px 8px", outline: "none", cursor: "pointer" }}
                  >
                    <option value="">Todos los meses</option>
                    {uniqueMonths.map(m => <option key={m} value={m} style={{ background: "#0a0a0a" }}>{m}</option>)}
                  </select>
                  <input
                    type="text" placeholder="# boletín…"
                    value={semarSearch} onChange={e => setSemarSearch(e.target.value)}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.frost, fontSize: 11, padding: "5px 10px", outline: "none", width: 110 }}
                  />
                  {(semarSearch || semarMonthFilter) && (
                    <button
                      onClick={() => { setSemarSearch(""); setSemarMonthFilter("") }}
                      style={{ ...FONT, fontSize: 10, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 8px", cursor: "pointer", outline: "none" }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.ash)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.slate)}
                    >✕ Limpiar</button>
                  )}
                  <span style={{ fontSize: 10, color: C.slate }}>{yearFiles.length} boletines</span>
                </div>
              </div>

              {/* M3b: Active date filter chip */}
              {(dateFrom || dateTo) && (
                <div style={{ padding: "8px 16px 0", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: C.gold, border: "1px solid rgba(207,181,59,0.25)", padding: "2px 10px", background: "rgba(207,181,59,0.04)" }}>
                    Filtro: {dateFrom || "inicio"} → {dateTo || "fin"} · {yearFiles.length} boletines
                  </span>
                </div>
              )}

              {/* Thumbnail grid */}
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                {yearFiles.map((entry: { num: string; has_image: boolean; has_text: boolean }) => {
                  const thumbUrl = `/api/download/boletin-image/${activeYear}/${entry.num}/page_1.png`
                  const bd = boletinDates[entry.num]
                  return (
                    <div
                      key={entry.num}
                      style={{ position: "relative", border: `1px solid ${C.border}`, background: "#0a0a0a", cursor: "pointer", overflow: "hidden" }}
                      onClick={() => setSelectedBulletin({ name: `SARGAZO_${entry.num}_${activeYear}.pdf`, num: entry.num, year: activeYear })}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.gold; (e.currentTarget.querySelector(".semar-overlay") as HTMLDivElement | null) && ((e.currentTarget.querySelector(".semar-overlay") as HTMLDivElement).style.opacity = "1") }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget.querySelector(".semar-overlay") as HTMLDivElement | null) && ((e.currentTarget.querySelector(".semar-overlay") as HTMLDivElement).style.opacity = "0") }}
                    >
                      {/* Thumbnail — shows page_1.png if image was extracted */}
                      {entry.has_image && (
                        <img
                          src={thumbUrl}
                          alt={`Boletín ${entry.num}`}
                          loading="lazy"
                          style={{ width: "100%", height: 95, objectFit: "cover", display: "block" }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                        />
                      )}
                      {/* Placeholder icon */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 95, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        {!entry.has_image && <FileText size={28} style={{ color: C.border }} />}
                      </div>

                      {/* Hover overlay */}
                      <div className="semar-overlay" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 95, background: "rgba(0,0,0,0.72)", opacity: 0, transition: "opacity 0.15s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Eye size={20} style={{ color: C.gold }} />
                        <span style={{ fontSize: 9.5, color: C.frost, fontWeight: "bold" }}>Ver galería</span>
                      </div>

                      {/* Semáforo stripe at top */}
                      {bd?.semaforo && (
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: semColor(bd.semaforo) }} />
                      )}

                      {/* Footer: num + date + semaforo + download */}
                      <div style={{ padding: "5px 8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ ...T.mono, fontSize: 10.5, color: C.gold, fontWeight: "bold" }}>#{entry.num}</span>
                          <a
                            href={`/api/download/file/semar/SARGAZO_${entry.num}_${activeYear}.pdf`}
                            download
                            title="Descargar PDF original"
                            onClick={e => e.stopPropagation()}
                            style={{ color: C.slate, display: "flex", alignItems: "center" }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.ash)}
                            onMouseLeave={e => (e.currentTarget.style.color = C.slate)}
                          >
                            <Download size={11} />
                          </a>
                        </div>
                        {bd?.fecha && (
                          <div style={{ fontSize: 8.5, color: C.slate, marginTop: 1 }}>{bd.fecha}</div>
                        )}
                        {bd?.semaforo && (
                          <div style={{ fontSize: 8.5, color: semColor(bd.semaforo), marginTop: 1 }}>● {bd.semaforo}</div>
                        )}
                        {/* M3c: Zone-relevant biomass badge */}
                        {activeRegionIndex !== 0 && bd?.cm_mt && (
                          <div style={{ fontSize: 8, color: C.gold, marginTop: 2, borderTop: `1px solid ${C.border}`, paddingTop: 2 }}>
                            CM: {bd.cm_mt} t
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {yearFiles.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center" as const, padding: 40, color: C.slate, fontSize: 12 }}>
                    Sin boletines para el filtro actual
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── NOAA: calendario interactivo de cobertura ── */}
        {(() => {
          // Build a Set of date strings YYYYMMDD from the full KMZ list
          const dateCoverage = new Set(noaaKmzFiles.map((fname: string) => {
            const m = fname.match(/sargassum_risk_(\d{8})\.kmz/)
            return m ? m[1] : null
          }).filter(Boolean) as string[])

          // Group by YYYY-MM
          const byMonth: Record<string, string[]> = {}
          Array.from(dateCoverage).sort().forEach((d: any) => {
            const ym = `${d.slice(0,4)}-${d.slice(4,6)}`
            if (!byMonth[ym]) byMonth[ym] = []
            byMonth[ym].push(d)
          })
          const months = Object.keys(byMonth).sort().reverse()

          // M4: Filter months by global date range
          const filteredMonths = months.filter(ym => {
            if (!dateFrom && !dateTo) return true
            const afterFrom = !dateFrom || ym >= dateFrom
            const beforeTo = !dateTo || ym <= dateTo
            return afterFrom && beforeTo
          })

          const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

          return (
            <div style={{ background: C.carbon, border: `1px solid ${C.border}` }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Activity size={15} style={{ color: "#60a5fa" }} />
                  <div>
                    <h3 style={{ ...FONT, fontSize: 14, fontWeight: "bold", color: C.frost, margin: 0 }}>NOAA SIR — Cobertura Satelital</h3>
                    <span style={{ fontSize: 9.5, color: C.slate }}>
                      Haz clic en cualquier día para verlo en el mapa · {dateCoverage.size} días con datos
                      {(dateFrom || dateTo) && (
                        <span style={{ color: C.gold }}>
                          {" · "}{filteredMonths.reduce((s, ym) => s + byMonth[ym].length, 0)} filtrados
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <input
                  type="text" placeholder="Filtrar mes (ej: 2026-05)…"
                  value={noaaSearch} onChange={e => setNoaaSearch(e.target.value)}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.frost, fontSize: 11, padding: "5px 10px", outline: "none", width: 180 }}
                />
              </div>

              {/* Calendar months */}
              <div style={{ padding: "12px 16px", maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {filteredMonths
                  .filter(ym => !noaaSearch || ym.includes(noaaSearch))
                  .map(ym => {
                    const days = byMonth[ym].sort()
                    const [year, month] = ym.split("-")
                    const monthLabel = `${MONTH_NAMES[Number(month)-1]} ${year}`
                    const isOpen = noaaExpandedMonth === ym || noaaSearch.length > 0
                    return (
                      <div key={ym} style={{ border: `1px solid ${C.border}`, background: "#0a0a0a" }}>
                        {/* Month header — clickable to expand */}
                        <button
                          onClick={() => setNoaaExpandedMonth(isOpen && !noaaSearch ? null : ym)}
                          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", outline: "none" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ ...FONT, fontSize: 12, fontWeight: "bold", color: C.frost }}>{monthLabel}</span>
                            {/* Risk dots — days with HIGH/MED/WARN/LOW in this month */}
                            {(() => {
                              let h=0, m=0, w=0, l=0
                              days.forEach((d: string) => {
                                const r = noaaDailyRisk[d]
                                if (!r) return
                                if (r.high > 0) h++
                                else if (r.medium > 0) m++
                                else if (r.warning > 0) w++
                                else l++
                              })
                              return (
                                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                  {h > 0 && <span title={`${h} días HIGH`} style={{ fontSize: 8.5, color: "#ef4444", fontWeight: "bold" }}>{h}H</span>}
                                  {m > 0 && <span title={`${m} días MEDIUM`} style={{ fontSize: 8.5, color: "#f97316", fontWeight: "bold" }}>{m}M</span>}
                                  {w > 0 && <span title={`${w} días WARNING`} style={{ fontSize: 8.5, color: "#eab308", fontWeight: "bold" }}>{w}W</span>}
                                  {l > 0 && <span title={`${l} días LOW`} style={{ fontSize: 8.5, color: "#22c55e", fontWeight: "bold" }}>{l}L</span>}
                                </div>
                              )
                            })()}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 10, color: C.slate }}>{days.length} días</span>
                            <ChevronRight size={12} style={{ color: C.slate, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                          </div>
                        </button>

                        {/* Day chips — color-coded by dominant NOAA risk */}
                        {isOpen && (
                          <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                            {days.map((d: string) => {
                              const day = d.slice(6,8)
                              const kmzFilename = `sargassum_risk_${d}.kmz`
                              const kmzExists = noaaKmzFiles.includes(kmzFilename)
                              const riskData = noaaDailyRisk[d]
                              const domColor = riskData
                                ? riskData.high > 0 ? "#ef4444"
                                  : riskData.medium > 0 ? "#f97316"
                                  : riskData.warning > 0 ? "#eab308"
                                  : "#22c55e"
                                : "rgba(96,165,250,0.6)"
                              const tooltipText = riskData
                                ? `${d} — HIGH:${riskData.high} MED:${riskData.medium} WARN:${riskData.warning} LOW:${riskData.low}`
                                : `${d}`
                              return (
                                <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                  <button
                                    onClick={() => { setMapLayers(prev => ({ ...prev, sir: true })); setMapSirDate(d); setActiveSubTab("map"); setTimeout(() => document.getElementById("mapa-visualizador")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100) }}
                                    title={tooltipText}
                                    style={{ width: 34, height: 34, background: `${domColor}18`, border: `1px solid ${domColor}60`, color: domColor, fontSize: 11, fontWeight: "bold", cursor: "pointer", outline: "none", borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${domColor}35`; e.currentTarget.style.borderColor = domColor }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${domColor}18`; e.currentTarget.style.borderColor = `${domColor}60` }}
                                  >
                                    {day}
                                  </button>
                                  {kmzExists && (
                                    <a
                                      href={`/api/download/file/noaa/${kmzFilename}`}
                                      download title="Descargar KMZ"
                                      onClick={e => e.stopPropagation()}
                                      style={{ fontSize: 8.5, color: C.slate, textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}
                                      onMouseEnter={e => (e.currentTarget.style.color = C.ash)}
                                      onMouseLeave={e => (e.currentTarget.style.color = C.slate)}
                                    >
                                      <Download size={8} /> KMZ
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })()}

        {/* ── Outputs del pipeline ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderLeft: `3px solid rgba(255,255,255,0.15)`, paddingLeft: 12 }}>
            <BarChart3 size={15} style={{ color: C.ash }} />
            <h2 style={{ fontSize: 15, fontWeight: "bold", color: C.frost, margin: 0 }}>Outputs del Pipeline</h2>
            <span style={{ fontSize: 10, color: C.slate }}>— archivos generados por el modelo predictivo</span>
          </div>

          <div style={{ border: `1px solid ${C.border}`, background: C.carbon }}>
            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 72px 160px 130px", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
              {["", "Archivo / Descripción", "MB", "Actualizado", ""].map(h => (
                <span key={h} style={{ ...T.caption, fontSize: 9, color: C.slate, textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>{h}</span>
              ))}
            </div>
            {files.outputs?.map((out: any, idx: number) => {
              const ext = out.name.split(".").pop()?.toUpperCase() || ""
              const extColor: Record<string, string> = { CSV: "#34d399", JSON: "#a78bfa", GEOJSON: "#60a5fa" }
              const isHeavy = out.name === "noaa_sir_riesgo_costero_qroo.geojson"
              return (
                <div key={out.name} style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 72px 160px 130px",
                  padding: "13px 16px", borderBottom: idx < files.outputs.length - 1 ? `1px solid ${C.border}` : "none",
                  alignItems: "center", background: activeBrowserTable === out.name ? "rgba(207,181,59,0.03)" : "transparent"
                }}>
                  <span style={{ fontSize: 8, fontWeight: "bold", color: extColor[ext] || C.slate, border: `1px solid ${extColor[ext] || C.border}`, padding: "2px 3px", textAlign: "center" as const }}>{ext}</span>
                  <div style={{ paddingLeft: 8 }}>
                    <a
                      href={`/api/download/file/output/${out.name}`} download
                      style={{ ...T.mono, fontSize: 12, color: C.gold, textDecoration: "none", display: "inline-block", marginBottom: 2, fontWeight: "bold" }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                    >
                      {out.name}
                    </a>
                    <p style={{ fontSize: 11, color: C.smoke, margin: 0, lineHeight: 1.3 }}>{out.description}</p>
                  </div>
                  <span style={{ ...T.mono, fontSize: 11, color: C.ash, textAlign: "right" as const }}>{out.size_mb}</span>
                  <span style={{ fontSize: 11, color: C.slate }}>{formatDate(out.modified_at).split(",")[0]}</span>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {isHeavy ? (
                      <span style={{ fontSize: 9.5, color: C.slate, fontStyle: "italic" }}>Solo descarga (480 MB)</span>
                    ) : (
                      <button
                        onClick={() => { handleTableChange(out.name); setActiveSubTab("browser") }}
                        style={{
                          ...FONT, border: `1px solid ${activeBrowserTable === out.name ? C.gold : C.border}`,
                          color: activeBrowserTable === out.name ? C.gold : C.ash,
                          padding: "5px 10px", fontSize: 9.5, cursor: "pointer",
                          textTransform: "uppercase" as const, letterSpacing: "0.5px",
                          background: activeBrowserTable === out.name ? "rgba(207,181,59,0.1)" : "transparent",
                          borderRadius: 0, outline: "none", display: "flex", alignItems: "center", gap: 5
                        }}
                      >
                        <Eye size={10} /> Explorar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Arquitectura técnica (colapsada visualmente) ── */}
        <details style={{ background: C.navy, border: `1px solid ${C.borderMid}` }}>
          <summary style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", listStyle: "none" }}>
            <Server size={16} style={{ color: C.gold }} />
            <span style={{ fontSize: 14, fontWeight: "bold", color: C.frost }}>Arquitectura de Persistencia — SQLite + Disco</span>
            <span style={{ fontSize: 10, color: C.slate, marginLeft: "auto" }}>Expandir justificación técnica</span>
          </summary>
          <div style={{ padding: "0 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              ["Cero Costo y Portabilidad Serverless", "SQLite es un archivo único autoportante. En Cloud Run no hay latencia de red ni costos fijos de hosting de una base externa."],
              ["JSON Nativo en SQLite", "json_extract() permite esquemas dinámicos (bitácora de pasos, variables del pipeline) sin renunciar a la integridad relacional."],
              ["Rendimiento con Archivos Binarios", "Los KMZ de NOAA (~45 MB) y PDFs de SEMAR se leen por mapeo de memoria local — más rápido que sockets de NoSQL remoto."],
              ["Backup = Un Archivo", "Clonar el sistema completo = copiar sargazo.db. Investigadores pueden correr el pipeline localmente de forma idéntica a producción."],
            ].map(([title, body]) => (
              <div key={title} style={{ background: "rgba(0,0,0,0.2)", padding: 18, border: `1px solid ${C.border}` }}>
                <h4 style={{ ...T.labelGold, fontSize: 10.5, marginBottom: 8 }}>{title}</h4>
                <p style={{ ...T.bodySm, color: C.smoke, margin: 0, fontSize: 11.5, lineHeight: 1.5 }}>{body}</p>
              </div>
            ))}
          </div>
        </details>

      </div>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Copy toast (M6b) */}
      {copyToast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#000", padding: "6px 16px", fontSize: 11, fontWeight: "bold", zIndex: 9999, pointerEvents: "none", letterSpacing: "0.05em" }}>
          COPIADO
        </div>
      )}

      {/* Hero Intro */}
      <div style={{ background: C.carbon, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px max(40px, 6vw) 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end" }}>
          <div>
            <p style={{ ...T.labelGold, marginBottom: 20 }}>Centro de Datos</p>
            <h1 style={{ ...T.heading, color: C.frost, margin: 0 }}>
              Panel de Monitoreo y<br />Visualización de Datos
            </h1>
          </div>
          <p style={{ ...T.body, color: C.ash, margin: 0, maxWidth: 480 }}>
            Supervisión regional del corpus de bases de datos, fuentes satelitales (NOAA) y oficiales (SEMAR) para Cozumel, Tulum, Yucatán y Quintana Roo. Explore y analice la información sin necesidad de redescargar.
          </p>
        </div>
      </div>

      {/* Persistent Regional Selector Dashboard */}
      <div style={{ background: C.carbon, borderBottom: `1px solid ${C.border}`, padding: "24px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <span style={{ ...T.labelGold, fontSize: 9, display: "block", marginBottom: 4 }}>Panel de Control Multirregional</span>
              <h2 style={{ fontSize: 18, color: C.frost, margin: 0, fontWeight: 300 }}>Monitoreo y Filtrado de Datos por Región</h2>
            </div>
            <span style={{ ...T.bodySm, color: C.slate, fontSize: 11.5 }}>
              Seleccione una región para coordinar el mapa y filtrar automáticamente el explorador de datasets.
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {regions.map((r, idx) => {
              const IconComponent = r.icon;
              const isSelected = activeRegionIndex === idx;
              return (
                <button
                  key={r.name}
                  onClick={() => {
                    setActiveRegionIndex(idx);
                  }}
                  style={{
                    background: isSelected ? "rgba(207,181,59,0.05)" : C.graphite,
                    border: `1px solid ${isSelected ? C.gold : C.border}`,
                    padding: "16px",
                    textAlign: "left" as const,
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: "120px",
                    borderRadius: 0,
                    outline: "none",
                    position: "relative",
                    boxShadow: isSelected ? "0 4px 20px rgba(207,181,59,0.1)" : "none",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = C.borderMid;
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  {isSelected && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: C.gold }} />
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                    <IconComponent size={20} style={{ color: isSelected ? C.gold : C.slate }} />
                    <span style={{
                      fontSize: 8.5,
                      fontWeight: "bold",
                      padding: "2px 6px",
                      background: r.riskLevel === "ALTO" ? "rgba(239,68,68,0.15)" : r.riskLevel === "BAJO" ? "rgba(96,165,250,0.15)" : "rgba(207,181,59,0.15)",
                      color: r.riskLevel === "ALTO" ? "#f87171" : r.riskLevel === "BAJO" ? "#60a5fa" : C.gold,
                      border: `1px solid ${r.riskLevel === "ALTO" ? "rgba(239,68,68,0.2)" : r.riskLevel === "BAJO" ? "rgba(96,165,250,0.2)" : "rgba(207,181,59,0.2)"}`
                    }}>
                      {r.riskLevel}
                    </span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <span style={{ ...FONT, fontSize: 13, fontWeight: "bold", color: isSelected ? C.gold : C.frost, display: "block" }}>{r.name}</span>
                    <span style={{ fontSize: 9.5, color: C.slate, marginTop: 2, display: "block" }}>{r.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Region Summary Panel */}
      <div style={{ background: "rgba(255,255,255,0.01)", borderBottom: `1px solid ${C.border}`, padding: "12px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw)" }}>
          {/* Toggle row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: regionSummaryExpanded ? 16 : 0 }}>
            <span style={{ ...FONT, fontSize: 11, color: C.ash }}>
              {regions[activeRegionIndex].name}
            </span>
            <span style={{ fontSize: 9.5, color: C.slate }}>—</span>
            <span style={{ fontSize: 9.5, color: C.slate, flex: 1 }}>
              {regions[activeRegionIndex].beaches.length > 0
                ? `${regions[activeRegionIndex].beaches.length} playas monitoreadas`
                : "Monitoreo macro satelital"}
            </span>
            <button
              onClick={() => setRegionSummaryExpanded(p => !p)}
              style={{ ...FONT, fontSize: 9.5, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 10px", cursor: "pointer", outline: "none" }}
            >
              {regionSummaryExpanded ? "▲ Menos detalles" : "▼ Ver detalles de región"}
            </button>
          </div>
          {regionSummaryExpanded && <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 32, alignItems: "center" }}>
            {/* Scope & Info */}
            <div>
              <span style={{ ...T.labelGold, fontSize: 9, display: "block", marginBottom: 4 }}>Ámbito y Cobertura Territorial</span>
              <p style={{ ...T.body, color: C.frost, fontWeight: 300, margin: "0 0 6px 0", fontSize: 13.5 }}>
                {regions[activeRegionIndex].scope}
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ ...T.caption, fontSize: 9, color: C.slate }}>Coordenadas:</span>
                <code style={{ ...T.mono, color: C.ash, fontSize: 10 }}>
                  {regions[activeRegionIndex].center[1].toFixed(2)}°N, {regions[activeRegionIndex].center[0].toFixed(2)}°W
                </code>
              </div>
            </div>

            {/* Beaches / Points of Interest */}
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 24 }}>
              <span style={{ ...T.label, fontSize: 9, display: "block", marginBottom: 6 }}>Playas Monitoreadas</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {regions[activeRegionIndex].beaches.length > 0 ? (
                  regions[activeRegionIndex].beaches.map(b => (
                    <span
                      key={b}
                      onClick={() => {
                        if (activeBrowserTable !== "beach_risk_profiles" && activeBrowserTable !== "risk_by_beach.json") {
                          setActiveBrowserTable("beach_risk_profiles");
                        }
                        setBrowserSearch(b);
                        setActiveSubTab("browser");
                      }}
                      style={{
                        fontSize: 9.5,
                        padding: "2px 8px",
                        background: C.graphite,
                        border: `1px solid ${C.borderMid}`,
                        color: C.ash,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMid; e.currentTarget.style.color = C.ash; }}
                    >
                      {b}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 10, color: C.slate, fontStyle: "italic" }}>
                    Monitoreo macro satelital (sin playas fijas)
                  </span>
                )}
              </div>
            </div>

            {/* Connected Data streams & Quick Actions */}
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={{ ...T.label, fontSize: 9, display: "block", marginBottom: 4 }}>Fuentes Activas</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {regions[activeRegionIndex].dataStreams.map(ds => (
                    <span key={ds} style={{ fontSize: 9, color: C.gold, border: `1px solid rgba(207,181,59,0.15)`, padding: "1px 6px", background: "rgba(207,181,59,0.02)" }}>
                      {ds}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                {activeSubTab !== "map" && (
                  <button
                    onClick={() => setActiveSubTab("map")}
                    style={{
                      ...FONT, background: "transparent", border: `1px solid ${C.gold}`, color: C.gold,
                      fontSize: 9.5, padding: "4px 8px", cursor: "pointer", textTransform: "uppercase",
                      borderRadius: 0, outline: "none", display: "inline-flex", alignItems: "center", gap: 4
                    }}
                  >
                    <LucideMap size={10} /> Ver en Mapa
                  </button>
                )}
                {activeSubTab !== "browser" && (
                  <button
                    onClick={() => {
                      setActiveSubTab("browser");
                      if (regions[activeRegionIndex].beaches.length > 0) {
                        setActiveBrowserTable("beach_risk_profiles");
                      }
                    }}
                    style={{
                      ...FONT, background: "transparent", border: `1px solid ${C.borderMid}`, color: C.frost,
                      fontSize: 9.5, padding: "4px 8px", cursor: "pointer", textTransform: "uppercase",
                      borderRadius: 0, outline: "none", display: "inline-flex", alignItems: "center", gap: 4
                    }}
                  >
                    <Database size={10} /> Ver Datasets
                  </button>
                )}
              </div>
            </div>
          </div>}
        </div>
      </div>

      {/* ── Quick Stats Strip (M4) ── */}
      {(Object.keys(boletinDates).length > 0 || Object.keys(noaaDailyRisk).length > 0) && (() => {
        const semColor = (s: string) => { const u = s.toUpperCase(); if (u.includes("CRÍT") || u.includes("CRIT") || u.includes("MUYALTO")) return "#ef4444"; if (u.includes("ALTO")) return "#f97316"; if (u.includes("NORMAL") || u.includes("MODERADO")) return "#eab308"; return "#22c55e" }
        const latestB = Object.values(boletinDates).filter(b => b.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
        const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}` })()
        const todayRisk = noaaDailyRisk[todayKey] || noaaDailyRisk[Object.keys(noaaDailyRisk).sort().at(-1) || ""]
        const todayRiskDate = Object.keys(noaaDailyRisk).sort().at(-1) || ""
        const todayDominant = todayRisk?.high > 0 ? "HIGH" : todayRisk?.medium > 0 ? "MEDIUM" : todayRisk?.warning > 0 ? "WARNING" : "LOW"
        const todayColor = todayRisk?.high > 0 ? "#ef4444" : todayRisk?.medium > 0 ? "#f97316" : todayRisk?.warning > 0 ? "#eab308" : "#22c55e"
        const pipelineOk = data?.pipeline?.status === "ok"
        const pipelineColor = pipelineOk ? "#22c55e" : data?.pipeline?.status === "running" ? "#eab308" : "#ef4444"
        const stats = [
          {
            label: "SEMÁFORO ACTUAL",
            value: latestB?.semaforo || "–",
            sub: latestB ? `Boletín #${Object.entries(boletinDates).find(([,v])=>v===latestB)?.[0]} · ${latestB.fecha}` : "Sin datos",
            color: latestB?.semaforo ? semColor(latestB.semaforo) : C.slate,
            icon: Activity
          },
          {
            label: "BIOMASA CM",
            value: latestB?.cm_mt ? `${Number(latestB.cm_mt).toLocaleString("es-MX")} t` : "–",
            sub: "Caribe Mexicano · último boletín",
            color: C.gold,
            icon: Waves
          },
          {
            label: "NOAA SIR RECIENTE",
            value: todayRisk ? todayDominant : "–",
            sub: todayRiskDate ? `${todayRiskDate.slice(0,4)}-${todayRiskDate.slice(4,6)}-${todayRiskDate.slice(6,8)} · ${todayRisk?.high || 0} seg. HIGH` : "Sin datos",
            color: todayColor,
            icon: Globe
          },
          {
            label: "PIPELINE",
            value: data?.pipeline?.status === "ok" ? "✓ OK" : data?.pipeline?.status === "running" ? "⟳ Corriendo" : data?.pipeline?.status === "never_run" ? "Sin ejecutar" : "Error",
            sub: data?.pipeline?.finished_at ? `Último: ${new Date(data.pipeline.finished_at).toLocaleDateString("es-MX")}` : "–",
            color: pipelineColor,
            icon: RefreshCw
          }
        ]
        return (
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw) 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, border: `1px solid ${C.border}` }}>
              {stats.map((s, i) => (
                <div key={i} style={{ padding: "14px 18px", background: C.carbon, borderRight: i < 3 ? `1px solid ${C.border}` : "none", display: "flex", gap: 12, alignItems: "center" }}>
                  <s.icon size={20} style={{ color: s.color, flexShrink: 0, opacity: 0.9 }} />
                  <div>
                    <div style={{ fontSize: 8.5, color: C.slate, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
                    <div style={{ ...FONT, fontSize: 14, fontWeight: "bold", color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: C.slate, marginTop: 3 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── M1: Global Date + Zone Filter Bar ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 max(40px, 6vw) 16px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
          background: C.carbon,
          border: `1px solid ${(dateFrom || dateTo) ? "rgba(207,181,59,0.3)" : C.border}`,
          borderLeft: `3px solid ${(dateFrom || dateTo) ? C.gold : C.borderMid}`,
        }}>
          <span
            style={{ ...T.label, fontSize: 9, color: C.slate, flexShrink: 0 }}
            title="Este filtro de fecha aplica a TODAS las secciones simultáneamente: Cronología, Explorador, Galería SEMAR y lista KMZ"
          >RANGO GLOBAL ⓘ</span>
          <input
            type="month" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            title="Desde — aplica a todas las secciones"
            style={{ background: "transparent", border: `1px solid ${dateFrom ? C.gold : C.borderMid}`, color: dateFrom ? C.frost : C.slate, padding: "3px 8px", ...FONT, fontSize: 11, outline: "none", colorScheme: "dark" }}
          />
          <span style={{ color: C.slate, fontSize: 10 }}>–</span>
          <input
            type="month" value={dateTo} onChange={e => setDateTo(e.target.value)}
            title="Hasta"
            style={{ background: "transparent", border: `1px solid ${dateTo ? C.gold : C.borderMid}`, color: dateTo ? C.frost : C.slate, padding: "3px 8px", ...FONT, fontSize: 11, outline: "none", colorScheme: "dark" }}
          />
          {(dateFrom || dateTo) && (
            <>
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setSortState(null); setBrowserPage(1); setSemarMonthFilter("") }}
                style={{ ...FONT, fontSize: 10, color: C.slate, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 7px", cursor: "pointer", outline: "none" }}
                title="Limpiar filtros de fecha globales"
              >✕</button>
              <span style={{ fontSize: 9, color: C.gold, border: "1px solid rgba(207,181,59,0.2)", padding: "2px 8px", background: "rgba(207,181,59,0.04)" }}>
                Aplica a todas las secciones
              </span>
            </>
          )}
          <span style={{ marginLeft: "auto", ...T.caption, fontSize: 9, color: (dateFrom || dateTo) ? C.gold : C.slate }}>
            {activeRegionIndex !== 0 ? regions[activeRegionIndex].name : "Todo el Caribe"}
            {(dateFrom || dateTo) && ` · ${dateFrom || "inicio"} → ${dateTo || "fin"}`}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px max(40px, 6vw) 80px" }}>

        <div style={{ display: "flex", gap: 32, alignItems: "start" }}>

          {/* Left Sidebar Navigation */}
          <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, position: "sticky", top: 100 }}>
            <div style={{ padding: "0 12px 12px 12px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ ...T.labelGold, fontSize: 10 }}>SECCIONES DEL CATÁLOGO</span>
            </div>
            {/* Primary tabs */}
            {[
              { id: "cronologia", label: "Cronología", desc: "¿Qué pasó qué día? NOAA + boletines", icon: Calendar },
              { id: "map", label: "Mapa Geográfico", desc: "Ver sargazo en el mapa ahora mismo", icon: Globe },
              { id: "browser", label: "Explorador de Datos", desc: "Buscar y descargar los datos en tabla", icon: Database },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                style={{
                  position: "relative" as const,
                  display: "flex", gap: 12, padding: "12px 16px", alignItems: "center",
                  background: activeSubTab === tab.id ? "rgba(207,181,59,0.08)" : "transparent",
                  border: `1px solid ${activeSubTab === tab.id ? C.gold : "transparent"}`,
                  textAlign: "left" as const, cursor: "pointer", transition: "all 0.15s",
                  borderRadius: 0, outline: "none"
                }}
                onMouseEnter={e => {
                  if (activeSubTab !== tab.id) e.currentTarget.style.background = "rgba(255,255,255,0.02)"
                }}
                onMouseLeave={e => {
                  if (activeSubTab !== tab.id) e.currentTarget.style.background = "transparent"
                }}
              >
                {(dateFrom || dateTo) && (["browser", "cronologia"] as string[]).includes(tab.id) && (
                  <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: C.gold }} />
                )}
                <tab.icon size={18} style={{ color: activeSubTab === tab.id ? C.gold : C.slate, flexShrink: 0 }} />
                <div>
                  <div style={{ ...FONT, fontSize: 13, fontWeight: activeSubTab === tab.id ? "bold" : "normal", color: activeSubTab === tab.id ? C.frost : C.ash }}>{tab.label}</div>
                  <div style={{ ...T.caption, fontSize: 9, color: C.slate, marginTop: 2 }}>{tab.desc}</div>
                </div>
              </button>
            ))}

            {/* Administration divider */}
            <div style={{ padding: "10px 12px 4px", marginTop: 4 }}>
              <span style={{ ...FONT, fontSize: 8, color: C.border, letterSpacing: "1px", textTransform: "uppercase" as const }}>── Administración</span>
            </div>

            {/* Secondary tabs */}
            {[
              { id: "pipeline", label: "Orquestación Pipeline", desc: "Actualizar datos del servidor", icon: RefreshCw },
              { id: "architecture", label: "Datos y Almacenamiento", desc: "Boletines SEMAR e imágenes satelitales", icon: Server },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                style={{
                  position: "relative" as const,
                  display: "flex", gap: 12, padding: "12px 16px", alignItems: "center",
                  background: activeSubTab === tab.id ? "rgba(207,181,59,0.08)" : "transparent",
                  border: `1px solid ${activeSubTab === tab.id ? C.gold : "transparent"}`,
                  textAlign: "left" as const, cursor: "pointer", transition: "all 0.15s",
                  borderRadius: 0, outline: "none",
                  opacity: activeSubTab === tab.id ? 1 : 0.7,
                }}
                onMouseEnter={e => {
                  if (activeSubTab !== tab.id) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.opacity = "1" }
                }}
                onMouseLeave={e => {
                  if (activeSubTab !== tab.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "0.7" }
                }}
              >
                {(dateFrom || dateTo) && tab.id === "architecture" && (
                  <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: C.gold }} />
                )}
                <tab.icon size={18} style={{ color: activeSubTab === tab.id ? C.gold : C.slate, flexShrink: 0 }} />
                <div>
                  <div style={{ ...FONT, fontSize: 13, fontWeight: activeSubTab === tab.id ? "bold" : "normal", color: activeSubTab === tab.id ? C.frost : C.ash }}>{tab.label}</div>
                  <div style={{ ...T.caption, fontSize: 9, color: C.slate, marginTop: 2 }}>{tab.desc}</div>
                </div>
              </button>
            ))}

            {/* Status micro card at the bottom of the sidebar */}
            <div style={{ background: C.carbon, border: `1px solid ${C.border}`, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ ...T.caption, fontSize: 9, color: C.slate }}>ESTADO DEL SERVIDOR</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
                <span style={{ fontSize: 11, fontWeight: "bold", color: C.frost }}>Datos Locales Listos</span>
              </div>
              <div style={{ ...T.caption, fontSize: 9, color: C.ash, lineHeight: 1.4 }}>
                Sincronización histórica completa para Quintana Roo y Yucatán en disco y SQLite.
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeSubTab === "map" && renderMapSection()}
            {activeSubTab === "browser" && renderBrowserSection()}
            {activeSubTab === "cronologia" && renderCronologiaSection()}
            {activeSubTab === "pipeline" && renderPipelineSection()}
            {activeSubTab === "architecture" && renderArchitectureSection()}
          </div>
        </div>

      </div>
      {renderGalleryModal()}
    </div>
  )
}