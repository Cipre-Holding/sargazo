import { useEffect, useRef, useState } from "react"
import { Waves, ArrowRight, TrendingUp, Satellite, Navigation, MapPin } from "lucide-react"

interface LandingProps {
  onEnter: () => void
}

// ── Particle Scatter Visualization ────────────────────────────────────────────

type Particle = {
  x: number
  y: number
  dx: number
  dy: number
  r: number
  len: number
  angle: number
  opacity: number
  color: "white" | "ash"
  pulse: number
  pulseDir: number
  pulseSpeed: number
}

function ParticleScatter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const ptRef     = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const W = canvas.width
    const H = canvas.height

    ptRef.current = Array.from({ length: 180 }, () => {
      const isDash  = Math.random() < 0.3
      const spd     = 0.04 + Math.random() * 0.18
      const dir     = Math.random() * Math.PI * 2
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        dx: Math.cos(dir) * spd,
        dy: Math.sin(dir) * spd,
        r:   1.2 + Math.random() * 1.6,
        len: isDash ? 4 + Math.random() * 6 : 0,
        angle: Math.random() * Math.PI,
        opacity: 0.12 + Math.random() * 0.55,
        color: Math.random() < 0.65 ? "white" : "ash",
        pulse: Math.random(),
        pulseDir: Math.random() < 0.5 ? 1 : -1,
        pulseSpeed: 0.002 + Math.random() * 0.007,
      }
    })

    let glowCount = 0

    function draw() {
      ctx.clearRect(0, 0, W, H)
      glowCount = 0

      for (const p of ptRef.current) {
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0) { p.x = 0;  p.dx *= -1 }
        if (p.x > W) { p.x = W;  p.dx *= -1 }
        if (p.y < 0) { p.y = 0;  p.dy *= -1 }
        if (p.y > H) { p.y = H;  p.dy *= -1 }

        p.pulse += p.pulseDir * p.pulseSpeed
        if (p.pulse > 1) { p.pulse = 1; p.pulseDir = -1 }
        if (p.pulse < 0) { p.pulse = 0; p.pulseDir = 1 }

        const glowing = p.pulse > 0.72 && glowCount < 10
        if (glowing) glowCount++

        const alpha = glowing
          ? 0.25 + p.pulse * 0.6
          : p.opacity * (0.45 + p.pulse * 0.55)

        if (glowing) {
          ctx.fillStyle   = `rgba(235,251,16,${alpha})`
          ctx.strokeStyle = `rgba(235,251,16,${alpha})`
        } else if (p.color === "white") {
          ctx.fillStyle   = `rgba(255,255,255,${alpha})`
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`
        } else {
          ctx.fillStyle   = `rgba(186,186,186,${alpha})`
          ctx.strokeStyle = `rgba(186,186,186,${alpha})`
        }

        if (p.len > 0) {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.angle)
          ctx.beginPath()
          ctx.moveTo(-p.len / 2, 0)
          ctx.lineTo(p.len / 2, 0)
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={380}
      height={500}
      style={{ display: "block", opacity: 0.85 }}
    />
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
    body: "Proceso de Ornstein-Uhlenbeck fraccional calibrado a la serie histórica SEMAR/GASB (2000-2026). Exponente de Hurst H = 0.80, tiempo de reversión τ½ = 13.3 meses. Correlación predictor ACO→CM r = 0.95.",
  },
  {
    num: "03",
    label: "PREDICCIÓN ENSEMBLE ACO→CM",
    body: "Ensemble ponderado por R² LOOCV de tres modelos ML: Ridge, Bayesian Ridge y Gradient Boosting. Corrección por tendencia secular + Intervalo de confianza 80% calibrado. Horizonte: siguiente mes.",
  },
  {
    num: "04",
    label: "SEMÁFORO OPERATIVO 5 NIVELES",
    body: "Clasificación automática en 5 niveles de alerta (Escaso → Muy alto). Actualización semanal vía pipeline automatizado (APScheduler, lunes 06:00 UTC). 10 playas monitoreadas en Quintana Roo.",
  },
]

const SOURCES = ["SEMAR", "NOAA AOML", "Mendeley GASB", "RTOFS", "GFS 0.25°", "OISST v2.1", "NCEP/NCAR", "SATsum"]

// ── Shared inline styles ──────────────────────────────────────────────────────

const FONT: React.CSSProperties = {
  fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  fontWeight: 300,
}

// ── Landing ───────────────────────────────────────────────────────────────────

export function Landing({ onEnter }: LandingProps) {
  const [openRow, setOpenRow] = useState<string | null>("01")

  return (
    <div style={{ background: "#000000", color: "#ffffff", ...FONT }}>

      {/* ── 1. Announcement bar ───────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2 text-center"
        style={{ background: "#ebfb10", height: 40, color: "#000000", fontSize: 12, letterSpacing: "0.96px" }}
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
        className="sticky top-0 z-50 flex items-center justify-between px-8 md:px-12"
        style={{ height: 56, background: "#000000", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <Waves size={15} style={{ color: "#ffffff" }} />
          <span style={{ fontSize: 13, letterSpacing: "0.52px", color: "#ffffff", textTransform: "uppercase" }}>
            Sargazo Cozumel
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline" style={{ fontSize: 12, letterSpacing: "0.48px", color: "#9d9d9d", textTransform: "uppercase" }}>
            Cipre Holding
          </span>
          {/* Ghost button */}
          <button
            onClick={onEnter}
            style={{
              ...FONT, fontSize: 12, letterSpacing: "0.48px", color: "#ffffff",
              textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 0, padding: "8px 24px", background: "transparent",
              cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#ffffff"
              e.currentTarget.style.background = "rgba(255,255,255,0.05)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"
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
              padding: "8px 24px", background: "#ebfb10", cursor: "pointer",
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

      {/* ── 3. Hero ───────────────────────────────────────────────── */}
      <section
        className="flex flex-col lg:flex-row items-center gap-16"
        style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 48px 96px" }}
      >
        {/* Left — text */}
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <p style={{
            fontSize: 12, letterSpacing: "0.96px", color: "#9d9d9d",
            textTransform: "uppercase", marginBottom: 40,
          }}>
            Cozumel, Q.Roo · En operación
          </p>

          <h1 style={{
            fontSize: "clamp(40px, 5vw, 50px)", fontWeight: 300,
            lineHeight: 1.2, letterSpacing: "-1.25px", color: "#ffffff",
            marginBottom: 0,
          }}>
            El sargazo<br />
            llega.<br />
            <span style={{ color: "#ebfb10" }}>Nosotros lo vemos.</span>
          </h1>

          <p style={{
            fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: "0.6px",
            color: "#9d9d9d", maxWidth: 480, marginTop: 24, marginBottom: 48,
          }}>
            Sistema de predicción satelital para el arribo de sargazo a Cozumel.
            IA + simulación física + datos oficiales —
            con hasta <span style={{ color: "#bababa" }}>14 días de anticipación</span>.
          </p>

          <div className="flex items-center gap-8 flex-wrap">
            <button
              onClick={onEnter}
              className="inline-flex items-center gap-2"
              style={{
                ...FONT, background: "#ebfb10", color: "#000000",
                fontSize: 14, letterSpacing: "0.56px", textTransform: "uppercase",
                border: "none", borderRadius: 0, padding: "14px 30px",
                cursor: "pointer", transition: "background 0.15s, transform 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#d4e20e" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#ebfb10" }}
              onMouseDown={e  => { e.currentTarget.style.transform = "scale(0.97)" }}
              onMouseUp={e    => { e.currentTarget.style.transform = "scale(1)" }}
            >
              Entrar al sistema
              <ArrowRight size={15} />
            </button>

            <a
              href="#metodologia"
              style={{
                ...FONT, color: "#858484", fontSize: 13, letterSpacing: "0.325px",
                textDecoration: "none", transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#858484" }}
            >
              Ver metodología
            </a>
          </div>
        </div>

        {/* Right — particle scatter */}
        <div className="shrink-0 hidden lg:block" style={{ opacity: 0.9 }}>
          <ParticleScatter />
        </div>
      </section>

      {/* ── 4. Plasma section — numbered accordion ───────────────── */}
      <section id="metodologia" style={{ background: "#1019ec" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px" }}>
          <p style={{
            fontSize: 12, letterSpacing: "0.96px", color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase", marginBottom: 48,
          }}>
            Capacidades del sistema
          </p>

          {ACCORDION.map((row) => (
            <div key={row.num}>
              <div style={{ height: 1, background: "rgba(255,255,255,0.2)" }} />
              <button
                onClick={() => setOpenRow(openRow === row.num ? null : row.num)}
                className="w-full text-left flex items-start gap-8"
                style={{
                  ...FONT, background: "transparent", border: "none",
                  cursor: "pointer", padding: "22px 0", color: "#ffffff",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 300, letterSpacing: "0.52px", color: "rgba(255,255,255,0.55)", minWidth: 28 }}>
                  {row.num}
                </span>
                <span style={{ fontSize: 13, fontWeight: 300, letterSpacing: "0.52px", textTransform: "uppercase", flex: 1 }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 18, color: "rgba(255,255,255,0.45)",
                  transition: "transform 0.2s",
                  transform: openRow === row.num ? "rotate(45deg)" : "none",
                  display: "inline-block",
                }}>
                  +
                </span>
              </button>

              {openRow === row.num && (
                <div style={{ paddingLeft: 52, paddingBottom: 28 }}>
                  <p style={{
                    fontSize: 15, fontWeight: 400, lineHeight: 1.5,
                    letterSpacing: "0.375px", color: "rgba(255,255,255,0.9)",
                    maxWidth: 560,
                  }}>
                    {row.body}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.2)" }} />
        </div>
      </section>

      {/* ── 5. Stats strip ───────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ maxWidth: 1280, margin: "0 auto" }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center text-center py-10 px-8"
              style={{ borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
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

      {/* ── 6. Feature cards ─────────────────────────────────────── */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 48px 80px" }}>
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.96px", color: "#858484", textTransform: "uppercase", marginBottom: 20 }}>
            Tecnología
          </p>
          <h2 style={{
            fontSize: "clamp(30px, 4vw, 40px)", fontWeight: 300,
            lineHeight: 1.2, letterSpacing: "-2px", color: "#ffffff",
            maxWidth: 480, marginBottom: 0,
          }}>
            Inteligencia operativa para sargazo.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {([
            { Icon: TrendingUp, title: "Predicción mensual",
              desc: "Ensemble de 3 modelos ML ponderados por R² LOOCV. Corrección por tendencia + IC 80% calibrado.",
              tags: ["Ridge", "Bayesian", "Ensemble"] },
            { Icon: Satellite,  title: "Riesgo costero satelital",
              desc: "315 días históricos del NOAA SIR interpolados con kernel Wendland C2 sobre malla de ~4 km.",
              tags: ["NOAA AOML", "~4 km", "582 celdas"] },
            { Icon: Navigation, title: "Forecast Lagrangiano",
              desc: "2,000 partículas con OpenDrift sobre corrientes RTOFS y viento GFS. 25 horizontes KDE cada 12h.",
              tags: ["2 000 part.", "RTOFS+GFS", "14 días"] },
            { Icon: MapPin,     title: "10 playas monitoreadas",
              desc: "Perfil de riesgo histórico para cada segmento costero de QRoo: Cozumel, Cancún, Playa del Carmen.",
              tags: ["Isla Mujeres 71%", "Cancún 66%", "Coz. Norte 65%"] },
          ] as const).map(({ Icon, title, desc, tags }, i) => (
            <div
              key={title}
              style={{
                borderTop: "1px solid rgba(255,255,255,0.1)",
                borderLeft: i % 2 === 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
                padding: 30,
                transition: "background 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#18181b" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <div style={{ marginBottom: 20 }}>
                <Icon size={16} style={{ color: "#ebfb10" }} />
              </div>
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
                      fontSize: 11, letterSpacing: "0.44px", color: "#9d9d9d",
                      border: "1px solid rgba(255,255,255,0.12)",
                      padding: "4px 10px", background: "transparent", textTransform: "uppercase",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
      </section>

      {/* ── 7. Data sources ──────────────────────────────────────── */}
      <section style={{ padding: "64px 48px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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
                  background: "transparent", textTransform: "uppercase",
                }}
              >
                {src}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Final CTA ─────────────────────────────────────────── */}
      <section style={{ padding: "80px 48px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(30px, 4vw, 40px)", fontWeight: 300,
            letterSpacing: "-2px", lineHeight: 1.2, color: "#ffffff", marginBottom: 20,
          }}>
            Empieza a monitorear ahora.
          </h2>
          <p style={{
            fontSize: 15, fontWeight: 400, lineHeight: 1.5, letterSpacing: "0.375px",
            color: "#9d9d9d", marginBottom: 40,
          }}>
            El sistema está activo y actualizado con los últimos datos de SEMAR y NOAA.
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
            Entrar al sistema <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── 9. Footer ────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "24px 48px" }}>
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
