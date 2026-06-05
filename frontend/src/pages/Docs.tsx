import React, { useState } from "react"
import { ArrowLeft, Waves, ArrowRight, Database, AlertTriangle, CheckCircle2 } from "lucide-react"

interface DocsProps {
  type: "methodology" | "layers"
  onBack: () => void
  onEnter: () => void
}

const FONT: React.CSSProperties = {
  fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontWeight: 300,
}

export function Docs({ type: initialType, onBack, onEnter }: DocsProps) {
  const [activeTab, setActiveTab] = useState<"methodology" | "layers">(initialType)

  const PAPERS = [
    {
      num: "01",
      title: "Allende-Arandia et al. 2023 — JGR Oceans",
      subtitle: "Lagrangian Characterization of Surface Transport",
      contribution: "Valida la parametrización de deriva superficial en el Caribe Mexicano. Confirma el uso del coeficiente de arrastre del viento (windage) del 2% y la trayectoria de corrientes hacia Cozumel. Sirve de base física para justificar el retardo causal entre la biomasa acumulada en el Atlántico Central y su arribo al Caribe Mexicano (ACO → CM).",
      tag: "Física y Deriva"
    },
    {
      num: "02",
      title: "Hu et al. 2023 — Remote Sensing of Environment",
      subtitle: "GASB Dataset (Great Atlantic Sargassum Belt)",
      contribution: "Creadores del dataset que cubre 288 meses de observaciones en 6 subregiones atlánticas. Explica la implementación de la red neuronal Res-UNet sobre imágenes satelitales MODIS/VIIRS para extraer el índice de algas flotantes AFAI (Alternative Floating Algae Index).",
      tag: "Teledetección / IA"
    },
    {
      num: "03",
      title: "De Amorim et al. 2025 — Harmful Algae",
      subtitle: "Transporte Amazonas-Caribe",
      contribution: "Valida el mecanismo de transporte de sargazo desde la pluma del río Amazonas hacia el Caribe impulsado por la Corriente del Norte de Brasil (NBC), la corriente de Guyana y la Corriente del Caribe.",
      tag: "Oceanografía"
    },
    {
      num: "04",
      title: "Cerdeira-Estrada et al. 2025 — SATsum CONABIO",
      subtitle: "Monitoreo satelital nacional",
      contribution: "Describe el funcionamiento del sistema de monitoreo satelital SATsum de la CONABIO en México. Utiliza imágenes MODIS a resolución de 1 km para la detección operativa local de acumulaciones.",
      tag: "Satélite Local"
    },
    {
      num: "05",
      title: "Mandelbrot & Van Ness 1968 — SIAM",
      subtitle: "Fractional Brownian Motion (fBm)",
      contribution: "Sustento matemático para el modelado del movimiento estocástico de las partículas. Justifica el valor del exponente de Hurst (H = 0.8047) obtenido en el análisis de series temporales de sargazo, confirmando que el proceso tiene memoria persistente a largo plazo.",
      tag: "Matemática Estocástica"
    },
    {
      num: "06",
      title: "Davies & Harte 1987 — Biometrika",
      subtitle: "Simulación de fBm con covarianza exacta",
      contribution: "Método matemático altamente eficiente para simular series de tiempo y desplazamientos fraccionales brownianos con covarianza exacta.",
      tag: "Algoritmia"
    },
    {
      num: "07",
      title: "Dagestad et al. 2018 — GMD",
      subtitle: "OpenDrift Framework",
      contribution: "Presentación de la arquitectura de simulación lagrangiana de código abierto OpenDrift utilizada para calcular el pronóstico físico de trayectorias en nuestro pipeline.",
      tag: "Modelado Físico"
    },
    {
      num: "08",
      title: "Wendland 1995 — radial basis functions",
      subtitle: "Kernel C2 para Interpolación Espacial",
      contribution: "Define las funciones de base radial compactas (CSRBF), específicamente el kernel Wendland C2, que se utiliza en la capa de riesgo ML para lograr una interpolación geoespacial robusta sin singularidades.",
      tag: "Geoestadística"
    }
  ]

  const DISCARDED = [
    {
      variable: "Viento como predictor directo en Fase 2 (Predicción de Biomasa)",
      reason: "Se encontró una correlación parcial débil e inversa (r = -0.22). El viento norte dominante es paralelo a la costa este de Cozumel, por lo que no genera un empuje perpendicular hacia las playas (onshore). Además, SEMAR no desglosa arribos este/oeste. El modelo que combinaba ACO + viento dio un R² = 0.77, inferior al modelo de solo ACO (R² = 0.78)."
    },
    {
      variable: "Temperatura Superficial del Mar (SST)",
      reason: "Aportaba un incremento marginal de R² de apenas +2.7% sobre la variable ACO con lag de 1 mes. Se le asignó prioridad muy baja (P9) y se excluyó para mantener la parsimonia del modelo."
    },
    {
      variable: "Modelos ARIMAX con muestra pequeña",
      reason: "No lograron converger con el tamaño de muestra histórico inicial (n = 13), retornando valores nulos. Requieren series de tiempo más extensas (n ≥ 24)."
    },
    {
      variable: "Prophet Multiplicativo",
      reason: "La estacionalidad aditiva obtuvo mejor ajuste sistemático en el Caribe. El modo multiplicativo fue eliminado del grid search de hiperparámetros."
    },
    {
      variable: "Movimiento Browniano Geométrico (GBM)",
      reason: "GBM asume que los incrementos son independientes (H = 0.5, ruido blanco), pero la serie temporal real del sargazo muestra una memoria persistente y de largo plazo muy alta (H = 0.80)."
    },
    {
      variable: "ARIMA con diferenciación entera (d)",
      reason: "No captura la naturaleza de integración fraccional de la serie (d = 0.3047)."
    },
    {
      variable: "Proceso de Ornstein-Uhlenbeck (OU) simple",
      reason: "Los residuos del modelo eran bimodales, lo que delató la presencia de dos regímenes de arribo distintos (temporada alta vs baja) que el modelo simple no podía separar por sí solo."
    }
  ]

  const LESSONS = [
    {
      title: "Mezcla de Lags (Mendeley vs SEMAR)",
      error: "Al combinar lags cruzados entre la serie histórica de Mendeley y los reportes recientes de SEMAR, la correlación original se invertía y se desplomaba de r = 0.918 a r = 0.47.",
      fix: "Se aisló el cálculo de lags temporales exclusivamente a partir de la serie de boletines homogéneos de SEMAR."
    },
    {
      title: "Confusión de Regiones (aligned_CM vs NWGoM)",
      error: "El dataset de Mendeley denominaba 'aligned_CM' a una región que en realidad correspondía al Noroeste del Golfo de México (NWGoM), no al Caribe Mexicano (CM). Mapear GASB contra esta serie daba una correlación errónea de r = -0.14.",
      fix: "Se realinearon y verificaron las coordenadas espaciales para garantizar la correspondencia exacta con el Caribe Mexicano."
    },
    {
      title: "Inflación de Correlación por Muestra Pequeña",
      error: "Un tamaño de muestra muy reducido de solo n = 9 puntos inflaba artificialmente la correlación de Pearson a r = 0.95.",
      fix: "Al expandir y limpiar la serie de datos a n = 14 puntos de control validados, la correlación se corrigió a un valor real y robusto de r = 0.89."
    },
    {
      title: "Tratamiento de Outliers de Biomasa",
      error: "Las lecturas extremas de biomasa mensual alcanzaban picos atípicos de hasta 82,699 toneladas que distorsionaban severamente las regresiones.",
      fix: "Se aplicó un filtro de winsorización al percentil 99 (P99) y escalado basado en medianas robustas."
    }
  ]

  return (
    <div style={{ minHeight: "100vh", color: "#ffffff", display: "flex", flexDirection: "column", background: "#000000", ...FONT }}>

      {/* Top Header — matches Landing nav exactly */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 max(40px, 6vw)",
        height: 56,
        background: "#000000",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {/* Left: back + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            title="Volver"
            style={{ ...FONT, background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "#858484", display: "flex", alignItems: "center", transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#858484" }}
          >
            <ArrowLeft size={14} />
          </button>
          <Waves size={14} style={{ color: "#ffffff" }} />
          <span style={{ fontSize: 13, letterSpacing: "0.52px", color: "#ffffff", textTransform: "uppercase" }}>
            Documentación Técnica
          </span>
        </div>

        {/* Center: tabs styled as Landing nav ghost buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setActiveTab("methodology")}
            style={{
              ...FONT,
              fontSize: 12,
              letterSpacing: "0.48px",
              color: activeTab === "methodology" ? "#ffffff" : "#858484",
              textTransform: "uppercase",
              border: activeTab === "methodology" ? "1px solid rgba(255,255,255,0.55)" : "1px solid rgba(255,255,255,0.18)",
              borderRadius: 0,
              padding: "8px 22px",
              background: activeTab === "methodology" ? "rgba(255,255,255,0.04)" : "transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              if (activeTab !== "methodology") {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.38)"
                ;(e.currentTarget as HTMLElement).style.color = "#d4d4d4"
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== "methodology") {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"
                ;(e.currentTarget as HTMLElement).style.color = "#858484"
              }
            }}
          >
            Bases Científicas
          </button>
          <button
            onClick={() => setActiveTab("layers")}
            style={{
              ...FONT,
              fontSize: 12,
              letterSpacing: "0.48px",
              color: activeTab === "layers" ? "#000000" : "#858484",
              textTransform: "uppercase",
              border: "none",
              borderRadius: 0,
              padding: "8px 22px",
              background: activeTab === "layers" ? "#cfb53b" : "transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              outline: activeTab === "layers" ? "none" : "1px solid rgba(255,255,255,0.18)",
              outlineOffset: "-1px",
            }}
            onMouseEnter={e => {
              if (activeTab === "layers") {
                (e.currentTarget as HTMLElement).style.background = "#baa335"
              } else {
                (e.currentTarget as HTMLElement).style.outlineColor = "rgba(255,255,255,0.38)"
                ;(e.currentTarget as HTMLElement).style.color = "#d4d4d4"
              }
            }}
            onMouseLeave={e => {
              if (activeTab === "layers") {
                (e.currentTarget as HTMLElement).style.background = "#cfb53b"
              } else {
                (e.currentTarget as HTMLElement).style.outlineColor = "rgba(255,255,255,0.18)"
                ;(e.currentTarget as HTMLElement).style.color = "#858484"
              }
            }}
          >
            Capas y Datos
          </button>
        </div>

        {/* Right: enter CTA */}
        <button
          onClick={onEnter}
          style={{
            ...FONT,
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 12, letterSpacing: "0.48px",
            color: "#000000", textTransform: "uppercase",
            border: "none", borderRadius: 0,
            padding: "8px 22px",
            background: "#cfb53b",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#baa335" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#cfb53b" }}
        >
          Entrar al Sistema
          <ArrowRight size={12} />
        </button>
      </header>

      {/* Main Content Scroll Area */}
      <main style={{ flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", padding: "48px max(40px, 6vw)" }}>
        
        {activeTab === "methodology" ? (
          <div className="space-y-16 animate-fade-in">
            {/* Header info */}
            <div>
              <h1 className="text-3xl font-light tracking-tight text-white mb-3">
                Sustento Científico y Validación
              </h1>
              <p className="text-sm text-zinc-400 max-w-2xl font-light leading-relaxed">
                El diseño predictivo y físico de este observatorio integra literatura científica, modelos estocásticos y una calibración de errores sistematizada para dar certidumbre a la toma de decisiones.
              </p>
            </div>

            {/* Grid of papers */}
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-widest text-[#cfb53b] font-mono">01 / Literatura Base</span>
                <h2 className="text-lg font-light mt-1">Papers y Referencias Científicas</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PAPERS.map((p) => (
                  <div key={p.num} className="border border-white/5 bg-zinc-950/40 p-6 flex flex-col justify-between hover:border-[#cfb53b]/20 transition-all duration-200">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-2xl font-mono text-zinc-700 leading-none">{p.num}</span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest border border-zinc-800 px-2 py-0.5">{p.tag}</span>
                      </div>
                      <h3 className="text-sm font-medium text-white leading-snug">{p.title}</h3>
                      <p className="text-xs text-zinc-400 font-mono mt-1 mb-3">{p.subtitle}</p>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">{p.contribution}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discarded variables */}
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-widest text-[#cfb53b] font-mono">02 / Parsimonia del Modelo</span>
                <h2 className="text-lg font-light mt-1">Variables y Enfoques Descartados</h2>
              </div>
              <div className="border border-white/5 divide-y divide-white/5 bg-zinc-950/20">
                {DISCARDED.map((d, i) => (
                  <div key={i} className="p-6 grid grid-cols-1 md:grid-cols-[1.3fr_2fr] gap-4 items-start">
                    <div className="flex gap-3 items-start">
                      <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-xs font-mono text-zinc-300 leading-snug">{d.variable}</span>
                    </div>
                    <div className="text-xs text-zinc-400 leading-relaxed font-light">
                      <span className="font-semibold text-zinc-350 block mb-1">Razón del Descarte:</span>
                      {d.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lessons and Errors */}
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-widest text-[#cfb53b] font-mono">03 / Depuración de Sesgos</span>
                <h2 className="text-lg font-light mt-1">Lecciones y Errores Depurados en el Pipeline</h2>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {LESSONS.map((l, i) => (
                  <div key={i} className="border border-white/5 bg-zinc-950/40 p-6 space-y-4">
                    <h3 className="text-xs font-mono text-[#cfb53b] uppercase tracking-wider">{l.title}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border-l-2 border-red-500/40 pl-4 space-y-1">
                        <span className="text-[10px] uppercase tracking-widest text-red-400 font-semibold font-mono">Sesgo / Error detectado:</span>
                        <p className="text-xs text-zinc-400 leading-relaxed font-light">{l.error}</p>
                      </div>
                      <div className="border-l-2 border-emerald-500/40 pl-4 space-y-1">
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold font-mono">Corrección e Impacto:</span>
                        <p className="text-xs text-zinc-400 leading-relaxed font-light">{l.fix}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Validation Methodologies */}
            <div className="space-y-6">
              <div className="border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-widest text-[#cfb53b] font-mono">04 / Métricas de Desempeño</span>
                <h2 className="text-lg font-light mt-1">Metodologías de Backtesting y Validación Cruzada</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border border-white/5 bg-zinc-950/40 p-6 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Database size={14} className="text-[#cfb53b]" />
                    <h3 className="text-sm font-medium">Ventana Expandible (Expanding Window)</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">
                    Implementado en <code className="text-[11px] font-mono text-zinc-300">backtest_modelos.py</code> para medir el desempeño real simulando predicciones mes a mes. En cada paso se entrena recursivamente agregando el mes real más reciente y prediciendo el siguiente. Las métricas de error (RMSE, MAE, SMAPE, Bias y Pearson) se calculan en escala real convirtiendo los outputs logarítmicos mediante la función exponencial.
                  </p>
                </div>

                <div className="border border-white/5 bg-zinc-950/40 p-6 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <h3 className="text-sm font-medium">Validación Cruzada LOOCV</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">
                    Implementado en <code className="text-[11px] font-mono text-zinc-300">modelos_fase1.py</code> para evaluar predicciones sobre muestras pequeñas (n=14). Los coeficientes de determinación R² obtenidos definen dinámicamente los pesos del ensemble final:
                  </p>
                  <div className="bg-black/40 border border-white/5 p-3 font-mono text-[10px] text-zinc-300 space-y-1">
                    <div>peso = max(0.05, R²_LOOCV)</div>
                    <div>pred_ensemble = Σ(peso_j * pred_j) / Σ(peso_j)</div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">
                    Un factor de calibración empírico calcula el intervalo de confianza del 80% (IC80) a partir del RMSE de validación cruzada.
                  </p>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="space-y-16 animate-fade-in">
            {/* Header info */}
            <div>
              <h1 className="text-3xl font-light tracking-tight text-white mb-3">
                Arquitectura de Capas de Mapeo
              </h1>
              <p className="text-sm text-zinc-400 max-w-2xl font-light leading-relaxed">
                Detalle técnico, origen de datos y procesamiento de las cuatro capas cartográficas integradas para lograr un monitoreo continuo e integral.
              </p>
            </div>

            {/* Layer Cards */}
            <div className="space-y-10">
              
              {/* Capa 1 */}
              <div className="border border-white/5 bg-zinc-950/40 p-8 space-y-6">
                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div>
                    <span className="text-xs font-mono text-[#cfb53b] uppercase tracking-wider">Capa 01</span>
                    <h2 className="text-xl font-light text-white mt-1">NOAA SIR (Sargassum Inundation Risk)</h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">Observación Satelital Directa</p>
                  </div>
                  <span className="text-[10px] font-mono border border-zinc-800 px-3 py-1 text-zinc-400 uppercase tracking-widest">Satelital</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Descripción:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">
                        Representa las observaciones físicas del nivel de riesgo satelital en las costas del Caribe, reportadas directamente por el Atlantic Oceanographic and Meteorological Laboratory (AOML) de la NOAA.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Tipo de Datos:</span>
                      <ul className="text-xs text-zinc-400 space-y-1 font-light">
                        <li>• Formato: GeoJSON LineString (segmentos costeros)</li>
                        <li>• Propiedades: <code className="text-[10px] font-mono text-zinc-300">risk</code> (low, warning, medium, high), <code className="text-[10px] font-mono text-zinc-300">date</code> (YYYYMMDD)</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Origen y Procesamiento:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">
                        Se descargan diariamente archivos KMZ comprimidos de la NOAA, se descomprimen en memoria, se parsean los Placemarks con coordenadas y etiquetas de riesgo, y se filtran geográficamente (Longitud -93° a -86°) para Quintana Roo y Yucatán. El histórico consolidado abarca 338 fechas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capa 2 */}
              <div className="border border-white/5 bg-zinc-950/40 p-8 space-y-6">
                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div>
                    <span className="text-xs font-mono text-[#cfb53b] uppercase tracking-wider">Capa 02</span>
                    <h2 className="text-xl font-light text-white mt-1">Riesgo ML (Machine Learning)</h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">Diagnóstico de Riesgo Interpolado</p>
                  </div>
                  <span className="text-[10px] font-mono border border-zinc-800 px-3 py-1 text-zinc-400 uppercase tracking-widest">Modelo Espacial</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Descripción:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">
                        Malla de riesgo costero continuo interpolada espacialmente para resolver la falta de órbita directa o la cobertura nubosa en el satélite NOAA.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Tipo de Datos:</span>
                      <ul className="text-xs text-zinc-400 space-y-1 font-light">
                        <li>• Formato: GeoJSON Polygon (celdas rectangulares de 0.04° de resolución, ~4.4 km)</li>
                        <li>• Propiedades: <code className="text-[10px] font-mono text-zinc-300">risk</code> (low, warning, medium, high), <code className="text-[10px] font-mono text-zinc-300">rv</code> (riesgo continuo 0-1)</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Metodología y Algoritmo:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light font-light">
                        Toma el grid de 338 fechas acumuladas de NOAA. Aplica un submuestreo espacial (distancia de exclusión 0.04°) e interpolación con un kernel anisotrópico <strong>Wendland C2</strong> (radio σ_lon = 0.5°, σ_lat = 0.25°), proyectando el sargazo preferencialmente este-oeste. Aplica máscara de tierra para evitar que el riesgo se desborde sobre tierra firme.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capa 3 */}
              <div className="border border-white/5 bg-zinc-950/40 p-8 space-y-6">
                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div>
                    <span className="text-xs font-mono text-[#cfb53b] uppercase tracking-wider">Capa 03</span>
                    <h2 className="text-xl font-light text-white mt-1">Densidad KDE (Kernel Density Estimation)</h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">Pronóstico de Acumulación a 14 días</p>
                  </div>
                  <span className="text-[10px] font-mono border border-zinc-800 px-3 py-1 text-zinc-400 uppercase tracking-widest">Estocástico</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Descripción:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">
                        Representa el mapa de calor continuo de la densidad de probabilidad espacial de acumulación de sargazo a lo largo del horizonte predictivo.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Tipo de Datos:</span>
                      <ul className="text-xs text-zinc-400 space-y-1 font-light">
                        <li>• Formato: GeoJSON Point (malla densa de probabilidad)</li>
                        <li>• Renderizado: Capa <code className="text-[10px] font-mono text-zinc-300">heatmap</code> dinámica en el cliente usando WebGL</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Procesamiento y Frecuencia:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light font-light">
                        A partir de las posiciones de las partículas del simulador físico, calcula una densidad kernel 2D gaussiana con ancho de banda fijo (bandwidth = 0.08° o ~9 km) para garantizar la consistencia en todos los zooms y densidades.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capa 4 */}
              <div className="border border-white/5 bg-zinc-950/40 p-8 space-y-6">
                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div>
                    <span className="text-xs font-mono text-[#cfb53b] uppercase tracking-wider">Capa 04</span>
                    <h2 className="text-xl font-light text-white mt-1">Trayectorias Lagrangianas</h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">Forecast de Deriva Física Directa</p>
                  </div>
                  <span className="text-[10px] font-mono border border-zinc-800 px-3 py-1 text-zinc-400 uppercase tracking-widest">Física</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Descripción:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light">
                        Simulación física e individual del movimiento de parcelas de agua con sargazo arrastradas por los forzantes marinos dominantes.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Ecuación de Deriva:</span>
                      <div className="bg-black/40 border border-white/5 p-3 font-mono text-[10px] text-zinc-350">
                        u_partícula = 1.5 * u_corriente + 0.02 * u_viento + ε_difusión
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2 font-light">
                        Donde se aplica un arrastre del viento (windage) calibrado del 2% y corrientes RTOFS aceleradas a 1.5x.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">Simulación Operativa:</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-light font-light">
                        Basado en el framework <strong>OpenDrift</strong>. Siembra 2,000 partículas en la zona de aproximación al Caribe y canal de Cozumel, simulando 14 días (336h) en pasos de tiempo físicos de 30 minutos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "32px 0", marginTop: 48, background: "#000000" }}>
        <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "0 max(40px, 6vw)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: 12, letterSpacing: "0.48px", color: "#858484", textTransform: "uppercase", fontFamily: "monospace" }}>
          <span>© 2026 Cipre Holding · Cozumel, Quintana Roo</span>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#858484", fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase", fontFamily: "monospace", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#858484" }}>
              Volver a Inicio
            </button>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <button onClick={onEnter} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#858484", fontSize: 12, letterSpacing: "0.48px", textTransform: "uppercase", fontFamily: "monospace", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#cfb53b" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#858484" }}>
              Entrar al Sistema
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
