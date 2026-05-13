# Sargazo Cozumel — Frontend

Aplicación React para monitoreo y predicción de arribo de sargazo en Cozumel, QRoo.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS 4 + shadcn/ui
- [mapcn](https://mapcn.dev) (MapLibre GL) para mapas interactivos
- Fira Sans + Fira Code (Google Fonts)
- Lucide React para iconos

## Setup

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # → dist/
```

El dev server redirige `/api/*` a `http://localhost:8000` (backend FastAPI).

## Estructura

```
src/
├── App.tsx                        # Layout principal: mapa + sidebar + legend
├── components/
│   ├── map/                       # Capas del mapa
│   │   ├── SirLayer.tsx           # NOAA SIR risk lines (LineStrings coloreados)
│   │   ├── MlRiskLayer.tsx        # ML risk interpolation (Wendland C2)
│   │   ├── KdeLayer.tsx           # KDE accumulation por horizonte
│   │   └── TrajectoryLayer.tsx    # Partículas animadas + slider temporal
│   ├── panels/                    # Paneles UI flotantes
│   │   ├── LayerControl.tsx       # Toggles de capas + horizonte + fecha NOAA
│   │   ├── ManualInputDialog.tsx  # Formulario de entrada manual de datos
│   │   ├── Dashboard.tsx          # CM chart, model comparison, beach risk, alerts
│   │   └── SystemStatus.tsx       # Barra de salud del sistema
│   └── ui/                        # shadcn/ui + mapcn components
│       ├── map.tsx                # Componente Map cn (MapLibre GL wrapper)
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── hooks/
│   └── useApi.ts                  # Custom hook para fetch a la API
└── lib/
    └── utils.ts                   # cn() utility de shadcn
```

## Componentes del Mapa

| Componente | Capa | Tipo | Fuente | API Endpoint |
|---|---|---|---|---|
| `SirLayer` | NOAA SIR | `line` (MapLibre) | NOAA SIR risk lines | `/api/forecast/geodata/sir` |
| `MlRiskLayer` | Riesgo ML | `fill` (MapLibre) | Interpolación Wendland C2 | `/api/forecast/geodata/ml-risk` |
| `KdeLayer` | Acumulación KDE | `fill` (MapLibre) | Forecast Lagrangiano | `/api/forecast/kde` |
| `TrajectoryLayer` | Trayectorias | `circle` + `line` | RTOFS/GFS OpenDrift | `/api/forecast/trajectories` |

## Temas

OKLCH palette: emerald primary (#059669), teal secondary (#0891B2). Tinted neutrals con chroma hacia azul (hue 250-260). Modo claro únicamente.

## Gráficas

Los gráficos del Dashboard usan **SVG inline** (sin librerías externas). Cada chart se renderiza como SVG directamente en el DOM, sin dependencias de charting. Esto mantiene el bundle size pequeño y evita licencias de terceros.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Build producción → `dist/` |
| `npm run preview` | Preview del build |
| `npx tsc --noEmit` | TypeScript check |
