"""
Descarga boletines diarios de sargazo SEMAR 2026.
Fuente: https://diredimoat.semar.gob.mx/OpSargazo/SargazoBoletinDiario.html
"""

import os
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE_URL = "https://diredimoat.semar.gob.mx/OpSargazo/"
INDEX_URL = BASE_URL + "SargazoBoletinDiario.html"
DELAY = 0.5  # segundos entre descargas


def get_pdf_links(session: requests.Session, year: str) -> list[tuple[str, str]]:
    """Devuelve lista de (nombre_archivo, url_completa) para el año indicado."""
    resp = session.get(INDEX_URL, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    links = []
    for tag in soup.find_all("a", href=True):
        href = tag["href"]
        if ".pdf" in href.lower() and year in href:
            filename = Path(href).name
            full_url = BASE_URL + href.lstrip("./")
            links.append((filename, full_url))

    return links


def download_pdf(session: requests.Session, filename: str, url: str, dest: Path) -> str:
    """Descarga un PDF. Devuelve 'ok', 'skip' (ya existe) o 'error'."""
    out_path = dest / filename
    if out_path.exists():
        return "skip"

    try:
        resp = session.get(url, timeout=30, stream=True)
        if resp.status_code == 404:
            return "404"
        resp.raise_for_status()
        out_path.write_bytes(resp.content)
        return "ok"
    except Exception as e:
        print(f"  ERROR {filename}: {e}")
        return "error"


def download_year(session: requests.Session, year: str):
    output_dir = Path(f"boletines_{year}")
    output_dir.mkdir(exist_ok=True)

    links = get_pdf_links(session, year)
    print(f"\nBoletines {year} encontrados: {len(links)}")

    ok = skip = errors = not_found = 0
    for i, (filename, url) in enumerate(links, 1):
        status = download_pdf(session, filename, url, output_dir)
        if status == "ok":
            ok += 1
            print(f"  [{i}/{len(links)}] ✓ {filename}")
            time.sleep(DELAY)
        elif status == "skip":
            skip += 1
            print(f"  [{i}/{len(links)}] = {filename} (ya existe)")
        elif status == "404":
            not_found += 1
            print(f"  [{i}/{len(links)}] - {filename} (no disponible)")
        else:
            errors += 1

    print(f"  → {ok} descargados, {skip} ya existían, {not_found} no disponibles, {errors} errores")
    return ok + skip  # PDFs disponibles


def main(years: list[str] = None):
    if years is None:
        years = ["2026", "2025", "2024"]

    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (sargazo-research/1.0)"

    print("Obteniendo índice de boletines...")
    for year in years:
        download_year(session, year)


if __name__ == "__main__":
    import sys
    years = sys.argv[1:] if len(sys.argv) > 1 else ["2026", "2025", "2024"]
    main(years)
