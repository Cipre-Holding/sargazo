# Design System - Sargazo Cozumel

## Visual Theme
Un tema oscuro sofisticado y de alto contraste operativo, optimizado para centros de monitoreo de la Secretaría de Marina (SEMAR). Inspirado en consolas militares y tableros de soberanía digital con acentos de color de precisión de alta visibilidad.

## Color Palette (OKLCH & Hex equivalents)
*   **Background Base (Dark):** `#0a0d0f` (oklch(14% 0.005 240)) — Pizarra oscuro profundo para el fondo general del app-shell.
*   **Background Surface:** `#12161a` (oklch(19% 0.008 240)) — Paneles laterales y tarjetas flotantes.
*   **Background Interactive / Hover:** `#1f262d` (oklch(26% 0.012 240)) — Elementos interactivos y estados seleccionados.
*   **Text Primary:** `#f3f4f6` (oklch(96% 0.002 240)) — Contraste máximo para lectura de datos numéricos y alertas.
*   **Text Secondary:** `#9ca3af` (oklch(70% 0.002 240)) — Subetiquetas y unidades de medida.
*   **Accent Brand (Teal-Emerald):** `#0dd393` (oklch(76% 0.18 165)) — Color principal para interactivos y señal de salud del sistema, alineado con el estilo técnico de CIPRE.
*   **Accent Signal (Teal Blue):** `#06b6d4` (oklch(72% 0.16 200)) — Color secundario para filtros activos.

### Alert Scale (Lognormal levels)
*   **Muy Bajo / Bajo:** `#3b82f6` (oklch(62% 0.20 250)) — Azul operativo.
*   **Moderado:** `#eab308` (oklch(79% 0.19 85)) — Amarillo de alerta.
*   **Alto:** `#f97316` (oklch(68% 0.22 45)) — Naranja.
*   **Muy Alto:** `#ef4444` (oklch(58% 0.24 25)) — Rojo.

## Typography
*   **System Sans:** `Fira Sans`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
*   **Mono Numbers:** `Fira Code`, `ui-monospace`, `SFMono-Regular`, monospace — Requerido para tablas de coordenadas y visualizadores de toneladas.
*   **Sizes:** 
    *   Title Main: 1.5rem (24px), semi-bold
    *   Section Header: 1.125rem (18px), medium
    *   Body Text: 0.875rem (14px), regular
    *   Labels/Mono: 0.75rem (12px), tabular-nums

## Spacing & Layout
*   **Grid:** Layout de pantalla completa. Mapa como lienzo de fondo absoluto (`w-full h-screen`).
*   **Sidebar Panel:** Barra lateral de ancho fijo (`420px` max, `w-full md:w-[420px]`) flotante o anclada al lado izquierdo con bordes de separación minimalistas (`border-r border-slate-800`).
*   **Spacing system:** `4px` (xs), `8px` (sm), `12px` (md), `16px` (lg), `24px` (xl).
*   **Elevation / Shadow:** `shadow-2xl` con opacidad reducida y bordes sutiles de `1px` en `#1f2937` para dar definición a los paneles flotantes sobre el mapa.

## Motion & Transitions
*   **Time Slider:** Transición de partículas y KDE con interpolaciones suaves.
*   **Panel toggle:** Desplazamiento lateral de la barra mediante transformaciones CSS aceleradas por GPU.
*   **Curve:** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) para todos los estados de foco, hover y transiciones de paneles.
*   **Durations:** `150ms` (interactivos rápidos), `300ms` (despliegues de paneles).
