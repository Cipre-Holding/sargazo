import { useEffect, useMemo, useRef, useState } from "react"
import { useMap } from "@/components/ui/map"

interface TrajPoint {
  lon: number; lat: number; step: number; id: number
}

interface TrajectoryLayerProps {
  trajectories: TrajPoint[] | null
  visible: boolean
  horizon: string
  setHorizon: (horizon: string) => void
}

export function TrajectoryLayer({ trajectories, visible, horizon, setHorizon }: TrajectoryLayerProps) {
  const { map, isLoaded } = useMap()
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  const dotSourceId = "traj-dots-source"
  const dotLayerId = "traj-dots-layer"
  const trailSourceId = "traj-trails-source"
  const trailLayerId = "traj-trails-layer"
  
  const MAX_TRAILS = 150  // show max 150 particle trails over the entire Caribbean

  // Group trajectory data by particle ID, filter to Caribbean area
  const particles = useMemo(() => {
    if (!trajectories) return []
    const filtered = trajectories.filter(
      (t) => t.lon > -93 && t.lon < -55 && t.lat > 8 && t.lat < 25
    )
    const grouped: Record<number, { step: number; lon: number; lat: number }[]> = {}
    for (const t of filtered) {
      if (!grouped[t.id]) grouped[t.id] = []
      grouped[t.id].push({ step: t.step, lon: t.lon, lat: t.lat })
    }
    // Sort each particle's points by step
    for (const id in grouped) {
      grouped[id].sort((a, b) => a.step - b.step)
    }
    return Object.entries(grouped)
      .map(([id, pts]) => ({ id: parseInt(id), pts }))
      .sort((a, b) => a.pts.length - b.pts.length)
      .reverse()
      .slice(0, MAX_TRAILS)
  }, [trajectories])

  // Extract all unique steps for the slider
  const allSteps = useMemo(() => {
    const stepSet = new Set<number>()
    for (const p of particles) {
      for (const pt of p.pts) {
        stepSet.add(pt.step)
      }
    }
    return Array.from(stepSet).sort((a, b) => a - b)
  }, [particles])

  // Current step value in hours derived from horizon
  const currentStep = useMemo(() => {
    const h = parseInt(horizon)
    if (isNaN(h)) return allSteps[0] ?? 12
    return h
  }, [horizon, allSteps])

  // Map step value to slider index
  const stepIdx = allSteps.indexOf(currentStep)

  // Register sources and layers (once)
  useEffect(() => {
    if (!isLoaded || !map) return

    // Dots (current position)
    if (!map.getSource(dotSourceId)) {
      map.addSource(dotSourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addLayer({
        id: dotLayerId, type: "circle", source: dotSourceId,
        paint: {
          "circle-radius": 4.5,
          "circle-color": "#0dd393",
          "circle-opacity": 0.9,
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#ffffff",
        },
      })
    }

    // Trails (historical path)
    if (!map.getSource(trailSourceId)) {
      map.addSource(trailSourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addLayer({
        id: trailLayerId, type: "line", source: trailSourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#06b6d4",
          "line-width": 1.2,
          "line-opacity": 0.3,
        },
      })
    }

    return () => {
      try {
        if (map.getLayer(dotLayerId)) map.removeLayer(dotLayerId)
        if (map.getSource(dotSourceId)) map.removeSource(dotSourceId)
        if (map.getLayer(trailLayerId)) map.removeLayer(trailLayerId)
        if (map.getSource(trailSourceId)) map.removeSource(trailSourceId)
      } catch {}
    }
  }, [isLoaded, map])

  // Build trail routes coordinates
  const trails = useMemo(() => {
    if (allSteps.length === 0) return []
    const result: [number, number][][] = []
    for (const p of particles) {
      const upToStep = p.pts.filter((pt) => pt.step <= currentStep)
      if (upToStep.length >= 2) {
        result.push(upToStep.map((pt) => [pt.lon, pt.lat] as [number, number]))
      }
    }
    return result
  }, [particles, currentStep, allSteps])

  // Update dots and trails sources when step or data changes
  useEffect(() => {
    if (!isLoaded || !map) return

    // 1. Update dots positions
    const dotFeatures: GeoJSON.Feature[] = []
    for (const p of particles) {
      const pt = p.pts.find((pt) => pt.step === currentStep)
      if (pt) {
        dotFeatures.push({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
        })
      }
    }
    try {
      const dotSrc = map.getSource(dotSourceId) as any
      if (dotSrc) dotSrc.setData({ type: "FeatureCollection", features: dotFeatures })
    } catch {}

    // 2. Update trails routes
    const trailFeatures: GeoJSON.Feature[] = trails.map((coords) => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    }))
    try {
      const trailSrc = map.getSource(trailSourceId) as any
      if (trailSrc) trailSrc.setData({ type: "FeatureCollection", features: trailFeatures })
    } catch {}
  }, [isLoaded, map, currentStep, particles, trails])

  // Animation timer synchronized with parent horizon
  useEffect(() => {
    if (playing && allSteps.length > 1) {
      timerRef.current = setInterval(() => {
        const idx = allSteps.indexOf(currentStep)
        const nextIdx = idx < allSteps.length - 1 ? idx + 1 : 0
        const nextH = allSteps[nextIdx]
        setHorizon(`${nextH}h`)
      }, 750)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, allSteps, currentStep, setHorizon])

  // Visibility
  useEffect(() => {
    if (!isLoaded || !map) return
    const vis = visible ? "visible" : "none"
    try {
      if (map.getLayer(dotLayerId)) map.setLayoutProperty(dotLayerId, "visibility", vis)
      if (map.getLayer(trailLayerId)) map.setLayoutProperty(trailLayerId, "visibility", vis)
    } catch {}
  }, [isLoaded, map, visible])

  if (!visible || allSteps.length === 0) return null

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3.5 rounded-xl border border-border/40 bg-surface/90 px-4 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button
        onClick={() => setPlaying(!playing)}
        className="flex size-8 items-center justify-center rounded-lg bg-surface-raised/80 hover:bg-surface-raised border border-border/30 text-fg hover:text-primary transition-all duration-150 cursor-pointer active:scale-95"
        title={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? (
          <svg className="size-3.5" viewBox="0 0 8 8"><rect x="1" y="1" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="4.5" y="1" width="2.5" height="6" rx="0.5" fill="currentColor"/></svg>
        ) : (
          <svg className="size-3.5" viewBox="0 0 8 8"><polygon points="1,0.5 7,4 1,7.5" fill="currentColor"/></svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, allSteps.length - 1)}
        value={Math.max(0, stepIdx)}
        onChange={(e) => {
          const idx = parseInt(e.target.value)
          if (idx >= 0 && idx < allSteps.length) {
            setHorizon(`${allSteps[idx]}h`)
          }
        }}
        className="w-32 cursor-pointer h-1.5 rounded-lg accent-primary"
        style={{ accentColor: 'var(--color-primary)' }}
      />
      <span className="text-xs text-muted font-mono min-w-20 text-right tabular-nums">
        Paso {stepIdx + 1}/{allSteps.length}
      </span>
    </div>
  )
}
