import { useEffect, useRef } from "react"
import { Waves, ArrowRight, TrendingUp, Satellite, Navigation, MapPin, ChevronRight } from "lucide-react"

interface LandingProps {
  onEnter: () => void
}

// ── Animated radar visualization ─────────────────────────────────────────────

function RadarViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const angleRef  = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const S = canvas.width  // 320
    const C = S / 2         // center

    // Sargazo cluster dots (relative to center, within 0..1 radius)
    const dots = [
      { r: 0.52, a: 0.18, size: 5, label: "ACO" },
      { r: 0.70, a: 0.42, size: 3.5, label: "" },
      { r: 0.35, a: 0.78, size: 4, label: "CM" },
      { r: 0.55, a: 1.12, size: 3, label: "" },
      { r: 0.28, a: 0.35, size: 2.5, label: "" },
    ]

    function draw(_ts: number) {
      ctx.clearRect(0, 0, S, S)

      // Background
      ctx.fillStyle = "#181818"
      ctx.beginPath()
      ctx.arc(C, C, C - 2, 0, Math.PI * 2)
      ctx.fill()

      // Concentric rings
      for (let i = 1; i <= 4; i++) {
        const r = (C - 8) * (i / 4)
        ctx.beginPath()
        ctx.arc(C, C, r, 0, Math.PI * 2)
        ctx.strokeStyle = "#343434"
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Crosshair
      ctx.strokeStyle = "#343434"
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(8, C); ctx.lineTo(S - 8, C); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(C, 8); ctx.lineTo(C, S - 8); ctx.stroke()

      // Grid labels
      ctx.fillStyle = "#666666"
      ctx.font = "700 9px -apple-system, system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("N", C, 16)
      ctx.fillText("S", C, S - 6)
      ctx.textAlign = "left"
      ctx.fillText("E", S - 16, C + 4)
      ctx.textAlign = "right"
      ctx.fillText("O", 16, C + 4)
      ctx.textAlign = "left"

      // Outer border ring
      ctx.beginPath()
      ctx.arc(C, C, C - 2, 0, Math.PI * 2)
      ctx.strokeStyle = "#343434"
      ctx.lineWidth = 2
      ctx.stroke()

      // Radar sweep — rotating orange gradient
      const sweep = angleRef.current
      const sweepWidth = Math.PI * 0.45

      // Sector fill with radial gradient
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(C, C)
      ctx.arc(C, C, C - 4, sweep - sweepWidth, sweep)
      ctx.closePath()
      const rg = ctx.createRadialGradient(C, C, 0, C, C, C - 4)
      rg.addColorStop(0,   "rgba(255, 67, 0, 0)")
      rg.addColorStop(0.5, "rgba(255, 67, 0, 0.04)")
      rg.addColorStop(1,   "rgba(255, 67, 0, 0.12)")
      ctx.fillStyle = rg
      ctx.fill()
      ctx.restore()

      // Sweep leading edge
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(C, C)
      ctx.lineTo(
        C + Math.cos(sweep) * (C - 4),
        C + Math.sin(sweep) * (C - 4)
      )
      ctx.strokeStyle = "#ff4300"
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.9
      ctx.stroke()
      ctx.restore()

      // Cluster dots — only show when sweep passes over them
      dots.forEach(dot => {
        const dx = C + Math.cos(dot.a) * dot.r * (C - 12)
        const dy = C + Math.sin(dot.a) * dot.r * (C - 12)

        // Check if sweep recently passed this dot
        const dotAngle = dot.a < 0 ? dot.a + Math.PI * 2 : dot.a
        const sweepAngle = sweep < 0 ? sweep + Math.PI * 2 : sweep
        const angleDiff = ((sweepAngle - dotAngle) + Math.PI * 2) % (Math.PI * 2)
        const inSweep = angleDiff < sweepWidth + 0.2

        if (inSweep) {
          const fade = 1 - angleDiff / (sweepWidth + 0.2)
          ctx.save()
          ctx.globalAlpha = 0.2 + fade * 0.8

          // Outer ring
          ctx.beginPath()
          ctx.arc(dx, dy, dot.size + 4, 0, Math.PI * 2)
          ctx.strokeStyle = "#ff4300"
          ctx.lineWidth = 1
          ctx.stroke()

          // Inner dot
          ctx.beginPath()
          ctx.arc(dx, dy, dot.size, 0, Math.PI * 2)
          ctx.fillStyle = "#ff4300"
          ctx.fill()

          // Label
          if (dot.label) {
            ctx.fillStyle = "#cacaca"
            ctx.font = "700 8px -apple-system, system-ui, sans-serif"
            ctx.textAlign = "left"
            ctx.fillText(dot.label, dx + dot.size + 4, dy + 3)
          }
          ctx.restore()
        } else {
          // Dim version of dot always visible
          ctx.save()
          ctx.globalAlpha = 0.15
          ctx.beginPath()
          ctx.arc(dx, dy, dot.size, 0, Math.PI * 2)
          ctx.fillStyle = "#ff4300"
          ctx.fill()
          ctx.restore()
        }
      })

      // Advance angle
      angleRef.current = (sweep + 0.018) % (Math.PI * 2)
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="rounded-full"
        style={{ border: "1px solid #343434" }}
      />
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: "0 0 60px rgba(255,67,0,0.08) inset, 0 0 40px rgba(255,67,0,0.05)" }}
      />
    </div>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "52.6k",   unit: "ton",     label: "Predicción junio 2026" },
  { value: "83",      unit: "/100",    label: "Confianza del sistema"  },
  { value: "315",     unit: "días",    label: "Historial NOAA SIR"     },
  { value: "14",      unit: "días",    label: "Horizonte de forecast"  },
]

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: TrendingUp,
    title: "Predicción mensual",
    desc: "Ensemble de 3 modelos ML ponderados por R² LOOCV. Corrección por tendencia + IC 80% calibrado. Predicción para el siguiente mes.",
    tags: ["Ridge", "Bayesian", "Ensemble"],
  },
  {
    Icon: Satellite,
    title: "Riesgo costero satelital",
    desc: "315 días históricos del NOAA SIR interpolados con kernel Wendland C2 sobre malla de ~4 km. 582 celdas de riesgo costero.",
    tags: ["NOAA AOML", "~4 km", "LOW→HIGH"],
  },
  {
    Icon: Navigation,
    title: "Forecast Lagrangiano",
    desc: "2,000 partículas con OpenDrift sobre corrientes RTOFS y viento GFS. 25 horizontes KDE cada 12h hasta 14 días.",
    tags: ["2,000 part.", "RTOFS+GFS", "14 días"],
  },
  {
    Icon: MapPin,
    title: "10 playas monitoreadas",
    desc: "Perfil de riesgo histórico para cada segmento costero de QRoo: Cozumel, Isla Mujeres, Cancún, Playa del Carmen y más.",
    tags: ["Isla Mujeres 71%", "Cancún 66%", "Coz. Norte 65%"],
  },
]

const SOURCES = ["SEMAR", "NOAA AOML", "Mendeley GASB", "RTOFS", "GFS 0.25°", "OISST v2.1", "NCEP/NCAR", "SATsum"]

// ── Landing ───────────────────────────────────────────────────────────────────

export function Landing({ onEnter }: LandingProps) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#111111", color: "#ffffff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable', system-ui, sans-serif", fontWeight: 700 }}
    >

      {/* ── 1. Top bar ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10"
        style={{ height: 56, borderBottom: "1px solid #343434", background: "rgba(17,17,17,0.92)", backdropFilter: "blur(12px)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg" style={{ background: "#ff4300" }}>
            <Waves className="size-4" style={{ color: "#ffffff" }} />
          </div>
          <span style={{ fontSize: 15, letterSpacing: "-0.3px", color: "#ffffff" }}>
            Sargazo Cozumel
          </span>
          <span
            className="flex items-center"
            style={{
              fontSize: 9, letterSpacing: "0.02em", color: "#ffffff",
              background: "#ff4300", borderRadius: 7, padding: "2px 6px",
            }}
          >
            BETA
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 12, color: "#666666", letterSpacing: "-0.1px" }}>
            Cipre Holding
          </span>
          <button
            onClick={onEnter}
            className="flex items-center gap-1.5"
            style={{
              fontSize: 13, letterSpacing: "-0.2px", color: "#ffffff",
              border: "1px solid #343434", borderRadius: 15, padding: "6px 16px",
              background: "transparent", cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = "#cacaca"
              el.style.background = "#1e1e1e"
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = "#343434"
              el.style.background = "transparent"
            }}
          >
            Entrar <ChevronRight size={13} />
          </button>
        </div>
      </header>

      {/* ── 2. Hero ────────────────────────────────────────────────── */}
      <section
        className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20 px-6 md:px-10"
        style={{ minHeight: "calc(100vh - 56px)", maxWidth: 1200, margin: "0 auto", paddingTop: 80, paddingBottom: 80 }}
      >
        {/* Text */}
        <div className="flex-1 min-w-0">
          {/* Status pill */}
          <div
            className="inline-flex items-center gap-2 mb-8"
            style={{
              border: "1px solid #343434", borderRadius: 999, padding: "6px 14px",
              background: "#181818",
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: "#ff4300", boxShadow: "0 0 8px #ff4300", flexShrink: 0 }}
            />
            <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "#999999" }}>
              COZUMEL, Q.ROO · EN OPERACIÓN
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(44px, 7vw, 68px)",
              lineHeight: 1,
              letterSpacing: "-0.056em",
              color: "#ffffff",
              marginBottom: 0,
            }}
          >
            El sargazo
            <br />no avisa.
            <br />
            <span style={{ color: "#ff4300" }}>Nosotros sí.</span>
          </h1>

          {/* Sub */}
          <p
            style={{
              fontSize: 16, lineHeight: 1.5, letterSpacing: "-0.24px",
              color: "#999999", maxWidth: 480, marginTop: 24, marginBottom: 40,
            }}
          >
            Sistema de predicción satelital para el arribo de sargazo a Cozumel.
            Inteligencia artificial + simulación física + datos oficiales —
            con hasta <span style={{ color: "#cacaca" }}>14 días de anticipación</span>.
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={onEnter}
              className="flex items-center gap-2"
              style={{
                background: "#ff4300", color: "#ffffff",
                fontSize: 14, letterSpacing: "-0.2px",
                border: "none", borderRadius: 15, padding: "12px 24px",
                cursor: "pointer", transition: "background 0.15s, transform 0.1s",
                fontWeight: 700,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#e03b00" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#ff4300" }}
              onMouseDown={e  => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)" }}
              onMouseUp={e    => { (e.currentTarget as HTMLElement).style.transform = "scale(1)" }}
            >
              Entrar al sistema
              <ArrowRight size={15} />
            </button>

            <a
              href="/docs/ARCHITECTURE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
              style={{
                color: "#666666", fontSize: 13, letterSpacing: "-0.15px",
                textDecoration: "none", transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#999999" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#666666" }}
            >
              Ver metodología técnica <ChevronRight size={13} />
            </a>
          </div>
        </div>

        {/* Radar visual */}
        <div className="shrink-0 hidden md:flex items-center justify-center" style={{ width: 320 }}>
          <RadarViz />
        </div>
      </section>

      {/* ── 3. Stats strip ─────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #343434", borderBottom: "1px solid #343434" }}>
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ maxWidth: 1200, margin: "0 auto" }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center text-center py-8 px-6"
              style={{
                borderRight: i < STATS.length - 1 ? "1px solid #343434" : "none",
              }}
            >
              <div
                className="flex items-end gap-1"
                style={{ marginBottom: 6 }}
              >
                <span style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.04em", color: "#ffffff" }}>
                  {s.value}
                </span>
                <span style={{ fontSize: 16, color: "#ff4300", paddingBottom: 3, letterSpacing: "-0.02em" }}>
                  {s.unit}
                </span>
              </div>
              <span style={{ fontSize: 11, letterSpacing: "0.04em", color: "#666666" }}>
                {s.label.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Features ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 24px 80px" }}>
        {/* Section heading */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.1em", color: "#ff4300", marginBottom: 12 }}>
            CAPACIDADES DEL SISTEMA
          </p>
          <h2 style={{ fontSize: 46, lineHeight: 1, letterSpacing: "-1.15px", color: "#ffffff", maxWidth: 520 }}>
            Inteligencia operativa para sargazo.
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map(({ Icon, title, desc, tags }) => (
            <div
              key={title}
              style={{
                background: "#181818",
                border: "1px solid #343434",
                borderRadius: 20,
                padding: 24,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#4a4a4a" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#343434" }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "#2b2a2a", border: "1px solid #343434",
                  marginBottom: 16,
                }}
              >
                <Icon size={18} style={{ color: "#ff4300" }} />
              </div>

              {/* Title */}
              <h3 style={{ fontSize: 18, letterSpacing: "-0.3px", color: "#ffffff", marginBottom: 10, lineHeight: 1.2 }}>
                {title}
              </h3>

              {/* Desc */}
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#999999", marginBottom: 16 }}>
                {desc}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10, letterSpacing: "0.04em", color: "#cacaca",
                      border: "1px solid #343434", borderRadius: 7, padding: "3px 8px",
                      background: "#2b2a2a",
                    }}
                  >
                    {t.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Data sources ────────────────────────────────────────── */}
      <section
        style={{ borderTop: "1px solid #343434", padding: "60px 24px" }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.1em", color: "#666666", marginBottom: 24, textAlign: "center" }}>
            FUENTES DE DATOS
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOURCES.map((src, i) => (
              <span key={src} className="flex items-center gap-3">
                <span
                  style={{
                    fontSize: 13, letterSpacing: "-0.1px", color: "#999999",
                    border: "1px solid #343434", borderRadius: 999, padding: "6px 14px",
                    background: "#181818",
                  }}
                >
                  {src}
                </span>
                {i < SOURCES.length - 1 && (
                  <span style={{ color: "#343434", fontSize: 12 }}>·</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Final CTA ───────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div
          style={{
            maxWidth: 640, margin: "0 auto",
            background: "#181818", border: "1px solid #343434",
            borderRadius: 25, padding: "60px 40px", textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 46px)", lineHeight: 1.1,
              letterSpacing: "-1.15px", color: "#ffffff", marginBottom: 16,
            }}
          >
            Empieza a monitorear ahora.
          </h2>
          <p style={{ fontSize: 15, color: "#666666", marginBottom: 36, lineHeight: 1.5, letterSpacing: "-0.15px" }}>
            El sistema está activo y actualizado con los últimos datos de SEMAR y NOAA.
          </p>
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2"
            style={{
              background: "#ff4300", color: "#ffffff", border: "none",
              fontSize: 14, letterSpacing: "-0.2px", fontWeight: 700,
              borderRadius: 15, padding: "14px 28px",
              cursor: "pointer", transition: "background 0.15s, transform 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#e03b00" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#ff4300" }}
            onMouseDown={e  => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)" }}
            onMouseUp={e    => { (e.currentTarget as HTMLElement).style.transform = "scale(1)" }}
          >
            Entrar al sistema <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── 7. Footer ──────────────────────────────────────────────── */}
      <footer
        style={{ borderTop: "1px solid #343434", padding: "24px 40px" }}
      >
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ maxWidth: 1200, margin: "0 auto" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center size-6 rounded"
              style={{ background: "#ff4300" }}
            >
              <Waves size={12} style={{ color: "#ffffff" }} />
            </div>
            <span style={{ fontSize: 12, color: "#666666", letterSpacing: "-0.1px" }}>
              © 2026 Cipre Holding · Cozumel, Quintana Roo
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span style={{ fontSize: 11, color: "#343434" }}>
              SEMAR · NOAA AOML · RTOFS · GFS · OISST
            </span>
          </div>
        </div>
      </footer>

    </div>
  )
}
