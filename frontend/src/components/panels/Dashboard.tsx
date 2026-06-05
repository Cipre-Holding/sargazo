import { useMemo, useState } from "react"
import { X, TrendingUp, BarChart2, MapPin, Shield, Waves, Calendar, Info, LineChart as LineChartIcon } from "lucide-react"

// ── SVG Charts ────────────────────────────────────────────────────────────────

function LineChart({ data, width = 280, height = 120 }: {
  data: { label: string; value: number }[]
  width?: number; height?: number
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const min = Math.min(...data.map(d => d.value), 0)
  const range = max - min || 1
  const pad = { top: 14, right: 12, bottom: 22, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const xScale = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW
  const yScale = (v: number) => pad.top + innerH - ((v - min) / range) * innerH

  const pathD = data.map((d, i) =>
    `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(d.value).toFixed(1)}`
  ).join(" ")

  const areaD = `${pathD} L${xScale(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${pad.left.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`

  const yTicks = 3
  const yStep = range / yTicks

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = pad.top + innerH - (i * innerH / yTicks)
        const val = min + i * yStep
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
            <text x={pad.left - 5} y={y + 3.5} textAnchor="end"
              fill="var(--color-muted)" fontSize="8" className="font-mono tabular-nums opacity-85">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        )
      })}
      {/* Area fill */}
      <path d={areaD} fill="url(#lineAreaGrad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point highlight */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1]
        return (
          <g className="font-mono">
            <circle cx={xScale(data.length - 1)} cy={yScale(last.value)} r="3"
              fill="var(--color-primary)" />
            <text x={xScale(data.length - 1)} y={yScale(last.value) - 8}
              textAnchor="middle" fill="var(--color-fg)" fontSize="9" fontWeight="700" className="tabular-nums">
              {last.value >= 1000 ? `${(last.value / 1000).toFixed(1)}k` : last.value.toFixed(0)}
            </text>
          </g>
        )
      })()}
      {/* X labels */}
      {data.map((d, i) => i % Math.max(1, Math.floor(data.length / 5)) !== 0 ? null : (
        <text key={i} x={xScale(i)} y={height - 4} textAnchor="middle"
          fill="var(--color-muted)" fontSize="7.5" className="font-mono opacity-80">
          {d.label}
        </text>
      ))}
    </svg>
  )
}

function BarChart({ data, width = 260, height = 100 }: {
  data: { label: string; value: number; color?: string }[]
  width?: number; height?: number
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barW = Math.min(36, (width - 20) / data.length - 6)

  return (
    <svg width={width} height={height} className="overflow-visible font-mono">
      {data.map((d, i) => {
        const x = 10 + i * (barW + 6)
        const barH = Math.max((d.value / max) * (height - 32), 2)
        const color = d.color || "var(--color-primary)"
        return (
          <g key={i}>
            {/* Background bar */}
            <rect x={x} y={8} width={barW} height={height - 32}
              rx="2.5" fill="var(--color-border)" opacity="0.3" />
            {/* Value bar */}
            <rect x={x} y={height - 24 - barH} width={barW} height={barH}
              rx="2.5" fill={color} opacity="0.9" />
            {/* Label */}
            <text x={x + barW / 2} y={height - 8} textAnchor="middle"
              fill="var(--color-muted)" fontSize="7" className="opacity-80"
              transform={`rotate(-40, ${x + barW / 2}, ${height - 8})`}>
              {d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label}
            </text>
            {/* Value */}
            <text x={x + barW / 2} y={height - 26 - barH} textAnchor="middle"
              fill="var(--color-fg)" fontSize="8" fontWeight="700" className="tabular-nums">
              {d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}k` : d.value.toFixed(0)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function BacktestChart({ data, width = 600, height = 200 }: {
  data: { month: string; real: number; pred: number }[]
  width?: number; height?: number
}) {
  const max = Math.max(...data.map(d => Math.max(d.real, d.pred)), 1)
  const pad = { top: 22, right: 30, bottom: 25, left: 55 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const xScale = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW
  const yScale = (v: number) => pad.top + innerH - (v / max) * innerH

  const realD = data.map((d, i) =>
    `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(d.real).toFixed(1)}`
  ).join(" ")

  const predD = data.map((d, i) =>
    `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(d.pred).toFixed(1)}`
  ).join(" ")

  const yTicks = 4

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible font-mono select-none">
      {/* Grid lines & Y labels */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = pad.top + innerH - (i * innerH / yTicks)
        const val = (i * max) / yTicks
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
            <text x={pad.left - 6} y={y + 3.5} textAnchor="end" fill="var(--color-muted)" fontSize="8" className="opacity-90">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        )
      })}

      {/* Real Line (Greenish/Teal) */}
      <path d={realD} fill="none" stroke="var(--color-success)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Predicted Line (Primary Blue/Purple) */}
      <path d={predD} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(d.real)} r="3" fill="var(--color-success)" />
          <circle cx={xScale(i)} cy={yScale(d.pred)} r="3" fill="var(--color-primary)" />
        </g>
      ))}

      {/* X Labels */}
      {data.map((d, i) => (
        <text key={i} x={xScale(i)} y={height - 4} textAnchor="middle" fill="var(--color-muted)" fontSize="8.5" className="opacity-80">
          {d.month.slice(5)}
        </text>
      ))}
    </svg>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface DashboardProps {
  predictions: any
  beachRisk: any
  confidence: any
  features?: any[]
  backtestDetailed?: any
  onClose: () => void
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<any>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="size-3.5" style={{ color: 'var(--color-primary)' }} />
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
    </div>
  )
}

export function Dashboard({ predictions, beachRisk, confidence, features, backtestDetailed, onClose }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "confidence" | "backtest">("overview")
  const [selectedBacktestModel, setSelectedBacktestModel] = useState<string>("ensemble")

  // CM history from features
  const cmHistory = useMemo(() => {
    if (!features) return []
    return features
      .filter((f: any) => f.log_cm && parseFloat(f.log_cm) > -20)
      .map((f: any) => ({
        label: f.month.slice(5),
        value: Math.round(Math.exp(parseFloat(f.log_cm)) * 1_000_000),
      }))
      .slice(-14)
  }, [features])

  // Model predictions
  const modelData = useMemo(() => {
    if (!predictions) return []
    const exclude: Record<string, boolean> = {
      "0.2_delta": true, "0.3_logistica": true, "0.4_prophet": true, "0.5_ar1": true,
      "1.3_rolling": true, "1.4_arimax": true, "1.6_prophet_tuned": true,
      "backtest": true, "ensemble": true, "metadata": true,
    }
    const result: { label: string; value: number; color: string }[] = []
    for (const [key, val] of Object.entries(predictions)) {
      if (exclude[key]) continue
      const m = val as any
      if (m?.prediccion_junio?.cm_ton) {
        result.push({
          label: m.modelo?.slice(0, 10) || key.slice(0, 10),
          value: m.prediccion_junio.cm_ton,
          color: key.includes("ridge") ? "var(--color-accent)" : "var(--color-primary)",
        })
      }
    }
    const ens = predictions.ensemble?.prediccion_junio
    if (ens) result.push({ label: "Ensemble", value: ens.cm_ton, color: "var(--color-risk-high)" })
    return result.sort((a, b) => b.value - a.value)
  }, [predictions])

  // Beach chart
  const beachChartData = useMemo(() => {
    if (!beachRisk?.segmentos) return []
    return beachRisk.segmentos.slice(0, 5).map((s: any) => ({
      label: s.name.split("/")[0].trim(),
      value: s.pct_high_medium,
      color: s.pct_high_medium > 65 ? "var(--color-risk-high)"
           : s.pct_high_medium > 50 ? "var(--color-risk-medium)"
           : "var(--color-risk-warning)",
    }))
  }, [beachRisk])

  // Alerts
  const alerts = useMemo(() => {
    const result: { type: string; text: string }[] = []
    const ens = predictions?.ensemble?.prediccion_junio
    if (ens?.cm_ton > 100000)
      result.push({ type: "error", text: `Predicción junio crítica: ${(ens.cm_ton / 1000).toFixed(0)}k ton` })
    else if (ens?.cm_ton > 50000)
      result.push({ type: "warning", text: `Predicción junio elevada: ${(ens.cm_ton / 1000).toFixed(0)}k ton` })
    const beach = beachRisk?.segmentos?.[0]
    if (beach?.pct_high_medium > 70)
      result.push({ type: "warning", text: `${beach.name}: ${beach.pct_high_medium}% riesgo HIGH/MED` })
    return result
  }, [predictions, beachRisk])

  // Filtered month-by-month results for selected backtest model
  const selectedModelResults = useMemo(() => {
    if (!backtestDetailed?.resultados) return []
    return backtestDetailed.resultados
      .filter((r: any) => r.modelo === selectedBacktestModel)
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
      .map((r: any) => ({
        month: r.month,
        real: r.cm_real_ton,
        pred: r.cm_pred_ton,
        error: r.error_ton,
        pct: r.error_pct,
      }))
  }, [backtestDetailed, selectedBacktestModel])

  const ensemble = predictions?.ensemble

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/70 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border/40 m-4 shadow-2xl shadow-black/60 bg-surface/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 z-10 backdrop-blur-xl bg-surface/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <Waves className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-fg tracking-tight">Dashboard · Sargazo Cozumel</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl hover:bg-surface-raised transition-colors cursor-pointer text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 border-b border-border/30 px-5 py-2 bg-surface-raised/30 shrink-0">
          {[
            { id: "overview", label: "Vista General" },
            { id: "confidence", label: "Confiabilidad" },
            { id: "backtest", label: "Backtesting (LOOCV)" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted hover:text-fg hover:bg-surface-raised"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">

          {activeTab === "overview" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="space-y-1.5">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs border font-medium ${
                      a.type === "error"
                        ? "text-risk-high border-risk-high/25"
                        : "text-warning border-warning/25"
                    }`} style={{
                      background: a.type === "error"
                        ? 'color-mix(in oklch, var(--color-risk-high) 10%, transparent)'
                        : 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                    }}>
                      <span className="size-1.5 rounded-full bg-current shrink-0" />
                      {a.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Ensemble KPI row */}
              {ensemble?.prediccion_junio && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Predicción Jun 2026",
                      value: `${(ensemble.prediccion_junio.cm_ton / 1000).toFixed(1)}k`,
                      unit: "ton",
                      color: "var(--color-primary)",
                    },
                    {
                      label: "Intervalo IC 80%",
                      value: ensemble.prediccion_junio.ci_80_mt
                        ? `${(ensemble.prediccion_junio.ci_80_mt[0] * 1_000_000 / 1000).toFixed(0)} – ${(ensemble.prediccion_junio.ci_80_mt[1] * 1_000_000 / 1000).toFixed(0)}`
                        : "—",
                      unit: "k ton",
                      color: "var(--color-muted)",
                    },
                    {
                      label: "Confianza sistema",
                      value: `${confidence?.porcentaje ?? 0}%`,
                      unit: confidence?.nivel ?? "",
                      color: confidence?.nivel === "ALTA" ? "var(--color-success)" : "var(--color-warning)",
                    },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border border-border/40 p-3.5 bg-surface-raised/10">
                      <div className="text-[10px] text-muted mb-1.5 uppercase tracking-widest font-semibold">{kpi.label}</div>
                      <div className="text-xl font-bold font-mono tabular-nums" style={{ color: kpi.color }}>
                        {kpi.value}
                      </div>
                      <div className="text-xs text-muted mt-0.5">{kpi.unit}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Charts row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CM evolution */}
                <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                  <SectionTitle icon={TrendingUp} title="Evolución CM (ton)" />
                  {cmHistory.length > 1
                    ? <LineChart data={cmHistory} width={280} height={130} />
                    : <div className="flex items-center justify-center h-32 text-xs text-muted">Sin datos</div>
                  }
                </div>

                {/* Model comparison */}
                <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                  <SectionTitle icon={BarChart2} title="Predicciones por modelo jun" />
                  {modelData.length > 0
                    ? <BarChart data={modelData} width={260} height={115} />
                    : <div className="flex items-center justify-center h-28 text-xs text-muted">Sin datos</div>
                  }
                </div>
              </div>

              {/* Beach risk + System health row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Beach risk bars */}
                <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                  <SectionTitle icon={MapPin} title="Riesgo HIGH+MED por playa" />
                  {beachChartData.length > 0
                    ? (
                      <div className="space-y-2.5">
                        {beachChartData.map((b: any, i: number) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted truncate flex-1 mr-2">{b.label}</span>
                              <span className="text-xs font-mono font-bold tabular-nums" style={{ color: b.color }}>
                                {b.value}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${b.value}%`, background: b.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                    : <div className="flex items-center justify-center h-24 text-xs text-muted">Sin datos</div>
                  }
                </div>

                {/* System health */}
                <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                  <SectionTitle icon={Shield} title="Salud del sistema" />
                  <div className="space-y-2.5 text-xs">
                    {confidence && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted">Confianza global</span>
                          <span className={`font-bold tabular-nums ${
                            confidence.nivel === "ALTA" ? "text-success" : "text-warning"
                          }`}>{confidence.porcentaje}% ({confidence.nivel})</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${confidence.porcentaje}%`,
                            background: confidence.nivel === "ALTA" ? 'var(--color-success)' : 'var(--color-warning)',
                          }} />
                        </div>
                      </>
                    )}
                    {[
                      ["Modelos activos",  `${modelData.length}`],
                      ["Datos NOAA SIR",   "338 días"],
                      ["Serie histórica",  "2000-2026 (298 meses)"],
                      ["Predicción activa","Jun 2026"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted">{k}</span>
                        <span className="font-mono text-fg/80">{v}</span>
                      </div>
                    ))}

                    {/* Confidence component breakdown */}
                    {confidence?.desglose && (
                      <div className="pt-2 border-t border-border/30 space-y-1.5">
                        {Object.entries(confidence.desglose).map(([k, v]: [string, any]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-[11px] text-muted flex-1 capitalize">{v.label || k.replace(/_/g, ' ')}</span>
                            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, (v.puntos / v.max) * 100)}%`,
                                  background: 'var(--color-primary)',
                                  opacity: 0.7,
                                }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted tabular-nums w-8 text-right">
                              {v.puntos}/{v.max}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "confidence" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/20">
                <h3 className="text-xs font-bold text-fg mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                  <Shield className="size-3.5 text-primary" /> Análisis de Confiabilidad Predictiva
                </h3>
                <p className="text-[11px] text-muted leading-relaxed">
                  El Grado de Confiabilidad Global del sistema evalúa la certidumbre matemática del pronóstico actual
                  en base a 5 dimensiones de consistencia algorítmica y calidad de datos de entrada.
                </p>
                <div className="mt-4 flex items-center justify-between p-3 rounded-lg border border-border/30 bg-surface/50">
                  <div>
                    <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Estatus Global</div>
                    <div className="text-xl font-bold text-fg flex items-baseline gap-1.5 font-mono mt-0.5">
                      {confidence?.porcentaje ?? 0}%
                      <span className={`text-[10px] font-sans font-bold px-1.5 py-0.5 rounded ${
                        confidence?.nivel === "ALTA" ? "bg-success/10 text-success"
                        : confidence?.nivel === "MEDIA" ? "bg-warning/10 text-warning"
                        : "bg-risk-high/10 text-risk-high"
                      }`}>
                        {confidence?.nivel ?? "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Umbrales de Clasificación</div>
                    <div className="text-[10px] font-medium text-muted mt-1">
                      <span className="text-success font-bold">ALTA</span> &ge;70% | <span className="text-warning font-bold">MEDIA</span> &ge;50% | <span className="text-risk-high font-bold">BAJA</span> &lt;50%
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    id: "freshness",
                    title: "1. Actualidad de Datos (Freshness)",
                    points: confidence?.desglose?.freshness?.puntos ?? 0,
                    max: 30,
                    desc: "Mide la antigüedad de la última observación diaria de biomasa y vientos de la SEMAR. Los datos en tiempo real (retraso <= 3 días) otorgan 30 puntos. Rango: 30 pts (reciente) hasta 5 pts (>30 días de retraso)."
                  },
                  {
                    id: "data_quality",
                    title: "2. Cantidad de Datos (Pares de Entrenamiento)",
                    points: confidence?.desglose?.data_quality?.puntos ?? 0,
                    max: 20,
                    desc: "Valida la cantidad de meses históricos con observaciones pareadas satélite-tierra (ACO vs CM). Se requieren mínimo 4 meses de coincidencia para calibrar de forma robusta las pendientes e interceptos de los modelos."
                  },
                  {
                    id: "concordance",
                    title: "3. Concordancia de Modelos (Consenso)",
                    points: confidence?.desglose?.concordance?.puntos ?? 0,
                    max: 20,
                    desc: "Mide la dispersión (Coeficiente de Variación) entre las proyecciones de los modelos de la Fase 1. Si los modelos divergen drásticamente en sus estimaciones de junio, el consenso baja; si convergen (CV < 30%), otorga 20 puntos."
                  },
                  {
                    id: "history",
                    title: "4. Precisión Histórica (R² de Backtesting)",
                    points: confidence?.desglose?.history?.puntos ?? 0,
                    max: 20,
                    desc: "Se califica con base al R² promedio de los modelos activos en el histórico. Indica qué tanta variabilidad de años anteriores explica matemáticamente el ensemble de modelos calibrado."
                  },
                  {
                    id: "season",
                    title: "5. Ventana Temporal (Estacionalidad)",
                    points: confidence?.desglose?.season?.puntos ?? 0,
                    max: 10,
                    desc: "El arribo de sargazo a Cozumel sigue un ciclo de primavera-verano estable (Mayo a Octubre). Pronosticar en esta ventana otorga 10 puntos, ya que los forzantes climatológicos son predecibles y constantes."
                  }
                ].map((c) => {
                  const pct = (c.points / c.max) * 100
                  const state = pct >= 80 ? "Excelente" : pct >= 50 ? "Regular" : "Crítico"
                  const stateColor = pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-warning)" : "var(--color-risk-high)"

                  return (
                    <div key={c.id} className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                      <div className="flex justify-between items-center mb-1.5">
                        <h4 className="text-xs font-bold text-fg tracking-tight">{c.title}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded font-mono" style={{ background: `color-mix(in oklch, ${stateColor} 12%, transparent)`, color: stateColor }}>
                          {state} ({c.points}/{c.max})
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed mb-3">{c.desc}</p>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: stateColor }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === "backtest" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Metodología */}
              <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/20">
                <h3 className="text-xs font-bold text-fg mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                  <Calendar className="size-3.5 text-primary" /> Validación Cruzada Histórica (LOOCV)
                </h3>
                <p className="text-[11px] text-muted leading-relaxed">
                  Para evaluar con rigor científico los modelos antes del uso en producción, implementamos un
                  <strong> Backtesting de Ventana Expansible</strong>. Para cada mes histórico disponible con biomasa real observada,
                  los modelos se reentrenaron desde cero usando únicamente datos previos a ese mes y proyectando de forma ciega
                  el mes siguiente.
                </p>
              </div>

              {/* Métricas Agregadas */}
              <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider">Métricas del Backtesting (Jul 2025 – May 2026)</h4>
                  <span className="text-[9px] text-muted font-mono">Total meses (N = 11)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/30 text-muted font-mono text-[9px] uppercase tracking-wider">
                        <th className="py-2 pr-2">Modelo</th>
                        <th className="py-2 text-right">R²</th>
                        <th className="py-2 text-right">RMSE (ton)</th>
                        <th className="py-2 text-right">MAE (ton)</th>
                        <th className="py-2 text-right">SMAPE (%)</th>
                        <th className="py-2 text-right">Sesgo (ton)</th>
                        <th className="py-2 text-right">Corr (r)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono text-fg/90">
                      {backtestDetailed?.metricas ? (
                        backtestDetailed.metricas.map((m: any) => {
                          const isSelected = m.modelo === selectedBacktestModel
                          return (
                            <tr
                              key={m.modelo}
                              className={`hover:bg-surface-raised/40 transition-colors cursor-pointer ${
                                isSelected ? "bg-primary/5 font-bold text-primary" : ""
                              }`}
                              onClick={() => setSelectedBacktestModel(m.modelo)}
                            >
                              <td className="py-2.5 font-sans font-semibold pr-2">{m.modelo}</td>
                              <td className="py-2.5 text-right tabular-nums">{(m["R²"] || m["cv_r2"] || 0).toFixed(3)}</td>
                              <td className="py-2.5 text-right tabular-nums">{m["RMSE(ton)"]?.toLocaleString() ?? "—"}</td>
                              <td className="py-2.5 text-right tabular-nums">{m["MAE(ton)"]?.toLocaleString() ?? "—"}</td>
                              <td className="py-2.5 text-right tabular-nums">{(m["SMAPE(%)"] || 0).toFixed(1)}%</td>
                              <td className="py-2.5 text-right tabular-nums">{m["Bias(ton)"] >= 0 ? `+${m["Bias(ton)"].toLocaleString()}` : m["Bias(ton)"].toLocaleString()}</td>
                              <td className="py-2.5 text-right tabular-nums">{m["Corr(r)"] ?? "—"}</td>
                            </tr>
                          )
                        })
                      ) : (
                        predictions?.backtest?.map((m: any) => {
                          const isSelected = m.Modelo === selectedBacktestModel
                          return (
                            <tr
                              key={m.Modelo}
                              className={`hover:bg-surface-raised/40 transition-colors cursor-pointer ${
                                isSelected ? "bg-primary/5 font-bold text-primary" : ""
                              }`}
                              onClick={() => setSelectedBacktestModel(m.Modelo)}
                            >
                              <td className="py-2.5 font-sans font-semibold pr-2">{m.Modelo}</td>
                              <td className="py-2.5 text-right tabular-nums">{(m["R²"] || 0).toFixed(3)}</td>
                              <td className="py-2.5 text-right tabular-nums">—</td>
                              <td className="py-2.5 text-right tabular-nums">—</td>
                              <td className="py-2.5 text-right tabular-nums">{(m["SMAPE(%)"] || 0).toFixed(1)}%</td>
                              <td className="py-2.5 text-right tabular-nums">—</td>
                              <td className="py-2.5 text-right tabular-nums">—</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gráfico SVG de Validación Temporal */}
              {selectedModelResults.length > 0 && (
                <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
                        Ajuste del Modelo: {selectedBacktestModel}
                      </h4>
                      <div className="text-[10px] text-muted mt-0.5">
                        <span className="text-success font-bold">Real observado (SEMAR)</span> vs <span className="text-primary font-bold">Pronóstico ciego</span>
                      </div>
                    </div>
                    {/* Model filter tabs */}
                    <div className="flex flex-wrap gap-1">
                      {["ensemble", "1.1_ridge", "0.1_regresion", "0.5_ar1"].map((m) => (
                        <button
                          key={m}
                          onClick={() => setSelectedBacktestModel(m)}
                          className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer transition-colors ${
                            selectedBacktestModel === m
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-surface-raised/50 text-muted hover:text-fg hover:bg-surface-raised"
                          }`}
                        >
                          {m === "ensemble" ? "Ensemble" : m === "1.1_ridge" ? "Ridge" : m === "0.1_regresion" ? "Lineal" : "AR(1)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-center p-2 rounded-lg bg-surface-raised/10 border border-border/20">
                    <BacktestChart data={selectedModelResults} width={620} height={180} />
                  </div>
                </div>
              )}

              {/* Tabla de Puntos Históricos */}
              {selectedModelResults.length > 0 && (
                <div className="rounded-xl border border-border/40 p-4 bg-surface-raised/5">
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider mb-3">Detalle mensual del ajuste</h4>
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/30 text-muted font-mono text-[9px] uppercase tracking-wider">
                          <th className="py-2">Mes</th>
                          <th className="py-2 text-right">Biomasa Real (ton)</th>
                          <th className="py-2 text-right">Predicho (ton)</th>
                          <th className="py-2 text-right">Desviación (ton)</th>
                          <th className="py-2 text-right">Error %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-mono text-fg/80">
                        {selectedModelResults.map((r: any) => {
                          const isOver = r.error > 0
                          const errColor = r.error === 0 ? "text-muted" : isOver ? "text-warning" : "text-primary"
                          return (
                            <tr key={r.month} className="hover:bg-surface-raised/20">
                              <td className="py-2 font-sans font-medium">{r.month}</td>
                              <td className="py-2 text-right tabular-nums">{r.real.toLocaleString()}</td>
                              <td className="py-2 text-right tabular-nums">{r.pred.toLocaleString()}</td>
                              <td className="py-2 text-right tabular-nums text-muted">{r.error >= 0 ? `+${r.error.toLocaleString()}` : r.error.toLocaleString()}</td>
                              <td className={`py-2 text-right tabular-nums font-bold ${errColor}`}>{r.pct >= 0 ? `+${r.pct.toFixed(1)}%` : `${r.pct.toFixed(1)}%`}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
