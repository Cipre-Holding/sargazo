import { useState, useCallback, useEffect, useRef } from "react"
import { Map, MapControls, useMap, MapMarker, MarkerContent, MapPopup } from "@/components/ui/map"
import { SirLayer } from "@/components/map/SirLayer"
import { MlRiskLayer } from "@/components/map/MlRiskLayer"
import { KdeLayer } from "@/components/map/KdeLayer"
import { TrajectoryLayer } from "@/components/map/TrajectoryLayer"
import { useApi } from "@/hooks/useApi"
import { Dashboard } from "@/components/panels/Dashboard"
import { ManualInputDialog } from "@/components/panels/ManualInputDialog"
import { InfoPanel } from "@/components/panels/InfoPanel"
import {
  Waves, Download, ChevronLeft, LayoutDashboard, Target,
  Layers, TrendingUp, Settings, RefreshCw, AlertTriangle, CircleHelp,
} from "lucide-react"
import "./App.css"

// ── Constants ─────────────────────────────────────────────────────────────────

const HORIZONS = [
  { value: "12h",  label: "12h" },
  { value: "24h",  label: "24h" },
  { value: "48h",  label: "48h" },
  { value: "72h",  label: "72h" },
  { value: "144h", label: "6d"  },
  { value: "336h", label: "14d" },
]

const LAYERS_CONFIG = [
  {
    id: "mlrisk",      label: "Riesgo ML (Machine Learning)",
    desc: "Riesgo interpolado (Wendland C2) · Malla ~4km",
    colorVar: "--color-risk-medium",
  },
  {
    id: "sir",         label: "NOAA SIR (Satelital)",
    desc: "Riesgo costero satelital NOAA AOML diario",
    colorVar: "--color-risk-high",
  },
  {
    id: "kde",         label: "Densidad KDE (14 días)",
    desc: "Densidad de partículas (Kernel Density Estimation)",
    colorVar: "--color-success",
  },
  {
    id: "trajectories", label: "Trayectorias Lagrangianas",
    desc: "Deriva física a 14d (corrientes RTOFS + viento GFS)",
    colorVar: "--color-primary",
  },
]

const SEMAFORO_LEVELS = [
  { max: 1000,     label: "ESCASO",   color: "var(--color-success)" },
  { max: 5000,     label: "MUY BAJO", color: "oklch(0.72 0.17 140)" },
  { max: 15000,    label: "BAJO",     color: "var(--color-warning)" },
  { max: 40000,    label: "MODERADO", color: "var(--color-risk-warning)" },
  { max: 80000,    label: "ALTO",     color: "var(--color-risk-medium)" },
  { max: Infinity, label: "MUY ALTO", color: "var(--color-risk-high)" },
]

type SidebarTab = "pred" | "layers" | "system"

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSemaforo(ton: number) {
  for (const s of SEMAFORO_LEVELS) {
    if (ton < s.max) return s
  }
  return SEMAFORO_LEVELS[5]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RecenterBtn() {
  const { map } = useMap()
  return (
    <button
      onClick={() => map?.flyTo({ center: [-86.95, 20.51], zoom: 10, duration: 1000 })}
      className="flex size-9 items-center justify-center rounded-xl border border-border/40 bg-surface/80 backdrop-blur text-muted hover:text-fg hover:bg-surface-raised transition-all duration-150 cursor-pointer shadow-lg shadow-black/30"
      title="Centrar en Cozumel"
    >
      <Target className="size-4" />
    </button>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [layers, setLayers] = useState<Record<string, boolean>>({
    mlrisk: true, sir: false, kde: false, trajectories: false,
  })
  const [horizon, setHorizon]           = useState("48h")
  const [sirDate, setSirDate]           = useState("")
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [infoOpen, setInfoOpen]         = useState(false)
  const [activeTab, setActiveTab]       = useState<SidebarTab>("pred")
  const [slowLoad, setSlowLoad]         = useState(false)
  const [selectedBeach, setSelectedBeach] = useState<any>(null)
  const mapRef                          = useRef<any>(null)

  const { data: predictions, loading: loadingPred } = useApi<any>("/predictions")
  const { data: allSirDates }                            = useApi<string[]>("/forecast/geodata/sir/dates")
  const sirGeoUrl = layers.sir
    ? (sirDate ? `/forecast/geodata/sir?date=${sirDate}` : "/forecast/geodata/sir")
    : null
  const { data: sirGeojson }                             = useApi<any>(sirGeoUrl)
  const { data: mlRisk }                                 = useApi<any>(layers.mlrisk ? "/forecast/geodata/ml-risk" : null)
  const { data: kdeData }                                = useApi<any>(layers.kde ? "/forecast/kde" : null)
  const { data: trajectories }                           = useApi<any[]>(layers.trajectories ? "/forecast/trajectories" : null)
  const { data: beachRisk }                              = useApi<any>("/forecast/risk-by-beach")
  const { data: features }                               = useApi<any[]>("/observations/features/cm")
  const { data: downloadStatus, refetch: refetchDownload } = useApi<any>("/download/status")
  const { data: backtestDetailed }                       = useApi<any>("/predictions/backtest")

  // Detect Cloud Run cold start — show message after 6s of loading
  useEffect(() => {
    if (!loadingPred) return
    const t = setTimeout(() => setSlowLoad(true), 6000)
    return () => clearTimeout(t)
  }, [loadingPred])
  useEffect(() => { if (!loadingPred) setSlowLoad(false) }, [loadingPred])

  useEffect(() => {
    if (!allSirDates || allSirDates.length === 0) return
    if (!sirDate || !allSirDates.includes(sirDate)) {
      setSirDate(allSirDates[allSirDates.length - 1])
    }
  }, [allSirDates, sirDate])

  const toggleLayer = useCallback(
    (id: string) => setLayers(p => ({ ...p, [id]: !p[id] })),
    []
  )

  const triggerDownload = useCallback(async () => {
    try {
      await fetch("/api/download/run", { method: "POST" })
      setTimeout(refetchDownload, 2000)
    } catch {}
  }, [refetchDownload])

  const handleSirDates = useCallback((_dates: string[]) => {}, [])

  // Derived data
  const ensemble      = predictions?.predicciones_fase1?.ensemble ?? null
  const prophet       = predictions?.predicciones_fase1?.['1.6_prophet_tuned'] ?? null
  const confidence    = ensemble?.confidence_score ?? null
  const beachSegments = beachRisk?.segmentos ?? []
  const semaforoLevel = ensemble?.prediccion_junio?.cm_ton ? getSemaforo(ensemble.prediccion_junio.cm_ton) : null

  const alerts: { type: "error" | "warning"; text: string }[] = []
  if ((ensemble?.prediccion_junio?.cm_ton ?? 0) > 100000)
    alerts.push({ type: "error",   text: `Predicción jun > 100k ton (${((ensemble?.prediccion_junio?.cm_ton ?? 0) / 1000).toFixed(0)}k)` })
  else if ((ensemble?.prediccion_junio?.cm_ton ?? 0) > 50000)
    alerts.push({ type: "warning", text: `Predicción jun alta: ${((ensemble?.prediccion_junio?.cm_ton ?? 0) / 1000).toFixed(0)}k ton` })
  if (beachSegments[0]?.pct_high_medium > 70)
    alerts.push({ type: "warning", text: `${beachSegments[0].name}: ${beachSegments[0].pct_high_medium}% riesgo alto` })

  const isRunning = downloadStatus?.status === "running"

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* ── Map (full background) ────────────────────────────────────────── */}
      <Map ref={mapRef} className="absolute inset-0" center={[-87.0, 20.3]} zoom={8.5} theme="dark">
        <div className="absolute top-[4.5rem] right-3 z-20">
          <RecenterBtn />
        </div>
        <MapControls position="bottom-right" showZoom showCompass />
        <SirLayer
          geojson={sirGeojson as any}
          visible={layers.sir}
          selectedDate={sirDate || undefined}
          onDatesAvailable={handleSirDates}
        />
        <MlRiskLayer  geojson={mlRisk as any}         visible={layers.mlrisk} />
        <KdeLayer     kdeData={kdeData as any}         horizon={horizon}       visible={layers.kde} />
        <TrajectoryLayer trajectories={trajectories as any}                    visible={layers.trajectories} />

        {/* Beach risk markers */}
        {beachSegments.map((beach: any) => {
          if (beach.lat === undefined || beach.lon === undefined) return null
          const riskColor = beach.pct_high_medium > 65
            ? 'var(--color-risk-high)'
            : beach.pct_high_medium > 50
            ? 'var(--color-risk-medium)'
            : beach.pct_high_medium > 0
            ? 'var(--color-risk-warning)'
            : 'var(--color-risk-low)'
          return (
            <MapMarker
              key={beach.id}
              longitude={beach.lon}
              latitude={beach.lat}
              onClick={() => setSelectedBeach(beach)}
            >
              <MarkerContent>
                <button
                  className="size-5 rounded-full border-2 border-white shadow-lg shadow-black/50 hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer"
                  style={{ backgroundColor: riskColor }}
                  title={`${beach.name} (${beach.pct_high_medium}% riesgo)`}
                />
              </MarkerContent>
            </MapMarker>
          )
        })}

        {/* Beach Details Popup */}
        {selectedBeach && (
          <MapPopup
            longitude={selectedBeach.lon}
            latitude={selectedBeach.lat}
            onClose={() => setSelectedBeach(null)}
            closeButton={true}
            className="w-64 bg-surface border border-border/40 text-fg p-4 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-fg border-b border-border/30 pb-1.5 tracking-tight">
                {selectedBeach.name}
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Riesgo Alto+Medio</span>
                  <span className="font-bold text-primary font-mono">{selectedBeach.pct_high_medium}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Riesgo Promedio</span>
                  <span className="font-semibold font-mono">{selectedBeach.riesgo_promedio.toFixed(2)} / 3.0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Registros con datos</span>
                  <span className="font-mono text-muted">{selectedBeach.n_dias_con_datos} días</span>
                </div>
              </div>
            </div>
          </MapPopup>
        )}
      </Map>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="absolute top-3 left-3 right-3 z-30 flex items-center gap-2.5 rounded-2xl border border-border/40 bg-surface/80 backdrop-blur-xl px-3 py-2 shadow-xl shadow-black/40">

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-surface-raised/60 text-muted hover:text-fg hover:bg-surface-raised transition-all duration-150 cursor-pointer"
          title={sidebarOpen ? "Cerrar panel" : "Abrir panel"}
        >
          <ChevronLeft className={`size-4 transition-transform duration-200 ${sidebarOpen ? "" : "rotate-180"}`} />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <img src="https://cipreholding.com/img/logos/LOGO-CIPRE-W.svg" className="h-4 w-auto opacity-90 brightness-110 shrink-0" alt="CIPRE" />
          <div className="h-3.5 w-px bg-border/50 shrink-0" />
          <Waves className="size-4 shrink-0 text-primary" />
          <span className="font-semibold text-sm tracking-tight text-fg">Sargazo Cozumel</span>
          <span className="hidden lg:inline text-[11px] text-muted border-l border-border/50 pl-2.5">
            Monitoreo y predicción operativa
          </span>
        </div>

        <div className="flex-1" />

        {/* Alert badge */}
        {alerts.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border"
            style={{
              background: 'var(--color-accent-soft)',
              borderColor: 'color-mix(in oklch, var(--color-warning) 25%, transparent)',
            }}>
            <AlertTriangle className="size-3 text-warning" />
            <span className="text-[10px] font-semibold text-warning">
              {alerts.length} alerta{alerts.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/30 bg-surface-raised/40">
          <span className={`size-1.5 rounded-full ${isRunning ? "bg-warning animate-pulse" : "bg-success"}`} />
          <span className="hidden sm:inline text-[11px] text-muted">
            {isRunning ? "Actualizando" : "Operativo"}
          </span>
        </div>

        {/* Info button */}
        <button
          onClick={() => setInfoOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary-soft/15 border border-primary/30 hover:bg-primary-soft/25 transition-all duration-150 cursor-pointer"
          title="Centro de Información"
        >
          <CircleHelp className="size-3.5" />
          <span className="hidden sm:inline">¿Dudas? Más info</span>
        </button>

        {/* Dashboard button */}
        <button
          onClick={() => setDashboardOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-muted hover:text-fg hover:bg-surface-raised border border-transparent hover:border-border/40 transition-all duration-150 cursor-pointer"
          title="Dashboard"
        >
          <LayoutDashboard className="size-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>
      </header>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`absolute top-[3.75rem] left-3 z-20 w-96 bottom-14 transition-all duration-300 ease-out ${
        sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[420px] opacity-0 pointer-events-none"
      }`}>
        <div className="h-full flex flex-col rounded-2xl border border-border/40 bg-surface/88 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden mt-2">

          {/* ── Tab bar ── */}
          <div className="flex border-b border-border/40 px-2 pt-2 gap-0.5 shrink-0">
            {([
              { id: "pred"   as SidebarTab, Icon: TrendingUp, label: "Predicción" },
              { id: "layers" as SidebarTab, Icon: Layers,     label: "Capas"      },
              { id: "system" as SidebarTab, Icon: Settings,   label: "Sistema"    },
            ] as const).map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 pb-2.5 pt-2 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-150 cursor-pointer rounded-t-lg ${
                  activeTab === id
                    ? "border-primary text-fg"
                    : "border-transparent text-muted hover:text-fg hover:border-border/50"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">

            {/* ════════ TAB: PREDICCIÓN ════════ */}
            {activeTab === "pred" && (
              <>
                {/* Loading skeleton */}
                {!ensemble && !confidence && beachSegments.length === 0 && (
                  <div className="space-y-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="rounded-xl border border-border/40 p-4 animate-pulse">
                        <div className="h-3 w-24 rounded bg-border/40 mb-3" />
                        <div className="h-8 w-32 rounded bg-border/40 mb-2" />
                        <div className="h-3 w-20 rounded bg-border/30" />
                      </div>
                    ))}
                    {slowLoad && (
                      <div className="px-3 py-2.5 rounded-xl border border-border/30 text-[10px] text-muted/70 text-center">
                        Iniciando servidor… puede tomar<br />
                        <span className="font-semibold text-muted">20–30 segundos</span> en primer acceso
                      </div>
                    )}
                  </div>
                )}
                {/* KPI Card */}
                {ensemble && (
                  <div className="rounded-xl border border-border bg-gradient-to-br from-primary-soft/30 to-bg/85 p-4 shadow-lg shadow-black/25">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">
                        Predicción Junio 2026
                      </span>
                      {confidence && (
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          confidence.nivel === "ALTA"
                            ? "border-success/20 text-success"
                            : "border-warning/20 text-warning"
                        }`} style={{
                          background: confidence.nivel === "ALTA"
                            ? 'oklch(0.76 0.18 165 / 0.1)'
                            : 'oklch(0.78 0.17 85 / 0.1)',
                        }}>
                          {confidence.porcentaje}% {confidence.nivel}
                        </span>
                      )}
                    </div>

                    {/* Big number */}
                    <div className="flex items-end gap-2.5 mb-2">
                      <span className="text-5xl leading-none font-bold tabular-nums tracking-tighter text-fg font-mono">
                        {(ensemble.prediccion_junio.cm_ton / 1000).toFixed(1)}
                      </span>
                      <div className="pb-1 space-y-0.5">
                        <div className="text-xs text-muted font-medium">×10³ ton</div>
                        {semaforoLevel && (
                          <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: semaforoLevel.color }}>
                            {semaforoLevel.label}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Change vs mayo */}
                    {ensemble.prediccion_junio.cambio_pct_vs_mayo !== undefined && (
                      <div className="flex items-center gap-1 mb-3 text-xs font-semibold">
                        <span style={{ color: ensemble.prediccion_junio.cambio_pct_vs_mayo > 0 ? 'var(--color-risk-high)' : 'var(--color-success)' }}>
                          {ensemble.prediccion_junio.cambio_pct_vs_mayo > 0 ? "▲" : "▼"}
                          {" "}{Math.abs(ensemble.prediccion_junio.cambio_pct_vs_mayo).toFixed(1)}%
                        </span>
                        <span className="text-muted font-normal">vs mayo</span>
                      </div>
                    )}

                    {/* IC 80% bar */}
                    {ensemble.prediccion_junio.ci_80_mt && (() => {
                      const lo  = ensemble.prediccion_junio.ci_80_mt[0] * 1_000_000 / 1000
                      const hi  = ensemble.prediccion_junio.ci_80_mt[1] * 1_000_000 / 1000
                      const val = ensemble.prediccion_junio.cm_ton / 1000
                      const pct = (hi - lo) > 0 ? ((val - lo) / (hi - lo)) * 100 : 50
                      return (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-muted mb-1">
                            <span>IC 80%</span>
                            <span className="font-mono tabular-nums">{lo.toFixed(0)} – {hi.toFixed(0)} k</span>
                          </div>
                          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                            <div className="absolute inset-0 rounded-full opacity-20" style={{ background: 'var(--color-primary)' }} />
                            <div className="absolute top-0 bottom-0 w-px rounded-full bg-fg/80"
                              style={{ left: `${Math.min(Math.max(pct, 4), 96)}%` }} />
                          </div>
                        </div>
                      )
                    })()}

                    {/* Prophet row */}
                    {prophet?.proyeccion_junio_2026_aco_mt && (
                      <div className="pt-2.5 border-t border-border/30 flex justify-between text-sm">
                        <span className="text-muted" title="Prophet n≈303, serie histórica GASB/ACO">
                          Prophet ACO jun
                        </span>
                        <span className="font-mono tabular-nums font-bold" style={{ color: 'var(--color-accent)' }}>
                          {prophet.proyeccion_junio_2026_aco_mt.toFixed(2)} Mt
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Confidence breakdown */}
                {confidence && (
                  <div className="rounded-xl border border-border/40 p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">
                        Confianza
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${
                        confidence.nivel === "ALTA" ? "text-success"
                          : confidence.nivel === "MEDIA" ? "text-warning"
                          : "text-error"
                      }`}>{confidence.porcentaje}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${confidence.porcentaje}%`,
                        background: confidence.nivel === "ALTA" ? 'var(--color-success)' : 'var(--color-warning)',
                      }} />
                    </div>
                    {confidence.desglose && (
                      <div className="space-y-1.5">
                        {Object.entries(confidence.desglose).map(([k, v]: [string, any]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-xs text-muted truncate flex-1 capitalize">
                              {k.replace(/_/g, ' ')}
                            </span>
                            <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(100, (v.puntos / v.max) * 100)}%`,
                                background: 'var(--color-primary)',
                                opacity: 0.75,
                              }} />
                            </div>
                            <span className="text-xs font-mono text-muted tabular-nums w-8 text-right">
                              {v.puntos}/{v.max}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Beach risk */}
                {beachSegments.length > 0 && (
                  <div className="rounded-xl border border-border/40 p-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
                      Riesgo por playa
                    </h3>
                    <div className="space-y-2">
                      {beachSegments.slice(0, 5).map((s: any) => {
                        const riskColor = s.pct_high_medium > 65
                          ? 'var(--color-risk-high)'
                          : s.pct_high_medium > 50
                          ? 'var(--color-risk-medium)'
                          : 'var(--color-risk-warning)'
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedBeach(s)
                              mapRef.current?.flyTo({ center: [s.lon, s.lat], zoom: 11.5, duration: 1200 })
                            }}
                            className="w-full text-left space-y-1 block hover:bg-surface-raised/40 p-1.5 rounded-lg transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-fg group-hover:text-primary transition-colors font-medium truncate pr-2">{s.name}</span>
                              <span className="text-xs font-mono font-bold tabular-nums shrink-0"
                                style={{ color: riskColor }}>
                                {s.pct_high_medium}%
                              </span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{
                                width: `${s.pct_high_medium}%`,
                                background: riskColor,
                              }} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Alerts in prediction tab */}
                {alerts.length > 0 && (
                  <div className="space-y-1.5">
                    {alerts.map((a, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs border ${
                        a.type === "error"
                          ? "text-risk-high border-risk-high/20"
                          : "text-warning border-warning/20"
                      }`} style={{
                        background: a.type === "error"
                          ? 'color-mix(in oklch, var(--color-risk-high) 10%, transparent)'
                          : 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                      }}>
                        <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                        <span>{a.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── TAB: CAPAS ─── */}
            {activeTab === "layers" && (
              <>
                {/* Layer toggles */}
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  {LAYERS_CONFIG.map((l, i) => (
                    <div key={l.id}>
                      {i > 0 && <div className="h-px mx-3" style={{ background: 'var(--color-border)', opacity: 0.5 }} />}
                      <button
                        onClick={() => toggleLayer(l.id)}
                        className={`w-full flex items-center gap-3 px-3 py-3 transition-all duration-150 cursor-pointer text-left ${
                          layers[l.id] ? "bg-surface-raised/50" : "hover:bg-surface-raised/25"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`size-4 rounded border-2 shrink-0 transition-all duration-150 flex items-center justify-center ${
                          layers[l.id] ? "border-transparent" : "border-border/60 bg-transparent"
                        }`} style={layers[l.id] ? { background: `var(${l.colorVar})` } : undefined}>
                          {layers[l.id] && (
                            <svg viewBox="0 0 12 12" className="size-3 text-white">
                              <path d="M3 6l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className={`text-base font-semibold transition-colors ${
                            layers[l.id] ? "text-fg" : "text-muted"
                          }`}>{l.label}</div>
                          <div className="text-xs text-muted/60 truncate">{l.desc}</div>
                        </div>

                        {layers[l.id] && (
                          <div className="size-1.5 rounded-full shrink-0" style={{ background: `var(${l.colorVar})` }} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Horizon selector — visible when KDE active */}
                {layers.kde && (
                  <div className="rounded-xl border border-border/40 p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted">
                        Horizonte KDE
                      </label>
                      <span className="text-xs font-mono text-muted">{horizon}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {HORIZONS.map((h) => (
                        <button
                          key={h.value}
                          onClick={() => setHorizon(h.value)}
                          className={`text-center py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                            horizon === h.value
                              ? "text-white shadow-sm"
                              : "text-muted hover:text-fg"
                          }`}
                          style={{
                            background: horizon === h.value
                              ? 'var(--color-primary)'
                              : 'var(--color-surface-raised)',
                          }}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SIR date slider — visible when SIR active */}
                {layers.sir && (allSirDates?.length ?? 0) > 1 && (
                  <div className="rounded-xl border border-border/40 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted">
                        Fecha SIR
                        <span className="font-normal ml-1 opacity-60">
                          ({allSirDates?.length}d)
                        </span>
                      </label>
                      <span className="text-xs font-mono font-semibold text-fg tabular-nums">{sirDate}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={(allSirDates?.length ?? 1) - 1}
                      value={Math.max(0, (allSirDates ?? []).indexOf(sirDate))}
                      onChange={(e) => setSirDate((allSirDates ?? [])[parseInt(e.target.value)])}
                      className="w-full cursor-pointer"
                      style={{ accentColor: 'var(--color-risk-high)' }}
                    />
                    <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--color-muted)', opacity: 0.6 }}>
                      <span>{allSirDates?.[0]}</span>
                      <span>{allSirDates?.[allSirDates.length - 1]}</span>
                    </div>
                  </div>
                )}

                {/* Info about layer counts */}
                <div className="rounded-xl border border-border/30 p-3 text-xs text-muted/60 space-y-1">
                  <div className="flex justify-between"><span>Fechas NOAA SIR</span><span className="font-mono">315</span></div>
                  <div className="flex justify-between"><span>Celdas ML interpoladas</span><span className="font-mono">915</span></div>
                  <div className="flex justify-between"><span>Partículas Lagrangianas</span><span className="font-mono">2 000</span></div>
                  <div className="flex justify-between"><span>Horizontes disponibles</span><span className="font-mono">12h – 14d</span></div>
                </div>
              </>
            )}

            {/* ════════ TAB: SISTEMA ════════ */}
            {activeTab === "system" && (
              <>
                {/* Status card */}
                <div className="rounded-xl border border-border/40 p-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Estado</h3>
                    <div className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${
                        isRunning ? "bg-warning animate-pulse"
                          : downloadStatus?.status === "ok" ? "bg-success"
                          : "bg-muted"
                      }`} />
                      <span className="text-xs text-muted">
                        {isRunning ? "Actualizando pipeline"
                          : downloadStatus?.status === "ok" ? "Operativo"
                          : "Sin datos"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      ["Serie histórica", "2000-2026"],
                      ["Fuentes",         "SEMAR + Mendeley + SATsum"],
                      ["Datos NOAA SIR",  "315 días"],
                      ["Partículas",      "2000 · RTOFS+GFS"],
                      ["Modelos activos", "Fase 0/1/2 + Ensemble"],
                      ["Pipeline",        "Lunes 06:00 UTC"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-muted">{k}</span>
                        <span className="font-mono text-fg/80 text-right max-w-[55%] truncate text-[10px]">{v}</span>
                      </div>
                    ))}
                    {downloadStatus?.finished_at && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Última actualización</span>
                        <span className="font-mono text-fg/80 tabular-nums text-[10px]">
                          {downloadStatus.finished_at.slice(0, 10)}
                        </span>
                      </div>
                    )}
                    {downloadStatus?.error && (
                      <div className="mt-2 px-2.5 py-1.5 rounded-lg text-[10px] border"
                        style={{ background: 'oklch(0.62 0.22 28 / 0.1)', borderColor: 'oklch(0.62 0.22 28 / 0.25)', color: 'var(--color-error)' }}>
                        {downloadStatus.error.slice(0, 120)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={triggerDownload}
                    disabled={isRunning}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/40 px-4 py-2.5 text-sm text-muted hover:text-fg transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-surface-raised)' }}
                  >
                    {isRunning
                      ? <><RefreshCw className="size-4 animate-spin" /> Actualizando...</>
                      : <><Download className="size-4" /> Actualizar datos</>}
                  </button>

                  <ManualInputDialog onSuccess={() => setTimeout(refetchDownload, 1000)} />
                </div>

                {/* Alerts summary */}
                {alerts.length > 0 && (
                  <div className="rounded-xl border border-border/40 p-3.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted mb-2.5">
                      Alertas activas
                    </h3>
                    <div className="space-y-1.5">
                      {alerts.map((a, i) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                          a.type === "error" ? "text-risk-high" : "text-warning"
                        }`} style={{
                          background: a.type === "error"
                            ? 'oklch(0.62 0.24 28 / 0.1)'
                            : 'oklch(0.78 0.17 85 / 0.1)',
                        }}>
                          <span className="size-1.5 rounded-full bg-current shrink-0" />
                          {a.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </aside>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3.5 rounded-xl border border-border/40 bg-surface/80 backdrop-blur-xl px-4 py-2 shadow-lg shadow-black/30">
        {[
          { label: "BAJO",  c: "var(--color-risk-low)",     desc: "Riesgo de arribo mínimo. Costa libre de acumulaciones significativas." },
          { label: "AVISO", c: "var(--color-risk-warning)", desc: "Presencia de sargazo disperso. Monitoreo rutinario sin afectación severa." },
          { label: "MEDIO", c: "var(--color-risk-medium)",  desc: "Arribo moderado. Acumulación progresiva en playas vulnerables." },
          { label: "ALTO",  c: "var(--color-risk-high)",    desc: "Riesgo extremo. Impacto masivo en costa. Requiere despliegue de barreras y recolección marina." },
        ].map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors cursor-help"
            title={item.desc}
          >
            <span className="size-2 rounded-sm" style={{ background: item.c }} />
            {item.label}
          </span>
        ))}
        <span className="text-border/50 text-muted">|</span>
        <span className="text-xs hidden sm:inline text-muted/60 font-mono">
          SEMAR · NOAA SIR · RTOFS · GFS
        </span>
      </div>

      {/* ── Info panel modal ─────────────────────────────────────────────── */}
      {infoOpen && (
        <InfoPanel onClose={() => setInfoOpen(false)} />
      )}

      {/* ── Dashboard modal ──────────────────────────────────────────────── */}
      {dashboardOpen && (
        <Dashboard
          predictions={predictions?.predicciones_fase1}
          beachRisk={beachRisk}
          confidence={confidence}
          features={features ?? undefined}
          backtestDetailed={backtestDetailed}
          onClose={() => setDashboardOpen(false)}
        />
      )}
    </div>
  )
}

export default App
