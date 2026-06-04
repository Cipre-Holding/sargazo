import { useEffect } from "react"
import { useMap } from "@/components/ui/map"

interface MlRiskLayerProps {
  geojson: GeoJSON.FeatureCollection | null
  visible: boolean
  opacity?: number
}

export function MlRiskLayer({ geojson, visible, opacity = 0.6 }: MlRiskLayerProps) {
  const { map, isLoaded } = useMap()
  const sourceId = "mlrisk-source"
  const layerId = "mlrisk-layer"

  useEffect(() => {
    if (!isLoaded || !map || !geojson || geojson.features.length === 0) return
    if (map.getSource(sourceId)) return

    map.addSource(sourceId, { type: "geojson", data: geojson })
    map.addLayer({
      id: layerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": [
          "match", ["get", "risk"],
          "high",    "#ef4444",
          "medium",  "#f97316",
          "warning", "#eab308",
          "low",     "#3b82f6",
          "#9ca3af"
        ],
        "fill-opacity": [
          "match", ["get", "risk"],
          "high", 0.60,
          "medium", 0.50,
          "warning", 0.38,
          "low", 0.22,
          0.25
        ],
        "fill-outline-color": "rgba(0,0,0,0.15)",
      },
    })
    return () => {
      try { if (map.getLayer(layerId)) map.removeLayer(layerId); if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
    }
  }, [isLoaded, map, geojson])

  useEffect(() => {
    if (!isLoaded || !map) return
    if (!map.getLayer(layerId)) return
    try { map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none") } catch {}
  }, [isLoaded, map, visible])

  useEffect(() => {
    if (!isLoaded || !map) return
    if (!map.getLayer(layerId)) return
    try {
      map.setPaintProperty(layerId, "fill-opacity", [
        "match", ["get", "risk"],
        "high", 0.60 * opacity,
        "medium", 0.50 * opacity,
        "warning", 0.38 * opacity,
        "low", 0.22 * opacity,
        0.25 * opacity
      ])
    } catch {}
  }, [isLoaded, map, opacity])

  return null
}
