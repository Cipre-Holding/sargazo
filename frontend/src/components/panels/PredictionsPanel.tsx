import { Card, CardContent } from "@/components/ui/card"

interface EnsemblePrediction {
  cm_ton: number; cm_mt: number; cambio_pct_vs_mayo?: number
  ci_80_mt?: [number, number]
  confidence_score?: { score: number; max: number; porcentaje: number; nivel: string }
}

interface ModelData {
  modelo?: string
  prediccion_junio?: { cm_ton: number; cm_mt: number; ci_80_mt?: [number, number] }
  r2?: number
  rmse_log?: number
}

interface PredictionsPanelProps {
  ensemble: EnsemblePrediction | null
  models: Record<string, ModelData> | null
  loading: boolean
  backtestStats?: { RMSE: number; MAE: number; Bias: number } | null
}

function fmt(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "k"
  return v.toFixed(0)
}

const NIVEL_SEMAFORO = [
  { max: 1000, label: "ESCASO", color: "bg-green-500" },
  { max: 5000, label: "MUY BAJO", color: "bg-lime-500" },
  { max: 15000, label: "BAJO", color: "bg-yellow-500" },
  { max: 40000, label: "MODERADO", color: "bg-orange-500" },
  { max: 80000, label: "ALTO", color: "bg-red-500" },
  { max: Infinity, label: "MUY ALTO", color: "bg-red-700" },
]

function getNivel(ton: number): { label: string; color: string } {
  for (const n of NIVEL_SEMAFORO) {
    if (ton < n.max) return n
  }
  return NIVEL_SEMAFORO[5]
}

export function PredictionsPanel({ ensemble, models, loading, backtestStats }: PredictionsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-lg backdrop-blur p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-28" />
        </div>
      </div>
    )
  }

  if (!ensemble && !models) return null

  const modelList = models
    ? Object.entries(models).filter(([, m]) => m.prediccion_junio).slice(0, 5).map(([key, m]) => ({
        key, name: m.modelo ?? key,
        ton: m.prediccion_junio!.cm_ton,
      }))
    : []

  const nivel = ensemble ? getNivel(ensemble.cm_ton) : null

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-lg backdrop-blur overflow-hidden">
      {/* Header with confidence */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Predicción</h3>
        {ensemble?.confidence_score && (
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
            ensemble.confidence_score.nivel === "ALTA" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
            ensemble.confidence_score.nivel === "MEDIA" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
          }`}>
            {ensemble.confidence_score.porcentaje}%
          </span>
        )}
      </div>

      {/* Ensemble */}
      {ensemble && (
        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              {nivel && <span className={`size-2 rounded-full ${nivel.color}`} title={nivel.label} />}
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Ensemble</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {fmt(ensemble.cm_ton)}
                <span className="text-xs font-normal text-slate-400 ml-0.5">ton</span>
              </span>
              {nivel && <div className="text-[9px] text-slate-400">{nivel.label}</div>}
            </div>
          </div>
          {ensemble.ci_80_mt && (
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-slate-400">IC 80%</span>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {fmt(ensemble.ci_80_mt[0] * 1_000_000)} – {fmt(ensemble.ci_80_mt[1] * 1_000_000)} ton
              </span>
            </div>
          )}
          {ensemble.cambio_pct_vs_mayo !== undefined && (
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-slate-400">vs mayo</span>
              <span className={`text-[10px] font-medium tabular-nums ${
                ensemble.cambio_pct_vs_mayo > 0 ? "text-red-500" : "text-emerald-500"
              }`}>
                {ensemble.cambio_pct_vs_mayo > 0 ? "+" : ""}{ensemble.cambio_pct_vs_mayo.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Model list */}
      {modelList.length > 0 && (
        <div className="px-3 py-1.5 space-y-0.5">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Por modelo</div>
          {modelList.map((m) => (
            <div key={m.key} className="flex items-center justify-between py-0.5">
              <span className="text-[10px] text-slate-500 truncate max-w-[60%]">{m.name}</span>
              <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 tabular-nums">{fmt(m.ton)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
