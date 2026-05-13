import { useState } from "react"
import { Button } from "@/components/ui/button"

const HORIZONTES = [
  { value: "12h", label: "12 h" },
  { value: "24h", label: "24 h" },
  { value: "48h", label: "48 h" },
  { value: "72h", label: "72 h" },
  { value: "144h", label: "6 d" },
  { value: "180h", label: "7.5 d" },
  { value: "228h", label: "9.5 d" },
  { value: "312h", label: "13 d" },
  { value: "336h", label: "14 d" },
]

const LAYERS = [
  {
    id: "mlrisk", label: "Riesgo ML", desc: "Interpolación de riesgo costero",
    info: "915 celdas interpoladas con kernel Wendland C2 (max-pooling).\nFuente: 52,551 segmentos NOAA SIR de 315 días.\nMalla: 4km. Radio: 67×20 km.\nFecha: 2026-05-11."
  },
  {
    id: "sir", label: "NOAA SIR", desc: "Riesgo costero satelital",
    info: "Segmentos de riesgo de NOAA Sargassum Inundation Risk v1.5.\nColores: rojo=HIGH, naranja=MED, amarillo=WARN, azul=LOW.\nSlider para navegar entre 315 fechas disponibles.\nFuente: cwcgom.aoml.noaa.gov"
  },
  {
    id: "kde", label: "Acumulación KDE", desc: "Densidad de partículas",
    info: "500 partículas virtuales con OpenDrift.\nForzamiento: RTOFS ×1.5 + GFS 10m + windage 2%.\nBandwidth fijo 0.08° (~9km).\nHorizontes 24-168h. 96h+ sin datos (partículas fuera del área)."
  },
  {
    id: "trajectories", label: "Trayectorias", desc: "Partículas animadas",
    info: "20 partículas animadas con slider temporal.\nForzamiento: RTOFS+GFS, 7 días.\nTeal = partícula activa, línea tenue = trail.\nSolo partículas en área Cozumel/QRoo."
  },
]

interface LayerControlProps {
  activeLayers: Record<string, boolean>
  onToggleLayer: (id: string) => void
  horizon: string
  onHorizonChange: (h: string) => void
  onDownloadTrigger: () => void
  downloadStatus: string
  sirDate: string
  sirDates: string[]
  onSirDateChange: (d: string) => void
}

export function LayerControl({
  activeLayers, onToggleLayer, horizon, onHorizonChange,
  onDownloadTrigger, downloadStatus,
  sirDate, sirDates, onSirDateChange,
}: LayerControlProps) {
  const [infoLayer, setInfoLayer] = useState<string | null>(null)
  const currentSirIdx = sirDates.indexOf(sirDate)

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-lg backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Capas</h3>
        <span className="text-[9px] text-slate-400" title="Clic en ? para información detallada">? = info</span>
      </div>

      {/* Layer toggles */}
      <div className="p-2 space-y-0.5">
        {LAYERS.map((l) => {
          const isActive = l.id === "mlrisk" ? activeLayers.mlrisk :
                           l.id === "sir" ? activeLayers.sir :
                           l.id === "kde" ? activeLayers.kde :
                           activeLayers.trajectories
          const layerKey = l.id === "trajectories" ? "trajectories" : l.id
          return (
            <div key={l.id} className="relative">
              <button
                onClick={() => onToggleLayer(layerKey)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-100 transition-colors duration-150 dark:hover:bg-slate-800/50"
                }`}
                title={l.desc}
              >
                <div className={`size-3 rounded-sm border transition-colors shrink-0 ${
                  isActive
                    ? "bg-emerald-500 border-emerald-500"
                    : "bg-transparent border-slate-300 dark:border-slate-600"
                }`}>
                  {isActive && (
                    <svg viewBox="0 0 12 12" className="size-3 text-white"><path d="M3 6l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{l.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{l.desc}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setInfoLayer(infoLayer === l.id ? null : l.id) }}
                  className="size-5 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center text-[10px] font-bold transition-colors"
                  title="Información de esta capa"
                >?</button>
              </button>
              {infoLayer === l.id && (
                <div className="mx-2 mb-1 px-2.5 py-2 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                  {l.info}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* NOAA SIR date slider */}
      {activeLayers.sir && sirDates.length > 1 && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Fecha SIR</label>
            <span className="text-[10px] text-slate-400 tabular-nums">{sirDate}</span>
          </div>
          <input
            type="range"
            min={0}
            max={sirDates.length - 1}
            value={Math.max(0, currentSirIdx)}
            onChange={(e) => onSirDateChange(sirDates[parseInt(e.target.value)])}
            className="w-full h-1 accent-emerald-500 cursor-pointer"
            title={`${sirDate} — ${currentSirIdx + 1} de ${sirDates.length} fechas`}
          />
          <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
            <span>{sirDates[0]}</span>
            <span>{sirDates[sirDates.length - 1]}</span>
          </div>
        </div>
      )}

      {/* Horizonte KDE */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Horizonte KDE</label>
          <span className="text-[9px] text-slate-400">14 días</span>
        </div>
        <div className="flex gap-1">
          {HORIZONTES.map((h) => (
            <button
              key={h.value}
              onClick={() => onHorizonChange(h.value)}
              className={`flex-1 text-center py-1 rounded text-[10px] font-medium transition-colors ${
                horizon === h.value
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title={`Acumulación a ${h.label}`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Download button */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs gap-1.5"
          onClick={onDownloadTrigger}
          disabled={downloadStatus === "running"}
          title="Descargar últimos datos NOAA SIR y re-ejecutar pipeline"
        >
          {downloadStatus === "running" ? (
            <><span className="size-2 rounded-full bg-amber-400 animate-pulse" /> Actualizando...</>
          ) : (
            <><span className="size-2 rounded-full bg-slate-300" /> Actualizar datos</>
          )}
        </Button>
      </div>
    </div>
  )
}
