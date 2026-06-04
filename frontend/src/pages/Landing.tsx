import { useEffect, useRef, useState } from "react"
import { Waves, ArrowRight, TrendingUp, Satellite, Navigation, MapPin } from "lucide-react"

interface LandingProps { onEnter: () => void }

// ── Geo types ─────────────────────────────────────────────────────────────────
type Cam = { lon: number; lat: number; scale: number }
type GeoDash = { lon: number; lat: number; startLon: number; dLon: number; halfLenDeg: number; lw: number; opacity: number; phase: number; period: number; curv: number; tilt: number }
type SarDash  = { lon: number; lat: number; dLon: number; halfLenDeg: number; lw: number; phase: number; period: number; startLon: number; stopped: boolean; curv: number; tilt: number }

// ── Mexico polygons ───────────────────────────────────────────────────────────
const MX_MAIN: [number,number][] = [
  [-114.9,32.5],[-111.0,31.3],[-108.2,31.3],[-106.6,31.8],
  [-104.8,29.6],[-102.8,29.4],[-100.7,29.2],[-100.3,28.2],
  [-99.5, 27.7],[-99.0, 26.4],[-97.2, 25.9],[-97.2, 23.0],
  [-97.5, 22.3],[-97.7, 20.9],[-96.2, 19.3],[-95.0, 18.8],
  [-94.1, 18.2],[-91.6, 18.8],[-90.8, 19.7],[-90.5, 21.3],
  [-89.7, 21.4],[-88.3, 21.6],[-87.1, 21.6],[-86.8, 21.3],
  [-87.0, 20.5],[-87.5, 20.0],[-87.7, 19.5],[-87.9, 19.0],
  [-88.3, 18.5],[-88.5, 18.0],[-89.1, 17.8],[-89.1, 17.3],
  [-90.9, 16.1],[-92.2, 14.5],[-92.4, 15.0],[-94.1, 16.0],
  [-95.0, 15.7],[-96.5, 15.5],[-97.7, 15.9],[-99.7, 16.7],
  [-100.6,17.0],[-101.5,17.0],[-102.3,17.8],[-103.5,19.0],
  [-104.6,19.2],[-105.0,20.5],[-105.6,21.5],[-106.3,22.9],
  [-106.5,23.2],[-108.5,24.2],[-109.5,27.0],[-110.0,28.5],
  [-111.8,30.0],[-113.5,31.0],
]
// Yucatan + QRoo coast polyline — open path, drawn brighter during zoom
const QR_COAST: [number,number][] = [
  [-90.5,21.3],[-89.7,21.4],[-88.3,21.6],
  [-87.1,21.6],[-86.8,21.3],
  [-87.0,20.5],[-87.5,20.0],[-87.7,19.5],[-87.9,19.0],
  [-88.3,18.5],[-88.5,18.0],[-89.1,17.8],[-89.1,17.3],
]

const MX_BAJA: [number,number][] = [
  [-117.1,32.5],[-114.7,31.8],[-113.5,29.5],[-112.0,27.5],
  [-111.5,27.0],[-110.5,25.5],[-109.8,23.5],[-109.4,22.9],
  [-110.0,23.5],[-111.0,25.5],[-113.0,27.0],[-115.0,28.5],
  [-116.0,30.0],[-117.1,31.5],
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function pip(px: number, py: number, poly: [number,number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi,yi] = poly[i], [xj,yj] = poly[j]
    if (((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside
  }
  return inside
}
function eic(t: number): number {
  return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2
}
function lx(lon: number, cam: Cam, W: number): number { return (lon-cam.lon)*cam.scale+W/2 }
function ly(lat: number, cam: Cam, H: number): number { return -(lat-cam.lat)*cam.scale+H/2 }
function smx(W: number, H: number): number { return Math.min((W*0.78)/31.3,(H*0.78)/18.2) }

function drawPoly(poly: [number,number][], cam: Cam, W: number, H: number, ctx: CanvasRenderingContext2D, alpha: number) {
  if (alpha<=0) return
  ctx.save()
  ctx.globalAlpha=alpha; ctx.strokeStyle="#ffffff"; ctx.lineWidth=0.7
  ctx.setLineDash([4,9])
  ctx.beginPath()
  poly.forEach(([lon,lat],i)=>{ const x=lx(lon,cam,W),y=ly(lat,cam,H); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y) })
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([])
  ctx.restore()
}

function drawLine(pts: [number,number][], cam: Cam, W: number, H: number, ctx: CanvasRenderingContext2D, alpha: number, lw: number) {
  if (alpha<=0) return
  ctx.save()
  ctx.globalAlpha=alpha; ctx.strokeStyle="#ffffff"; ctx.lineWidth=lw
  ctx.setLineDash([3,7])
  ctx.beginPath()
  pts.forEach(([lon,lat],i)=>{ const x=lx(lon,cam,W),y=ly(lat,cam,H); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y) })
  ctx.stroke(); ctx.setLineDash([])
  ctx.restore()
}

function drawLabel(text: string, lon: number, lat: number, cam: Cam, W: number, H: number, ctx: CanvasRenderingContext2D, alpha: number) {
  const x=lx(lon,cam,W), y=ly(lat,cam,H)
  if (x<-80||x>W+80||y<-20||y>H+20) return
  ctx.save()
  ctx.globalAlpha=alpha; ctx.fillStyle="#d4d4d4"; ctx.font="700 11px 'Inter',sans-serif"
  ctx.fillText(text, x, y)
  ctx.restore()
}

function buildMXP(): GeoDash[] {
  const pts: GeoDash[] = []
  let att = 0
  while (pts.length < 1400 && att < 160000) {
    att++
    const lon = -118+Math.random()*31.3
    const lat = 14.5+Math.random()*18.2
    if (!pip(lon,lat,MX_MAIN) && !pip(lon,lat,MX_BAJA)) continue
    const r = Math.random()
    pts.push({
      lon, lat,
      startLon:   lon,
      dLon:       (Math.random()-0.5)*0.0005,
      halfLenDeg: r<0.5 ? 0.04+Math.random()*0.10 : r<0.85 ? 0.14+Math.random()*0.22 : 0.38+Math.random()*0.44,
      lw:         0.5+Math.random()*1.1,
      opacity:    0.18+Math.random()*0.68,
      phase:      Math.random()*Math.PI*2,
      period:     2+Math.random()*5,
      curv:       (Math.random()-0.5)*0.55,
      tilt:       (Math.random()-0.5)*0.30,
    })
  }
  return pts
}

// Fine-detail particles for QRoo — sub-pixel in wide view, emerge at Caribbean zoom
function buildQRDetailP(): GeoDash[] {
  const pts: GeoDash[] = []
  let att = 0
  while (pts.length < 480 && att < 70000) {
    att++
    const lon = -89.6+Math.random()*3.3   // QRoo bbox lon
    const lat = 17.2+Math.random()*4.8    // QRoo bbox lat
    if (!pip(lon,lat,MX_MAIN)) continue
    pts.push({
      lon, lat,
      startLon:   lon,
      dLon:       (Math.random()-0.5)*0.00015,   // nearly static
      halfLenDeg: 0.006+Math.random()*0.030,     // 2-10px at 8.5x zoom
      lw:         0.35+Math.random()*0.80,
      opacity:    0.28+Math.random()*0.68,
      phase:      Math.random()*Math.PI*2,
      period:     1.5+Math.random()*4.0,
      curv:       (Math.random()-0.5)*0.50,
      tilt:       (Math.random()-0.5)*0.22,
    })
  }
  return pts
}

function buildBajaP(): GeoDash[] {
  const pts: GeoDash[] = []
  let att = 0
  while (pts.length < 220 && att < 40000) {
    att++
    const lon = -117.5+Math.random()*8.5
    const lat = 22.5+Math.random()*10.0
    if (!pip(lon,lat,MX_BAJA)) continue
    const r = Math.random()
    pts.push({
      lon, lat,
      startLon:   lon,
      dLon:       (Math.random()-0.5)*0.0004,
      halfLenDeg: r<0.5 ? 0.04+Math.random()*0.10 : r<0.85 ? 0.14+Math.random()*0.20 : 0.32+Math.random()*0.36,
      lw:         0.5+Math.random()*1.0,
      opacity:    0.20+Math.random()*0.65,
      phase:      Math.random()*Math.PI*2,
      period:     2+Math.random()*5,
      curv:       (Math.random()-0.5)*0.55,
      tilt:       (Math.random()-0.5)*0.28,
    })
  }
  return pts
}

function buildSarP(): SarDash[] {
  return Array.from({length:220},()=>{
    const startLon = -84.5+Math.random()*5.5
    return {
      lon: startLon, lat: 17.5+Math.random()*4.0,
      dLon:       -(0.007+Math.random()*0.013),
      halfLenDeg: 0.05+Math.random()*0.18,
      lw:         0.6+Math.random()*1.4,
      phase:      Math.random()*Math.PI*2,
      period:     1.5+Math.random()*3.0,
      startLon, stopped: false,
      curv:       (Math.random()-0.5)*0.45,
      tilt:       (Math.random()-0.5)*0.25,
    }
  })
}

const TW=9, TZI=14, TCB=24, TZO=29, TLOOP=30, COAST=-87.2

// ── GeoParticleField ──────────────────────────────────────────────────────────
function GeoParticleField({ stageRef }: { stageRef: { current: number } }) {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const wrap   = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext("2d")!

    let W=0, H=0, mxP: GeoDash[]=[], bajaP: GeoDash[]=[], saP: SarDash[]=[], qrP: GeoDash[]=[], startMs=0, prevStage=-1

    function init() {
      W = wrap!.offsetWidth
      H = wrap!.offsetHeight
      if (!W || !H) return
      canvas!.width=W; canvas!.height=H
      mxP=buildMXP(); bajaP=buildBajaP(); saP=buildSarP(); qrP=buildQRDetailP()
      startMs=performance.now(); prevStage=-1
    }

    function getCam(): { stage: number; cam: Cam } {
      const s0=smx(W,H)
      const wc: Cam={lon:-102.0,lat:23.5,scale:s0}
      const cc: Cam={lon:-87.4, lat:20.3,scale:s0*8.5}
      const T=((performance.now()-startMs)/1000)%TLOOP
      if (T<TW)  return {stage:0,cam:wc}
      if (T<TZI) { const t=eic((T-TW)/(TZI-TW)); return {stage:1,cam:{lon:wc.lon+(cc.lon-wc.lon)*t,lat:wc.lat+(cc.lat-wc.lat)*t,scale:wc.scale+(cc.scale-wc.scale)*t}} }
      if (T<TCB) return {stage:2,cam:cc}
      if (T<TZO) { const t=eic((T-TCB)/(TZO-TCB)); return {stage:3,cam:{lon:cc.lon+(wc.lon-cc.lon)*t,lat:cc.lat+(wc.lat-cc.lat)*t,scale:cc.scale+(wc.scale-cc.scale)*t}} }
      return {stage:0,cam:wc}
    }

    function draw() {
      if (!W||!H) return
      const now=performance.now()
      const T=((now-startMs)/1000)%TLOOP
      const ts=now/1000
      const {stage,cam}=getCam()

      if (stage===0 && prevStage>0) {
        for (const p of saP) { p.lon=p.startLon; p.stopped=false }
        for (const p of mxP) { p.lon=p.startLon }
        for (const p of bajaP) { p.lon=p.startLon }
        for (const p of qrP) { p.lon=p.startLon }
      }
      prevStage=stage
      stageRef.current=stage

      ctx.globalAlpha=1
      ctx.clearRect(0,0,W,H)

      // Polygon border contour (dashed, behind particles)
      drawPoly(MX_MAIN, cam, W, H, ctx, 0.09)
      drawPoly(MX_BAJA, cam, W, H, ctx, 0.09)

      // Mexico particles
      for (const p of mxP) {
        p.lon+=p.dLon
        if (p.lon<-118) p.lon+=31.3
        if (p.lon>-86.7) p.lon-=31.3
        const px=lx(p.lon,cam,W), py=ly(p.lat,cam,H)
        const hl=Math.min(p.halfLenDeg*cam.scale,180)
        if (hl<0.5||px+hl<0||px-hl>W||py<-2||py>H+2) continue
        const osc=0.55+0.45*Math.sin(2*Math.PI*ts/p.period+p.phase)
        const y0=py+p.tilt*hl*0.22, y1=py-p.tilt*hl*0.22, cy=py+p.curv*hl*0.18
        ctx.globalAlpha=p.opacity*osc
        ctx.strokeStyle="#ffffff"
        ctx.lineWidth=p.lw
        ctx.beginPath(); ctx.moveTo(px-hl,y0); ctx.quadraticCurveTo(px,cy,px+hl,y1); ctx.stroke()
      }

      // Baja California dedicated particles
      for (const p of bajaP) {
        p.lon+=p.dLon
        if (p.lon<-117.5) p.lon+=8.5
        if (p.lon>-109.0) p.lon-=8.5
        const px=lx(p.lon,cam,W), py=ly(p.lat,cam,H)
        const hl=Math.min(p.halfLenDeg*cam.scale,180)
        if (hl<0.5||px+hl<0||px-hl>W||py<-2||py>H+2) continue
        const osc=0.55+0.45*Math.sin(2*Math.PI*ts/p.period+p.phase)
        const y0=py+p.tilt*hl*0.22, y1=py-p.tilt*hl*0.22, cy=py+p.curv*hl*0.18
        ctx.globalAlpha=p.opacity*osc
        ctx.strokeStyle="#ffffff"
        ctx.lineWidth=p.lw
        ctx.beginPath(); ctx.moveTo(px-hl,y0); ctx.quadraticCurveTo(px,cy,px+hl,y1); ctx.stroke()
      }

      // Sargazo particles (stage 1,2,3)
      if (stage>=1) {
        let sa=1.0
        if (stage===1) sa=eic((T-TW)/(TZI-TW))
        if (stage===3) sa=1-eic((T-TCB)/(TZO-TCB))

        for (const p of saP) {
          // only drift during stage 2
          if (stage===2 && !p.stopped) {
            p.lon+=p.dLon
            if (p.lon<=COAST) { p.lon=COAST; p.stopped=true }
          }
          const px=lx(p.lon,cam,W), py=ly(p.lat,cam,H)
          const hl=Math.min(p.halfLenDeg*cam.scale,100)
          if (hl<0.5||px+hl<0||px-hl>W||py<-2||py>H+2) continue
          // white → #cfb53b as particle approaches coast
          const rawProg=(p.startLon-p.lon)/(p.startLon-COAST)
          const prog=Math.max(0,Math.min(1,(rawProg-0.25)/0.75))
          const cr=Math.round(255-48*prog), cg=Math.round(255-74*prog), cb=Math.round(255-196*prog)
          const osc=0.6+0.4*Math.sin(2*Math.PI*ts/p.period+p.phase)
          const sy0=py+p.tilt*hl*0.22, sy1=py-p.tilt*hl*0.22, scy=py+p.curv*hl*0.18
          ctx.globalAlpha=(p.stopped?0.7*osc:0.4+0.35*osc)*sa
          ctx.strokeStyle=`rgb(${cr},${cg},${cb})`
          ctx.lineWidth=p.lw
          ctx.beginPath(); ctx.moveTo(px-hl,sy0); ctx.quadraticCurveTo(px,scy,px+hl,sy1); ctx.stroke()
        }
      }

      // QRoo detail particles + coast line — emerge as camera zooms in
      if (stage>=1) {
        let qa=1.0
        if (stage===1) qa=eic((T-TW)/(TZI-TW))
        if (stage===3) qa=1-eic((T-TCB)/(TZO-TCB))

        // Fine-grained land particles (invisible at wide scale, visible at zoom)
        for (const p of qrP) {
          p.lon+=p.dLon
          const px=lx(p.lon,cam,W), py=ly(p.lat,cam,H)
          const hl=Math.min(p.halfLenDeg*cam.scale,48)
          if (hl<0.8||px+hl<0||px-hl>W||py<-2||py>H+2) continue
          const osc=0.55+0.45*Math.sin(2*Math.PI*ts/p.period+p.phase)
          const y0=py+p.tilt*hl*0.22, y1=py-p.tilt*hl*0.22, cy=py+p.curv*hl*0.18
          ctx.globalAlpha=p.opacity*osc*qa
          ctx.strokeStyle="#ffffff"; ctx.lineWidth=p.lw
          ctx.beginPath(); ctx.moveTo(px-hl,y0); ctx.quadraticCurveTo(px,cy,px+hl,y1); ctx.stroke()
        }

        // QRoo coast polyline brighter during zoom
        drawLine(QR_COAST, cam, W, H, ctx, qa*0.18, 0.9)
      }

      // Geographic labels — visible only during Caribbean stage
      if (stage===2) {
        const la=eic(Math.min(1,(T-TZI)/2))
        drawLabel("CANCÚN",     -86.55, 21.38, cam, W, H, ctx, la*0.85)
        drawLabel("COZUMEL",    -86.50, 20.48, cam, W, H, ctx, la*0.85)
        drawLabel("TULUM",      -86.95, 20.02, cam, W, H, ctx, la*0.80)
        drawLabel("CHETUMAL",   -88.00, 18.48, cam, W, H, ctx, la*0.70)
        drawLabel("MAR CARIBE", -84.90, 19.60, cam, W, H, ctx, la*0.55)
      }
    }

    function loop() { draw(); rafRef.current=requestAnimationFrame(loop) }
    init()
    rafRef.current=requestAnimationFrame(loop)
    const ro=new ResizeObserver(init)
    ro.observe(wrap!)
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [stageRef])

  return (
    <div ref={wrapRef} style={{position:"absolute",inset:0,pointerEvents:"none"}}>
      <canvas ref={canvasRef} style={{display:"block"}} />
    </div>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────
const STATS = [
  { value:"52.6k", unit:"ton",  label:"Predicción junio 2026" },
  { value:"83",    unit:"/100", label:"Confianza del sistema"  },
  { value:"315",   unit:"días", label:"Historial NOAA SIR"     },
  { value:"14",    unit:"días", label:"Horizonte de forecast"  },
  { value:"604",   unit:"reg.", label:"Boletines SEMAR 2014–26" },
  { value:"H=0.80",unit:"Hurst",label:"Memoria larga fOU"      },
  { value:"2 000", unit:"part.",label:"Partículas OpenDrift"    },
  { value:"10",    unit:"plyas",label:"Segmentos monitoreados"  },
]
const ACCORDION = [
  { num:"01", label:"TELEDETECCIÓN SATELITAL",
    body:"Procesamiento de imágenes Copernicus / Sentinel-3 con índice AFAI. 315 fechas diarias NOAA AOML interpoladas con kernel Wendland C2 sobre una malla costera de ~4 km. 582 celdas de riesgo costero activas." },
  { num:"02", label:"MODELADO ESTOCÁSTICO fOU",
    body:"Proceso de Ornstein-Uhlenbeck fraccional calibrado a la serie SEMAR/GASB (2000-2026). Hurst H = 0.80, reversión τ½ = 13.3 meses. Correlación predictor ACO→CM r = 0.95." },
  { num:"03", label:"PREDICCIÓN ENSEMBLE ACO→CM",
    body:"Ensemble ponderado por R² LOOCV de tres modelos ML: Ridge, Bayesian Ridge y Gradient Boosting. Corrección por tendencia secular + IC 80% calibrado. Horizonte: siguiente mes." },
  { num:"04", label:"SEMÁFORO OPERATIVO 5 NIVELES",
    body:"Clasificación automática: Escaso → Muy alto. Actualización semanal (APScheduler, lunes 06:00 UTC). 10 playas monitoreadas en Quintana Roo con perfil de riesgo histórico." },
  { num:"05", label:"TRANSPORTE LAGRANGIANO",
    body:"2 000 partículas liberadas desde el Atlántico Central con OpenDrift sobre corrientes RTOFS 1/12° y viento GFS 0.25°. Densidad KDE a 0.1° por segmento costero. 25 horizontes de pronóstico. Ventana operativa: 14 días." },
  { num:"06", label:"ACTUALIZACIÓN CONTINUA DE DATOS",
    body:"Pipeline automatizado: descarga semanal de boletines SEMAR, OCR con pdfplumber/Tesseract, normalización y escritura en SQLite. APScheduler cron lunes 06:00 UTC. Latencia < 2 h desde publicación oficial. 4 formatos PDF cubiertos." },
]
const SOURCES = ["SEMAR","NOAA AOML","Mendeley GASB","RTOFS","GFS 0.25°","OISST v2.1","NCEP/NCAR","SATsum"]
const FONT: React.CSSProperties = { fontFamily:"'Inter',ui-sans-serif,system-ui,sans-serif", fontWeight:300 }

// ── Landing ───────────────────────────────────────────────────────────────────
export function Landing({ onEnter }: LandingProps) {
  const [openRow, setOpenRow]   = useState<string|null>("01")
  const [caribOn, setCaribOn]   = useState(false)
  const stageRef = useRef(0)

  const metodoRef = useRef<HTMLDivElement>(null)
  const preguntasRef = useRef<HTMLDivElement>(null)
  const accordionRefs = useRef<(HTMLDivElement|null)[]>([])
  const lineRefs = useRef<(HTMLDivElement|null)[]>([])
  const radarRef = useRef<SVGSVGElement>(null)

  const questionListRef = useRef<HTMLUListElement>(null)
  const questionItemRefs = useRef<(HTMLLIElement|null)[]>([])

  useEffect(() => {
    const id = setInterval(() => setCaribOn(stageRef.current===2), 150)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const rootEl = document.getElementById("root")
    
    const getAbsoluteTop = (el: HTMLElement): number => {
      let top = 0
      let currentEl: HTMLElement | null = el
      while (currentEl) {
        top += currentEl.offsetTop
        currentEl = currentEl.offsetParent as HTMLElement | null
      }
      return top
    }

    const handleScroll = () => {
      // Tomamos el valor máximo de scroll de todos los posibles contenedores
      const currentScroll = Math.max(
        window.pageYOffset || 0,
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
        rootEl ? rootEl.scrollTop : 0
      )
      const viewHeight = window.innerHeight

      // 1. Animación de Metodología (Sección Azul)
      const metodo = metodoRef.current
      if (metodo) {
        const scrollStart = getAbsoluteTop(metodo)
        const scrollEnd = scrollStart + metodo.offsetHeight - viewHeight
        
        let progress = 0
        if (currentScroll > scrollStart) {
          progress = (currentScroll - scrollStart) / (scrollEnd - scrollStart)
        }
        progress = Math.max(0, Math.min(1, progress))
        
        if (radarRef.current) {
          radarRef.current.style.transform = `scale(${1.0 + progress * 0.08}) rotate(${progress * 120}deg)`
          radarRef.current.style.opacity = `${0.06 + progress * 0.16}`
        }
        
        const activeIdx = Math.min(5, Math.floor(progress * 6))
        
        accordionRefs.current.forEach((el, idx) => {
          if (!el) return
          const line = lineRefs.current[idx]
          
          if (idx === activeIdx) {
            el.style.maxHeight = '200px'
            el.style.opacity = '1'
            el.style.marginTop = '16px'
            el.style.paddingBottom = '32px'
            if (line) {
              line.style.transform = 'scaleX(1)'
              line.style.background = '#ffffff'
            }
          } else {
            el.style.maxHeight = '0'
            el.style.opacity = '0'
            el.style.marginTop = '0'
            el.style.paddingBottom = '0'
            if (line) {
              line.style.transform = 'scaleX(0)'
              line.style.background = 'rgba(255,255,255,0.18)'
            }
          }
        })
      }
      
      // 2. Animación de Preguntas (Sección Negra)
      const preguntas = preguntasRef.current
      if (preguntas) {
        const scrollStart = getAbsoluteTop(preguntas)
        const scrollEnd = scrollStart + preguntas.offsetHeight - viewHeight
        
        let progress = 0
        if (currentScroll > scrollStart) {
          progress = (currentScroll - scrollStart) / (scrollEnd - scrollStart)
        }
        progress = Math.max(0, Math.min(1, progress))
        
        const totalItems = 6
        const activeIdx = Math.min(totalItems - 1, Math.floor(progress * totalItems))
        
        if (questionListRef.current) {
          const offset = -activeIdx * 100
          questionListRef.current.style.transform = `translateY(${offset}px)`
        }
        
        questionItemRefs.current.forEach((el, idx) => {
          if (!el) return
          const distance = Math.abs(idx - (progress * totalItems - 0.5))
          
          if (idx === activeIdx) {
            el.style.filter = 'none'
            el.style.opacity = '1'
            el.style.color = '#ffffff'
            const underline = el.querySelector('.q-underline') as HTMLElement
            if (underline) {
              underline.style.width = '100%'
            }
          } else {
            const blurAmount = Math.min(4, distance * 1.8)
            el.style.filter = `blur(${blurAmount}px)`
            el.style.opacity = `${Math.max(0.12, 1 - distance * 0.35)}`
            el.style.color = 'rgba(255,255,255,0.3)'
            const underline = el.querySelector('.q-underline') as HTMLElement
            if (underline) {
              underline.style.width = '0%'
            }
          }
        })
      }
    }
    
    // Escuchar el evento scroll con fase de captura en window y en el target
    const target = rootEl || window
    target.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    
    // Ejecutar inmediatamente para configurar estados iniciales
    handleScroll()
    
    return () => {
      target.removeEventListener('scroll', handleScroll)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const ANNOUNCE_H=40, NAV_H=56
  const HERO_H=`calc(100vh - ${ANNOUNCE_H+NAV_H}px)`

  return (
    <div style={{background:"#000000",color:"#ffffff",...FONT}}>

      {/* 1. Announcement bar */}
      <div className="flex items-center justify-center gap-2 text-center"
        style={{background:"#cfb53b",height:ANNOUNCE_H,color:"#000000",fontSize:12,letterSpacing:"0.96px"}}>
        <span style={{textTransform:"uppercase"}}>Datos actualizados · Semana 22 · 2026</span>
        <button onClick={onEnter}
          style={{...FONT,fontSize:12,letterSpacing:"0.96px",color:"#000000",background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline",textTransform:"uppercase"}}>
          Ver sistema →
        </button>
      </div>

      {/* 2. Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 md:px-14"
        style={{height:NAV_H,background:"#000000",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="flex items-center gap-3">
          <Waves size={14} style={{color:"#ffffff"}} />
          <span style={{fontSize:13,letterSpacing:"0.52px",color:"#ffffff",textTransform:"uppercase"}}>
            Sargazo Cozumel
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline"
            style={{fontSize:12,letterSpacing:"0.48px",color:"#858484",textTransform:"uppercase"}}>
            Cipre Holding
          </span>
          <button onClick={onEnter}
            style={{...FONT,fontSize:12,letterSpacing:"0.48px",color:"#ffffff",textTransform:"uppercase",border:"1px solid rgba(255,255,255,0.28)",borderRadius:0,padding:"8px 22px",background:"transparent",cursor:"pointer",transition:"border-color 0.15s,background 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffffff";e.currentTarget.style.background="rgba(255,255,255,0.05)"}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.28)";e.currentTarget.style.background="transparent"}}>
            Entrar
          </button>
          <button onClick={onEnter}
            style={{...FONT,fontSize:12,letterSpacing:"0.48px",color:"#000000",textTransform:"uppercase",border:"none",borderRadius:0,padding:"8px 22px",background:"#cfb53b",cursor:"pointer",transition:"background 0.15s,transform 0.1s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#baa335"}}
            onMouseLeave={e=>{e.currentTarget.style.background="#cfb53b"}}
            onMouseDown={e=>{e.currentTarget.style.transform="scale(0.97)"}}
            onMouseUp={e=>{e.currentTarget.style.transform="scale(1)"}}>
            Sistema →
          </button>
        </div>
      </header>

      {/* 3. Hero */}
      <section style={{position:"relative",height:HERO_H,overflow:"hidden",background:"#000000"}}>
        <GeoParticleField stageRef={stageRef} />

        {/* bottom fade */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:120,
          background:"linear-gradient(to bottom,transparent,#000000)",pointerEvents:"none"}} />

        {/* headline */}
        <div style={{position:"absolute",left:"max(40px,6vw)",top:"50%",transform:"translateY(-50%)",maxWidth:520,zIndex:10}}>
          <p style={{fontSize:12,letterSpacing:"0.96px",color:"#9d9d9d",textTransform:"uppercase",marginBottom:28}}>
            Mar Caribe · Zona de monitoreo activo
          </p>
          <h1 style={{fontSize:"clamp(36px,4.8vw,50px)",fontWeight:300,lineHeight:1.2,letterSpacing:"-1.25px",color:"#ffffff",marginBottom:0}}>
            El sargazo<br />llega.<br />
            <span style={{color:"#cfb53b"}}>Nosotros lo vemos.</span>
          </h1>
        </div>

        {/* secondary text */}
        <div className="hidden md:block"
          style={{position:"absolute",right:"max(40px,6vw)",bottom:48,maxWidth:300,zIndex:10,textAlign:"right"}}>
          <div style={{height:1,background:"rgba(255,255,255,0.2)",marginBottom:16}} />
          <p style={{fontSize:13,fontWeight:400,lineHeight:1.5,letterSpacing:"0.325px",color:"#9d9d9d"}}>
            Sistema de predicción satelital para el arribo de sargazo a Cozumel.
            IA + simulación física + datos oficiales.
          </p>
          <p style={{fontSize:12,letterSpacing:"0.48px",color:"#858484",marginTop:12,textTransform:"uppercase"}}>
            14 días de anticipación
          </p>
        </div>

        {/* CTA */}
        <div style={{position:"absolute",left:"max(40px,6vw)",bottom:48,zIndex:10,display:"flex",alignItems:"center",gap:32}}>
          <button onClick={onEnter} className="inline-flex items-center gap-2"
            style={{...FONT,background:"#cfb53b",color:"#000000",fontSize:14,letterSpacing:"0.56px",textTransform:"uppercase",border:"none",borderRadius:0,padding:"13px 28px",cursor:"pointer",transition:"background 0.15s,transform 0.1s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#baa335"}}
            onMouseLeave={e=>{e.currentTarget.style.background="#cfb53b"}}
            onMouseDown={e=>{e.currentTarget.style.transform="scale(0.97)"}}
            onMouseUp={e=>{e.currentTarget.style.transform="scale(1)"}}>
            Entrar al sistema <ArrowRight size={14} />
          </button>
          <a href="#metodologia"
            style={{...FONT,color:"#858484",fontSize:13,letterSpacing:"0.325px",textDecoration:"none",transition:"color 0.15s",textTransform:"uppercase"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#ffffff"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#858484"}}>
            Ver metodología
          </a>
        </div>

        {/* Sargazo alert — visible during Caribbean stage */}
        <div style={{
          position:"absolute",bottom:80,left:"50%",transform:"translateX(-50%)",
          zIndex:20,pointerEvents:"none",
          opacity:caribOn?1:0,transition:"opacity 0.8s ease",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8,border:"1px solid #cfb53b",padding:"5px 16px",background:"rgba(0,0,0,0.85)"}}>
            <span style={{color:"#cfb53b",fontSize:11,letterSpacing:"0.88px",textTransform:"uppercase"}}>
              ⚠ Sargazo · ACO→CM activo
            </span>
          </div>
        </div>
      </section>

      {/* 4. Plasma section — sticky scrollytelling */}
      <section ref={metodoRef} id="metodologia" style={{position:"relative",background:"#1019ec",height:"350vh"}}>
        <div style={{position:"sticky",top:0,height:"100vh",display:"flex",alignItems:"center",overflow:"hidden"}}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-12 w-full" style={{maxWidth:1280,margin:"0 auto",padding:"0 max(40px,6vw)"}}>
            
            {/* Left column: Accordion */}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <p style={{fontSize:12,letterSpacing:"0.96px",color:"rgba(255,255,255,0.5)",textTransform:"uppercase",marginBottom:36}}>
                Capacidades del sistema
              </p>
              {ACCORDION.map((row, idx)=>(
                <div key={row.num}>
                  <div 
                    ref={el => { lineRefs.current[idx] = el }}
                    style={{height:1,background:"rgba(255,255,255,0.18)",transformOrigin:"left",transform:"scaleX(0)",transition:"transform 0.4s ease, background 0.4s ease"}} 
                  />
                  <button onClick={()=>setOpenRow(openRow===row.num?null:row.num)}
                    className="w-full text-left flex items-start gap-8"
                    style={{...FONT,background:"transparent",border:"none",cursor:"pointer",padding:"20px 0",color:"#ffffff"}}>
                    <span style={{fontSize:13,letterSpacing:"0.52px",color:"rgba(255,255,255,0.5)",minWidth:28}}>{row.num}</span>
                    <span style={{fontSize:13,letterSpacing:"0.52px",textTransform:"uppercase",flex:1}}>{row.label}</span>
                    <span style={{fontSize:18,color:"rgba(255,255,255,0.4)",transition:"transform 0.2s",transform:openRow===row.num?"rotate(45deg)":"none",display:"inline-block"}}>+</span>
                  </button>
                  <div 
                    ref={el => { accordionRefs.current[idx] = el }}
                    style={{
                      paddingLeft:52,
                      maxHeight:"0px",
                      opacity:0,
                      overflow:"hidden",
                      transition:"max-height 0.4s ease, opacity 0.4s ease, margin-top 0.4s ease, padding-bottom 0.4s ease",
                      marginTop:"0px",
                      paddingBottom:"0px"
                    }}
                  >
                    <p style={{fontSize:15,fontWeight:400,lineHeight:1.5,letterSpacing:"0.375px",color:"rgba(255,255,255,0.88)",maxWidth:560}}>
                      {row.body}
                    </p>
                  </div>
                </div>
              ))}
              <div style={{height:1,background:"rgba(255,255,255,0.18)"}} />
            </div>

            {/* Right column: Interactive Radar SVG */}
            <div className="hidden lg:flex justify-center items-center">
              <svg 
                ref={radarRef}
                viewBox="0 0 400 400" 
                className="w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]" 
                style={{
                  opacity:0.06, 
                  transition:"transform 0.1s linear, opacity 0.2s ease",
                  color:"#ffffff"
                }}
              >
                {/* Radar outer grids */}
                <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="4 8" />
                <circle cx="200" cy="200" r="130" stroke="#cfb53b" strokeWidth="0.8" fill="none" strokeDasharray="3 5" />
                <circle cx="200" cy="200" r="80" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <circle cx="200" cy="200" r="30" stroke="#cfb53b" strokeWidth="0.8" fill="none" />
                {/* Crosshairs */}
                <line x1="20" y1="200" x2="380" y2="200" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                <line x1="200" y1="20" x2="200" y2="380" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                {/* Diagonals */}
                <line x1="72" y1="72" x2="328" y2="328" stroke="currentColor" strokeWidth="0.5" opacity="0.15" strokeDasharray="2 2" />
                <line x1="72" y1="328" x2="328" y2="72" stroke="currentColor" strokeWidth="0.5" opacity="0.15" strokeDasharray="2 2" />
                {/* Radial sweep arm */}
                <line x1="200" y1="200" x2="320" y2="120" stroke="#cfb53b" strokeWidth="1.5" />
                <polygon points="320,120 310,123 317,130" fill="#cfb53b" />
              </svg>
            </div>

          </div>
        </div>
      </section>

      {/* 4b. Question Stack Section (Lumen-like for Sargazo) */}
      <section ref={preguntasRef} style={{position:"relative",background:"#000000",height:"300vh",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{position:"sticky",top:0,height:"100vh",display:"flex",alignItems:"center",overflow:"hidden"}}>
          
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_8fr_2fr] gap-6 items-center w-full" style={{maxWidth:1280,margin:"0 auto",padding:"0 max(40px,6vw)"}}>
            
            {/* Left: Indicator */}
            <div className="flex items-center gap-3 self-start lg:self-center">
              <div className="w-2 h-2 shrink-0" style={{background:"#cfb53b"}} />
              <span style={{fontSize:11,letterSpacing:"0.96px",color:"#cfb53b",textTransform:"uppercase"}}>Lumen</span>
            </div>

            {/* Center: Blurred Scroll Stack */}
            <div style={{
              position:"relative",
              height:300,
              overflow:"hidden",
              display:"flex",
              alignItems:"center"
            }}>
              {/* Fade masks */}
              <div style={{
                position:"absolute",
                top:0,
                left:0,
                right:0,
                height:100,
                background:"linear-gradient(to bottom, #000000, transparent)",
                zIndex:10,
                pointerEvents:"none"
              }} />
              <div style={{
                position:"absolute",
                bottom:0,
                left:0,
                right:0,
                height:100,
                background:"linear-gradient(to top, #000000, transparent)",
                zIndex:10,
                pointerEvents:"none"
              }} />

              {/* Central crosshair line */}
              <div style={{
                position:"absolute",
                top:"50%",
                left:0,
                right:0,
                height:1,
                background:"rgba(255,255,255,0.15)",
                transform:"translateY(-50%)",
                zIndex:5
              }} />

              {/* The sliding list */}
              <ul 
                ref={questionListRef}
                style={{
                  listStyle:"none",
                  padding:0,
                  margin:0,
                  width:"100%",
                  transform:"translateY(0px)",
                  transition:"transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
                  paddingTop:100,
                  paddingBottom:100
                }}
              >
                {([
                  { text: "¿Cómo influye el viento GFS en el desvío del sargazo hacia Cozumel?", highlight: "viento GFS", color: "#cfb53b" },
                  { text: "¿Qué densidad de biomasa se estima para el canal de Yucatán esta semana?", highlight: "densidad de biomasa", color: "#1019ec" },
                  { text: "¿Es el modelo estocástico fOU suficiente para predecir la tendencia secular?", highlight: "modelo estocástico fOU", color: "#cfb53b" },
                  { text: "¿Qué playas registrarán un nivel de alerta Muy Alto en las próximas 48 horas?", highlight: "alerta Muy Alto", color: "#1019ec" },
                  { text: "¿Cómo calibrar la confianza del sistema ante desviaciones en las corrientes?", highlight: "corrientes", color: "#cfb53b" },
                  { text: "¿Cuál es la tasa de arribo promedio por kilómetro lineal de costa?", highlight: "tasa de arribo promedio", color: "#1019ec" }
                ] as const).map((q, idx)=>(
                  <li 
                    key={idx}
                    ref={el => { questionItemRefs.current[idx] = el }}
                    style={{
                      height:100,
                      display:"flex",
                      flexDirection:"column",
                      justifyContent:"center",
                      transition:"filter 0.4s ease, opacity 0.4s ease, color 0.4s ease",
                      padding:"0 10px"
                    }}
                  >
                    <span style={{fontSize:"clamp(18px, 2.2vw, 25px)", lineHeight:1.3, fontWeight:300}}>
                      {q.text.split(q.highlight)[0]}
                      <span style={{display:"inline-block", position:"relative", color:q.color}}>
                        {q.highlight}
                        <span className="q-underline" style={{position:"absolute", bottom:-2, left:0, width:"0%", height:2, background:q.color, transition:"width 0.4s ease"}} />
                      </span>
                      {q.text.split(q.highlight)[1]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Action */}
            <div className="hidden lg:flex justify-end">
              <button 
                onClick={onEnter}
                style={{
                  ...FONT,
                  fontSize:12,
                  letterSpacing:"0.96px",
                  color:"#cfb53b",
                  background:"transparent",
                  border:"none",
                  cursor:"pointer",
                  textTransform:"uppercase",
                  display:"flex",
                  alignItems:"center",
                  gap:8,
                  padding:"10px 0"
                }}
              >
                Ver sistema <ArrowRight size={14} />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 5. Stats strip */}
      <div style={{background:"#000000",borderTop:"1px solid rgba(255,255,255,0.07)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{maxWidth:1280,margin:"0 auto"}}>
          {STATS.map((s,i)=>(
            <div key={s.label} className="flex flex-col items-center text-center py-10 px-8"
              style={{borderRight:i<STATS.length-1?"1px solid rgba(255,255,255,0.07)":"none"}}>
              <div className="flex items-end gap-1.5" style={{marginBottom:8}}>
                <span style={{fontSize:40,fontWeight:300,lineHeight:1,letterSpacing:"-1.25px",color:"#ffffff"}}>{s.value}</span>
                <span style={{fontSize:14,fontWeight:300,color:"#cfb53b",paddingBottom:4,letterSpacing:"0.56px"}}>{s.unit}</span>
              </div>
              <span style={{fontSize:12,letterSpacing:"0.96px",color:"#858484",textTransform:"uppercase"}}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Feature grid */}
      <section style={{background:"#000000",maxWidth:1280,margin:"0 auto",padding:"96px max(40px,6vw) 80px"}}>
        <div style={{marginBottom:64}}>
          <p style={{fontSize:12,letterSpacing:"0.96px",color:"#858484",textTransform:"uppercase",marginBottom:20}}>Tecnología</p>
          <h2 style={{fontSize:"clamp(28px,3.5vw,40px)",fontWeight:300,lineHeight:1.2,letterSpacing:"-2px",color:"#ffffff",maxWidth:480,margin:0}}>
            Inteligencia operativa para sargazo.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          {([
            {Icon:TrendingUp,title:"Predicción mensual",
              desc:"Ensemble de 3 modelos ML ponderados por R² LOOCV. IC 80% calibrado. Horizonte: siguiente mes.",
              tags:["Ridge","Bayesian","Ensemble"]},
            {Icon:Satellite,title:"Riesgo costero satelital",
              desc:"315 días históricos NOAA SIR interpolados con kernel Wendland C2. Malla ~4 km, 582 celdas.",
              tags:["NOAA AOML","~4 km","582 celdas"]},
            {Icon:Navigation,title:"Forecast Lagrangiano",
              desc:"2 000 partículas con OpenDrift sobre corrientes RTOFS y viento GFS. 25 horizontes KDE.",
              tags:["2 000 part.","RTOFS+GFS","14 días"]},
            {Icon:MapPin,title:"10 playas monitoreadas",
              desc:"Perfil de riesgo histórico para cada segmento de QRoo: Cozumel, Cancún, Playa del Carmen.",
              tags:["Isla Mujeres 71%","Cancún 66%","Coz. Norte 65%"]},
          ] as const).map(({Icon,title,desc,tags},i)=>(
            <div key={title}
              style={{borderTop:"1px solid rgba(255,255,255,0.08)",borderLeft:i%2===1?"1px solid rgba(255,255,255,0.08)":"none",padding:30,transition:"background 0.2s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#18181b"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>
              <Icon size={15} style={{color:"#cfb53b",marginBottom:20}} />
              <h3 style={{fontSize:16,fontWeight:300,letterSpacing:"-0.5px",color:"#ffffff",marginBottom:10,lineHeight:1.25}}>{title}</h3>
              <p style={{fontSize:14,fontWeight:400,lineHeight:1.5,letterSpacing:"0.35px",color:"#9d9d9d",marginBottom:20}}>{desc}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map(t=>(
                  <span key={t} style={{fontSize:11,letterSpacing:"0.44px",color:"#858484",border:"1px solid rgba(255,255,255,0.1)",padding:"3px 10px",textTransform:"uppercase"}}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{height:1,background:"rgba(255,255,255,0.08)"}} />
      </section>

      {/* 7. Data coverage table */}
      <section style={{background:"#000000",padding:"80px max(40px,6vw)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <p style={{fontSize:12,letterSpacing:"0.96px",color:"#858484",textTransform:"uppercase",marginBottom:8}}>Cobertura de datos</p>
          <h2 style={{fontSize:"clamp(24px,2.8vw,34px)",fontWeight:300,letterSpacing:"-1.5px",color:"#ffffff",marginBottom:48}}>
            Registro histórico integrado.
          </h2>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontWeight:300}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(255,255,255,0.12)"}}>
                  {["Dataset","Período","Registros","Frecuencia","Resolución"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"0 16px 14px 0",fontSize:11,letterSpacing:"0.88px",color:"#858484",textTransform:"uppercase",fontWeight:300}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Boletines SEMAR",      "2014 – 2026", "604",  "Semanal",  "Caribe Mexicano"],
                  ["NOAA SIR (satélite)",  "2019 – 2024", "315",  "Diario",   "~4 km costero"  ],
                  ["SATsum Caribe",        "2011 – 2024", "162",  "Mensual",  "Regional"        ],
                  ["SATsum ZEE México",    "2011 – 2024", "162",  "Mensual",  "ZEE nacional"    ],
                  ["SST Cozumel (OISST)",  "2000 – 2026", "316",  "Mensual",  "0.25°"           ],
                  ["Viento Cozumel (NCEP)","2000 – 2026", "316",  "Mensual",  "2.5°"            ],
                  ["Mendeley GASB",        "2000 – 2023", "282",  "Mensual",  "Subregional"     ],
                ].map(([ds,per,rec,freq,res],i)=>(
                  <tr key={ds} style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:i%2===0?"transparent":"rgba(255,255,255,0.02)"}}>
                    <td style={{padding:"14px 16px 14px 0",color:"#ffffff",letterSpacing:"0.325px"}}>{ds}</td>
                    <td style={{padding:"14px 16px 14px 0",color:"#9d9d9d",fontVariantNumeric:"tabular-nums"}}>{per}</td>
                    <td style={{padding:"14px 16px 14px 0",color:"#cfb53b",fontVariantNumeric:"tabular-nums",letterSpacing:"0.325px"}}>{rec}</td>
                    <td style={{padding:"14px 16px 14px 0",color:"#9d9d9d"}}>{freq}</td>
                    <td style={{padding:"14px 16px 14px 0",color:"#858484"}}>{res}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 8. Sources */}
      <section style={{background:"#000000",padding:"64px max(40px,6vw)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <p style={{fontSize:12,letterSpacing:"0.96px",color:"#858484",textTransform:"uppercase",marginBottom:24,textAlign:"center"}}>
            Fuentes de datos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SOURCES.map(src=>(
              <span key={src} style={{fontSize:12,fontWeight:300,letterSpacing:"0.48px",color:"#9d9d9d",border:"1px solid rgba(255,255,255,0.1)",padding:"6px 14px",textTransform:"uppercase"}}>
                {src}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 9. CTA final */}
      <section style={{background:"#000000",padding:"80px max(40px,6vw)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:640,margin:"0 auto",textAlign:"center"}}>
          <h2 style={{fontSize:"clamp(28px,3.5vw,40px)",fontWeight:300,letterSpacing:"-2px",lineHeight:1.2,color:"#ffffff",marginBottom:20}}>
            Empieza a monitorear ahora.
          </h2>
          <p style={{fontSize:15,fontWeight:400,lineHeight:1.5,letterSpacing:"0.375px",color:"#9d9d9d",marginBottom:40}}>
            Sistema activo con los últimos datos de SEMAR y NOAA.
          </p>
          <button onClick={onEnter} className="inline-flex items-center gap-2"
            style={{...FONT,background:"#cfb53b",color:"#000000",fontSize:14,letterSpacing:"0.56px",textTransform:"uppercase",border:"none",borderRadius:0,padding:"14px 32px",cursor:"pointer",transition:"background 0.15s,transform 0.1s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#baa335"}}
            onMouseLeave={e=>{e.currentTarget.style.background="#cfb53b"}}
            onMouseDown={e=>{e.currentTarget.style.transform="scale(0.97)"}}
            onMouseUp={e=>{e.currentTarget.style.transform="scale(1)"}}>
            Entrar al sistema <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* 10. Footer */}
      <footer style={{background:"#000000",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"24px max(40px,6vw)"}}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4" style={{maxWidth:1280,margin:"0 auto"}}>
          <div className="flex items-center gap-3">
            <Waves size={13} style={{color:"#858484"}} />
            <span style={{fontSize:12,fontWeight:300,color:"#858484",letterSpacing:"0.48px"}}>
              © 2026 Cipre Holding · Cozumel, Quintana Roo
            </span>
          </div>
          <span style={{fontSize:11,fontWeight:300,color:"#858484",letterSpacing:"0.44px",textTransform:"uppercase"}}>
            SEMAR · NOAA AOML · RTOFS · GFS · OISST
          </span>
        </div>
      </footer>

    </div>
  )
}
