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
    // Do not filter by selectedDate on the frontend because the API (?date=...)
    // already returns the correct 7-day rolling composite of features for that selected date.
    return { features: geojson.features, dates: d }
  }, [geojson])

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
          "high", 7.0, "medium", 5.0, "warning", 4.0, "low", 3.0, 3.0,
        ],
        "line-opacity": [
          "match", ["get", "risk"],
          "high", 1.0, "medium", 0.90, "warning", 0.80, "low", 0.60, 0.60,
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
      if (src) {
        src.setData(filteredCollection)
      }
    } catch {}
  }, [isLoaded, map, filteredCollection])

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
