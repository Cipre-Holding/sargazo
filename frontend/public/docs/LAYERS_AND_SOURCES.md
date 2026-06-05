# Capas de Mapeo y Fuentes de Datos — Sargazo Cozumel

Este documento detalla el funcionamiento técnico, tipo de datos, fuentes y procesamiento de las cuatro capas cartográficas integradas en el sistema de monitoreo de sargazo.

---

## 1. NOAA SIR (Sargassum Inundation Risk) — Observación Satelital

### Descripción General
Esta capa representa las observaciones físicas y recientes de la acumulación de sargazo en las costas del Caribe y el Golfo de México, reportadas directamente por la NOAA.

### Tipo de Datos
* **Formato**: GeoJSON LineString (segmentos costeros).
* **Propiedades**:
  * `risk`: Nivel de riesgo asignado al segmento (`low`, `warning`, `medium`, `high`).
  * `date`: Fecha de la observación satelital en formato `YYYYMMDD`.
  * `color`: Color hexadecimal asignado según el nivel de riesgo.

### Origen y Obtención
* **Fuente**: *Atlantic Oceanographic and Meteorological Laboratory (AOML)* de la NOAA.
* **Proceso de Extracción**:
  1. Se descargan diariamente los archivos en formato comprimido KMZ desde la URL pública de la NOAA (`https://cwcgom.aoml.noaa.gov/SIR/KMZ/sargassum_risk_{date}.kmz`).
  2. El script de procesamiento descomprime el KMZ en memoria y lee el archivo KML.
  3. Mediante un parseador basado en expresiones regulares, extrae los elementos `<Placemark>` que contienen la etiqueta `<SimpleData name="risk">` y las coordenadas geográficas de los segmentos costeros.
  4. Los datos son filtrados en un rango geográfico expandido de cobertura histórica y reciente (Quintana Roo y Yucatán).

### Procesos de Datos y Filtrado
* **Histórico completo (QRoo y Yucatán)**: Se consolida en el archivo `noaa_sir_riesgo_costero_qroo.geojson` (coordenadas entre `-93.0°` y `-86.0°` longitud) para alimentar el análisis temporal y perfiles por playa.
* **Caribe reducido (3 fechas)**: Para optimizar la velocidad de carga de la aplicación en el primer acceso, las últimas 3 fechas de todo el Caribe se extraen en `noaa_sir_riesgo_costero_qroo_reduced.geojson`.

---

## 2. Riesgo ML (Machine Learning) — Diagnóstico de Riesgo Interpolado

### Descripción General
Esta capa muestra un mapa de calor interpolado y suavizado del nivel de riesgo histórico y de la frecuencia acumulada de arribos de sargazo en las playas del Caribe Mexicano y la Península de Yucatán.

### Tipo de Datos
* **Formato**: GeoJSON Polygon (malla rectangular de celdas de `0.04°` de resolución, aprox. 4.4 km).
* **Propiedades**:
  * `risk`: Clasificación de riesgo de la celda (`low`, `warning`, `medium`, `high`).
  * `rv`: Valor numérico continuo de riesgo interpolado normalizado entre `[0, 1]`.
  * `c`: Color hexadecimal según el nivel.

### Proceso de Datos y Metodología
1. **Puntos de Entrenamiento**: Se toma el grid histórico acumulado de la NOAA (`noaa_sir_aggregated_grid.json`) que promedia el riesgo diario observado a lo largo de 338 fechas.
2. **Submuestreo (Downsampling)**: Se realiza un submuestreo espacial usando distancias de exclusión de `0.04°` (cdist) para evitar redundancias y reducir el tamaño del dataset de entrenamiento.
3. **Interpolación Espacial Anisotrópica**: Se aplica un kernel matemático **Wendland C2** (Wendland 1995) con pesos que definen un radio de influencia elíptico (σ_lon = 0.5°, σ_lat = 0.25°), simulando la dispersión costera preferencial del sargazo en dirección este-oeste en el Caribe.
4. **Máscara de Tierra**: Se aplica un enmascaramiento sobre las zonas terrestres continentales e insulares (como Cozumel, Isla Mujeres, y la base de Yucatán en Campeche/Tabasco) para evitar que el riesgo se desborde sobre tierra firme.

---

## 3. Densidad KDE (Kernel Density Estimation) — Pronóstico de Acumulación

### Descripción General
Representa la densidad de probabilidad de acumulación de sargazo a futuro a lo largo de un horizonte de 14 días. Es un pronóstico predictivo derivado de la simulación lagrangiana de partículas.

### Tipo de Datos
* **Formato**: GeoJSON Point (malla de puntos de densidad servida dinámicamente como una capa `heatmap` nativa de MapLibre en WebGL).
* **Propiedades**:
  * `density`: Valor continuo de densidad de partículas normalizado entre `[0, 1]`.

### Proceso de Datos y Metodología
1. **Entrada**: Toma las coordenadas de las partículas simuladas por el modelo OpenDrift para cada horizonte de tiempo (`12h` a `336h`).
2. **Kernel Gaussiano Fijo**: Se aplica una estimación de densidad de kernel 2D (*gaussian_kde* de SciPy) con un bandwidth constante de `0.08°` (aprox. 9 km). El uso de un ancho de banda fijo asegura que la visualización del sargazo mantenga el mismo tamaño físico de acumulación indeferentemente de la dispersión de las partículas.
3. **Visualización Dinámica**: La capa `KdeLayer.tsx` dibuja los puntos en el cliente utilizando WebGL para renderizar un mapa de calor dinámico, suave y continuo que escala su radio y su opacidad al cambiar el zoom.

---

## 4. Trayectorias Lagrangianas — Pronóstico de Deriva Física

### Descripción General
Esta capa simula el movimiento físico de partículas individuales de sargazo a lo largo de los próximos 14 días bajo la acción de las corrientes y los vientos del Caribe.

### Tipo de Datos
* **Formato**:
  * Puntos (coordenadas geográficas instantáneas de las partículas simuladas).
  * Líneas de estela (estelas geográficas que muestran el camino recorrido por cada partícula).

### Forzamiento Físico y Datos de Entrada
* **Corrientes Oceánicas**: Datos de corrientes superficiales de **RTOFS (Real-Time Ocean Forecast System)**. Las velocidades se escalan por un factor de **1.5×** para calibrar la velocidad de deriva costera.
* **Vientos Superficiales**: Datos de velocidad y dirección del viento a 10 metros del **GFS (Global Forecast System)**.
* **Ecuación de Deriva**:
  $$\vec{u}_{particula} = 1.5 \cdot \vec{u}_{corriente} + 0.02 \cdot \vec{u}_{viento} + \vec{\epsilon}_{difusion}$$
  * Se aplica un coeficiente de arrastre del viento (*windage*) del **2%**, validado físicamente en la literatura científica para sargazo pelágico.

### Simulación y Animación
* **Modelo**: Basado en el framework **OpenDrift** (OceanDrift).
* **Configuración**: Se siembran **2,000 partículas** en áreas clave de entrada al Caribe y canal de Yucatán. Se corre una simulación de 336 horas (14 días) con pasos de tiempo físicos de 30 minutos.
* **Sincronización**: Las posiciones calculadas cada 12 horas se almacenan en `forecast_7d_trayectorias.csv` y se reproducen en sincronía con el timeline de la Densidad KDE.
