"""
generate_pdf.py
Genera el documento PDF profesional del Sistema de Prediccion Operativa de Sargazo - Cozumel.
Usa solo fuentes built-in de reportlab (Helvetica, Times-Roman) y texto ASCII-safe.
"""

from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, NextPageTemplate, KeepTogether
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
import os

# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------
BLUE_DARK   = colors.Color(10/255,  42/255,  80/255)   # cover background
BLUE_MAIN   = colors.Color(0/255,   82/255, 147/255)   # section headers
BLUE_TABLE  = colors.Color(0/255,  120/255, 200/255)   # table header row
GRAY_LIGHT  = colors.Color(0.94, 0.94, 0.96)           # alternating rows
GRAY_FOOTER = colors.Color(0.60, 0.60, 0.60)
WHITE       = colors.white
BLACK       = colors.black

OUTPUT_PATH = "/home/alex/sargazo/sargazo_proyecto.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

# ---------------------------------------------------------------------------
# Page drawing callbacks
# ---------------------------------------------------------------------------
def draw_cover_page(canvas, doc):
    """Draw the full-page cover (page 1)."""
    canvas.saveState()
    # Background
    canvas.setFillColor(BLUE_DARK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Accent bars
    canvas.setFillColor(BLUE_TABLE)
    canvas.rect(0, PAGE_H * 0.38, PAGE_W, 5, fill=1, stroke=0)
    canvas.rect(0, PAGE_H * 0.62, PAGE_W, 5, fill=1, stroke=0)
    # Title
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 28)
    title_lines = ["Sistema de Prediccion", "Operativa de Sargazo", "Cozumel"]
    y = PAGE_H * 0.72
    for line in title_lines:
        canvas.drawCentredString(PAGE_W / 2, y, line)
        y -= 38
    # Subtitle
    canvas.setFont("Helvetica", 14)
    canvas.setFillColor(colors.Color(0.75, 0.88, 1.0))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.44,
                             "Cipre Holding  |  Mayo 2026")
    canvas.setFont("Helvetica", 11)
    canvas.setFillColor(colors.Color(0.60, 0.80, 1.0))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.40,
                             "https://sargazo-xvcvxyopra-pv.a.run.app")
    # Bottom tag
    canvas.setFont("Helvetica", 10)
    canvas.setFillColor(colors.Color(0.55, 0.70, 0.85))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H * 0.10,
                             "Teledeteccion Satelital  |  Analisis Estocastico"
                             "  |  Modelado Lagrangiano  |  ML")
    canvas.restoreState()


def draw_content_page(canvas, doc):
    """Draw footer on content pages (page 2+)."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRAY_FOOTER)
    page_num = canvas.getPageNumber()
    text = (f"Sistema de Prediccion Operativa de Sargazo - Cozumel  |"
            f"  Cipre Holding  |  Mayo 2026  |  Pag. {page_num - 1}")
    canvas.drawCentredString(PAGE_W / 2, 1.2 * cm, text)
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Helper builders
# ---------------------------------------------------------------------------
def colored_bar_header(text, level=1):
    """Returns a Table that simulates a left-border colored section header."""
    font_size = 13 if level == 1 else 11
    p_style = ParagraphStyle(
        f"hdr_{text[:8]}_{level}",
        fontName="Helvetica-Bold",
        fontSize=font_size,
        leading=font_size + 4,
        textColor=BLUE_MAIN
    )
    data = [[Paragraph(text, p_style)]]
    avail = PAGE_W - 2 * MARGIN
    t = Table(data, colWidths=[avail])
    t.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEABOVE",     (0, 0), (-1, 0), 0.5, colors.Color(0.85, 0.85, 0.87)),
        ("LINEBEFORE",    (0, 0), (0, -1), 4,   BLUE_MAIN),
        ("BACKGROUND",    (0, 0), (-1, -1), colors.Color(0.96, 0.97, 0.99)),
    ]))
    return t


def make_table(header_row, data_rows, col_widths=None):
    """Builds a styled table with blue header and alternating gray rows."""
    avail = PAGE_W - 2 * MARGIN
    if col_widths is None:
        n = len(header_row)
        col_widths = [avail / n] * n

    body_style = ParagraphStyle(
        "TblBody", fontName="Helvetica", fontSize=9, leading=12, textColor=BLACK
    )
    header_style = ParagraphStyle(
        "TblHdr", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=WHITE
    )

    all_rows = [[Paragraph(str(h), header_style) for h in header_row]]
    for row in data_rows:
        all_rows.append([Paragraph(str(cell), body_style) for cell in row])

    t = Table(all_rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, 0),   BLUE_TABLE),
        ("TEXTCOLOR",      (0, 0), (-1, 0),   WHITE),
        ("FONTNAME",       (0, 0), (-1, 0),   "Helvetica-Bold"),
        ("FONTSIZE",       (0, 0), (-1, -1),  9),
        ("LEADING",        (0, 0), (-1, -1),  12),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),  [WHITE, GRAY_LIGHT]),
        ("GRID",           (0, 0), (-1, -1),  0.4, colors.Color(0.8, 0.8, 0.82)),
        ("VALIGN",         (0, 0), (-1, -1),  "TOP"),
        ("LEFTPADDING",    (0, 0), (-1, -1),  6),
        ("RIGHTPADDING",   (0, 0), (-1, -1),  6),
        ("TOPPADDING",     (0, 0), (-1, -1),  4),
        ("BOTTOMPADDING",  (0, 0), (-1, -1),  4),
    ]))
    return t


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "Body",
        fontName="Helvetica", fontSize=10, leading=14,
        textColor=BLACK, spaceAfter=6, spaceBefore=2,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        "BodySmall",
        fontName="Helvetica", fontSize=9, leading=13,
        textColor=BLACK, spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        "BulletItem",
        fontName="Helvetica", fontSize=10, leading=14,
        textColor=BLACK, spaceAfter=3,
        leftIndent=14, firstLineIndent=0
    ))
    return styles


# ---------------------------------------------------------------------------
# Build document content
# ---------------------------------------------------------------------------
def build_story(styles):
    story = []
    body   = styles["Body"]
    small  = styles["BodySmall"]
    bullet = styles["BulletItem"]
    avail  = PAGE_W - 2 * MARGIN

    # Switch to content template after cover
    story.append(NextPageTemplate("content"))
    story.append(PageBreak())   # end cover page, move to content template

    # ---- 1. RESUMEN EJECUTIVO ----------------------------------------
    story.append(colored_bar_header("1. RESUMEN EJECUTIVO"))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph(
        "Sistema de prediccion operativa del arribo de sargazo (Sargassum spp.) a Cozumel, "
        "Quintana Roo, Mexico. Combina teledeteccion satelital (AFAI/MODIS/VIIRS/OLCI), analisis "
        "estocastico de series de tiempo, modelado numerico oceanico Lagrangiano y aprendizaje "
        "automatico. Genera predicciones con 1-4 semanas de anticipacion para gestion proactiva "
        "de playas.",
        body
    ))
    story.append(Spacer(1, 0.2 * cm))

    kpi_data = [
        ["Indicador", "Valor"],
        ["Semaforo SEMAR (mayo 2026)", "MUY ALTO"],
        ["Ensemble junio 2026", "52,571 ton"],
        ["Intervalo de confianza 80%", "7,000 - 293,000 ton"],
        ["Prophet ACO jun-2026", "3.85 Mt"],
        ["Score de confianza ensemble", "83/100 (ALTA)"],
    ]
    story.append(make_table(kpi_data[0], kpi_data[1:],
                            col_widths=[avail*0.55, avail*0.45]))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 2. PROBLEMA Y CONTEXTO --------------------------------------
    story.append(colored_bar_header("2. PROBLEMA Y CONTEXTO"))
    story.append(Spacer(1, 0.2 * cm))
    items = [
        "Crisis de sargazo pelagico desde 2011 en el Caribe Mexicano.",
        "Impacto en turismo, pesca artesanal y ecosistemas costeros.",
        "Cozumel: turismo internacional de alto valor (cruceros, buceo).",
        "La prediccion operativa permite: movilizar personal de recoleccion, "
        "alertas tempranas a touroperadores, planificar limpieza en playas prioritarias.",
    ]
    for item in items:
        story.append(Paragraph(f"   *  {item}", bullet))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 3. ARQUITECTURA DEL SISTEMA ---------------------------------
    story.append(colored_bar_header("3. ARQUITECTURA DEL SISTEMA"))
    story.append(Spacer(1, 0.2 * cm))
    arch_data = [
        ["Componente", "Tecnologia"],
        ["Frontend",   "React 19 + Vite 8 + MapLibre GL 5.24 + Tailwind CSS v4 + TypeScript"],
        ["Backend",    "FastAPI + APScheduler + SQLite + Gunicorn/Uvicorn"],
        ["Despliegue", "Docker multi-stage -> Google Cloud Run (4Gi RAM, 2 vCPU, northamerica-south1)"],
        ["Pipeline",   "Automatizado semanal (lunes 06:00 UTC)"],
    ]
    story.append(make_table(arch_data[0], arch_data[1:],
                            col_widths=[avail*0.25, avail*0.75]))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 4. FUENTES DE DATOS -----------------------------------------
    story.append(colored_bar_header("4. FUENTES DE DATOS"))
    story.append(Spacer(1, 0.2 * cm))
    src_hdr = ["Fuente", "Tipo", "Cobertura", "Uso"]
    src_data = [
        ["SEMAR/IOGMC Boletines",
         "PDF OCR",
         "Mar 2024-actualidad (609 PDFs)",
         "Semaforo, biomasa CM, corrientes, viento"],
        ["Mendeley/Hu et al. 2023",
         "XLSX satelital",
         "2000-2023 (298 meses)",
         "Serie larga GASB, ACO (AFAI/MODIS/VIIRS)"],
        ["NOAA SIR (cwcgom.aoml)",
         "KMZ/GeoJSON",
         "Diario (315 fechas)",
         "Riesgo costero satelital por celda"],
        ["NOAA RTOFS",
         "NetCDF",
         "14 dias pronostico",
         "Corrientes oceanicas (modelo Lagrangiano)"],
        ["NCEP/GFS NOAA",
         "NetCDF",
         "14 dias pronostico",
         "Viento superficial para windage"],
        ["SATsum USF Oceanography",
         "AFAI diario",
         "Region Yucatan",
         "Imagenes satelitales tiempo real"],
        ["SST OISST",
         "NetCDF mensual",
         "2000-2026",
         "Temperatura superficial del mar"],
    ]
    story.append(make_table(src_hdr, src_data,
                            col_widths=[avail*0.27, avail*0.13, avail*0.28, avail*0.32]))
    story.append(PageBreak())

    # ---- 5. PIPELINE DE DATOS ----------------------------------------
    story.append(colored_bar_header("5. PIPELINE DE DATOS"))
    story.append(Spacer(1, 0.2 * cm))
    pipeline_steps = [
        ("Step 1 - Descarga boletines (download_boletines.py)",
         "PDFs SEMAR via requests+BeautifulSoup. 609 PDFs. Delay 0.5s, detecta 404 automatico."),
        ("Step 2 - OCR y extraccion (extract_boletines.py)",
         "4 formatos PDF (2024-2026). OCR NVIDIA PaddleOCR para escaneados. CSV maestro: 604 filas x 27 columnas."),
        ("Step 3 - Combinacion datasets (combine_datasets.py)",
         "Mendeley XLSX (298 meses) + SEMAR CSV -> sargazo_combinado_2000_2026.csv (311 filas)."),
        ("Step 4 - Feature engineering (prepare_features.py)",
         "5 CSVs de features: lags 1-6 meses, log-transforms, z-scores, residuos estocasticos."),
        ("Step 5 - Modelos predictivos (Fase 0/1/2)",
         "Ejecuta modelos, genera JSONs de predicciones."),
        ("Step 6 - Modelo Lagrangiano (modelo_pronostico_7dias.py)",
         "RTOFS+GFS -> 2,000 particulas -> KDE + trayectorias."),
        ("Step 7 - Interpolacion ML (interpolar_riesgo_ml_v2.py)",
         "Wendland C2 -> GeoJSON riesgo interpolado (915 celdas)."),
        ("Step 8 - Riesgo por playa (risk_by_beach.py)",
         "Perfil de riesgo 10 segmentos costeros."),
    ]
    p_step_title = ParagraphStyle("StepTitle", fontName="Helvetica-Bold", fontSize=10,
                                  leading=13, textColor=BLUE_MAIN, spaceAfter=1)
    for title, desc in pipeline_steps:
        story.append(Paragraph(title, p_step_title))
        story.append(Paragraph("   " + desc, small))
        story.append(Spacer(1, 0.15 * cm))
    story.append(PageBreak())

    # ---- 6. MODELOS MATEMATICOS --------------------------------------
    story.append(colored_bar_header("6. MODELOS MATEMATICOS"))
    story.append(Spacer(1, 0.2 * cm))

    # 6.1
    story.append(colored_bar_header("6.1  Analisis Estocastico de la Serie Temporal", level=2))
    story.append(Spacer(1, 0.15 * cm))
    params_data = [
        ["Parametro", "Valor", "Interpretacion"],
        ["Exponente de Hurst (H)", "0.8047", "Memoria larga en log(GASB). Proceso fBM."],
        ["Hurst de incrementos",   "0.2963", "Anti-persistente. Combinacion = fOU."],
        ["theta (OU)",             "0.075 mes-1", "Velocidad de retorno a la media."],
        ["tau_1/2",                "9.2 meses", "Semivida de la desviacion."],
        ["tau_e",                  "13.3 meses", "Escala de correlacion exponencial."],
        ["sigma",                  "1.002 Mt/mes^0.5", "Volatilidad instantanea."],
        ["d (ARFIMA)",             "0.30", "d = H - 0.5"],
        ["Skew GASB",              "2.57", "Distribucion lognormal."],
        ["Kurtosis GASB",          "7.78", "Colas pesadas."],
        ["ADF (serie original)",   "p = 0.36", "NO estacionaria."],
        ["ADF (log-retornos)",     "p < 0.00001", "Log-retornos estacionarios."],
    ]
    story.append(make_table(params_data[0], params_data[1:],
                            col_widths=[avail*0.32, avail*0.24, avail*0.44]))
    story.append(Spacer(1, 0.3 * cm))

    # 6.2
    story.append(colored_bar_header("6.2  Predictores Operativos - Correlaciones Lag", level=2))
    story.append(Spacer(1, 0.15 * cm))
    corr_data = [
        ["Predictor", "Lag", "n", "Spearman r", "p-valor"],
        ["ACO -> CM",             "1 mes",   "14", "0.8901", "0.00002"],
        ["ACO -> CM",             "2 meses", "13", "0.7253", "0.005"],
        ["ACO -> CM",             "3 meses", "12", "0.3357", "n.s."],
        ["CO -> CM (contemp.)",   "0",       "15", "0.8321", "0.0001"],
        ["CO -> CM",              "1 mes",   "14", "0.6571", "0.011"],
    ]
    story.append(make_table(corr_data[0], corr_data[1:],
                            col_widths=[avail*0.30, avail*0.13, avail*0.09,
                                        avail*0.20, avail*0.28]))
    story.append(Spacer(1, 0.3 * cm))

    # 6.3
    story.append(colored_bar_header("6.3  Modelos Fase 0 (Operativos)", level=2))
    story.append(Spacer(1, 0.1 * cm))
    fase0 = [
        ("Regresion local con kernel tricubico (LOESS)",
         "Suavizado no parametrico. Ventana adaptativa. Captura tendencias sin asumir forma funcional."),
        ("AR(1) con deriva",
         "x_t = phi * x(t-1) + mu*dt + epsilon_t. Modelo base de referencia para series con autocorrelacion."),
        ("ARIMAX(p,d,q)",
         "ARIMA extendido con variable exogena ACO lag-1 como regresor. "
         "Captura estructura ARMA + componente predictora externa."),
    ]
    for name, desc in fase0:
        story.append(Paragraph(f"   <b>{name}:</b>  {desc}", bullet))
    story.append(Spacer(1, 0.3 * cm))

    # 6.4
    story.append(colored_bar_header("6.4  Modelos Fase 1 (Extendidos)", level=2))
    story.append(Spacer(1, 0.1 * cm))
    fase1 = [
        ("Ridge Regression",
         "Regularizacion L2. Maneja multicolinealidad entre features (lags de ACO, GASB, SST, viento). "
         "Lambda optimizado por validacion cruzada."),
        ("Bayesian Ridge",
         "Version probabilistica de Ridge. Genera intervalos de credibilidad sobre los coeficientes. "
         "Cuantifica incertidumbre epistemica."),
        ("Prophet (Meta)",
         "Modelo aditivo bayesiano para series con estacionalidad. "
         "Tuneado con changepoints en anomalias 2018-2020 y 2022-2024. "
         "n=298 meses. Proyeccion jun-2026: 3.85 Mt."),
        ("Ensemble ponderado por R2",
         "y_hat = Sum(wi * y_hat_i) donde wi = R2_i / Sum(R2_j). "
         "Score: 83/100 (ALTA confianza). Prediccion junio 2026: 52,571 ton."),
    ]
    for name, desc in fase1:
        story.append(Paragraph(f"   <b>{name}:</b>  {desc}", bullet))
    story.append(PageBreak())

    # 6.5
    story.append(colored_bar_header("6.5  Modelo Lagrangiano - Pronostico 14 dias", level=2))
    story.append(Spacer(1, 0.1 * cm))
    lag_steps = [
        "2,000 particulas sembradas en celdas de riesgo NOAA SIR.",
        "Adveccion: corrientes RTOFS + windage GFS (fraccion 3% velocidad viento).",
        "Integracion Runge-Kutta 4to orden, paso horario.",
        "KDE gaussiano sobre posiciones finales -> mapa de probabilidad de acumulacion.",
        "25 horizontes: 12h, 24h, 48h, 72h ... 336h (14 dias).",
    ]
    for s in lag_steps:
        story.append(Paragraph(f"   -  {s}", bullet))
    story.append(Spacer(1, 0.3 * cm))

    # 6.6
    story.append(colored_bar_header("6.6  Interpolacion Wendland C2", level=2))
    story.append(Spacer(1, 0.1 * cm))
    story.append(Paragraph(
        "Funcion radial de soporte compacto: phi(r) = (1 - r)^4 * (4r + 1) para r <= 1. "
        "Interpolacion del riesgo costero NOAA SIR a malla regular. "
        "915 celdas interpoladas en la costa de Quintana Roo.",
        body
    ))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 7. REGIONES CLAVE Y TELEDETECCION ---------------------------
    story.append(colored_bar_header("7. REGIONES CLAVE Y TELEDETECCION"))
    story.append(Spacer(1, 0.2 * cm))
    regions_data = [
        ["Region / Indice", "Descripcion"],
        ["GASB",
         "Great Atlantic Sargassum Belt: Franja 5-15N, Atlantico Central. "
         "Fuente principal de sargazo pelagico."],
        ["ACO",
         "Atlantico Central Occidental: Region de convergencia antes del Caribe. "
         "Predictor principal: r = 0.89, lag = 1 mes."],
        ["CM",
         "Caribe Mexicano: Zona operativa. Incluye Isla Mujeres, Cancun, "
         "Playa del Carmen, Tulum, Cozumel."],
        ["AFAI",
         "Alternative Floating Algae Index: Indice derivado de reflectancia NIR. "
         "Desarrollado por Hu et al. 2009. Detecta biomasa desde MODIS, VIIRS, OLCI (Sentinel-3). "
         "Unidades: Mt (Megatoneladas peso seco)."],
    ]
    story.append(make_table(regions_data[0], regions_data[1:],
                            col_widths=[avail*0.17, avail*0.83]))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 8. INTERFAZ Y FUNCIONALIDADES -------------------------------
    story.append(colored_bar_header("8. INTERFAZ Y FUNCIONALIDADES"))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("<b>Capas del mapa:</b>", body))
    map_layers = [
        "Riesgo ML: Interpolacion Wendland C2, 915 celdas, escala LOW/WARN/MED/HIGH.",
        "NOAA SIR: Lineas de riesgo costero satelital, navegables por fecha.",
        "KDE Lagrangiano: Densidad de acumulacion de particulas, 25 horizontes.",
        "Trayectorias: Lineas de 2,000 particulas Lagrangianas, horizonte 14 dias.",
    ]
    for i, layer in enumerate(map_layers, 1):
        story.append(Paragraph(f"   {i}.  {layer}", bullet))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("<b>Panel de prediccion:</b>", body))
    panel_items = [
        "KPI principal: Ensemble junio 2026 con semaforo de color.",
        "Intervalo de confianza 80% visualizado.",
        "Cambio porcentual vs. mes anterior.",
        "Score de confianza 83/100 con desglose por componente.",
        "Riesgo por playa: 10 segmentos costeros.",
    ]
    for item in panel_items:
        story.append(Paragraph(f"   -  {item}", bullet))
    story.append(PageBreak())

    # ---- 9. SCORE DE CONFIANZA ---------------------------------------
    story.append(colored_bar_header("9. SCORE DE CONFIANZA DEL ENSEMBLE"))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("Sistema de 100 puntos que integra los siguientes factores:", body))
    score_items = [
        "Convergencia de modelos (acuerdo entre predicciones).",
        "Calidad de datos de entrenamiento.",
        "Estabilidad de residuos.",
        "Significancia estadistica de predictores (ACO lag-1 p-valor).",
        "Score actual: 83/100  ->  nivel ALTA confianza.",
    ]
    for item in score_items:
        story.append(Paragraph(f"   -  {item}", bullet))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 10. PLAYAS MONITOREADAS -------------------------------------
    story.append(colored_bar_header("10. PLAYAS MONITOREADAS"))
    story.append(Spacer(1, 0.2 * cm))
    beaches_hdr = ["Segmento Costero", "Riesgo mayo 2026"]
    beaches_data = [
        ["Isla Mujeres",               "71%"],
        ["Cancun Norte",               "66%"],
        ["Cozumel Norte",              "65%"],
        ["Cancun Sur",                 "62%"],
        ["Puerto Morelos",             "58%"],
        ["Playa del Carmen Norte",     "55%"],
        ["Playa del Carmen Sur",       "51%"],
        ["Tulum Norte",                "48%"],
        ["Tulum Sur",                  "42%"],
        ["Cozumel Sur",                "38%"],
    ]
    story.append(make_table(beaches_hdr, beaches_data,
                            col_widths=[avail*0.65, avail*0.35]))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 11. ALCANCES Y LIMITACIONES ---------------------------------
    story.append(colored_bar_header("11. ALCANCES Y LIMITACIONES"))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("<b>Alcances:</b>", body))
    for item in [
        "Prediccion mensual CM con anticipacion 1-4 semanas (ventana operativa util).",
        "Actualizacion semanal automatica del pipeline.",
        "Pronostico Lagrangiano a 14 dias.",
        "Acceso web en tiempo real desde cualquier dispositivo.",
    ]:
        story.append(Paragraph(f"   -  {item}", bullet))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("<b>Limitaciones:</b>", body))
    for item in [
        "IC 80% amplio (7k-293k ton) por alta variabilidad interanual del fenomeno.",
        "Correlacion ACO->CM significativa solo a lag 1-2 meses; lag-3 no significativo.",
        "Modelo Lagrangiano asume windage constante 3% (no captura eventos extremos).",
        "Datos CM basados en OCR: posibles errores en PDFs escaneados.",
        "En Cloud Run: SIR muestra solo 3 fechas recientes (vs. 315 en servidor local).",
    ]:
        story.append(Paragraph(f"   -  {item}", bullet))
    story.append(Spacer(1, 0.4 * cm))

    # ---- 12. PROXIMOS PASOS ------------------------------------------
    story.append(colored_bar_header("12. PROXIMOS PASOS"))
    story.append(Spacer(1, 0.2 * cm))
    for item in [
        "Integrar AFAI en tiempo real desde USF Optical Oceanography Lab.",
        "Ampliar serie CM con validacion manual de 63 registros NaN.",
        "Asimilar viento real de boyas SEMAR.",
        "Considerar ARFIMA(1, 0.3, 0) como modelo base por H = 0.8047.",
    ]:
        story.append(Paragraph(f"   -  {item}", bullet))
    story.append(Spacer(1, 0.6 * cm))

    # ---- Final rule & URL -------------------------------------------
    story.append(HRFlowable(width=avail, thickness=1, color=BLUE_TABLE))
    story.append(Spacer(1, 0.25 * cm))
    p_footer2 = ParagraphStyle(
        "Footer2", fontName="Helvetica", fontSize=9,
        leading=12, alignment=TA_CENTER, textColor=GRAY_FOOTER
    )
    story.append(Paragraph(
        "https://sargazo-xvcvxyopra-pv.a.run.app  |  "
        "Cipre Holding  |  arojas@cipreholding.com  |  Mayo 2026",
        p_footer2
    ))

    return story


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    doc = BaseDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN + 0.5 * cm,
        title="Sistema de Prediccion Operativa de Sargazo - Cozumel",
        author="Cipre Holding",
        subject="Prediccion sargazo Cozumel, mayo 2026",
    )

    # Cover template: full-page frame (no margins matter — content is via onPage)
    cover_frame = Frame(
        0, 0, PAGE_W, PAGE_H,
        leftPadding=0, bottomPadding=0,
        rightPadding=0, topPadding=0,
        id="cover_frame"
    )
    cover_template = PageTemplate(
        id="cover",
        frames=[cover_frame],
        onPage=draw_cover_page
    )

    # Content template: standard margins
    content_frame = Frame(
        MARGIN,
        MARGIN + 0.5 * cm,        # room for footer
        PAGE_W - 2 * MARGIN,
        PAGE_H - 2 * MARGIN - 0.5 * cm,
        id="content_frame"
    )
    content_template = PageTemplate(
        id="content",
        frames=[content_frame],
        onPage=draw_content_page
    )

    doc.addPageTemplates([cover_template, content_template])

    styles = build_styles()
    story  = build_story(styles)

    doc.build(story)

    size_bytes = os.path.getsize(OUTPUT_PATH)
    size_mb    = size_bytes / (1024 * 1024)
    print(f"PDF generado exitosamente: {OUTPUT_PATH}")
    print(f"Paginas: generadas correctamente")
    print(f"Tamano del archivo: {size_mb:.3f} MB  ({size_bytes:,} bytes)")


if __name__ == "__main__":
    main()
