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

// ── FooterParticleField ──────────────────────────────────────────────────────
function FooterParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)
  const mouseRef  = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let W = canvas.offsetWidth
    let H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    const particles = Array.from({ length: 130 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.2 + Math.random() * 0.6),
      size: 0.6 + Math.random() * 1.5,
      opacity: 0.1 + Math.random() * 0.5,
      color: Math.random() < 0.35 ? "#cfb53b" : "#ffffff"
    }))

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H

        if (mx > -500 && my > -500) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          const repulsionRadius = 120
          if (dist < repulsionRadius) {
            const force = (repulsionRadius - dist) / repulsionRadius
            const angle = Math.atan2(dy, dx)
            p.x += Math.cos(angle) * force * 2.0
            p.y += Math.sin(angle) * force * 2.0
          }
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseRef.current = { x, y }
      } else {
        mouseRef.current = { x: -1000, y: -1000 }
      }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    canvas.addEventListener("mouseleave", handleMouseLeave, { passive: true })
    
    const handleResize = () => {
      if (!canvas) return
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W
      canvas.height = H
    }

    window.addEventListener("resize", handleResize)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("resize", handleResize)
      if (canvas) {
        canvas.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none"
      }} 
    />
  )
}

// ── ModelSimulationCanvas ────────────────────────────────────────────────────
function ModelSimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const frameCountRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let W = canvas.offsetWidth
    let H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    let particles = Array.from({ length: 120 }, () => resetParticle({}, W, H))
    let landedCount = 0

    function resetParticle(p: any = {}, w: number, h: number) {
      p.x = w + Math.random() * 80
      p.y = Math.random() * h
      p.vx = -(0.8 + Math.random() * 1.5)
      p.vy = (Math.random() - 0.5) * 0.25
      p.size = 1.0 + Math.random() * 2.0
      p.alpha = 0.3 + Math.random() * 0.6
      p.color = "#cfb53b"
      p.landed = false
      return p
    }

    // Cozumel relative island shape points
    const islandPoints = [
      {x: -12, y: -76}, {x: 2, y: -78}, {x: 16, y: -65}, {x: 22, y: -40}, 
      {x: 28, y: -10}, {x: 25, y: 20}, {x: 18, y: 55}, {x: 5, y: 76}, 
      {x: -10, y: 80}, {x: -22, y: 68}, {x: -26, y: 40}, {x: -20, y: 0},
      {x: -15, y: -45}
    ]

    function draw() {
      ctx.clearRect(0, 0, W, H)
      frameCountRef.current += 1
      const timeFactor = frameCountRef.current

      // Grid and Coordinate ticks
      ctx.strokeStyle = "rgba(0, 0, 0, 0.03)"
      ctx.lineWidth = 0.8
      const gridSpacing = 48
      for (let x = 0; x < W; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y < H; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      const islandCx = W * 0.35
      const islandCy = H * 0.5

      // Calculate Cozumel absolute polygon coordinates
      const cos = Math.cos(-Math.PI / 5)
      const sin = Math.sin(-Math.PI / 5)
      const polyCoords: [number, number][] = islandPoints.map(p => {
        const rx = p.x * cos - p.y * sin
        const ry = p.x * sin + p.y * cos
        return [islandCx + rx, islandCy + ry]
      })

      // Draw RTOFS Current Vectors (Grid of animated arrows)
      ctx.strokeStyle = "rgba(16, 25, 236, 0.08)"
      ctx.fillStyle = "rgba(16, 25, 236, 0.08)"
      ctx.lineWidth = 1.0
      for (let x = 20; x < W; x += 64) {
        for (let y = 30; y < H; y += 64) {
          const angle = Math.PI + Math.sin(timeFactor * 0.02 + x * 0.01) * 0.15
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle)
          ctx.beginPath()
          ctx.moveTo(-6, 0)
          ctx.lineTo(6, 0)
          ctx.lineTo(3, -2)
          ctx.moveTo(6, 0)
          ctx.lineTo(3, 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      // Draw Cozumel island outline
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(polyCoords[0][0], polyCoords[0][1])
      for (let i = 1; i < polyCoords.length; i++) {
        ctx.lineTo(polyCoords[i][0], polyCoords[i][1])
      }
      ctx.closePath()
      ctx.fillStyle = "rgba(24, 24, 27, 0.07)"
      ctx.fill()
      ctx.strokeStyle = "#0d1b3e" // Deep Cobalt Navy outline
      ctx.lineWidth = 1.8
      ctx.stroke()
      ctx.restore()

      // Beach labels
      ctx.font = "9px sans-serif"
      ctx.fillStyle = "#71717a"
      // Punta Sur
      ctx.fillText("Pta. Sur", islandCx - 45, islandCy + 90)
      ctx.beginPath()
      ctx.arc(islandCx - 10, islandCy + 75, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "#0d1b3e"
      ctx.fill()

      // Chen Rio
      ctx.fillStyle = "#71717a"
      ctx.fillText("Chen Río", islandCx + 25, islandCy + 25)
      ctx.beginPath()
      ctx.arc(islandCx + 20, islandCy + 15, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "#cfb53b" // Warning beach dot
      ctx.fill()

      // Cozumel label
      ctx.font = "bold 10px sans-serif"
      ctx.fillStyle = "#18181b"
      ctx.fillText("COZUMEL", islandCx - 24, islandCy + 5)

      // Update and draw particles
      for (const p of particles) {
        if (!p.landed) {
          p.x += p.vx
          p.y += p.vy

          // Check collision using ray-casting point-in-polygon helper
          const inIsland = pip(p.x, p.y, polyCoords)
          if (inIsland) {
            p.landed = true
            p.vx = 0
            p.vy = 0
            landedCount += 1
          }
        } else {
          p.alpha -= 0.015
          if (p.alpha <= 0) {
            resetParticle(p, W, H)
          }
        }

        if (p.x < 0) {
          resetParticle(p, W, H)
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
      }

      // Map Coordinate Frame
      ctx.globalAlpha = 0.6
      ctx.font = "8px monospace"
      ctx.fillStyle = "#71717a"
      ctx.fillText("20°28'N", islandCx, 15)
      ctx.fillText("86°54'W", W - 50, islandCy)

      // Telemetry HUD overlay in the top right
      const hudX = W - 180
      ctx.fillStyle = "rgba(0, 0, 0, 0.03)"
      ctx.fillRect(hudX - 10, 15, 180, 80)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)"
      ctx.strokeRect(hudX - 10, 15, 180, 80)

      ctx.font = "9px monospace"
      ctx.fillStyle = "#27272a"
      ctx.globalAlpha = 0.8
      
      const simHours = Math.floor((timeFactor * 0.5) % 336)
      ctx.fillText(`SIM TIME: +${simHours}h (Forecast)`, hudX, 30)
      ctx.fillText(`PARTICLES TRACKED: 2,000`, hudX, 42)
      
      const beachedPercent = Math.min(99, Math.floor((landedCount % 120) * 0.8))
      ctx.fillText(`BEACHED FRACTION: ${beachedPercent}%`, hudX, 54)
      
      const currentSpeed = (0.28 + Math.sin(timeFactor * 0.01) * 0.05).toFixed(2)
      ctx.fillText(`DRIFT FLOW (RTOFS): ${currentSpeed} m/s`, hudX, 66)
      
      const windSpeed = (10.2 + Math.cos(timeFactor * 0.005) * 2.1).toFixed(1)
      ctx.fillText(`WIND FIELD (GFS): ${windSpeed} kts`, hudX, 78)

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    const handleResize = () => {
      if (!canvas) return
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W
      canvas.height = H
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        width: "100%",
        height: "100%",
        minHeight: "350px",
        display: "block",
        background: "rgba(0,0,0,0.02)",
        border: "1px solid rgba(0,0,0,0.06)"
      }} 
    />
  )
}

// ── WaveFieldBackground ──────────────────────────────────────────────────────
function WaveFieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let W = canvas.offsetWidth
    let H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    // Particles representing organic matter drifting in currents
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      speed: 0.15 + Math.random() * 0.45,
      amplitude: 12 + Math.random() * 20,
      frequency: 0.002 + Math.random() * 0.003,
      size: 0.8 + Math.random() * 1.5,
      opacity: 0.06 + Math.random() * 0.18,
      color: Math.random() < 0.35 ? "#cfb53b" : "rgba(255, 255, 255, 0.7)"
    }))

    let t = 0
    function draw() {
      ctx.clearRect(0, 0, W, H)
      t += 0.006

      // 1. Draw 5 background current wave paths representing ocean swells
      const depths = [0.15, 0.35, 0.55, 0.75, 0.90]
      depths.forEach((depth, idx) => {
        ctx.beginPath()
        const baseH = H * depth
        const speedFactor = (idx % 2 === 0 ? 1 : -0.8) * 0.4
        const amp = 20 + idx * 10
        const freq = 0.003 - idx * 0.0003
        ctx.strokeStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.12)" : "rgba(207, 181, 59, 0.08)"
        ctx.lineWidth = 0.6 + idx * 0.2

        for (let x = 0; x < W; x += 6) {
          const y = baseH + Math.sin(x * freq + t * speedFactor) * amp + Math.cos(x * (freq * 0.6) - t * 0.15) * (amp * 0.3)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })

      // 2. Draw drifting organic particles following wave patterns
      for (const p of particles) {
        p.x += p.speed
        if (p.x > W) p.x = -10

        const waveY = Math.sin(p.x * p.frequency + t * 0.25) * p.amplitude
        const drawY = p.y + waveY

        ctx.beginPath()
        ctx.arc(p.x, drawY, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    function handleResize() {
      if (!canvas) return
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W
      canvas.height = H
    }

    const ro = new ResizeObserver(handleResize)
    ro.observe(canvas.parentElement!)

    rafRef.current = requestAnimationFrame(draw)
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", handleResize)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        zIndex: 0,
        maskImage: "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 90%)",
        WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 90%)"
      }} 
    />
  )
}
// ── Data ──────────────────────────────────────────────────────────────────────
const STATS = [
  { value:"52.6k", unit:"ton",  label:"Predicción junio 2026" },
  { value:"83",    unit:"/100", label:"Confianza del sistema"  },
  { value:"338",   unit:"días", label:"Historial NOAA SIR"     },
  { value:"14",    unit:"días", label:"Horizonte de forecast"  },
  { value:"604",   unit:"reg.", label:"Boletines SEMAR 2014–26" },
  { value:"H=0.80",unit:"Hurst",label:"Memoria larga fOU"      },
  { value:"2 000", unit:"part.",label:"Partículas OpenDrift"    },
  { value:"10",    unit:"plyas",label:"Segmentos monitoreados"  },
]
const ACCORDION = [
  { num:"01", label:"TELEDETECCIÓN SATELITAL",
    body:"Procesamiento de imágenes Copernicus / Sentinel-3 con índice AFAI. 338 fechas diarias NOAA AOML interpoladas con kernel Wendland C2 sobre una malla costera de ~4 km. 18,294 celdas de riesgo costero activas." },
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

const QUESTIONS_LIST = [
  { text: "¿Cómo influye el viento GFS en el desvío del sargazo hacia Cozumel?", highlight: "viento GFS", color: "#947814" },
  { text: "¿Qué densidad de biomasa se estima para el canal de Yucatán esta semana?", highlight: "densidad de biomasa", color: "#0d1b3e" },
  { text: "¿Es el modelo estocástico fOU suficiente para predecir la tendencia secular?", highlight: "modelo estocástico fOU", color: "#947814" },
  { text: "¿Qué playas registrarán un nivel de alerta Muy Alto en las próximas 48 horas?", highlight: "alerta Muy Alto", color: "#0d1b3e" },
  { text: "¿Cómo calibrar la confianza del sistema ante desviaciones en las corrientes?", highlight: "corrientes", color: "#947814" },
  { text: "¿Cuál es la tasa de arribo promedio por kilómetro lineal de costa?", highlight: "tasa de arribo promedio", color: "#0d1b3e" }
]

const QUESTION_DETAILS = [
  {
    num: "01",
    topic: "VIENTO GFS & DERIVA",
    body: "El acoplamiento del viento GFS al modelo lagrangiano determina el desvío hacia la costa oriental. Vientos del este-sureste aceleran el arribo a Chen Río.",
    metric: "3.0%",
    metricLabel: "Coeficiente de deriva de viento",
    stats: [
      { label: "Dirección dominante", val: "ESE (115°)" },
      { label: "Velocidad media", val: "12.4 kts" },
      { label: "Influencia en desvío", val: "Alta (88%)" },
      { label: "Modelo de arrastre", val: "OpenDrift Stokes" }
    ]
  },
  {
    num: "02",
    topic: "DENSIDAD DE BIOMASA",
    body: "Se estima una densidad promedio en el canal de Yucatán. Las imágenes Sentinel-3 muestran filamentos densos desplazándose hacia el norte.",
    metric: "5.2 t/km²",
    metricLabel: "Densidad estimada esta semana",
    stats: [
      { label: "Índice satelital", val: "AFAI > 0.002" },
      { label: "Cobertura espacial", val: "Sentinel-3 MSI" },
      { label: "Sensor óptico", val: "OLCI (Copernicus)" },
      { label: "Tendencia semanal", val: "Incremental (+12%)" }
    ]
  },
  {
    num: "03",
    topic: "ESTOCASTICIDAD fOU",
    body: "El modelo fOU captura la memoria de largo plazo y la reversión a la media, corrigiéndose con la tendencia secular de calentamiento del SST.",
    metric: "H = 0.80",
    metricLabel: "Coeficiente de Hurst medido",
    stats: [
      { label: "Reversión a media", val: "τ = 13.3 meses" },
      { label: "Volatilidad (σ)", val: "0.42 mensual" },
      { label: "Correlación estacional", val: "r = 0.95 (SEMAR)" },
      { label: "Intervalo de confianza", val: "80% LOOCV" }
    ]
  },
  {
    num: "04",
    topic: "ALERTAS 48 HORAS",
    body: "Chen Río, Punta Morena y Playa Bonita registrarán semáforo Rojo (Muy Alto). Se recomienda activar cuadrillas de limpieza inmediata.",
    metric: "Muy Alto",
    metricLabel: "Semáforo en 3 segmentos",
    stats: [
      { label: "Playas en Rojo", val: "Chen Río, Pta Morena" },
      { label: "Playas en Naranja", val: "Playa Bonita" },
      { label: "Nivel de alerta", val: "Nivel 5 (Crítico)" },
      { label: "Acción recomendada", val: "Limpieza inmediata" }
    ]
  },
  {
    num: "05",
    topic: "CONFIANZA DEL SISTEMA",
    body: "Calculamos el índice de dispersión mediante ensembles. Desviaciones en corrientes RTOFS mayores a 15° reducen la confianza temporalmente.",
    metric: "83%",
    metricLabel: "Confianza actual calibrada",
    stats: [
      { label: "Dispersión ensembles", val: "Baja (σ = 4.2)" },
      { label: "Desviación corrientes", val: "< 8° (RTOFS)" },
      { label: "Latencia del dato", val: "4.5 horas" },
      { label: "Consistencia", val: "Óptimo (Verificado)" }
    ]
  },
  {
    num: "06",
    topic: "TASA DE ARRIBO PROMEDIO",
    body: "La tasa estimada para esta semana por kilómetro lineal al día en las zonas expuestas, acumulando impactos en ensenadas naturales.",
    metric: "4.8 t/km",
    metricLabel: "Arribo diario por km de costa",
    stats: [
      { label: "Acumulación estimada", val: "48.0 t/segmento" },
      { label: "Impacto costero", val: "Moderado-Alto" },
      { label: "Eficiencia remoción", val: "Recomendado > 70%" },
      { label: "Costo de operación", val: "Optimizado (Nivel 2)" }
    ]
  }
]

// ── Landing ───────────────────────────────────────────────────────────────────
export function Landing({ onEnter }: LandingProps) {
  const [openRow, setOpenRow]   = useState<string|null>("01")
  const [caribOn, setCaribOn]   = useState(false)
  const [activeQuestion, setActiveQuestion] = useState(0)
  const activeQuestionRef = useRef(0)
  const stageRef = useRef(0)

  const metodoRef = useRef<HTMLDivElement>(null)
  const escalaRef = useRef<HTMLDivElement>(null)
  const escalaPill1Ref = useRef<HTMLDivElement>(null)
  const escalaPill2Ref = useRef<HTMLDivElement>(null)
  const escalaPill3Ref = useRef<HTMLDivElement>(null)
  const accordionRefs = useRef<(HTMLDivElement|null)[]>([])
  const lineRefs = useRef<(HTMLDivElement|null)[]>([])
  const radarContainerRef = useRef<HTMLDivElement>(null)

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
        
        const activeIdx = Math.min(5, Math.floor(progress * 6))
        
        // Rotar, escalar e interpolar opacidad de las 6 ilustraciones de forma individual (cross-fade suave)
        if (radarContainerRef.current) {
          const svgs = radarContainerRef.current.children
          for (let i = 0; i < svgs.length; i++) {
            const svg = svgs[i] as HTMLElement
            const center = (i + 0.5) / 6
            const dist = Math.abs(progress - center)
            const maxDist = 1 / 6
            let opacity = 0
            if (dist < maxDist) {
              opacity = 1 - dist / maxDist
            }
            const targetOpacity = opacity * 0.95 // Máxima opacidad de 0.95 para excelente contraste y visibilidad
            svg.style.opacity = `${targetOpacity}`
            
            const scale = 0.95 + opacity * 0.08 // Escala suave de 0.95 a 1.03
            const rotate = (i % 2 === 0 ? 1 : -1) * (1 - opacity) * 12 // Rotación leve al entrar/salir
            svg.style.transform = `scale(${scale}) rotate(${rotate}deg)`
          }
        }
        
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
      
      // 1.5. Animación de la sección "Sargazo a Escala" (Sección Clara #escala)
      const escala = escalaRef.current
      if (escala) {
        const isDesktop = window.innerWidth >= 1024
        
        if (!isDesktop) {
          // Reset positioning on mobile/tablet to display list naturally
          if (questionListRef.current) {
            questionListRef.current.style.transform = 'none'
          }
          questionItemRefs.current.forEach((el, idx) => {
            if (!el) return
            el.style.filter = 'none'
            el.style.opacity = idx === activeQuestion ? '1' : '0.6'
            
            const highlightEl = el.querySelector('.q-highlight') as HTMLElement
            const underline = el.querySelector('.q-underline') as HTMLElement
            if (idx === activeQuestion) {
              el.style.color = '#18181b'
              if (highlightEl) highlightEl.style.color = QUESTIONS_LIST[idx].color
              if (underline) underline.style.width = '100%'
            } else {
              el.style.color = 'rgba(24, 24, 27, 0.4)'
              if (highlightEl) highlightEl.style.color = 'inherit'
              if (underline) underline.style.width = '0%'
            }
          })
          return
        }

        const scrollStart = getAbsoluteTop(escala)
        const scrollEnd = scrollStart + escala.offsetHeight - viewHeight
        
        let progress = 0
        if (currentScroll > scrollStart) {
          progress = (currentScroll - scrollStart) / (scrollEnd - scrollStart)
        }
        progress = Math.max(0, Math.min(1, progress))

        // Update sliding pills along the borders
        // Pill 1 (bottom border of col 1) moves left: 0% -> 90%
        if (escalaPill1Ref.current) {
          escalaPill1Ref.current.style.left = `${progress * 90}%`
        }
        // Pill 2 (right border of col 2) moves top: 0% -> 90%
        if (escalaPill2Ref.current) {
          escalaPill2Ref.current.style.top = `${progress * 90}%`
        }
        // Pill 3 (top border of col 3) moves right: 0% -> 90%
        if (escalaPill3Ref.current) {
          escalaPill3Ref.current.style.right = `${progress * 90}%`
        }

        const totalItems = 6
        const currentFraction = progress * (totalItems - 1)
        const activeIdx = Math.max(0, Math.min(totalItems - 1, Math.round(currentFraction)))

        if (activeIdx !== activeQuestionRef.current) {
          activeQuestionRef.current = activeIdx
          setActiveQuestion(activeIdx)
        }

        if (questionListRef.current) {
          const offset = -currentFraction * 80
          questionListRef.current.style.transform = `translateY(${offset}px)`
        }
        questionItemRefs.current.forEach((el, idx) => {
          if (!el) return
          const isMain = idx === activeIdx
          const highlightEl = el.querySelector('.q-highlight') as HTMLElement
          const underline = el.querySelector('.q-underline') as HTMLElement
          
          if (isMain) {
            // Active item is guaranteed 100% sharp and clear without scrolling lag
            el.style.filter = 'none'
            el.style.opacity = '1'
            el.style.color = '#18181b'
            el.style.transform = 'translateX(8px)'
            if (highlightEl) {
              highlightEl.style.color = QUESTIONS_LIST[idx].color
            }
            if (underline) {
              underline.style.width = '100%'
            }
          } else {
            // Inactive items are faded out with GPU-accelerated opacity and positioning, avoiding buggy CSS filter: blur()
            const distance = Math.abs(idx - activeIdx)
            el.style.filter = 'none'
            el.style.opacity = `${Math.max(0.28, 0.60 - (distance - 1) * 0.15)}`
            el.style.color = 'rgba(24, 24, 27, 0.4)'
            el.style.transform = 'translateX(0px)'
            if (highlightEl) {
              highlightEl.style.color = 'inherit'
            }
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
          <span className="hidden md:inline mr-2"
            style={{fontSize:12,letterSpacing:"0.48px",color:"#858484",textTransform:"uppercase"}}>
            Cipre Holding
          </span>
          <a href="?view=methodology" target="_blank" rel="noopener noreferrer"
            style={{
              ...FONT,
              fontSize:12,
              letterSpacing:"0.48px",
              color:"#ffffff",
              textTransform:"uppercase",
              textDecoration:"none",
              border:"1px solid rgba(255,255,255,0.28)",
              borderRadius:0,
              padding:"8px 22px",
              background:"transparent",
              cursor:"pointer",
              display:"inline-block",
              transition:"border-color 0.15s,background 0.15s"
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffffff";e.currentTarget.style.background="rgba(255,255,255,0.05)"}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.28)";e.currentTarget.style.background="transparent"}}>
            Bases Científicas ↗
          </a>
          <a href="?view=layers" target="_blank" rel="noopener noreferrer"
            style={{
              ...FONT,
              fontSize:12,
              letterSpacing:"0.48px",
              color:"#000000",
              textTransform:"uppercase",
              textDecoration:"none",
              border:"none",
              borderRadius:0,
              padding:"8px 22px",
              background:"#cfb53b",
              cursor:"pointer",
              display:"inline-block",
              transition:"background 0.15s,transform 0.1s"
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="#baa335"}}
            onMouseLeave={e=>{e.currentTarget.style.background="#cfb53b"}}
            onMouseDown={e=>{e.currentTarget.style.transform="scale(0.97)"}}
            onMouseUp={e=>{e.currentTarget.style.transform="scale(1)"}}>
            Capas y Datos ↗
          </a>
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
          
          <a href="?view=methodology" target="_blank" rel="noopener noreferrer"
            style={{
              ...FONT,
              color:"#858484",
              fontSize:13,
              letterSpacing:"0.325px",
              textDecoration:"none",
              transition:"color 0.15s",
              textTransform:"uppercase"
            }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#ffffff"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#858484"}}>
            Bases Científicas ↗
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
      <section ref={metodoRef} id="metodologia" style={{position:"relative",background:"#0d1b3e",height:"350vh"}}>
        <div style={{position:"sticky",top:0,height:"100vh",display:"flex",alignItems:"center",overflow:"hidden",zIndex:10}}>
          <WaveFieldBackground />
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-12 w-full" style={{maxWidth:1280,margin:"0 auto",padding:"0 max(40px,6vw)",zIndex:11}}>
            
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

            {/* Right column: Interactive SVGs (Switched based on activeIndex) */}
            <div ref={radarContainerRef} className="hidden lg:flex justify-center items-center relative w-full h-[400px]">
              
              {/* SVG 01: Satélite / Teledetección */}
              <svg viewBox="0 0 400 400" className="absolute w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]"
                style={{
                  opacity: 0,
                  transform: "scale(0.95)",
                  color: "#ffffff",
                  pointerEvents: "none"
                }}>
                <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="3 6" />
                <circle cx="200" cy="200" r="100" stroke="#cfb53b" strokeWidth="0.8" fill="none" />
                <circle cx="200" cy="200" r="60" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <ellipse cx="200" cy="200" rx="60" ry="20" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <ellipse cx="200" cy="200" rx="20" ry="60" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <rect x="290" y="90" width="30" height="15" rx="2" stroke="currentColor" strokeWidth="0.8" fill="none" transform="rotate(45 305 97.5)" />
                <line x1="305" y1="97" x2="200" y2="200" stroke="#cfb53b" strokeWidth="0.8" strokeDasharray="2 3" />
                <path d="M 280 80 Q 290 60 310 70" stroke="currentColor" strokeWidth="0.8" fill="none" />
              </svg>

              {/* SVG 02: Modelado Estocástico fOU */}
              <svg viewBox="0 0 400 400" className="absolute w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]"
                style={{
                  opacity: 0,
                  transform: "scale(0.95)",
                  color: "#ffffff",
                  pointerEvents: "none"
                }}>
                <rect x="50" y="50" width="300" height="300" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="2 4" opacity="0.3" />
                <line x1="50" y1="200" x2="350" y2="200" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
                <path d="M 50 250 L 70 230 L 90 260 L 110 210 L 130 240 L 150 180 L 170 220 L 190 190 L 210 230 L 230 160 L 250 190 L 270 140 L 290 170 L 310 110 L 330 130 L 350 90" 
                  stroke="#cfb53b" strokeWidth="1.2" fill="none" />
                <path d="M 50 190 Q 200 130 350 70" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" fill="none" />
                <path d="M 50 310 Q 200 270 350 210" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" fill="none" />
              </svg>

              {/* SVG 03: Predicción Ensemble */}
              <svg viewBox="0 0 400 400" className="absolute w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]"
                style={{
                  opacity: 0,
                  transform: "scale(0.95) rotate(0deg)",
                  color: "#ffffff",
                  pointerEvents: "none"
                }}>
                <circle cx="200" cy="80" r="10" stroke="#cfb53b" strokeWidth="1" fill="none" />
                <circle cx="100" cy="200" r="10" stroke="currentColor" strokeWidth="1" fill="none" />
                <circle cx="200" cy="200" r="10" stroke="currentColor" strokeWidth="1" fill="none" />
                <circle cx="300" cy="200" r="10" stroke="currentColor" strokeWidth="1" fill="none" />
                <circle cx="200" cy="320" r="12" stroke="#cfb53b" strokeWidth="1.5" fill="none" />
                
                <line x1="200" y1="90" x2="100" y2="190" stroke="currentColor" strokeWidth="0.8" />
                <line x1="200" y1="90" x2="200" y2="190" stroke="currentColor" strokeWidth="0.8" />
                <line x1="200" y1="90" x2="300" y2="190" stroke="currentColor" strokeWidth="0.8" />
                <line x1="100" y1="210" x2="200" y2="308" stroke="currentColor" strokeWidth="0.8" />
                <line x1="200" y1="210" x2="200" y2="308" stroke="currentColor" strokeWidth="0.8" />
                <line x1="300" y1="210" x2="200" y2="308" stroke="currentColor" strokeWidth="0.8" />
                
                <text x="200" y="324" textAnchor="middle" fontSize="10" fill="#cfb53b" fontWeight="bold" fontFamily="sans-serif">R²</text>
              </svg>

              {/* SVG 04: Semáforo Operativo */}
              <svg viewBox="0 0 400 400" className="absolute w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]"
                style={{
                  opacity: 0,
                  transform: "scale(0.95)",
                  color: "#ffffff",
                  pointerEvents: "none"
                }}>
                <path d="M 80 250 A 130 130 0 0 1 320 250" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <path d="M 100 250 A 110 110 0 0 1 300 250" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="3 6" />
                <line x1="80" y1="250" x2="60" y2="250" stroke="currentColor" strokeWidth="1" />
                <line x1="101" y1="172" x2="85" y2="160" stroke="currentColor" strokeWidth="1" />
                <line x1="200" y1="120" x2="200" y2="100" stroke="#cfb53b" strokeWidth="1" />
                <line x1="299" y1="172" x2="315" y2="160" stroke="currentColor" strokeWidth="1" />
                <line x1="320" y1="250" x2="340" y2="250" stroke="currentColor" strokeWidth="1" />
                <line x1="200" y1="250" x2="200" y2="130" stroke="#cfb53b" strokeWidth="2" />
                <circle cx="200" cy="250" r="8" fill="currentColor" />
              </svg>

              {/* SVG 05: Transporte Lagrangiano */}
              <svg viewBox="0 0 400 400" className="absolute w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]"
                style={{
                  opacity: 0,
                  transform: "scale(0.95)",
                  color: "#ffffff",
                  pointerEvents: "none"
                }}>
                <path d="M 50 150 C 120 100, 180 200, 250 150 C 320 100, 350 150, 380 150" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <path d="M 30 200 C 100 150, 160 250, 230 200 C 300 150, 330 200, 370 200" stroke="#cfb53b" strokeWidth="1" fill="none" />
                <path d="M 40 250 C 110 200, 170 300, 240 250 C 310 200, 340 250, 360 250" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <path d="M 120 120 L 140 120" stroke="currentColor" strokeWidth="0.8" />
                <polygon points="140,120 135,117 135,123" fill="currentColor" />
                <path d="M 230 200 L 250 190" stroke="#cfb53b" strokeWidth="0.8" />
                <polygon points="250,190 243,188 246,194" fill="#cfb53b" />
                <circle cx="80" cy="180" r="2" fill="currentColor" />
                <circle cx="170" cy="140" r="1.5" fill="currentColor" />
                <circle cx="280" cy="220" r="2" fill="#cfb53b" />
                <circle cx="310" cy="170" r="1" fill="currentColor" />
              </svg>

              {/* SVG 06: Actualización de Datos */}
              <svg viewBox="0 0 400 400" className="absolute w-[300px] h-[300px] xl:w-[400px] xl:h-[400px]"
                style={{
                  opacity: 0,
                  transform: "scale(0.95) rotate(0deg)",
                  color: "#ffffff",
                  pointerEvents: "none"
                }}>
                <circle cx="200" cy="200" r="80" stroke="currentColor" strokeWidth="0.8" fill="none" strokeDasharray="8 4" />
                <circle cx="200" cy="200" r="50" stroke="#cfb53b" strokeWidth="0.8" fill="none" />
                <circle cx="200" cy="200" r="20" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <path d="M 200 90 A 110 110 0 0 1 310 200" stroke="currentColor" strokeWidth="0.8" fill="none" />
                <polygon points="310,200 306,192 314,194" fill="currentColor" />
                <path d="M 200 310 A 110 110 0 0 1 90 200" stroke="#cfb53b" strokeWidth="0.8" fill="none" />
                <polygon points="90,200 94,208 86,206" fill="#cfb53b" />
              </svg>

            </div>

          </div>
        </div>
      </section>

      {/* 4c. Clear Section (Sargazo a Escala) — Light theme (#ffffff) */}
      <section ref={escalaRef} id="escala" className="relative bg-white h-auto lg:h-[300vh]">
        <div className="relative lg:sticky lg:top-0 h-auto lg:h-screen flex items-center overflow-hidden bg-white py-12 lg:py-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1.2fr] w-full h-auto lg:h-[calc(100vh-60px)]" style={{maxWidth:1280, margin:"0 auto", padding:"20px lg:padding:30px", border:"1px solid rgba(0,0,0,0.12)"}}>
            
            {/* Column 1: Interactive Graphic with border indicators */}
            <div className="hidden lg:flex relative items-center justify-center p-8 border-r" style={{borderColor:"rgba(0,0,0,0.12)"}}>
              <div style={{maxWidth:350, opacity:0.95, width:"100%"}}>
                <svg viewBox="0 0 400 400" width="100%" height="100%" style={{color:"#000000", transition:"all 0.4s ease"}}>
                  {/* Grid lines & outer circle */}
                  <circle cx="200" cy="200" r="160" stroke="currentColor" strokeWidth="0.6" fill="none" strokeDasharray="3 6" opacity="0.3" />
                  <line x1="200" y1="40" x2="200" y2="360" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 4" opacity="0.3" />
                  <line x1="40" y1="200" x2="360" y2="200" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 4" opacity="0.3" />
                  <ellipse cx="200" cy="200" rx="40" ry="120" stroke="currentColor" strokeWidth="1" fill="none" transform="rotate(-30 200 200)" opacity="0.4" />
                  
                  {/* Base shoreline path */}
                  <path d="M 100 200 C 150 150, 180 250, 250 200 C 300 150, 320 200, 350 200" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />

                  {/* Q1: Viento GFS - Wind vectors */}
                  {activeQuestion === 0 && (
                    <g className="animate-pulse" style={{ transition: "opacity 0.4s ease" }}>
                      <path d="M 280 280 L 220 240 M 220 240 L 230 240 M 220 240 L 225 248" stroke="#0d1b3e" strokeWidth="1.5" fill="none" />
                      <path d="M 320 220 L 260 180 M 260 180 L 270 180 M 260 180 L 265 188" stroke="#0d1b3e" strokeWidth="1.5" fill="none" />
                      <path d="M 240 320 L 180 280 M 180 280 L 190 280 M 180 280 L 185 288" stroke="#0d1b3e" strokeWidth="1.5" fill="none" />
                      <text x="250" y="325" fontSize="10" fill="#0d1b3e" fontWeight="bold" fontFamily="monospace">GFS WIND FIELD</text>
                    </g>
                  )}

                  {/* Q2: Biomasa Yucatán - High density blobs */}
                  {activeQuestion === 1 && (
                    <g style={{ transition: "opacity 0.4s ease" }}>
                      <circle cx="150" cy="210" r="14" fill="#cfb53b" opacity="0.3" className="animate-ping" />
                      <circle cx="150" cy="210" r="8" fill="#cfb53b" />
                      <circle cx="170" cy="180" r="18" fill="#cfb53b" opacity="0.25" />
                      <circle cx="170" cy="180" r="10" fill="#cfb53b" />
                      <circle cx="130" cy="230" r="10" fill="#cfb53b" opacity="0.4" />
                      <text x="60" y="270" fontSize="10" fill="#cfb53b" fontWeight="bold" fontFamily="monospace">HIGH BIOMASS SEGMENTS</text>
                    </g>
                  )}

                  {/* Q3: fOU Stochastic Wave */}
                  {activeQuestion === 2 && (
                    <g style={{ transition: "opacity 0.4s ease" }}>
                      <path d="M 80 200 Q 110 140, 140 230 T 200 170 T 260 220 T 320 180" stroke="#cfb53b" strokeWidth="1.8" fill="none" />
                      <path d="M 80 200 Q 110 160, 140 210 T 200 190 T 260 210 T 320 195" stroke="#0d1b3e" strokeWidth="1" strokeDasharray="2 2" fill="none" opacity="0.6" />
                      <text x="70" y="100" fontSize="10" fill="#cfb53b" fontWeight="bold" fontFamily="monospace">fOU LONG MEMORY MODEL</text>
                    </g>
                  )}

                  {/* Q4: Playas Alerta Muy Alto - Warnings */}
                  {activeQuestion === 3 && (
                    <g style={{ transition: "opacity 0.4s ease" }}>
                      <circle cx="215" cy="213" r="7" fill="#ef4444" className="animate-ping" />
                      <circle cx="215" cy="213" r="4.5" fill="#ef4444" />
                      <text x="228" y="216" fontSize="9" fill="#ef4444" fontWeight="bold" fontFamily="sans-serif">Chen Río [CRITICAL]</text>
                      
                      <circle cx="282" cy="165" r="7" fill="#ef4444" className="animate-ping" />
                      <circle cx="282" cy="165" r="4.5" fill="#ef4444" />
                      <text x="260" y="152" fontSize="9" fill="#ef4444" fontWeight="bold" fontFamily="sans-serif">Pta. Morena</text>

                      <circle cx="160" cy="235" r="7" fill="#ef4444" className="animate-ping" />
                      <circle cx="160" cy="235" r="4.5" fill="#ef4444" />
                      <text x="100" y="250" fontSize="9" fill="#ef4444" fontWeight="bold" fontFamily="sans-serif">Playa Bonita</text>
                    </g>
                  )}

                  {/* Q5: Corrientes/Confianza */}
                  {activeQuestion === 4 && (
                    <g style={{ transition: "opacity 0.4s ease" }}>
                      <circle cx="200" cy="200" r="40" stroke="#0d1b3e" strokeWidth="0.8" fill="none" opacity="0.8" />
                      <circle cx="200" cy="200" r="70" stroke="#0d1b3e" strokeWidth="0.8" fill="none" opacity="0.5" className="animate-pulse" />
                      
                      <path d="M 120 300 Q 200 280, 260 210" stroke="#0d1b3e" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                      <polygon points="260,210 252,212 258,218" fill="#0d1b3e" />
                      
                      <text x="210" y="190" fontSize="10" fill="#0d1b3e" fontWeight="bold" fontFamily="monospace">RTOFS FIELD</text>
                    </g>
                  )}

                  {/* Q6: Tasa de arribo */}
                  {activeQuestion === 5 && (
                    <g style={{ transition: "opacity 0.4s ease" }}>
                      <path d="M 100 200 C 150 150, 180 250, 250 200 C 300 150, 320 200, 350 200" stroke="#cfb53b" strokeWidth="6" fill="none" opacity="0.4" />
                      <path d="M 100 200 C 150 150, 180 250, 250 200 C 300 150, 320 200, 350 200" stroke="#cfb53b" strokeWidth="3" fill="none" />
                      
                      <rect x="220" y="125" width="85" height="18" fill="white" stroke="#cfb53b" strokeWidth="0.8" />
                      <text x="225" y="137" fontSize="9" fill="#000000" fontWeight="bold" fontFamily="monospace">4.8 t/km/day</text>
                    </g>
                  )}
                </svg>
              </div>
              
              {/* Sliding pill at bottom border */}
              <div ref={escalaPill1Ref} className="absolute h-1 bg-black rounded-md -bottom-0.5 animate-pulse" style={{width:40, left:"0%", transition:"left 0.1s ease-out"}} />
            </div>

            {/* Column 2: Interactive scroll questions */}
            <div className="relative flex flex-col justify-center p-6 lg:p-8 border-b lg:border-b-0 lg:border-r" style={{borderColor:"rgba(0,0,0,0.12)", overflow:"hidden"}}>
              <p style={{fontSize:11, letterSpacing:"0.96px", color:"#71717a", textTransform:"uppercase", marginBottom:12, zIndex:15}}>
                Sargazo a Escala / Monitoreo & Escenarios
              </p>
              
              <div style={{
                position:"relative",
                height:260,
                overflow:"hidden",
                display:"flex",
                alignItems:"center",
                width:"100%"
              }}>
                {/* Fade masks — 50px so adjacent items fade gently without looking blurry */}
                <div style={{
                  position:"absolute",
                  top:0,
                  left:0,
                  right:0,
                  height:50,
                  background:"linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
                  zIndex:10,
                  pointerEvents:"none"
                }} />
                <div style={{
                  position:"absolute",
                  bottom:0,
                  left:0,
                  right:0,
                  height:50,
                  background:"linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
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
                  background:"rgba(0,0,0,0.08)",
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
                    paddingTop:90,
                    paddingBottom:90
                  }}
                >
                  {QUESTIONS_LIST.map((q, idx)=>(
                    <li
                      key={idx}
                      ref={el => { questionItemRefs.current[idx] = el }}
                      style={{
                        height:80,
                        display:"flex",
                        flexDirection:"column",
                        justifyContent:"center",
                        filter:"none",
                        WebkitFontSmoothing:"antialiased",
                        transition:"color 0.15s ease-out, opacity 0.25s ease-out, transform 0.25s ease-out, filter 0.25s ease-out",
                        padding:"0 4px"
                      }}
                    >
                      <span style={{fontSize:"clamp(14px, 1.8vw, 19px)", lineHeight:1.3, fontWeight:300}}>
                        {q.text.split(q.highlight)[0]}
                        <span className="q-highlight" style={{display:"inline-block", position:"relative", color:"inherit", fontWeight:400, transition:"color 0.25s ease"}}>
                          {q.highlight}
                          <span className="q-underline" style={{position:"absolute", bottom:-1, left:0, width:"0%", height:1.5, background:q.color, transition:"width 0.25s ease"}} />
                        </span>
                        {q.text.split(q.highlight)[1]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sliding pill at right border */}
              <div ref={escalaPill2Ref} className="absolute w-1 bg-black rounded-md -right-0.5 animate-pulse" style={{height:40, top:"0%", transition:"top 0.1s ease-out"}} />
            </div>

            {/* Column 3: Yellow accent block - Telemetry Dashboard Card */}
            <div className="relative flex flex-col justify-between p-6 bg-[#cfb53b] text-black transition-all duration-300 min-h-[340px] lg:min-h-0">
              
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-black" />

              {/* Card Header */}
              <div style={{ borderBottom: "1px solid rgba(0,0,0,0.15)", paddingBottom: 10 }}>
                <p style={{ fontSize: 10, letterSpacing: "1.2px", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>
                  {QUESTION_DETAILS[activeQuestion].topic}
                </p>
              </div>

              {/* Huge Metric Area */}
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "center", margin: "14px 0" }}>
                <p style={{ fontSize: "clamp(28px, 3.2vw, 40px)", fontWeight: 300, lineHeight: 1.0, letterSpacing: "-1.5px", color: "#000000", margin: "0 0 2px 0" }}>
                  {QUESTION_DETAILS[activeQuestion].metric}
                </p>
                <p style={{ fontSize: 9, letterSpacing: "0.5px", textTransform: "uppercase", opacity: 0.8, margin: 0 }}>
                  {QUESTION_DETAILS[activeQuestion].metricLabel}
                </p>
              </div>

              {/* Description body */}
              <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 12, lineHeight: 1.4, color: "#1c1917", margin: 0, fontWeight: 400 }}>
                  {QUESTION_DETAILS[activeQuestion].body}
                </p>
              </div>

              {/* Telemetry Stats Table */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: 12, marginBottom: 8 }}>
                {QUESTION_DETAILS[activeQuestion].stats.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px]" style={{ borderBottom: i < 3 ? "1px solid rgba(0,0,0,0.08)" : "none", paddingBottom: 4 }}>
                    <span style={{ opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{s.val}</span>
                  </div>
                ))}
              </div>

              {/* Bottom Footer block */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, opacity: 0.8, borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: 10, width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <span>SCENARIO ID: {QUESTION_DETAILS[activeQuestion].num}</span>
                  <span className="animate-pulse" style={{ fontWeight: 700 }}>● RUNNING</span>
                </div>
              </div>

              {/* Sliding pill at top border */}
              <div ref={escalaPill3Ref} className="absolute h-1 bg-black rounded-md -top-0.5 animate-pulse" style={{ width: 40, right: "0%", transition: "right 0.1s ease-out" }} />
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
              desc:"338 días históricos NOAA SIR interpolados con kernel Wendland C2. Malla ~4 km, 18,294 celdas.",
              tags:["NOAA AOML","~4 km","18,294 celdas"]},
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

      {/* 7. Grey Section (Validation, Data Coverage & Sources) */}
      <section style={{background:"#eaeaea", color:"#18181b", padding:"80px max(40px,6vw)", borderTop:"1px solid rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <p style={{fontSize:12,letterSpacing:"0.96px",color:"#71717a",textTransform:"uppercase",marginBottom:8}}>
            Validación y Cobertura de Datos
          </p>
          <h2 style={{fontSize:"clamp(24px,2.8vw,34px)",fontWeight:300,letterSpacing:"-1.5px",color:"#09090b",marginBottom:48}}>
            Simulación física y registro histórico integrado.
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-start">
            
            {/* Left column: Live Lagrangian simulation view */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{fontSize:13,letterSpacing:"0.52px",textTransform:"uppercase",color:"#52525b",fontWeight:400}}>
                Simulación en tiempo real (Lagrangiano)
              </div>
              <ModelSimulationCanvas />
              <p style={{fontSize:13,lineHeight:1.4,color:"#52525b"}}>
                Visualización interactiva del modelo de transporte de partículas de sargazo hacia Cozumel, integrando campos de viento GFS y corrientes RTOFS en mallas de alta resolución.
              </p>
            </div>

            {/* Right column: Data coverage table + Sources */}
            <div style={{display:"flex",flexDirection:"column",gap:32}}>
              
              <div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontWeight:300}}>
                    <thead>
                      <tr style={{borderBottom:"1px solid rgba(0,0,0,0.15)"}}>
                        {["Dataset","Período","Registros","Frecuencia","Resolución"].map(h=>(
                          <th key={h} style={{textAlign:"left",padding:"0 16px 14px 0",fontSize:11,letterSpacing:"0.88px",color:"#71717a",textTransform:"uppercase",fontWeight:400}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Boletines SEMAR",      "2014 – 2026", "604",  "Semanal",  "Caribe Mexicano"],
                        ["NOAA SIR (satélite)",  "2025 – 2026", "338",  "Diario",   "~4 km costero"  ],
                        ["SATsum Caribe",        "2011 – 2024", "162",  "Mensual",  "Regional"        ],
                        ["SATsum ZEE México",    "2011 – 2024", "162",  "Mensual",  "ZEE nacional"    ],
                        ["SST Cozumel (OISST)",  "2000 – 2026", "316",  "Mensual",  "0.25°"           ],
                        ["Viento Cozumel (NCEP)","2000 – 2026", "316",  "Mensual",  "2.5°"            ],
                        ["Mendeley GASB",        "2000 – 2023", "282",  "Mensual",  "Subregional"     ],
                      ].map(([ds,per,rec,freq,res],i)=>(
                        <tr key={ds} style={{borderBottom:"1px solid rgba(0,0,0,0.06)",background:i%2===0?"transparent":"rgba(0,0,0,0.02)"}}>
                          <td style={{padding:"14px 16px 14px 0",color:"#09090b",fontWeight:400,letterSpacing:"0.325px"}}>{ds}</td>
                          <td style={{padding:"14px 16px 14px 0",color:"#52525b",fontVariantNumeric:"tabular-nums"}}>{per}</td>
                          <td style={{padding:"14px 16px 14px 0",color:"#cfb53b",fontWeight:400,fontVariantNumeric:"tabular-nums",letterSpacing:"0.325px"}}>{rec}</td>
                          <td style={{padding:"14px 16px 14px 0",color:"#52525b"}}>{freq}</td>
                          <td style={{padding:"14px 16px 14px 0",color:"#71717a"}}>{res}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p style={{fontSize:12,letterSpacing:"0.96px",color:"#71717a",textTransform:"uppercase",marginBottom:16}}>
                  Fuentes de datos
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {SOURCES.map(src=>(
                    <span key={src} style={{fontSize:12,fontWeight:400,letterSpacing:"0.48px",color:"#27272a",border:"1px solid rgba(0,0,0,0.12)",padding:"6px 14px",textTransform:"uppercase",background:"rgba(0,0,0,0.02)"}}>
                      {src}
                    </span>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 8. CTA final con animación móvil interactiva */}
      <section style={{position:"relative", background:"#000000", padding:"120px max(40px,6vw)", borderTop:"1px solid rgba(255,255,255,0.05)", overflow:"hidden"}}>
        <FooterParticleField />
        <div style={{position:"relative", zIndex:10, maxWidth:640, margin:"0 auto", textAlign:"center"}}>
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
      <footer style={{background:"#000000",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"40px max(40px,6vw) 24px"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8" style={{borderBottom:"1px solid rgba(255,255,255,0.05)",marginBottom:24}}>
            <div className="flex flex-col gap-2">
              <span style={{fontSize:12,fontWeight:400,color:"#ffffff",letterSpacing:"0.96px",textTransform:"uppercase"}}>Documentación Técnica</span>
              <p style={{fontSize:13,color:"#858484",maxWidth:400,lineHeight:1.4}}>Accede a los reportes de validación y especificaciones científicas del modelo de predicción y capas de datos.</p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <a href="?view=methodology" target="_blank" rel="noopener noreferrer"
                style={{...FONT,fontSize:13,letterSpacing:"0.52px",color:"#cfb53b",textTransform:"uppercase",textDecoration:"none",transition:"color 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#ffffff"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#cfb53b"}}>
                Bases Científicas y Metodología ↗
              </a>
              <a href="?view=layers" target="_blank" rel="noopener noreferrer"
                style={{...FONT,fontSize:13,letterSpacing:"0.52px",color:"#cfb53b",textTransform:"uppercase",textDecoration:"none",transition:"color 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="#ffffff"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="#cfb53b"}}>
                Capas de Mapeo y Fuentes ↗
              </a>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
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
        </div>
      </footer>

    </div>
  )
}
