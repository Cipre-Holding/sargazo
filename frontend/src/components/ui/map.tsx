import MapLibreGL, { type PopupOptions, type MarkerOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, Minus, Plus, Locate, Maximize, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const defaultStyles = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

type Theme = "light" | "dark";

function getDocumentTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  return null;
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useResolvedTheme(themeProp?: "light" | "dark"): Theme {
  const [detectedTheme, setDetectedTheme] = useState(() => getDocumentTheme() ?? getSystemTheme());
  useEffect(() => {
    if (themeProp) return;
    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) setDetectedTheme(docTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!getDocumentTheme()) setDetectedTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [themeProp]);
  return themeProp ?? detectedTheme;
}

type MapContextValue = { map: MapLibreGL.Map | null; isLoaded: boolean };
const MapContext = createContext<MapContextValue | null>(null);

function useMap() {
  const context = useContext(MapContext);
  if (!context) throw new Error("useMap must be used within a Map component");
  return context;
}

type MapViewport = { center: [number, number]; zoom: number; bearing: number; pitch: number };
type MapStyleOption = string | MapLibreGL.StyleSpecification;
type MapRef = MapLibreGL.Map;

type MapProps = {
  children?: ReactNode;
  className?: string;
  theme?: Theme;
  styles?: { light?: MapStyleOption; dark?: MapStyleOption };
  projection?: MapLibreGL.ProjectionSpecification;
  viewport?: Partial<MapViewport>;
  onViewportChange?: (viewport: MapViewport) => void;
  loading?: boolean;
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter();
  return { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
}

const Map = forwardRef<MapRef, MapProps>(function Map(
  { children, className, theme: themeProp, styles, projection, viewport, onViewportChange, loading = false, ...props },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const currentStyleRef = useRef<string | MapStyleOption | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalUpdateRef = useRef(false);
  const resolvedTheme = useResolvedTheme(themeProp);
  const isControlled = viewport !== undefined && onViewportChange !== undefined;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const mapStyles = useMemo(() => ({
    dark: styles?.dark ?? defaultStyles.dark,
    light: styles?.light ?? defaultStyles.light,
  }), [styles]);

  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) { clearTimeout(styleTimeoutRef.current); styleTimeoutRef.current = null; }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    currentStyleRef.current = initialStyle;
    const map = new MapLibreGL.Map({
      container: containerRef.current,
      style: initialStyle,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      ...props,
      ...viewport,
    });
    const styleDataHandler = () => {
      clearStyleTimeout();
      styleTimeoutRef.current = setTimeout(() => {
        setIsStyleLoaded(true);
        if (projection) map.setProjection(projection);
      }, 100);
    };
    const loadHandler = () => setIsLoaded(true);
    const handleMove = () => {
      if (internalUpdateRef.current) return;
      onViewportChangeRef.current?.(getViewport(map));
    };
    map.on("load", loadHandler);
    map.on("styledata", styleDataHandler);
    map.on("move", handleMove);
    setMapInstance(map);
    return () => {
      clearStyleTimeout();
      map.off("load", loadHandler);
      map.off("styledata", styleDataHandler);
      map.off("move", handleMove);
      map.remove();
      setIsLoaded(false); setIsStyleLoaded(false); setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance || !isControlled || !viewport) return;
    if (mapInstance.isMoving()) return;
    const current = getViewport(mapInstance);
    const next = {
      center: viewport.center ?? current.center,
      zoom: viewport.zoom ?? current.zoom,
      bearing: viewport.bearing ?? current.bearing,
      pitch: viewport.pitch ?? current.pitch,
    };
    if (next.center[0] === current.center[0] && next.center[1] === current.center[1] &&
        next.zoom === current.zoom && next.bearing === current.bearing && next.pitch === current.pitch) return;
    internalUpdateRef.current = true;
    mapInstance.jumpTo(next);
    internalUpdateRef.current = false;
  }, [mapInstance, isControlled, viewport]);

  useEffect(() => {
    if (!mapInstance || !resolvedTheme) return;
    const newStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    if (currentStyleRef.current === newStyle) return;
    clearStyleTimeout();
    currentStyleRef.current = newStyle;
    setIsStyleLoaded(false);
    mapInstance.setStyle(newStyle, { diff: true });
  }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

  const contextValue = useMemo(() => ({ map: mapInstance, isLoaded: isLoaded && isStyleLoaded }), [mapInstance, isLoaded, isStyleLoaded]);

  return (
    <MapContext.Provider value={contextValue}>
      <div ref={containerRef} className={cn("relative h-full w-full", className)}>
        {(!isLoaded || loading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
});

type MarkerContextValue = { marker: MapLibreGL.Marker; map: MapLibreGL.Map | null };
const MarkerContext = createContext<MarkerContextValue | null>(null);
function useMarkerContext() {
  const context = useContext(MarkerContext);
  if (!context) throw new Error("Marker components must be used within MapMarker");
  return context;
}

type MapMarkerProps = {
  longitude: number; latitude: number; children: ReactNode;
  onClick?: (e: MouseEvent) => void; onMouseEnter?: (e: MouseEvent) => void; onMouseLeave?: (e: MouseEvent) => void;
  onDragStart?: (lngLat: { lng: number; lat: number }) => void;
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

function MapMarker({ longitude, latitude, children, onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd, draggable = false, ...markerOptions }: MapMarkerProps) {
  const { map } = useMap();
  const callbacksRef = useRef({ onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd });
  callbacksRef.current = { onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd };
  const marker = useMemo(() => {
    const markerInstance = new MapLibreGL.Marker({ ...markerOptions, element: document.createElement("div"), draggable }).setLngLat([longitude, latitude]);
    const hc = (e: MouseEvent) => callbacksRef.current.onClick?.(e);
    const hme = (e: MouseEvent) => callbacksRef.current.onMouseEnter?.(e);
    const hml = (e: MouseEvent) => callbacksRef.current.onMouseLeave?.(e);
    markerInstance.getElement()?.addEventListener("click", hc);
    markerInstance.getElement()?.addEventListener("mouseenter", hme);
    markerInstance.getElement()?.addEventListener("mouseleave", hml);
    const hds = () => { const l = markerInstance.getLngLat(); callbacksRef.current.onDragStart?.({ lng: l.lng, lat: l.lat }); };
    const hd = () => { const l = markerInstance.getLngLat(); callbacksRef.current.onDrag?.({ lng: l.lng, lat: l.lat }); };
    const hde = () => { const l = markerInstance.getLngLat(); callbacksRef.current.onDragEnd?.({ lng: l.lng, lat: l.lat }); };
    markerInstance.on("dragstart", hds);
    markerInstance.on("drag", hd);
    markerInstance.on("dragend", hde);
    return markerInstance;
  }, []);
  useEffect(() => {
    if (!map) return;
    marker.addTo(map);
    return () => { marker.remove(); };
  }, [map]);
  if (marker.getLngLat().lng !== longitude || marker.getLngLat().lat !== latitude) marker.setLngLat([longitude, latitude]);
  if (marker.isDraggable() !== draggable) marker.setDraggable(draggable);
  return <MarkerContext.Provider value={{ marker, map }}>{children}</MarkerContext.Provider>;
}

type MarkerContentProps = { children?: ReactNode; className?: string };
function MarkerContent({ children, className }: MarkerContentProps) {
  const { marker } = useMarkerContext();
  return createPortal(
    <div className={cn("flex items-center justify-center", className)}>
      {children || <div className="size-4 rounded-full border-2 border-white bg-primary shadow-lg" />}
    </div>,
    marker.getElement(),
  );
}

type MarkerPopupProps = { children: ReactNode; className?: string; closeButton?: boolean } & Omit<PopupOptions, "closeButton">;
function MarkerPopup({ children, className, closeButton = false, ...popupOptions }: MarkerPopupProps) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);
  const popup = useMemo(() => new MapLibreGL.Popup({ offset: 16, ...popupOptions, closeButton: false }).setMaxWidth("none").setDOMContent(container), []);
  useEffect(() => {
    if (!map) return;
    popup.setDOMContent(container);
    marker.setPopup(popup);
    return () => { marker.setPopup(null); };
  }, [map]);
  const handleClose = () => popup.remove();
  return createPortal(
    <div className={cn("min-w-40 rounded-lg border bg-card p-3 text-card-foreground shadow-lg", className)}>
      {closeButton && (
        <button onClick={handleClose} className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent">
          <X className="size-3" />
        </button>
      )}
      {children}
    </div>,
    container,
  );
}

type MarkerTooltipProps = { children: ReactNode; className?: string } & Omit<PopupOptions, "closeButton" | "closeOnClick">;
function MarkerTooltip({ children, className, ...popupOptions }: MarkerTooltipProps) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);
  const tooltip = useMemo(() => new MapLibreGL.Popup({ offset: 16, ...popupOptions, closeOnClick: true, closeButton: false }).setMaxWidth("none"), []);
  useEffect(() => {
    if (!map) return;
    tooltip.setDOMContent(container);
    const hme = () => tooltip.setLngLat(marker.getLngLat()).addTo(map);
    const hml = () => tooltip.remove();
    marker.getElement()?.addEventListener("mouseenter", hme);
    marker.getElement()?.addEventListener("mouseleave", hml);
    return () => {
      marker.getElement()?.removeEventListener("mouseenter", hme);
      marker.getElement()?.removeEventListener("mouseleave", hml);
      tooltip.remove();
    };
  }, [map]);
  return createPortal(
    <div className={cn("rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md", className)}>{children}</div>,
    container,
  );
}

type MarkerLabelProps = { children: ReactNode; className?: string; position?: "top" | "bottom" };
function MarkerLabel({ children, className, position = "top" }: MarkerLabelProps) {
  return <div className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-foreground", position === "top" ? "bottom-full mb-1" : "top-full mt-1", className)}>{children}</div>;
}

type MapControlsProps = {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  showZoom?: boolean; showCompass?: boolean; showLocate?: boolean; showFullscreen?: boolean;
  className?: string; onLocate?: (coords: { longitude: number; latitude: number }) => void;
};

const positionClasses = { "top-left": "top-2 left-2", "top-right": "top-2 right-2", "bottom-left": "bottom-2 left-2", "bottom-right": "bottom-10 right-2" };

function MapControls({ position = "bottom-right", showZoom = true, showCompass = false, showLocate = false, showFullscreen = false, className, onLocate }: MapControlsProps) {
  const { map } = useMap();
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const hzi = useCallback(() => map?.zoomTo(map.getZoom() + 1, { duration: 300 }), [map]);
  const hzo = useCallback(() => map?.zoomTo(map.getZoom() - 1, { duration: 300 }), [map]);
  const hrb = useCallback(() => map?.resetNorthPitch({ duration: 300 }), [map]);
  const hfl = useCallback(() => {
    setWaitingForLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1500 }); onLocate?.({ longitude: pos.coords.longitude, latitude: pos.coords.latitude }); setWaitingForLocation(false); },
        () => setWaitingForLocation(false),
      );
    }
  }, [map, onLocate]);
  const hfs = useCallback(() => {
    const container = map?.getContainer();
    if (!container) return;
    document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen();
  }, [map]);

  return (
    <div className={cn("absolute z-10 flex flex-col gap-1", positionClasses[position], className)}>
      {showZoom && (
        <div className="flex flex-col overflow-hidden rounded-md border bg-card shadow-sm">
          <button onClick={hzi} className="flex size-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground"><Plus className="size-4" /></button>
          <div className="h-px bg-border" />
          <button onClick={hzo} className="flex size-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground"><Minus className="size-4" /></button>
        </div>
      )}
      {showCompass && (
        <button onClick={hrb} className="flex size-8 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground">
          <div ref={() => {}} className="transition-transform" style={{ transform: `rotateZ(${- (map?.getBearing() ?? 0)}deg)` }}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 4,22 12,18 20,22" fill="currentColor" /><polygon points="12,2 4,22 12,18 20,22" className="opacity-50" /></svg>
          </div>
        </button>
      )}
      {showLocate && (
        <button onClick={hfl} className="flex size-8 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground">
          {waitingForLocation ? <Loader2 className="size-4 animate-spin" /> : <Locate className="size-4" />}
        </button>
      )}
      {showFullscreen && (
        <button onClick={hfs} className="flex size-8 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"><Maximize className="size-4" /></button>
      )}
    </div>
  );
}

type MapPopupProps = { longitude: number; latitude: number; onClose?: () => void; children: ReactNode; className?: string; closeButton?: boolean } & Omit<PopupOptions, "closeButton">;
function MapPopup({ longitude, latitude, onClose, children, className, closeButton = false, ...popupOptions }: MapPopupProps) {
  const { map } = useMap();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const container = useMemo(() => document.createElement("div"), []);
  const popup = useMemo(() => new MapLibreGL.Popup({ offset: 16, ...popupOptions, closeButton: false }).setMaxWidth("none").setLngLat([longitude, latitude]), []);
  useEffect(() => {
    if (!map) return;
    const oc = () => onCloseRef.current?.();
    popup.on("close", oc);
    popup.setDOMContent(container);
    popup.addTo(map);
    return () => { popup.off("close", oc); if (popup.isOpen()) popup.remove(); };
  }, [map]);
  const handleClose = () => popup.remove();
  return createPortal(
    <div className={cn("min-w-40 rounded-lg border bg-card p-3 text-card-foreground shadow-lg", className)}>
      {closeButton && <button onClick={handleClose} className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground"><X className="size-3" /></button>}
      {children}
    </div>,
    container,
  );
}

type MapRouteProps = {
  id?: string; coordinates: [number, number][]; color?: string; width?: number; opacity?: number;
  dashArray?: [number, number]; onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void; interactive?: boolean;
};
function MapRoute({ id: propId, coordinates, color = "#4285F4", width = 3, opacity = 0.8, dashArray, onClick, onMouseEnter, onMouseLeave, interactive = true }: MapRouteProps) {
  const { map, isLoaded } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `route-source-${id}`;
  const layerId = `route-layer-${id}`;
  useEffect(() => {
    if (!isLoaded || !map) return;
    map.addSource(sourceId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
    map.addLayer({ id: layerId, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": width, "line-opacity": opacity, ...(dashArray && { "line-dasharray": dashArray }) } });
    return () => { try { if (map.getLayer(layerId)) map.removeLayer(layerId); if (map.getSource(sourceId)) map.removeSource(sourceId); } catch {} };
  }, [isLoaded, map]);
  useEffect(() => {
    if (!isLoaded || !map || coordinates.length < 2) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
    if (source) source.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
  }, [isLoaded, map, coordinates, sourceId]);
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, "line-color", color);
    map.setPaintProperty(layerId, "line-width", width);
    map.setPaintProperty(layerId, "line-opacity", opacity);
    if (dashArray) map.setPaintProperty(layerId, "line-dasharray", dashArray);
  }, [isLoaded, map, layerId, color, width, opacity, dashArray]);
  useEffect(() => {
    if (!isLoaded || !map || !interactive) return;
    const hc = () => onClick?.();
    const hme = () => { map.getCanvas().style.cursor = "pointer"; onMouseEnter?.(); };
    const hml = () => { map.getCanvas().style.cursor = ""; onMouseLeave?.(); };
    map.on("click", layerId, hc);
    map.on("mouseenter", layerId, hme);
    map.on("mouseleave", layerId, hml);
    return () => { map.off("click", layerId, hc); map.off("mouseenter", layerId, hme); map.off("mouseleave", layerId, hml); };
  }, [isLoaded, map, layerId, onClick, onMouseEnter, onMouseLeave, interactive]);
  return null;
}

type MapArcDatum = { id: string | number; from: [number, number]; to: [number, number] };
function MapArc({ data, id: propId, curvature = 0.2, samples = 64, paint, layout, hoverPaint, onClick, onHover, interactive = true, beforeId }: {
  data: MapArcDatum[]; id?: string; curvature?: number; samples?: number;
  paint?: Record<string, unknown>; layout?: Record<string, unknown>; hoverPaint?: Record<string, unknown>;
  onClick?: (e: { arc: MapArcDatum; longitude: number; latitude: number }) => void;
  onHover?: ((e: { arc: MapArcDatum; longitude: number; latitude: number } | null) => void) | undefined;
  interactive?: boolean; beforeId?: string;
}) {
  const { map, isLoaded } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `arc-source-${id}`;
  const layerId = `arc-layer-${id}`;
  useEffect(() => {
    if (!isLoaded || !map) return;
    const features = data.map((arc) => {
      const { from, to, ...props } = arc;
      const dx = to[0] - from[0]; const dy = to[1] - from[1]; const dist = Math.hypot(dx, dy);
      const mx = (from[0] + to[0]) / 2; const my = (from[1] + to[1]) / 2;
      const nx = -dy / (dist || 1); const ny = dx / (dist || 1);
      const offset = dist * curvature; const cx = mx + nx * offset; const cy = my + ny * offset;
      const coords: [number, number][] = [];
      for (let i = 0; i <= samples; i++) { const t = i / samples; coords.push([(1-t)*(1-t)*from[0] + 2*(1-t)*t*cx + t*t*to[0], (1-t)*(1-t)*from[1] + 2*(1-t)*t*cy + t*t*to[1]]); }
      return { type: "Feature" as const, properties: props, geometry: { type: "LineString" as const, coordinates: coords } };
    });
    map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features }, promoteId: "id" });
    map.addLayer({ id: layerId, type: "line", source: sourceId, layout: layout || { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#4285F4", "line-width": 2, "line-opacity": 0.85, ...paint } }, beforeId);
    return () => { try { if (map.getLayer(layerId)) map.removeLayer(layerId); if (map.getSource(sourceId)) map.removeSource(sourceId); } catch {} };
  }, [isLoaded, map]);
  return null;
}

export { Map, useMap, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MarkerLabel, MapPopup, MapControls, MapRoute, MapArc };
export type { MapRef, MapViewport, MapArcDatum };
