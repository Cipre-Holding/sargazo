# Documentación Técnica Pro: Sistema de Predicción de Sargazo (Cozumel)

Este documento es el repositorio central de conocimiento para el proyecto de predicción de arribo de *Sargassum* en Cozumel, Quintana Roo. Combina oceanografía satelital, análisis de datos históricos y validación gubernamental.

---

## 1. Fundamentos de Teledetección (Remote Sensing)

### El Índice AFAI (Alternative Floating Algae Index)
El sargazo se detecta mediante el fenómeno del **"Red Edge"** (Borde Rojo). Mientras el agua absorbe casi toda la radiación en el Infrarrojo Cercano (NIR), la vegetación (sargazo) la refleja intensamente.
*   **Fórmula Conceptual:** El AFAI mide la desviación de la reflectancia en la banda NIR (859 nm) respecto a una línea base formada por las bandas roja (645 nm) e infrarroja de onda corta (SWIR).
*   **Ventaja:** A diferencia del NDVI, el AFAI es menos sensible a nubes delgadas y al "glint" (reflejo del sol en el agua), lo que lo hace ideal para el océano abierto.

### Sensores y Satélites
1.  **MODIS (Aqua y Terra):** Resolución de 1km. Es la fuente de la serie histórica de 24 años.
2.  **VIIRS (SNPP y NOAA-20):** Complemento de 750m que mejora la cobertura diaria.
3.  **OLCI (Sentinel-3):** Provee el índice MCI (Maximum Chlorophyll Index) con mejor resolución espectral.
4.  **MSI (Sentinel-2):** Alta resolución (10-20m) para monitoreo de playas específicas.

---

## 2. Oceanografía Física y Modelado de Deriva

Para predecir el arribo a Cozumel no basta con ver el sargazo; hay que saber hacia dónde lo llevan las corrientes.

### Modelo HYCOM (Hybrid Coordinate Ocean Model)
*   **Uso:** Provee vectores de velocidad y dirección de corrientes superficiales.
*   **Integración:** Los archivos KML generados por el VAS de la USF incluyen estos vectores.
*   **Efecto Leeway:** El sargazo flota parcialmente fuera del agua. Para una predicción exacta, se debe sumar al vector de la corriente un **1-3% del vector del viento superficial**.

---

## 3. Arquitectura de Datos y Datasets

### Dataset Maestro (Biomasa Histórica)
*   **Fuente:** Mendeley Data (Hu et al., 2023). [Enlace](https://doi.org/10.17632/zcyd5wvncc.1)
*   **Regiones Críticas para Cozumel:**
    *   **GASB (Great Atlantic Sargassum Belt):** La "fábrica" de sargazo. Sus picos predicen el año general.
    *   **ACR (Antilles Current Region):** El "embudo" antes de entrar al Caribe Mexicano. Sus picos predicen arribos en **2-4 semanas**.

### Protocolo de Validación SEMAR
La Secretaría de Marina utiliza un **Semáforo de Arribo**:
*   **Escaso (Azul):** Presencia mínima en la orilla.
*   **Moderado (Amarillo):** Manchas frecuentes, requieren limpieza manual.
*   **Abundante (Naranja):** Acumulación masiva, requiere maquinaria.
*   **Excesivo (Rojo):** Impacto severo, barreras de contención superadas.

---

## 4. Integración Tecnológica: Lightpanda & MCP

**Lightpanda** no es solo un navegador, es un motor de ejecución de "skills" para agentes de IA.

### Capacidades del MCP Server (`lightpanda mcp`)
El servidor Model Context Protocol expone herramientas nativas:
1.  **`goto`:** Navegación ultra-rápida (sin renderizado gráfico) para ahorrar tokens.
2.  **`markdown`:** Convierte sitios complejos como los de SEMAR o Quintana Roo en texto procesable por IA.
3.  **`semantic_tree`:** Permite que la IA entienda la estructura de un mapa interactivo sin verlo.
4.  **`evaluate`:** Permite inyectar Javascript para extraer datos específicos de biomasa que no están en un CSV.

---

## 5. Guía de Ejecución de Scripts

### Análisis de Correlación (`analyze_data.py`)
Calcula el coeficiente de Pearson entre regiones con desplazamiento temporal.
*   **Hito:** Encontramos que el **Lag de 1 y 2 meses** tiene la correlación más alta (0.72).

### Descarga Automática (`download_sargasso.py`)
Genera la base de imágenes para un modelo de visión o reporte visual.
*   **Formato de URL:** `https://optics.marine.usf.edu/data/vantenna/products/modis/YUCATAN/AFAI/YYYY/AFAI.YYYYDOY.mapped.jpg`

---

## 6. Bibliografía y Fuentes Oficiales

1.  **USF Optical Oceanography Lab:** [optics.marine.usf.edu](https://optics.marine.usf.edu)
2.  **Mendeley Data Dataset:** [DOI: 10.17632/zcyd5wvncc.1](https://doi.org/10.17632/zcyd5wvncc.1)
3.  **SEMAR Sargazo:** [diredimoat.semar.gob.mx](https://diredimoat.semar.gob.mx/OpSargazo/SargazoBoletinDiario.html)
4.  **Lightpanda Docs:** [lightpanda.io/docs](https://lightpanda.io/docs)
5.  **Red de Monitoreo Q. Roo:** [observatoriosargazo.org](https://www.observatoriosargazo.org)

---
*Documentación generada por Gemini CLI para el Proyecto Sargazo Cozumel - 07 de Mayo de 2026.*
