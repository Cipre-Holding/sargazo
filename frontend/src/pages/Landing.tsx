import { useEffect, useRef, useState } from "react"
import { Waves, ArrowRight, TrendingUp, Satellite, Navigation, MapPin } from "lucide-react"

interface LandingProps {
  onEnter: () => void
}

// ── Full-screen particle field (Aaru-style horizontal dashes) ────────────────

type Dash = {
  x: number
  y: number
  len: number
  lw: number            // line width
  drift: number         // px per frame, positive = rightward
  opacity: number       // base opacity
  phase: number         // sine phase offset
  period: number        // seconds for full opacity cycle
  colHW: number         // half-width of column at this y
  colCX: number         // column center x at creation
}

function buildParticles(W: number, H: number): Dash[] {
  // Column: centered at 60% from left, shaped like a sargazo drift plume
  // Narrower at top (incoming Atlantic), wider in middle (belt), tapering at bottom (coast)
  const cx = W * 0.60

  function halfWidth(yn: number): number {
    // yn = 0..1 (top to bottom)
    // Shape: sparse top → dense middle belt → sparse bottom
    const base = Math.sin(yn * Math.PI) * (W * 0.26)
    const pulse = Math.sin(yn * Math.PI * 2.8 + 0.4) * (W * 0.07)
    return Math.max(20, base + pulse)
  }

  const BANDS = 64
  const particles: Dash[] = []

  for (let b = 0; b < BANDS; b++) {
    const yn = b / BANDS
    const hw = halfWidth(yn)
    // More dashes in the denser middle band
    const density = Math.round(5 + yn * (1 - yn) * 36 + Math.random() * 6)

    for (let i = 0; i < density; i++) {
      // Gaussian-ish x distribution within column: mostly near center but spread to edges
      const u1 = Math.random()
      const u2 = Math.random()
      const gauss = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-9))) * Math.cos(2 * Math.PI * u2)
      const xOff = gauss * hw * 0.42    // sigma ≈ 42% of half-width

      const x = cx + Math.max(-hw, Math.min(hw, xOff))
      const y = (b / BANDS) * H + Math.random() * (H / BANDS)

      // Length: short dashes dominate, occasional long streaks
      const r = Math.random()
      const len = r < 0.5
        ? 4  + Math.random() * 12   // short   4-16px
        : r < 0.82
        ? 18 + Math.random() * 28   // medium  18-46px
        : 50 + Math.random() * 45   // long    50-95px

      particles.push({
        x, y, len,
        lw: 0.5 + Math.random() * 0.9,
        drift: 0.006 + Math.random() * 0.055,
        opacity: 0.12 + Math.random() * 0.62,
        phase: Math.random() * Math.PI * 2,
        period: 2 + Math.random() * 5,
        colHW: hw,
        colCX: cx,
      })
    }
  }
  return particles
}

function ParticleField() {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const stRef     = useRef<{ W: number; H: number; pts: Dash[]; t: number }>({
    W: 0, H: 0, pts: [], t: 0,
  })

  useEffect(() => {
    const wrap   = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext("2d")!

    function init() {
      const W = wrap!.offsetWidth
      const H = wrap!.offsetHeight
      canvas!.width  = W
      canvas!.height = H
      stRef.current = { W, H, pts: buildParticles(W, H), t: 0 }
    }

    function draw() {
      const s = stRef.current
      const { W, H, pts } = s
      s.t += 1 / 60    // ~60fps time accumulator

      ctx.clearRect(0, 0, W, H)

      for (const p of pts) {
        // Drift rightward
        p.x += p.drift
        // Wrap: when past the right edge of column, respawn on the left edge
        if (p.x - p.len / 2 > p.colCX + p.colHW * 1.1) {
          p.x = p.colCX - p.colHW * (0.7 + Math.random() * 0.5) - p.len / 2
        }

        // Opacity: gentle sine pulse
        const osc = 0.55 + 0.45 * Math.sin(2 * Math.PI * s.t / p.period + p.phase)
        const alpha = p.opacity * osc

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth   = p.lw
        ctx.beginPath()
        ctx.moveTo(p.x - p.len / 2, p.y)
        ctx.lineTo(p.x + p.len / 2, p.y)
        ctx.stroke()
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    init()
    rafRef.current = requestAnimationFrame(draw)

    const ro = new ResizeObserver(init)
    ro.observe(wrap)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "52.6k", unit: "ton",  label: "Predicción junio 2026" },
  { value: "83",    unit: "/100", label: "Confianza del sistema"  },
  { value: "315",   unit: "días", label: "Historial NOAA SIR"     },
  { value: "14",    unit: "días", label: "Horizonte de forecast"  },
]

const ACCORDION = [
  {
    num: "01",
    label: "TELEDETECCIÓN SATELITAL",
    body: "Procesamiento de imágenes Copernicus / Sentinel-3 con índice AFAI. 315 fechas diarias NOAA AOML interpoladas con kernel Wendland C2 sobre una malla costera de ~4 km. 582 celdas de riesgo costero activas.",
  },
  {
    num: "02",
    label: "MODELADO ESTOCÁSTICO fOU",
    body: "Proceso de Ornstein-Uhlenbeck fraccional calibrado a la serie SEMAR/GASB (2000-2026). Hurst H = 0.80, reversión τ½ = 13.3 meses. Correlación predictor ACO→CM r = 0.95.",
  },
  {
    num: "03",
    label: "PREDICCIÓN ENSEMBLE ACO→CM",
    body: "Ensemble ponderado por R² LOOCV de tres modelos ML: Ridge, Bayesian Ridge y Gradient Boosting. Corrección por tendencia secular + IC 80% calibrado. Horizonte: siguiente mes.",
  },
  {
    num: "04",
    label: "SEMÁFORO OPERATIVO 5 NIVELES",
    body: "Clasificación automática: Escaso → Muy alto. Actualización semanal (APScheduler, lunes 06:00 UTC). 10 playas monitoreadas en Quintana Roo con perfil de riesgo histórico.",
  },
]

const SOURCES = ["SEMAR", "NOAA AOML", "Mendeley GASB", "RTOFS", "GFS 0.25°", "OISST v2.1", "NCEP/NCAR", "SATsum"]

const FONT: React.CSSProperties = {
  fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  fontWeight: 300,
}

// ── Landing ───────────────────────────────────────────────────────────────────

export function Landing({ onEnter }: LandingProps) {
  const [openRow, setOpenRow] = useState<string | null>("01")

  // Announcement bar = 40px, nav = 56px → hero fills remainder to 100vh
  const ANNOUNCE_H = 40
  const NAV_H      = 56
  const HERO_H     = `calc(100vh - ${ANNOUNCE_H + NAV_H}px)`

  return (
    <div style={{ background: "#000000", color: "#ffffff", ...FONT }}>

      {/* ── 1. Announcement bar ───────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2 text-center"
        style={{
          background: "#ebfb10", height: ANNOUNCE_H, color: "#000000",
          fontSize: 12, letterSpacing: "0.96px",
        }}
      >
        <span style={{ textTransform: "uppercase" }}>
          Datos actualizados · Semana 22 · 2026
        </span>
        <button
          onClick={onEnter}
          style={{
            ...FONT, fontSize: 12, letterSpacing: "0.96px", color: "#000000",
            background: "transparent", border: "none", cursor: "pointer",
            textDecoration: "underline", textTransform: "uppercase",
          }}
        >
          Ver sistema →
        </button>
      </div>

      {/* ── 2. Navigation ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-8 md:px-14"
        style={{
          height: NAV_H, background: "#000000",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-3">
          <Waves size={14} style={{ color: "#ffffff" }} />
          <span style={{ fontSize: 13, letterSpacing: "0.52px", color: "#ffffff", textTransform: "uppercase" }}>
            Sargazo Cozumel
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline" style={{ fontSize: 12, letterSpacing: "0.48px", color: "#858484", textTransform: "uppercase" }}>
            Cipre Holding
          </span>
          {/* Ghost */}
          <button
            onClick={onEnter}
            style={{
              ...FONT, fontSize: 12, letterSpacing: "0.48px", color: "#ffffff",
              textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.28)",
              borderRadius: 0, padding: "8px 22px", background: "transparent",
              cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#ffffff"
              e.currentTarget.style.background = "rgba(255,255,255,0.05)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"
              e.currentTarget.style.background = "transparent"
            }}
          >
            Entrar
          </button>
          {/* Filled CTA */}
          <button
            onClick={onEnter}
            style={{
              ...FONT, fontSize: 12, letterSpacing: "0.48px", color: "#000000",
              textTransform: "uppercase", border: "none", borderRadius: 0,
              padding: "8px 22px", background: "#ebfb10", cursor: "pointer",
              transition: "background 0.15s, transform 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d4e20e" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#ebfb10" }}
            onMouseDown={e  => { e.currentTarget.style.transform = "scale(0.97)" }}
            onMouseUp={e    => { e.currentTarget.style.transform = "scale(1)" }}
          >
            Sistema →
          </button>
        </div>
      </header>

      {/* ── 3. Hero — full viewport, particles behind text ────────── */}
      <section
        style={{
          position: "relative",
          height: HERO_H,
          overflow: "hidden",
          background: "#000000",
        }}
      >
        {/* Particle field — fills entire hero */}
        <ParticleField />

        {/* Subtle vertical gradient fade at bottom so content below is clean */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
            background: "linear-gradient(to bottom, transparent, #000000)",
            pointerEvents: "none",
          }}
        />

        {/* Main headline — left side, vertically centered */}
        <div
          style={{
            position: "absolute",
            left: "max(40px, 6vw)",
            top: "50%",
            transform: "translateY(-50%)",
            maxWidth: 520,
            zIndex: 10,
          }}
        >
          <p style={{
            fontSize: 12, letterSpacing: "0.96px", color: "#9d9d9d",
            textTransform: "uppercase", marginBottom: 28,
          }}>
            Cozumel, Q.Roo · En operación
          </p>

          <h1 style={{
            fontSize: "clamp(36px, 4.8vw, 50px)", fontWeight: 300,
            lineHeight: 1.2, letterSpacing: "-1.25px", color: "#ffffff",
            marginBottom: 0,
          }}>
            El sargazo<br />
            llega.<br />
            <span style={{ color: "#ebfb10" }}>Nosotros lo vemos.</span>
          </h1>
        </div>

        {/* Secondary text — bottom right (hidden on mobile) */}
        <div
          className="hidden md:block"
          style={{
            position: "absolute",
            right: "max(40px, 6vw)",
            bottom: 48,
            maxWidth: 300,
            zIndex: 10,
            textAlign: "right",
          }}
        >
          <div style={{ height: 1, background: "rgba(255,255,255,0.2)", marginBottom: 16 }} />
          <p style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.5, letterSpacing: "0.325px", color: "#9d9d9d" }}>
            Sistema de predicción satelital para el arribo de sargazo a Cozumel.
            IA + simulación física + datos oficiales.
          </p>
          <p style={{ fontSize: 12, letterSpacing: "0.48px", color: "#858484", marginTop: 12, textTransform: "uppercase" }}>
            14 días de anticipación
          </p>
        </div>

        {/* CTA — bottom left */}
        <div
          style={{
            position: "absolute",
            left: "max(40px, 6vw)",
            bottom: 48,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2"
            style={{
              ...FONT, background: "#ebfb10", color: "#000000",
              fontSize: 14, letterSpacing: "0.56px", textTransform: "uppercase",
              border: "none", borderRadius: 0, padding: "13px 28px",
              cursor: "pointer", transition: "background 0.15s, transform 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d4e20e" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#ebfb10" }}
            onMouseDown={e  => { e.currentTarget.style.transform = "scale(0.97)" }}
            onMouseUp={e    => { e.currentTarget.style.transform = "scale(1)" }}
          >
            Entrar al sistema <ArrowRight size={14} />
          </button>

          <a
            href="#metodologia"
            style={{
              ...FONT, color: "#858484", fontSize: 13, letterSpacing: "0.325px",
              textDecoration: "none", transition: "color 0.15s", textTransform: "uppercase",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#858484" }}
          >
            Ver metodología
          </a>
        </div>
      </section>

      {/* ── 4. Plasma section — visible only AFTER scrolling ─────── */}
      <section id="metodologia" style={{ background: "#1019ec" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px max(40px, 6vw)" }}>
          <p style={{
            fontSize: 12, letterSpacing: "0.96px", color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase", marginBottom: 56,
          }}>
            Capacidades del sistema
          </p>

          {ACCORDION.map((row) => (
            <div key={row.num}>
              <div style={{ height: 1, background: "rgba(255,255,255,0.18)" }} />
              <button
                onClick={() => setOpenRow(openRow === row.num ? null : row.num)}
                className="w-full text-left flex items-start gap-8"
                style={{
                  ...FONT, background: "transparent", border: "none",
                  cursor: "pointer", padding: "24px 0", color: "#ffffff",
                }}
              >
                <span style={{ fontSize: 13, letterSpacing: "0.52px", color: "rgba(255,255,255,0.5)", minWidth: 28 }}>
                  {row.num}
                </span>
                <span style={{ fontSize: 13, letterSpacing: "0.52px", textTransform: "uppercase", flex: 1 }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 18, color: "rgba(255,255,255,0.4)",
                  transition: "transform 0.2s",
                  transform: openRow === row.num ? "rotate(45deg)" : "none",
                  display: "inline-block",
                }}>
                  +
                </span>
              </button>

              {openRow === row.num && (
                <div style={{ paddingLeft: 52, paddingBottom: 32 }}>
                  <p style={{
                    fontSize: 15, fontWeight: 400, lineHeight: 1.5,
                    letterSpacing: "0.375px", color: "rgba(255,255,255,0.88)",
                    maxWidth: 560,
                  }}>
                    {row.body}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.18)" }} />
        </div>
      </section>

      {/* ── 5. Stats strip ───────────────────────────────────────── */}
      <div style={{ background: "#000000", borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ maxWidth: 1280, margin: "0 auto" }}>
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center text-center py-10 px-8"
              style={{ borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
            >
              <div className="flex items-end gap-1.5" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 300, lineHeight: 1, letterSpacing: "-1.25px", color: "#ffffff" }}>
                  {s.value}
                </span>
                <span style={{ fontSize: 14, fontWeight: 300, color: "#ebfb10", paddingBottom: 4, letterSpacing: "0.56px" }}>
                  {s.unit}
                </span>
              </div>
              <span style={{ fontSize: 12, letterSpacing: "0.96px", color: "#858484", textTransform: "uppercase" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. Feature grid ──────────────────────────────────────── */}
      <section style={{ background: "#000000", maxWidth: 1280, margin: "0 auto", padding: "96px max(40px, 6vw) 80px" }}>
        <div style={{ marginBottom: 64 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.96px", color: "#858484", textTransform: "uppercase", marginBottom: 20 }}>
            Tecnología
          </p>
          <h2 style={{
            fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 300,
            lineHeight: 1.2, letterSpacing: "-2px", color: "#ffffff",
            maxWidth: 480, margin: 0,
          }}>
            Inteligencia operativa para sargazo.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {([
            { Icon: TrendingUp, title: "Predicción mensual",
              desc: "Ensemble de 3 modelos ML ponderados por R² LOOCV. IC 80% calibrado. Horizonte: siguiente mes.",
              tags: ["Ridge", "Bayesian", "Ensemble"] },
            { Icon: Satellite, title: "Riesgo costero satelital",
              desc: "315 días históricos NOAA SIR interpolados con kernel Wendland C2. Malla ~4 km, 582 celdas.",
              tags: ["NOAA AOML", "~4 km", "582 celdas"] },
            { Icon: Navigation, title: "Forecast Lagrangiano",
              desc: "2 000 partículas con OpenDrift sobre corrientes RTOFS y viento GFS. 25 horizontes KDE.",
              tags: ["2 000 part.", "RTOFS+GFS", "14 días"] },
            { Icon: MapPin, title: "10 playas monitoreadas",
              desc: "Perfil de riesgo histórico para cada segmento de QRoo: Cozumel, Cancún, Playa del Carmen.",
              tags: ["Isla Mujeres 71%", "Cancún 66%", "Coz. Norte 65%"] },
          ] as const).map(({ Icon, title, desc, tags }, i) => (
            <div
              key={title}
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                borderLeft: i % 2 === 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                padding: 30,
                transition: "background 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#18181b" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <Icon size={15} style={{ color: "#ebfb10", marginBottom: 20 }} />
              <h3 style={{ fontSize: 16, fontWeight: 300, letterSpacing: "-0.5px", color: "#ffffff", marginBottom: 10, lineHeight: 1.25 }}>
                {title}
              </h3>
              <p style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5, letterSpacing: "0.35px", color: "#9d9d9d", marginBottom: 20 }}>
                {desc}
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11, letterSpacing: "0.44px", color: "#858484",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "3px 10px", textTransform: "uppercase",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
      </section>

      {/* ── 7. Sources ───────────────────────────────────────────── */}
      <section style={{ background: "#000000", padding: "64px max(40px, 6vw)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p style={{
            fontSize: 12, letterSpacing: "0.96px", color: "#858484",
            textTransform: "uppercase", marginBottom: 24, textAlign: "center",
          }}>
            Fuentes de datos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SOURCES.map(src => (
              <span
                key={src}
                style={{
                  fontSize: 12, fontWeight: 300, letterSpacing: "0.48px", color: "#9d9d9d",
                  border: "1px solid rgba(255,255,255,0.1)", padding: "6px 14px",
                  textTransform: "uppercase",
                }}
              >
                {src}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. CTA final ─────────────────────────────────────────── */}
      <section style={{ background: "#000000", padding: "80px max(40px, 6vw)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 300,
            letterSpacing: "-2px", lineHeight: 1.2, color: "#ffffff", marginBottom: 20,
          }}>
            Empieza a monitorear ahora.
          </h2>
          <p style={{
            fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: "0.375px",
            color: "#9d9d9d", marginBottom: 40,
          }}>
            Sistema activo con los últimos datos de SEMAR y NOAA.
          </p>
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2"
            style={{
              ...FONT, background: "#ebfb10", color: "#000000",
              fontSize: 14, letterSpacing: "0.56px", textTransform: "uppercase",
              border: "none", borderRadius: 0, padding: "14px 32px",
              cursor: "pointer", transition: "background 0.15s, transform 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#d4e20e" }}
            onMouseLeave={e => { e.currentTarget.style.background = "#ebfb10" }}
            onMouseDown={e  => { e.currentTarget.style.transform = "scale(0.97)" }}
            onMouseUp={e    => { e.currentTarget.style.transform = "scale(1)" }}
          >
            Entrar al sistema <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ── 9. Footer ────────────────────────────────────────────── */}
      <footer style={{ background: "#000000", borderTop: "1px solid rgba(255,255,255,0.07)", padding: "24px max(40px, 6vw)" }}>
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ maxWidth: 1280, margin: "0 auto" }}
        >
          <div className="flex items-center gap-3">
            <Waves size={13} style={{ color: "#858484" }} />
            <span style={{ fontSize: 12, fontWeight: 300, color: "#858484", letterSpacing: "0.48px" }}>
              © 2026 Cipre Holding · Cozumel, Quintana Roo
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 300, color: "#858484", letterSpacing: "0.44px", textTransform: "uppercase" }}>
            SEMAR · NOAA AOML · RTOFS · GFS · OISST
          </span>
        </div>
      </footer>

    </div>
  )
}
