import { useMemo } from "react"
import { X, TrendingUp, BarChart2, MapPin, Shield, Waves } from "lucide-react"

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
          <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.25" />
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
              stroke="var(--color-border)" strokeWidth="0.75" strokeDasharray="3 3" />
            <text x={pad.left - 5} y={y + 3.5} textAnchor="end"
              fill="var(--color-muted)" fontSize="8" opacity="0.7">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        )
      })}
      {/* Area fill */}
      <path d={areaD} fill="url(#lineAreaGrad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point highlight */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1]
        return (
          <>
            <circle cx={xScale(data.length - 1)} cy={yScale(last.value)} r="3.5"
              fill="var(--color-primary)" />
            <text x={xScale(data.length - 1)} y={yScale(last.value) - 8}
              textAnchor="middle" fill="var(--color-fg)" fontSize="9" fontWeight="700">
              {last.value >= 1000 ? `${(last.value / 1000).toFixed(1)}k` : last.value.toFixed(0)}
            </text>
          </>
        )
      })()}
      {/* X labels */}
      {data.map((d, i) => i % Math.max(1, Math.floor(data.length / 5)) !== 0 ? null : (
        <text key={i} x={xScale(i)} y={height - 4} textAnchor="middle"
          fill="var(--color-muted)" fontSize="7.5" opacity="0.65">
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
    <svg width={width} height={height} className="overflow-visible">
      {data.map((d, i) => {
        const x = 10 + i * (barW + 6)
        const barH = Math.max((d.value / max) * (height - 32), 2)
        const color = d.color || "var(--color-primary)"
        return (
          <g key={i}>
            {/* Background bar */}
            <rect x={x} y={8} width={barW} height={height - 32}
              rx="3" fill="var(--color-border)" opacity="0.4" />
            {/* Value bar */}
            <rect x={x} y={height - 24 - barH} width={barW} height={barH}
              rx="3" fill={color} opacity="0.85" />
            {/* Label */}
            <text x={x + barW / 2} y={height - 8} textAnchor="middle"
              fill="var(--color-muted)" fontSize="7"
              transform={`rotate(-40, ${x + barW / 2}, ${height - 8})`}>
              {d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label}
            </text>
            {/* Value */}
            <text x={x + barW / 2} y={height - 26 - barH} textAnchor="middle"
              fill="var(--color-fg)" fontSize="8" fontWeight="700">
              {d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}k` : d.value.toFixed(0)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface DashboardProps {
  predictions: any
  beachRisk: any
  confidence: any
  features?: any[]
  onClose: () => void
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<any>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="size-3.5" style={{ color: 'var(--color-primary)' }} />
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
    </div>
  )
}

export function Dashboard({ predictions, beachRisk, confidence, features, onClose }: DashboardProps) {
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

  const ensemble = predictions?.ensemble

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border/50 m-4 shadow-2xl shadow-black/60"
        style={{ background: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 z-10 backdrop-blur-xl"
          style={{ background: 'oklch(0.09 0.016 245 / 0.95)' }}>
          <div className="flex items-center gap-2.5">
            <Waves className="size-4" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-sm font-bold text-fg tracking-tight">Dashboard · Sargazo Cozumel</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl hover:bg-surface-raised transition-colors cursor-pointer text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">

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
                    ? 'oklch(0.62 0.24 28 / 0.1)'
                    : 'oklch(0.78 0.17 85 / 0.1)',
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
                <div key={kpi.label} className="rounded-xl border border-border/40 p-3.5">
                  <div className="text-[10px] text-muted mb-1.5 uppercase tracking-widest font-semibold">{kpi.label}</div>
                  <div className="text-xl font-bold font-mono tabular-nums" style={{ color: kpi.color }}>
                    {kpi.value}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">{kpi.unit}</div>
                </div>
              ))}
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CM evolution */}
            <div className="rounded-xl border border-border/40 p-4">
              <SectionTitle icon={TrendingUp} title="Evolución CM (ton)" />
              {cmHistory.length > 1
                ? <LineChart data={cmHistory} width={280} height={130} />
                : <div className="flex items-center justify-center h-32 text-xs text-muted">Sin datos</div>
              }
            </div>

            {/* Model comparison */}
            <div className="rounded-xl border border-border/40 p-4">
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
            <div className="rounded-xl border border-border/40 p-4">
              <SectionTitle icon={MapPin} title="Riesgo HIGH+MED por playa" />
              {beachChartData.length > 0
                ? (
                  <div className="space-y-2.5">
                    {beachChartData.map((b: any, i: number) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted truncate flex-1 mr-2">{b.label}</span>
                          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: b.color }}>
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
            <div className="rounded-xl border border-border/40 p-4">
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
                  ["Datos NOAA SIR",   "315 días"],
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
                        <span className="text-[10px] text-muted flex-1 capitalize">{k.replace(/_/g, ' ')}</span>
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
      </div>
    </div>
  )
}
