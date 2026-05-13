interface SystemStatusProps {
  downloadStatus: { status: string; started_at?: string; finished_at?: string; error?: string } | null
  confidenceScore?: { score: number; max: number; porcentaje: number; nivel: string } | null
  featureCount?: number
}

export function SystemStatus({ downloadStatus, confidenceScore, featureCount }: SystemStatusProps) {
  const isRunning = downloadStatus?.status === "running"
  const isOk = downloadStatus?.status === "ok"
  const neverRun = downloadStatus?.status === "never_run" || !downloadStatus

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-lg backdrop-blur overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Sistema</h3>
        <span className={`inline-flex items-center gap-1 text-[10px] ${
          isRunning ? "text-amber-500" : isOk ? "text-emerald-500" : "text-slate-400"
        }`}>
          <span className={`size-1.5 rounded-full ${
            isRunning ? "bg-amber-500 animate-pulse" : isOk ? "bg-emerald-500" : "bg-slate-300"
          }`} />
          {isRunning ? "Actualizando" : isOk ? "Operativo" : "Sin datos"}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {featureCount !== undefined && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Features</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">{featureCount} columnas</span>
          </div>
        )}
        {confidenceScore && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Confianza</span>
            <span className={`font-medium tabular-nums ${
              confidenceScore.nivel === "ALTA" ? "text-emerald-500" :
              confidenceScore.nivel === "MEDIA" ? "text-amber-500" : "text-red-500"
            }`}>
              {confidenceScore.porcentaje}% ({confidenceScore.nivel})
            </span>
          </div>
        )}
        {downloadStatus?.finished_at && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Última act.</span>
            <span className="text-slate-500 tabular-nums">
              {downloadStatus.finished_at.slice(0, 10)}
            </span>
          </div>
        )}
        {downloadStatus?.error && (
          <div className="text-[9px] text-red-400 mt-1">
            Error: {downloadStatus.error.slice(0, 80)}
          </div>
        )}
      </div>
    </div>
  )
}
