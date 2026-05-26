import { useEffect, useMemo, useRef } from "react"
import type { GeoJSONSource } from "maplibre-gl"
import { useMap } from "@/components/ui/map"

interface KdeLayerProps {
  kdeData: Record<string, { lon: number[]; lat: number[]; density: number[][] }> | null
  horizon: string
  visible: boolean
}

export function KdeLayer({ kdeData, horizon, visible }: KdeLayerProps) {
  const { map, isLoaded } = useMap()
  const sourceId = `kde-source-${horizon}`
  const layerId = `kde-layer-${horizon}`

  const geojson = useMemo(() => {
    if (!kdeData || !kdeData[horizon]) return null
    const { lon, lat, density } = kdeData[horizon]
    const features: GeoJSON.Feature[] = []
    for (let i = 0; i < lon.length - 1; i++) {
      for (let j = 0; j < lat.length - 1; j++) {
        const val = density[j]?.[i] ?? 0
        if (val < 0.05) continue
        features.push({
          type: "Feature",
          properties: { density: val },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [lon[i], lat[j]], [lon[i+1], lat[j]], [lon[i+1], lat[j+1]], [lon[i], lat[j+1]], [lon[i], lat[j]],
            ]],
          },
        })
      }
    }
    return { type: "FeatureCollection" as const, features }
  }, [kdeData, horizon])

  useEffect(() => {
    if (!isLoaded || !map || !geojson) return
    const exists = map.getSource(sourceId)
    if (!exists) {
      map.addSource(sourceId, { type: "geojson", data: geojson })
      map.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["get", "density"],
            0, "rgba(13, 211, 147, 0)",
            0.1, "rgba(6, 182, 212, 0.15)",
            0.3, "rgba(6, 182, 212, 0.4)",
            0.5, "rgba(13, 211, 147, 0.6)",
            0.8, "rgba(13, 211, 147, 0.8)",
            1, "rgba(243, 244, 246, 0.95)",
          ],
          "fill-outline-color": "transparent",
        },
      })
    } else {
      const src = map.getSource(sourceId) as unknown as GeoJSONSource
      src.setData(geojson)
    }
    return () => {
      try { if (map.getLayer(layerId)) map.removeLayer(layerId); if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
    }
  }, [isLoaded, map, geojson, sourceId])

  useEffect(() => {
    if (!isLoaded || !map) return
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none")
  }, [isLoaded, map, visible])

  return null
}
