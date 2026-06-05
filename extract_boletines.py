"""
Extrae datos estructurados de los boletines diarios de sargazo SEMAR/IOGMC
y genera un CSV con una fila por boletín.

Columnas del CSV:
  fecha, num_boletin, semaforo,
  biomasa_caribe_mexicano_ton, biomasa_caribe_central_ton,
  biomasa_caribe_oriental_ton, biomasa_atlantico_central_ton,
  num_conglomerados, conglomerado_cozumel (bool),
  corriente_xcalak_nudos, corriente_xcalak_dir,
  corriente_mahahual_nudos, corriente_mahahual_dir,
  corriente_tulum_nudos, corriente_tulum_dir,
  corriente_playa_carmen_nudos, corriente_playa_carmen_dir,
  corriente_puerto_morelos_nudos, corriente_puerto_morelos_dir,
  corriente_cancun_nudos, corriente_cancun_dir,
  viento_norte_nudos, viento_norte_dir,
  viento_sur_nudos, viento_sur_dir,
  archivo
"""

import re
import csv
import sys
import os
import base64
import tempfile
import requests
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent

# NVIDIA PaddleOCR — fallback para páginas escaneadas
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "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")
PADDLEOCR_URL  = "https://ai.api.nvidia.com/v1/cv/baidu/paddleocr"


def ocr_page(img) -> str:
    """Envía una imagen PIL al API PaddleOCR y devuelve el texto concatenado."""
    try:
        from pdf2image import convert_from_path  # importación tardía
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            tmp = f.name
        img.save(tmp, "PNG")
        with open(tmp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        os.unlink(tmp)

        resp = requests.post(
            PADDLEOCR_URL,
            headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Accept": "application/json"},
            json={"input": [{"type": "image_url", "url": f"data:image/png;base64,{b64}"}]},
            timeout=30,
        )
        detections = resp.json().get("data", [{}])[0].get("text_detections", [])
        return " | ".join(d["text_prediction"]["text"] for d in detections)
    except Exception as e:
        print(f"  OCR error: {e}", file=sys.stderr)
        return ""


def get_last_page_text_via_ocr(pdf_path: Path) -> str:
    """Convierte la última página del PDF a imagen y extrae texto con OCR."""
    try:
        from pdf2image import convert_from_path
        pages = convert_from_path(str(pdf_path), dpi=100)
        return ocr_page(pages[-1])
    except Exception as e:
        print(f"  OCR page convert error: {e}", file=sys.stderr)
        return ""

OUTPUT_CSV = None  # se determina en main() según la carpeta de entrada

MESES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}

FIELDNAMES = [
    "fecha", "num_boletin", "semaforo",
    "biomasa_caribe_mexicano_ton", "biomasa_caribe_central_ton",
    "biomasa_caribe_oriental_ton", "biomasa_atlantico_central_ton",
    "num_conglomerados", "conglomerado_cozumel",
    "corriente_xcalak_nudos", "corriente_xcalak_dir",
    "corriente_mahahual_nudos", "corriente_mahahual_dir",
    "corriente_tulum_nudos", "corriente_tulum_dir",
    "corriente_playa_carmen_nudos", "corriente_playa_carmen_dir",
    "corriente_puerto_morelos_nudos", "corriente_puerto_morelos_dir",
    "corriente_cancun_nudos", "corriente_cancun_dir",
    "viento_norte_nudos", "viento_norte_dir",
    "viento_sur_nudos", "viento_sur_dir",
    "archivo",
]


def clean_num(s: str) -> str:
    """'52,484' o '186, 226' → '52484'"""
    return re.sub(r"[\s,\.]", "", s).strip() if s else ""


def date_from_filename(filename: str) -> tuple[str, str]:
    """SARGAZO_1425_07_MAYO_2026.pdf → ('2026-05-07', '1425')"""
    m = re.match(r"SARGAZO_(\d+)_(\d{1,2})_([A-ZÁÉÍÓÚÜÑ]+)_(\d{4})", filename, re.IGNORECASE)
    if m:
        num = m.group(1)
        day = m.group(2).zfill(2)
        mes = MESES.get(m.group(3).lower(), "00")
        year = m.group(4)
        return f"{year}-{mes}-{day}", num
    return "", ""


def extract_date_and_num(text: str, filename: str = "") -> tuple[str, str]:
    """Extrae fecha (YYYY-MM-DD) y número de boletín. Prioriza nombre de archivo."""
    if filename:
        date, num = date_from_filename(filename)
        if date:
            return date, num

    # Fallback: texto del PDF (formato compacto o con espacios)
    m = re.search(
        r"N[ÚU]M\.?\s*(\d+)\s*/?\s*(\d{1,2})\s*de\s*(\w+)\s*del?\s*(\d{4})",
        _norm(text), re.IGNORECASE
    )
    if m:
        num = m.group(1)
        day = m.group(2).zfill(2)
        mes = MESES.get(m.group(3).lower().strip(), "00")
        year = m.group(4)
        return f"{year}-{mes}-{day}", num

    return "", ""


def extract_regional_biomass(table: list[list]) -> dict:
    """Extrae biomasa por región de la tabla de página 2 (Formatos C y D)."""
    result = {
        "biomasa_caribe_mexicano_ton": "",
        "biomasa_caribe_central_ton": "",
        "biomasa_caribe_oriental_ton": "",
        "biomasa_atlantico_central_ton": "",
    }
    for row in table:
        row_text = " ".join(str(c) for c in row if c).upper()
        val = ""
        for cell in row:
            c = str(cell) if cell else ""
            # Eliminar sufijo "Ton." / "TON." / "ton" para aceptar "14,353 Ton."
            c_stripped = re.sub(r"\s*[Tt][Oo][Nn]\.?\s*$", "", c).strip()
            if re.match(r"[\d,\.]+$", c_stripped):
                val = clean_num(c_stripped)
        if "CARIBE MEXICANO" in row_text or "(CM)" in row_text:
            result["biomasa_caribe_mexicano_ton"] = val
        elif "CARIBE CENTRAL" in row_text or "(CC)" in row_text:
            result["biomasa_caribe_central_ton"] = val
        elif "CARIBE ORIENTAL" in row_text or "ANTILLAS" in row_text:
            result["biomasa_caribe_oriental_ton"] = val
        elif "ATLÁNTICO" in row_text or "ACO" in row_text or "OCCIDENTAL" in row_text:
            result["biomasa_atlantico_central_ton"] = val
    return result


def _parse_biomasa_num(raw: str) -> str:
    """
    Convierte número de biomasa a entero string (tons sin decimales).
    Convenciones observadas en los PDFs de SEMAR:
      Formato A: period = separador decimal  "670.464" → 670,  "758.44" → 758
      Formato B: comma  = separador de miles "8,917"   → 8917
    Regla: si el string tiene punto → parsear como float (período decimal).
           si solo tiene coma → eliminar coma (miles) y parsear como int.
    """
    if not raw:
        return ""
    if "." in raw:
        try:
            return str(int(round(float(raw.replace(",", "")))))
        except Exception:
            pass
    try:
        return str(int(raw.replace(",", "").replace(".", "").strip()))
    except Exception:
        return ""


def extract_biomasa_texto(text: str) -> str:
    """
    Extrae biomasa CM total del texto en línea para Formatos A y B.
    Formato A: "cantidad aproximada de sargazo de670.464Ton"
    Formato B: "cobertura algal a la fecha de 8,917 Ton."
    Devuelve toneladas como string entero, o vacío.
    """
    t = _norm(text)
    patterns = [
        r"cobertura\s+algal\s+(?:en\s+\S+\s+)?(?:\w+\s+){0,6}de\s+([\d,\.]+)\s*[Tt]on",
        r"cantidad\s+aproximada\s+de\s+sargazo\s+de\s*([\d,\.]+)\s*[Tt]on",
        r"cobertura\s+algal\s+a\s+la\s+fecha\s+de\s+([\d,\.]+)\s*[Tt]on",
        r"sargazode([\d,\.]+)[Tt]on",
        r"fechade([\d,\.]+)[Tt]on",
        r"sargazo\s*de\s*([\d,\.]+)\s*[Tt]on",
    ]
    for pat in patterns:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            return _parse_biomasa_num(m.group(1))
    return ""


# Ordenadas de más larga a más corta para evitar match parcial (sureste antes que sur)
DIRECCIONES = r"(sureste|suroeste|noreste|noroeste|norte|sur|este|oeste)"


def _norm(text: str) -> str:
    """Normaliza el texto: une líneas y colapsa espacios extra."""
    return re.sub(r"\s+", " ", text.replace("\n", " "))


_NIVELES = r"(MUY\s*ALTO|MUY\s*BAJO|ESCASO|MODERADO|ABUNDANTE|EXCESIVO|ALTO|BAJO)"


def _normalize_nivel(s: str) -> str:
    val = re.sub(r"\s+", " ", s).strip().upper()
    return re.sub(r"MUY(ALTO|BAJO)", r"MUY \1", val)


def extract_semaforo(text: str) -> str:
    t = _norm(text)

    # Formato 2026/2025-tardío: "SEMÁFORO <nivel>" (con o sin espacio)
    m = re.search(r"SEM[ÁA]FORO\s*" + _NIVELES, t, re.IGNORECASE)
    if m:
        return _normalize_nivel(m.group(1))

    # Formato 2025-temprano: tabla "NIVEL SEMÁFORO*" + texto + "1 <nivel>"
    m = re.search(r"NIVEL\s+SEM[ÁA]FORO.*?\d+\s+" + _NIVELES, t, re.IGNORECASE | re.DOTALL)
    if m:
        return _normalize_nivel(m.group(1))

    # Formato 2025-temprano alt: línea suelta "^\d+ <nivel>" en texto sin normalizar
    m = re.search(r"^\s*\d+\s+" + _NIVELES + r"\s+[\d,]+\s+ton", text, re.IGNORECASE | re.MULTILINE)
    if m:
        return _normalize_nivel(m.group(1))

    # Formato 2024: 'CATEGORÍA "ESCASO"' / 'CATEGORÍA "ESCASO"' / 'CATEGORÍA MODERADO'
    m = re.search(r"CATEGOR[ÍI]A\W+" + _NIVELES, t, re.IGNORECASE)
    if m:
        return _normalize_nivel(m.group(1))

    return ""


def extract_corrientes(text: str) -> dict:
    result = {}
    t = _norm(text)

    locations = {
        "xcalak": "corriente_xcalak",
        "mahahual": "corriente_mahahual",
        "tulum": "corriente_tulum",
        "playa del carmen": "corriente_playa_carmen",
        "puerto morelos": "corriente_puerto_morelos",
        r"canc[uú]n": "corriente_cancun",
    }
    for loc_pat, key in locations.items():
        # "Xcalak 0.8 nudos con dirección hacia el norte"
        # o "Cancún0.9nudoscondirecciónhaciaelnorte"
        m = re.search(
            rf"{loc_pat}\s*([\d\.]+)\s*nudos\s*con\s*direcci[oó]n\s*hacia\s*el\s*{DIRECCIONES}",
            t, re.IGNORECASE
        )
        if m:
            result[f"{key}_nudos"] = m.group(1)
            result[f"{key}_dir"] = m.group(2).lower()
        else:
            result[f"{key}_nudos"] = ""
            result[f"{key}_dir"] = ""
    return result


def extract_viento(text: str) -> dict:
    result = {"viento_norte_nudos": "", "viento_norte_dir": "",
              "viento_sur_nudos": "", "viento_sur_dir": ""}
    t = _norm(text)

    # "Región norte: 16-14 nudos, del sureste"  o  "Regiónnorte:16-14nudos,delsureste"
    m_norte = re.search(
        r"[Rr]egi[oó]n\s*norte\s*:\s*([\d\-]+)\s*nudos\s*,?\s*del\s*" + DIRECCIONES,
        t, re.IGNORECASE
    )
    if m_norte:
        result["viento_norte_nudos"] = m_norte.group(1)
        result["viento_norte_dir"] = m_norte.group(2).lower()

    m_sur = re.search(
        r"[Rr]egi[oó]n\s*sur\s*:\s*([\d\-]+)\s*nudos\s*,?\s*del\s*" + DIRECCIONES,
        t, re.IGNORECASE
    )
    if m_sur:
        result["viento_sur_nudos"] = m_sur.group(1)
        result["viento_sur_dir"] = m_sur.group(2).lower()

    return result


def extract_conglomerados(table: list[list], page1_text: str) -> tuple[int, bool]:
    """Devuelve (num_conglomerados, hay_arribo_cozumel)."""
    count = 0
    cozumel = False
    if table:
        for row in table:
            first = str(row[0] or "").strip()
            if re.match(r"^\d+$", first):
                count += 1
                row_text = " ".join(str(c) for c in row if c).upper()
                if "COZUMEL" in row_text:
                    cozumel = True
    if not count:
        # fallback: contar filas numéricas en el texto
        matches = re.findall(r"^\s*(\d+)\s+\d", page1_text, re.MULTILINE)
        count = len(matches)
    if not cozumel and "COZUMEL" in page1_text.upper():
        cozumel = True
    return count, cozumel


def parse_bulletin(pdf_path: Path) -> dict | None:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) < 2:
                return None

            p1_text = pdf.pages[0].extract_text() or ""
            p2_text = pdf.pages[1].extract_text() or ""
            # Última página = semáforo/corrientes (puede ser p3 o p4)
            last_text = (pdf.pages[-1].extract_text() or "").strip()

            p1_tables = pdf.pages[0].extract_tables()
            # Buscar tabla de biomasa regional en página 2 o 3
            p2_tables = []
            for pg in pdf.pages[1:]:
                tbls = pg.extract_tables()
                if tbls:
                    pg_text = pg.extract_text() or ""
                    if re.search(r"caribe mexicano|regi[oó]n.*sargazo", pg_text, re.IGNORECASE):
                        p2_tables = tbls
                        break
                    if not p2_tables:
                        p2_tables = tbls

            fecha, num_boletin = extract_date_and_num(p1_text, pdf_path.name)

            # Intentar tabla de biomasa regional en páginas 2+ (Formatos C/D)
            regional = extract_regional_biomass(p2_tables[0] if p2_tables else [])

            # Formato C: tabla de biomasa en página 1 (index 0)
            if not regional["biomasa_caribe_mexicano_ton"] and p1_tables:
                regional = extract_regional_biomass(p1_tables[0])

            # Formatos A/B: biomasa CM en texto en línea (no en tabla)
            if not regional["biomasa_caribe_mexicano_ton"]:
                bio_txt = extract_biomasa_texto(p1_text + " " + p2_text)
                if bio_txt:
                    regional["biomasa_caribe_mexicano_ton"] = bio_txt

            num_cong, cozumel = extract_conglomerados(
                p1_tables[0] if p1_tables else [], p1_text
            )

            # Texto completo de todas las páginas (para semáforo que puede estar en cualquiera)
            all_text = "\n".join(
                pdf.pages[i].extract_text() or "" for i in range(len(pdf.pages))
            )

            # Semáforo: buscar en todo el documento
            semaforo = extract_semaforo(all_text)

            # Corrientes/viento: están en la última página; si vacía → OCR
            if not last_text or not extract_semaforo(last_text):
                if not semaforo:  # solo llama OCR si tampoco lo encontramos en el texto
                    print(f"    → OCR fallback", end="", flush=True)
                    ocr_text = get_last_page_text_via_ocr(pdf_path)
                    if not semaforo:
                        semaforo = extract_semaforo(ocr_text)
                    last_text = ocr_text if ocr_text else last_text

            corrientes = extract_corrientes(last_text)
            viento    = extract_viento(last_text)

            row = {
                "fecha": fecha,
                "num_boletin": num_boletin,
                "semaforo": semaforo,
                **regional,
                "num_conglomerados": num_cong,
                "conglomerado_cozumel": "SI" if cozumel else "NO",
                **corrientes,
                **viento,
                "archivo": pdf_path.name,
            }
            return row

    except Exception as e:
        print(f"  ERROR {pdf_path.name}: {e}", file=sys.stderr)
        return None


def main(pdf_dir: str = "boletines_2026"):
    pdf_folder = Path(pdf_dir)
    # Detectar año desde el nombre de la carpeta (ej. "boletines_2025" → "2025")
    year_match = re.search(r"\d{4}", pdf_folder.name)
    year_tag = year_match.group() if year_match else pdf_folder.name
    out_csv = f"boletines_sargazo_{year_tag}.csv"

    pdfs = sorted(pdf_folder.glob("*.pdf"))
    if not pdfs:
        print(f"No se encontraron PDFs en {pdf_folder.resolve()}")
        return

    existing_rows = {}
    out_csv_path = Path(out_csv)
    if out_csv_path.exists():
        try:
            with open(out_csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    existing_rows[r["archivo"]] = r
            print(f"Cargados {len(existing_rows)} registros existentes desde {out_csv}")
        except Exception as e:
            print(f"No se pudo leer {out_csv} existente: {e}")

    rows = []
    for i, pdf_path in enumerate(pdfs, 1):
        if pdf_path.name in existing_rows:
            rows.append(existing_rows[pdf_path.name])
        else:
            row = parse_bulletin(pdf_path)
            if row:
                rows.append(row)
                print(f"[{i}/{len(pdfs)}] {pdf_path.name}  →  {row['fecha']}  semáforo: {row['semaforo']}")
            else:
                print(f"[{i}/{len(pdfs)}] {pdf_path.name}  →  sin datos")

    rows.sort(key=lambda r: r["fecha"] or "9999")

    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nCSV generado: {out_csv}  ({len(rows)} filas)")
    merge_and_sync_db()
    return out_csv


def merge_and_sync_db():
    print("\nCombinando CSVs en boletines_sargazo_MASTER.csv y sincronizando base de datos...")
    import pandas as pd
    from backend.database import SessionLocal
    from backend.models import SEMARObservation
    
    # Merge CSVs
    dfs = []
    for year in ["2024", "2025", "2026"]:
        csv_file = ROOT / f"boletines_sargazo_{year}.csv"
        if csv_file.exists():
            df_year = pd.read_csv(csv_file)
            df_year["año"] = int(year)
            dfs.append(df_year)
    if not dfs:
        print("No se encontraron CSVs de años específicos para combinar.")
        return
        
    master_df = pd.concat(dfs, ignore_index=True)
    master_df = master_df.drop_duplicates(subset=["fecha"])
    master_df = master_df.sort_values(by="fecha")
    
    master_csv = ROOT / "boletines_sargazo_MASTER.csv"
    master_df.to_csv(master_csv, index=False)
    print(f"✅ boletines_sargazo_MASTER.csv actualizado ({len(master_df)} filas)")
    
    # Sync with DB
    db = SessionLocal()
    try:
        def to_float(val):
            if pd.isna(val) or val == "":
                return None
            try:
                return float(val)
            except:
                return None
                
        def to_int(val):
            if pd.isna(val) or val == "":
                return None
            try:
                return int(float(val))
            except:
                return None
                
        db_obs = {o.fecha: o for o in db.query(SEMARObservation).all()}
        new_count = 0
        update_count = 0
        
        for _, r in master_df.iterrows():
            fecha_str = str(r["fecha"])
            obs = db_obs.get(fecha_str)
            is_new = False
            if not obs:
                obs = SEMARObservation(fecha=fecha_str)
                db.add(obs)
                is_new = True
                
            obs.num_boletin = str(r["num_boletin"]) if pd.notna(r["num_boletin"]) else None
            obs.semaforo = str(r["semaforo"]) if pd.notna(r["semaforo"]) else None
            obs.biomasa_caribe_mexicano_ton = to_float(r.get("biomasa_caribe_mexicano_ton"))
            obs.biomasa_caribe_central_ton = to_float(r.get("biomasa_caribe_central_ton"))
            obs.biomasa_caribe_oriental_ton = to_float(r.get("biomasa_caribe_oriental_ton"))
            obs.biomasa_atlantico_central_ton = to_float(r.get("biomasa_atlantico_central_ton"))
            obs.num_conglomerados = to_int(r.get("num_conglomerados"))
            obs.conglomerado_cozumel = str(r.get("conglomerado_cozumel")) if pd.notna(r.get("conglomerado_cozumel")) else None
            
            obs.corriente_xcalak_nudos = to_float(r.get("corriente_xcalak_nudos"))
            obs.corriente_xcalak_dir = str(r.get("corriente_xcalak_dir")) if pd.notna(r.get("corriente_xcalak_dir")) else None
            obs.corriente_mahahual_nudos = to_float(r.get("corriente_mahahual_nudos"))
            obs.corriente_mahahual_dir = str(r.get("corriente_mahahual_dir")) if pd.notna(r.get("corriente_mahahual_dir")) else None
            obs.corriente_tulum_nudos = to_float(r.get("corriente_tulum_nudos"))
            obs.corriente_tulum_dir = str(r.get("corriente_tulum_dir")) if pd.notna(r.get("corriente_tulum_dir")) else None
            obs.corriente_playa_carmen_nudos = to_float(r.get("corriente_playa_carmen_nudos"))
            obs.corriente_playa_carmen_dir = str(r.get("corriente_playa_carmen_dir")) if pd.notna(r.get("corriente_playa_carmen_dir")) else None
            obs.corriente_puerto_morelos_nudos = to_float(r.get("corriente_puerto_morelos_nudos"))
            obs.corriente_puerto_morelos_dir = str(r.get("corriente_puerto_morelos_dir")) if pd.notna(r.get("corriente_puerto_morelos_dir")) else None
            obs.corriente_cancun_nudos = to_float(r.get("corriente_cancun_nudos"))
            obs.corriente_cancun_dir = str(r.get("corriente_cancun_dir")) if pd.notna(r.get("corriente_cancun_dir")) else None
            
            obs.viento_norte_nudos = str(r.get("viento_norte_nudos")) if pd.notna(r.get("viento_norte_nudos")) else None
            obs.viento_norte_dir = str(r.get("viento_norte_dir")) if pd.notna(r.get("viento_norte_dir")) else None
            obs.viento_sur_nudos = str(r.get("viento_sur_nudos")) if pd.notna(r.get("viento_sur_nudos")) else None
            obs.viento_sur_dir = str(r.get("viento_sur_dir")) if pd.notna(r.get("viento_sur_dir")) else None
            
            obs.archivo = str(r.get("archivo")) if pd.notna(r.get("archivo")) else None
            obs.anio = to_int(r.get("año"))
            
            if is_new:
                new_count += 1
            else:
                update_count += 1
                
        db.commit()
        print(f"✅ Sincronización DB completada: {new_count} creados, {update_count} actualizados.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error al sincronizar con la base de datos: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else "boletines_2026"
    main(folder)
