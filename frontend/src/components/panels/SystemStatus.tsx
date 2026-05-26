interface SystemStatusProps {
  downloadStatus: { status: string; started_at?: string; finished_at?: string; error?: string } | null
  confidenceScore?: { score: number; max: number; porcentaje: number; nivel: string } | null
  featureCount?: number
}

export function SystemStatus({ downloadStatus, confidenceScore, featureCount }: SystemStatusProps) {
  const isRunning = downloadStatus?.status === "running"
  const isOk = downloadStatus?.status === "ok"

  return (
    <div className="rounded-xl border border-border/40 bg-surface/90 shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-fg uppercase tracking-widest">Sistema</h3>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
          isRunning ? "text-warning" : isOk ? "text-success" : "text-muted"
        }`}>
          <span className={`size-1.5 rounded-full ${
            isRunning ? "bg-warning animate-pulse" : isOk ? "bg-success" : "bg-muted"
          }`} />
          {isRunning ? "Actualizando" : isOk ? "Operativo" : "Sin datos"}
        </span>
      </div>
      <div className="px-3.5 py-3 space-y-2">
        {featureCount !== undefined && (
          <div className="flex justify-between text-xs">
            <span className="text-muted">Features</span>
            <span className="text-fg font-medium font-mono">{featureCount} columnas</span>
          </div>
        )}
        {confidenceScore && (
          <div className="flex justify-between text-xs">
            <span className="text-muted">Confianza</span>
            <span className={`font-semibold font-mono tabular-nums ${
              confidenceScore.nivel === "ALTA" ? "text-success" : "text-warning"
            }`}>
              {confidenceScore.porcentaje}% ({confidenceScore.nivel})
            </span>
          </div>
        )}
        {downloadStatus?.finished_at && (
          <div className="flex justify-between text-xs">
            <span className="text-muted">Última actualización</span>
            <span className="text-fg/80 font-mono tabular-nums">
              {downloadStatus.finished_at.slice(0, 10)}
            </span>
          </div>
        )}
        {downloadStatus?.error && (
          <div className="text-[10px] text-error mt-1 border border-error/25 bg-error/5 p-2 rounded-lg font-mono">
            Error: {downloadStatus.error.slice(0, 100)}
          </div>
        )}
      </div>
    </div>
  )
}
