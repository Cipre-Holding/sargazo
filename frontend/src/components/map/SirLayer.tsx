import { useEffect, useMemo, useCallback } from "react"
import { useMap } from "@/components/ui/map"

interface SirLayerProps {
  geojson: GeoJSON.FeatureCollection | null
  visible: boolean
  opacity?: number
  selectedDate?: string
  onDatesAvailable?: (dates: string[]) => void
}

export function SirLayer({ geojson, visible, opacity = 0.6, selectedDate, onDatesAvailable }: SirLayerProps) {
  const { map, isLoaded } = useMap()
  const sourceId = "sir-source"
  const layerId = "sir-layer"

  const { features, dates } = useMemo(() => {
    if (!geojson) return { features: [], dates: [] as string[] }
    const d = [...new Set(geojson.features.map((f) => f.properties?.date as string))].sort() as string[]
    if (onDatesAvailable && d.length > 0) {
      onDatesAvailable(d)
    }
    let filtered = geojson.features
    if (selectedDate) {
      filtered = geojson.features.filter((f) => f.properties?.date === selectedDate)
    }
    return { features: filtered, dates: d }
  }, [geojson, selectedDate])

  const filteredCollection: GeoJSON.FeatureCollection = useMemo(
    () => ({ type: "FeatureCollection", features }),
    [features]
  )

  // Add source and layer once
  useEffect(() => {
    if (!isLoaded || !map) return
    if (map.getSource(sourceId)) return

    // Add empty source initially, fill with data below
    map.addSource(sourceId, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    })
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": [
          "match", ["get", "risk"],
          "high",    "#ef4444",
          "medium",  "#f97316",
          "warning", "#eab308",
          "low",     "#3b82f6",
          "#9ca3af"
        ],
        "line-width": [
          "match", ["get", "risk"],
          "high", 3, "medium", 2, "warning", 1.5, "low", 1, 1,
        ],
        "line-opacity": [
          "match", ["get", "risk"],
          "high", 0.75, "medium", 0.55, "warning", 0.35, "low", 0.12, 0.2,
        ],
      },
    })
    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {}
    }
  }, [isLoaded, map])

  // Update data when features change
  useEffect(() => {
    if (!isLoaded || !map) return
    try {
      const src = map.getSource(sourceId) as any
      if (src && features.length > 0) {
        src.setData(filteredCollection)
      }
    } catch {}
  }, [isLoaded, map, filteredCollection, features.length])

  // Toggle visibility
  useEffect(() => {
    if (!isLoaded || !map) return
    try {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none")
      }
    } catch {}
  }, [isLoaded, map, visible])

  return null
}
