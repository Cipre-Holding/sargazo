import { useEffect, useMemo } from "react"
import type { GeoJSONSource } from "maplibre-gl"
import { useMap } from "@/components/ui/map"

interface KdeLayerProps {
  kdeData: Record<string, { lon: number[]; lat: number[]; density: number[][] }> | null
  horizon: string
  visible: boolean
}

export function KdeLayer({ kdeData, horizon, visible }: KdeLayerProps) {
  const { map, isLoaded } = useMap()
  const sourceId = "kde-source"
  const layerId = "kde-layer"

  const geojson = useMemo(() => {
    if (!kdeData || !kdeData[horizon]) return { type: "FeatureCollection" as const, features: [] }
    const { lon, lat, density } = kdeData[horizon]
    const features: GeoJSON.Feature[] = []
    
    for (let i = 0; i < lon.length; i++) {
      for (let j = 0; j < lat.length; j++) {
        const val = density[j]?.[i] ?? 0
        if (val < 0.02) continue // Umbral mínimo para mostrar densidad
        features.push({
          type: "Feature",
          properties: { density: val },
          geometry: {
            type: "Point",
            coordinates: [lon[i], lat[j]],
          },
        })
      }
    }
    return { type: "FeatureCollection" as const, features }
  }, [kdeData, horizon])

  // Registrar fuente y capa de tipo Heatmap una sola vez
  useEffect(() => {
    if (!isLoaded || !map) return
    if (map.getSource(sourceId)) return

    map.addSource(sourceId, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    })

    map.addLayer({
      id: layerId,
      type: "heatmap",
      source: sourceId,
      paint: {
        // Ponderación de peso por densidad de sargazo en cada punto
        "heatmap-weight": ["get", "density"],
        // Multiplicador de intensidad según zoom para mantener suavidad al acercar/alejar
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 1.2,
          9, 3.5
        ],
        // Degradado de color premium (Cian suave -> Esmeralda -> Ámbar -> Coral brillante)
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0, 242, 254, 0)",
          0.15, "rgba(6, 182, 212, 0.18)",
          0.40, "rgba(16, 185, 129, 0.45)",
          0.70, "rgba(245, 158, 11, 0.75)",
          1.00, "rgba(239, 68, 68, 0.92)"
        ],
        // Radio de influencia suavizado según nivel de zoom
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 6,
          9, 30
        ],
        // Opacidad de la capa
        "heatmap-opacity": 0.82,
      },
    })

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {}
    }
  }, [isLoaded, map])

  // Actualizar los datos cuando el geojson cambia (cambio de horizonte o datos nuevos)
  useEffect(() => {
    if (!isLoaded || !map || !geojson) return
    try {
      const src = map.getSource(sourceId) as unknown as GeoJSONSource
      if (src) {
        src.setData(geojson)
      }
    } catch (e) {
      console.error("Error updating KDE data:", e)
    }
  }, [isLoaded, map, geojson])

  // Controlar la visibilidad de la capa
  useEffect(() => {
    if (!isLoaded || !map) return
    if (!map.getLayer(layerId)) return
    try {
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none")
    } catch {}
  }, [isLoaded, map, visible])

  return null
}
