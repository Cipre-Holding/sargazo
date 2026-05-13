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
        "fill-color": ["get", "c"],
        "fill-opacity": [
          "match", ["get", "risk"],
          "high", 0.55,
          "medium", 0.45,
          "warning", 0.3,
          "low", 0.12,
          0.25
        ],
        "fill-outline-color": "transparent",
      },
    })
    return () => {
      try { if (map.getLayer(layerId)) map.removeLayer(layerId); if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
    }
  }, [isLoaded, map, geojson])

  useEffect(() => {
    if (!isLoaded || !map) return
    try { map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none") } catch {}
  }, [isLoaded, map, visible])

  useEffect(() => {
    if (!isLoaded || !map) return
    try {
      map.setPaintProperty(layerId, "fill-opacity", [
        "match", ["get", "risk"],
        "high", 0.55 * opacity,
        "medium", 0.45 * opacity,
        "warning", 0.3 * opacity,
        "low", 0.12 * opacity,
        0.25 * opacity
      ])
    } catch {}
  }, [isLoaded, map, opacity])

  return null
}
