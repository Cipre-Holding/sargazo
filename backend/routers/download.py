import sys
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import DownloadLog

PIPELINE_RUNNING = False

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

router = APIRouter(prefix="/api/download", tags=["download"])


def run_weekly_pipeline(log_id: int):
    """Executes the full data pipeline: download → extract → combine → predict."""
    import json
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.database import SQLALCHEMY_DATABASE_URL
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {},
    )
    Session = sessionmaker(bind=engine)
    db = Session()

    steps = {}
    error = None
    try:
        # Step 1: Download NOAA SIR
        from descargar_noaa_sir import main as download_noaa
        download_noaa()
        steps["noaa_sir"] = "ok"

        # Step 2: Download SEMAR boletines
        from download_boletines import main as download_semar
        download_semar()
        steps["semar_download"] = "ok"

        # Step 3: Extract boletines
        from extract_boletines import main as extract_semar
        extract_semar()
        steps["semar_extract"] = "ok"

        # Step 4: Combine datasets
        from combine_datasets import main as combine
        combine()
        steps["combine"] = "ok"

        # Step 5: Prepare features
        from prepare_features import main as prepare
        prepare()
        steps["features"] = "ok"

        # Step 6: Run predictions
        from modelos_fase0 import main as pred0
        pred0()
        steps["predict_phase0"] = "ok"

        from modelos_fase1 import main as pred1
        pred1()
        steps["predict_phase1"] = "ok"

        # Step 7: Confidence score
        from confidence_score import calculate_confidence as calc_conf
        calc_conf()
        steps["confidence"] = "ok"

        # Step 8: ML risk interpolation (NOAA SIR → grid)
        from interpolar_riesgo_ml_v2 import build_temporal_risk as ml_risk
        ml_risk()
        steps["ml_risk"] = "ok"

        # Step 9: Beach risk profile
        from risk_by_beach import build_risk_profile as beach_risk
        beach_risk()
        steps["beach_risk"] = "ok"

        # Step 10: Trajectory forecast (14 días, RTOFS+GFS)
        # ⚠️ Ejecución lenta (~15-30 min). Se ejecuta al final para no bloquear
        # los pasos rápidos anteriores. Si falla, los pasos 7-9 ya se guardaron.
        try:
            from modelo_pronostico_7dias import run_forecast_7dias as trajectory
            trajectory()
            steps["trajectory_forecast"] = "ok"
        except Exception as traj_err:
            steps["trajectory_forecast"] = f"falló: {traj_err}"
            print(f"  ⚠️ Trajectory forecast falló (no crítico): {traj_err}")

    except Exception as e:
        error = str(e)
        steps["error"] = error

    try:
        log = db.query(DownloadLog).filter(DownloadLog.id == log_id).first()
        if log:
            log.status = "error" if error else "ok"
            log.finished_at = datetime.now(timezone.utc)
            log.steps = json.dumps(steps)
            log.error = error
            db.commit()
    finally:
        global PIPELINE_RUNNING
        PIPELINE_RUNNING = False
        db.close()


@router.post("/run")
def trigger_download(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    global PIPELINE_RUNNING
    if PIPELINE_RUNNING:
        return {"status": "already_running", "message": "El pipeline ya se está ejecutando"}

    # If there is a stuck log, make sure it is updated
    stuck_log = db.query(DownloadLog).filter(DownloadLog.status == "running").first()
    if stuck_log:
        stuck_log.status = "error"
        stuck_log.error = "Ejecución abortada por nueva petición"
        db.commit()

    log = DownloadLog(status="running")
    db.add(log)
    db.commit()
    db.refresh(log)
    PIPELINE_RUNNING = True
    background_tasks.add_task(run_weekly_pipeline, log.id)
    return {"status": "started", "log_id": log.id, "message": "Pipeline running in background"}


@router.get("/status")
def get_download_status(db: Session = Depends(get_db)):
    log = db.query(DownloadLog).order_by(DownloadLog.id.desc()).first()
    if not log:
        return {"status": "never_run"}
    import json
    return {
        "status": log.status,
        "started_at": str(log.started_at) if log.started_at else None,
        "finished_at": str(log.finished_at) if log.finished_at else None,
        "steps": json.loads(log.steps) if log.steps else None,
        "error": log.error,
    }


@router.get("/logs")
def get_download_logs(limit: int = 10, db: Session = Depends(get_db)):
    logs = db.query(DownloadLog).order_by(DownloadLog.id.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "started_at": str(log.started_at) if log.started_at else None,
            "finished_at": str(log.finished_at) if log.finished_at else None,
            "status": log.status,
            "error": log.error,
        }
        for log in logs
    ]


@router.get("/catalog")
def get_data_catalog(db: Session = Depends(get_db)):
    """Return file and database metadata stats for the data catalog."""
    import os
    import json
    from sqlalchemy import text

    # 1. Database Stats
    db_stats = {
        "size_bytes": 0,
        "last_modified": None,
        "tables": []
    }

    from backend.database import SQLALCHEMY_DATABASE_URL
    if "sqlite:///" in SQLALCHEMY_DATABASE_URL:
        db_file_path = ROOT / SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
        if db_file_path.exists():
            db_stats["size_bytes"] = db_file_path.stat().st_size
            db_stats["last_modified"] = datetime.fromtimestamp(db_file_path.stat().st_mtime, tz=timezone.utc).isoformat()

    tables_meta = {
        "manual_inputs": "Registros de entrada manual ingresados por administradores",
        "download_log": "Bitácora de descargas e inferencias automáticas del pipeline",
        "mendeley_observations": "Dataset de biomasa mensual histórica GASB (Hu et al. 2023)",
        "semar_observations": "Observaciones y corrientes extraídas de boletines oficiales de la SEMAR",
        "satellite_observations": "Biomasa mensual de sargazo local (capas SATsum)",
        "climatology_observations": "Datos oceanográficos mensuales históricos (SST y componentes de viento)",
        "daily_sir_summaries": "Resúmenes diarios de cantidad de celdas por riesgo NOAA SIR",
        "model_features": "Variables predictoras formateadas para los modelos de machine learning",
        "model_predictions": "Predicciones de arribo mensual de sargazo generadas por el modelo",
        "beach_risk_profiles": "Perfiles de susceptibilidad y riesgo promedio por playa en Cozumel"
    }

    for table_name, desc in tables_meta.items():
        try:
            count_res = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).fetchone()
            count = count_res[0] if count_res else 0

            table_stats = {
                "name": table_name,
                "count": count,
                "description": desc,
                "min_date": None,
                "max_date": None
            }

            if table_name == "daily_sir_summaries":
                date_res = db.execute(text(f"SELECT MIN(date), MAX(date) FROM {table_name}")).fetchone()
                if date_res:
                    table_stats["min_date"], table_stats["max_date"] = date_res
            elif table_name == "semar_observations":
                date_res = db.execute(text(f"SELECT MIN(fecha), MAX(fecha) FROM {table_name}")).fetchone()
                if date_res:
                    table_stats["min_date"], table_stats["max_date"] = date_res
            elif table_name in ["mendeley_observations", "satellite_observations", "climatology_observations", "model_features"]:
                date_res = db.execute(text(f"SELECT MIN(month), MAX(month) FROM {table_name}")).fetchone()
                if date_res:
                    table_stats["min_date"], table_stats["max_date"] = date_res
            elif table_name == "model_predictions":
                date_res = db.execute(text(f"SELECT MIN(date_month), MAX(date_month) FROM {table_name}")).fetchone()
                if date_res:
                    table_stats["min_date"], table_stats["max_date"] = date_res

            db_stats["tables"].append(table_stats)
        except Exception:
            pass

    # 2. Files Stats Helper
    def get_dir_file_stats(dir_path: Path, pattern: str):
        if not dir_path.exists():
            return {"count": 0, "total_size_mb": 0.0, "latest_files": []}
        files = sorted(dir_path.glob(pattern), key=lambda x: x.stat().st_mtime, reverse=True)
        total_size = sum(f.stat().st_size for f in files)
        latest_files = []
        for f in files[:10]:
            latest_files.append({
                "name": f.name,
                "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
                "modified_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat()
            })
        return {
            "count": len(files),
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "latest_files": latest_files
        }

    noaa_stats = get_dir_file_stats(ROOT / "noaa_sir_kmz", "sargassum_risk_*.kmz")

    # Combined bulletins
    bulletins_files = []
    bulletins_count = 0
    bulletins_size = 0.0
    for yr in ["2024", "2025", "2026"]:
        yr_stats = get_dir_file_stats(ROOT / f"boletines_{yr}", "SARGAZO_*.pdf")
        bulletins_count += yr_stats["count"]
        bulletins_size += yr_stats["total_size_mb"]
        bulletins_files.extend(yr_stats["latest_files"])

    bulletins_files.sort(key=lambda x: x["modified_at"], reverse=True)
    bulletins_stats = {
        "count": bulletins_count,
        "total_size_mb": round(bulletins_size, 2),
        "latest_files": bulletins_files[:10]
    }

    # 3. Outputs Stats
    outputs_meta = [
        {"name": "forecast_7d_trayectorias.csv", "desc": "Simulaciones físicas lagrangianas de partículas (OpenDrift)"},
        {"name": "forecast_kde_acumulaciones.json", "desc": "Densidades espaciales de arribo futuro (análisis KDE)"},
        {"name": "features_fuente.csv", "desc": "Dataset consolidado con variables oceanográficas y biomasa"},
        {"name": "features_growth.csv", "desc": "Factores de crecimiento y tasas de cambio mensual de sargazo"},
        {"name": "features_prediccion_cm.csv", "desc": "Variables rezagadas de biomasa listas para modelado"},
        {"name": "features_semaforo.csv", "desc": "Datos clasificados para predicción de semáforo costero"},
        {"name": "residuos_estocasticos.csv", "desc": "Residuos de predicción para ajuste estocástico fOU"},
        {"name": "noaa_sir_aggregated_grid.json", "desc": "Malla agregada histórica de celdas NOAA SIR"},
        {"name": "noaa_sir_riesgo_costero_qroo.geojson", "desc": "GeoJSON histórico completo con celdas NOAA SIR"},
        {"name": "noaa_sir_riesgo_costero_qroo_reduced.geojson", "desc": "GeoJSON reducido del Caribe (últimas 3 fechas)"},
        {"name": "noaa_sir_riesgo_ml_corregido.geojson", "desc": "Malla continua de riesgo costero calculada vía Machine Learning"},
        {"name": "risk_by_beach.json", "desc": "Perfiles y susceptibilidades individuales de riesgo por playa"}
    ]

    outputs_stats = []
    for out in outputs_meta:
        fp = ROOT / out["name"]
        if fp.exists():
            outputs_stats.append({
                "name": out["name"],
                "size_mb": round(fp.stat().st_size / (1024 * 1024), 2),
                "modified_at": datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc).isoformat(),
                "description": out["desc"]
            })

    # 4. Pipeline last status
    last_log = db.query(DownloadLog).order_by(DownloadLog.id.desc()).first()

    # Clean up ghost running states on server restart
    if last_log and last_log.status == "running" and not PIPELINE_RUNNING:
        last_log.status = "error"
        last_log.error = "Ejecución abortada debido al reinicio del servidor"
        db.commit()

    pipeline_stats = {
        "status": last_log.status if last_log else "never_run",
        "last_run": str(last_log.started_at) if last_log and last_log.started_at else None,
        "finished_at": str(last_log.finished_at) if last_log and last_log.finished_at else None,
        "steps": json.loads(last_log.steps) if last_log and last_log.steps else None,
        "error": last_log.error if last_log else None
    }

    return {
        "database": db_stats,
        "files": {
            "noaa_sir_kmz": noaa_stats,
            "boletines_semar": bulletins_stats,
            "outputs": outputs_stats
        },
        "pipeline": pipeline_stats
    }


@router.get("/table/{table_name}")
def get_table_sample(
    table_name: str,
    limit: int = 50,
    page: int = 1,
    search: str = None,
    date_from: str = None,
    date_to: str = None,
    sort_col: str = None,
    sort_dir: str = "asc",
    export: bool = False,
    db: Session = Depends(get_db)
):
    """Return rows from a table or file with optional search, date filter, sort, and CSV export."""
    from sqlalchemy import text
    from fastapi.responses import Response
    import pandas as pd
    import json

    DATE_COLS = {"fecha", "date", "month"}

    def apply_df_filters(df: "pd.DataFrame", search: str, date_from: str, date_to: str, sort_col: str, sort_dir: str) -> "pd.DataFrame":
        if search:
            mask = df.astype(str).apply(lambda x: x.str.contains(search, case=False, na=False)).any(axis=1)
            df = df[mask]
        date_col = next((c for c in df.columns if c in DATE_COLS), None)
        if date_col:
            col_vals = df[date_col].astype(str)
            sample = col_vals.dropna().iloc[0] if len(col_vals.dropna()) > 0 else ""
            nodash = "-" not in sample and len(sample) == 8  # YYYYMMDD format
            def norm_filter(f: str, end: bool = False) -> str:
                """Convert YYYY-MM filter to format matching the column."""
                if nodash:
                    # YYYY-MM → YYYYMM01 (start) or YYYYMM31 (end)
                    f_clean = f.replace("-", "")
                    return f_clean + ("31" if end else "01")
                return f
            df[date_col] = col_vals
            if date_from:
                df = df[df[date_col] >= norm_filter(date_from)]
            if date_to:
                df = df[df[date_col] <= norm_filter(date_to, end=True)]
        if sort_col and sort_col in df.columns:
            try:
                df = df.sort_values(sort_col, ascending=(sort_dir == "asc"), na_position="last")
            except Exception:
                pass
        return df

    try:
        allowed_tables = [
            "manual_inputs", "download_log", "mendeley_observations",
            "semar_observations", "satellite_observations", "climatology_observations",
            "daily_sir_summaries", "model_features", "model_predictions", "beach_risk_profiles"
        ]
        allowed_csvs = [
            "forecast_7d_trayectorias.csv", "features_fuente.csv", "features_growth.csv",
            "features_prediccion_cm.csv", "features_semaforo.csv", "residuos_estocasticos.csv",
            "noaa_sir_resumen_diario.csv", "sargazo_combinado_2000_2026.csv", "satsum_caribe_mensual.csv",
            "sst_cozumel_mensual.csv", "viento_cozumel_mensual.csv", "boletines_sargazo_MASTER.csv",
            "satsum_zee_mex_mensual.csv", "lagrangian_fbm_finales.csv", "lagrangian_fbm_trayectorias.csv",
            "sargazo_correlaciones_lag.csv"
        ]
        allowed_jsons = [
            "risk_by_beach.json", "noaa_sir_composite_7d.geojson",
            "noaa_sir_riesgo_costero_qroo_reduced.geojson", "noaa_sir_riesgo_ml_corregido.geojson"
        ]

        offset = (page - 1) * limit

        if table_name in allowed_tables:
            cols_res = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            cols = [c[1] for c in cols_res]

            where_clauses = []
            query_params: dict = {}
            if search:
                search_terms = [f"CAST({col} AS TEXT) LIKE :search_val" for col in cols]
                where_clauses.append("(" + " OR ".join(search_terms) + ")")
                query_params["search_val"] = f"%{search}%"
            date_col = next((c for c in cols if c in DATE_COLS), None)
            if date_col and date_from:
                where_clauses.append(f"CAST({date_col} AS TEXT) >= :date_from")
                query_params["date_from"] = date_from
            if date_col and date_to:
                where_clauses.append(f"CAST({date_col} AS TEXT) <= :date_to")
                query_params["date_to"] = date_to
            where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
            order_sql = ""
            if sort_col and sort_col in cols:
                direction = "ASC" if sort_dir == "asc" else "DESC"
                order_sql = f" ORDER BY CAST({sort_col} AS TEXT) {direction}"

            count_res = db.execute(text(f"SELECT COUNT(*) FROM {table_name}{where_sql}"), query_params).fetchone()
            total_count = count_res[0] if count_res else 0

            if export:
                all_rows = db.execute(text(f"SELECT * FROM {table_name}{where_sql}{order_sql}"), query_params).fetchall()
                import csv as _csv, io
                buf = io.StringIO()
                writer = _csv.writer(buf)
                writer.writerow(cols)
                for r in all_rows:
                    writer.writerow([r[i] for i in range(len(cols))])
                return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{table_name}.csv"'})

            rows_res = db.execute(
                text(f"SELECT * FROM {table_name}{where_sql}{order_sql} LIMIT :limit OFFSET :offset"),
                {**query_params, "limit": limit, "offset": offset}
            ).fetchall()
            result = []
            for r in rows_res:
                row_dict = {}
                for col_idx, col_name in enumerate(cols):
                    val = r[col_idx]
                    row_dict[col_name] = val.hex() if isinstance(val, bytes) else val
                result.append(row_dict)
            return {"columns": cols, "rows": result, "total_count": total_count, "page": page, "limit": limit}

        elif table_name in allowed_csvs:
            csv_path = ROOT / table_name
            if not csv_path.exists():
                raise HTTPException(status_code=404, detail="Archivo CSV no encontrado")
            df = pd.read_csv(csv_path)
            df = df.astype(object).where(pd.notnull(df), None)
            df = apply_df_filters(df, search, date_from, date_to, sort_col, sort_dir)
            cols = list(df.columns)
            if export:
                return Response(content=df.to_csv(index=False), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{table_name}"'})
            total_count = len(df)
            result = df.iloc[offset:offset+limit].to_dict(orient="records")
            return {"columns": cols, "rows": result, "total_count": total_count, "page": page, "limit": limit}

        elif table_name in allowed_jsons:
            json_path = ROOT / table_name
            if not json_path.exists():
                raise HTTPException(status_code=404, detail="Archivo JSON no encontrado")
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            rows = []
            if table_name == "risk_by_beach.json":
                for seg in data.get("segmentos", []):
                    row = dict(seg)
                    if "risk_levels_pct" in row and isinstance(row["risk_levels_pct"], dict):
                        pcts = row.pop("risk_levels_pct")
                        for k, v in pcts.items():
                            row[f"pct_{k}"] = v
                    rows.append(row)
            else:
                for feat in data.get("features", []):
                    row = dict(feat.get("properties", {}))
                    geom = feat.get("geometry", {})
                    if geom:
                        row["geometry_type"] = geom.get("type", "")
                        coords = geom.get("coordinates", [])
                        row["coords_count"] = len(coords) if isinstance(coords, list) else 0
                    rows.append(row)
            if not rows:
                return {"columns": [], "rows": [], "total_count": 0, "page": page, "limit": limit}
            df = pd.DataFrame(rows).astype(object).where(pd.notnull(pd.DataFrame(rows)), None)
            df = apply_df_filters(df, search, date_from, date_to, sort_col, sort_dir)
            cols = list(df.columns)
            if export:
                return Response(content=df.to_csv(index=False), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{table_name}.csv"'})
            total_count = len(df)
            result = df.iloc[offset:offset+limit].to_dict(orient="records")
            return {"columns": cols, "rows": result, "total_count": total_count, "page": page, "limit": limit}

        else:
            raise HTTPException(status_code=400, detail="Nombre de tabla o dataset no permitido")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al consultar tabla: {str(e)}")


@router.get("/file/{file_group}/{filename}")
def download_file(file_group: str, filename: str):
    """Download a specific file from the catalog."""
    import os
    # Secure filename to prevent directory traversal
    filename = os.path.basename(filename)

    if file_group == "noaa":
        fp = ROOT / "noaa_sir_kmz" / filename
    elif file_group == "semar":
        fp = None
        for yr in ["2024", "2025", "2026"]:
            temp_fp = ROOT / f"boletines_{yr}" / filename
            if temp_fp.exists():
                fp = temp_fp
                break
        if not fp:
            raise HTTPException(status_code=404, detail="Archivo SEMAR no encontrado")
    elif file_group == "output":
        fp = ROOT / filename
    else:
        raise HTTPException(status_code=400, detail="Grupo de archivos no válido")

    if not fp or not fp.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    return FileResponse(path=str(fp), filename=filename)


@router.get("/noaa-kmz-list")
def list_noaa_kmz():
    """List all NOAA SIR KMZ filenames (date strings) available for the calendar."""
    base = ROOT / "noaa_sir_kmz"
    if not base.exists():
        return {"dates": []}
    dates = sorted(
        [f.name for f in base.glob("sargassum_risk_????????.kmz")],
        reverse=True
    )
    return {"files": dates}


@router.get("/boletin-list")
def list_boletines():
    """List all SEMAR bulletins that have been processed (have images/text extracted)."""
    base = ROOT / "boletines_imagenes"
    result: dict[str, list[dict]] = {}
    if not base.exists():
        return {"years": result}
    for yr_dir in sorted(base.iterdir()):
        if not yr_dir.is_dir():
            continue
        yr = yr_dir.name
        entries = []
        for num_dir in sorted(yr_dir.iterdir(), key=lambda p: int(p.name) if p.name.isdigit() else 0, reverse=True):
            if not num_dir.is_dir():
                continue
            has_img = (num_dir / "page_1.png").exists()
            has_txt = (num_dir / "texto_completo.txt").exists()
            entries.append({"num": num_dir.name, "has_image": has_img, "has_text": has_txt})
        result[yr] = entries
    return {"years": result}


@router.get("/boletin-images/{year}/{num_boletin}")
def list_boletin_images(year: str, num_boletin: str):
    """List all images available for a specific SEMAR bulletin."""
    import os
    year = os.path.basename(year)
    num_boletin = os.path.basename(num_boletin)
    
    dp = ROOT / "boletines_imagenes" / year / num_boletin
    if not dp.exists():
        return {"images": []}
        
    files = sorted(dp.glob("*.png"))
    return {
        "images": [f.name for f in files]
    }


@router.get("/boletin-image/{year}/{num_boletin}/{filename}")
def get_boletin_image(year: str, num_boletin: str, filename: str):
    """Serve an image extracted from a SEMAR bulletin."""
    import os
    year = os.path.basename(year)
    num_boletin = os.path.basename(num_boletin)
    filename = os.path.basename(filename)
    
    fp = ROOT / "boletines_imagenes" / year / num_boletin / filename
    if not fp.exists():
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
        
    return FileResponse(path=str(fp), filename=filename)


@router.get("/boletin-text/{year}/{num_boletin}")
def get_boletin_text(year: str, num_boletin: str):
    """Retrieve extracted full text from a SEMAR bulletin."""
    import os
    year = os.path.basename(year)
    num_boletin = os.path.basename(num_boletin)
    
    fp = ROOT / "boletines_imagenes" / year / num_boletin / "texto_completo.txt"
    if not fp.exists():
        return {"text": ""}
        
    with open(fp, "r", encoding="utf-8") as f:
        text = f.read()
    return {"text": text}


@router.get("/boletin-tables/{year}/{num_boletin}")
def get_boletin_tables(year: str, num_boletin: str):
    """Retrieve extracted tables from a SEMAR bulletin."""
    import os
    import json
    year = os.path.basename(year)
    num_boletin = os.path.basename(num_boletin)
    
    fp = ROOT / "boletines_imagenes" / year / num_boletin / "tablas.json"
    if not fp.exists():
        return {"tables": {}}
        
    try:
        with open(fp, "r", encoding="utf-8") as f:
            tables = json.load(f)
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer tablas: {e}")


@router.get("/boletin-dates")
def get_boletin_dates():
    """Map bulletin number → date + semáforo from the master CSV."""
    import csv as _csv
    fp = ROOT / "boletines_sargazo_MASTER.csv"
    if not fp.exists():
        return {"records": []}
    records = []
    with open(fp, newline="", encoding="utf-8") as f:
        reader = _csv.DictReader(f)
        for row in reader:
            num = str(row.get("num_boletin", "")).strip()
            if not num:
                continue
            records.append({
                "num": num,
                "fecha": str(row.get("fecha", "")).strip(),
                "semaforo": str(row.get("semaforo", "")).strip(),
                "aco_mt": str(row.get("biomasa_caribe_oriental_ton", "")).strip(),
                "cm_mt": str(row.get("biomasa_caribe_mexicano_ton", "")).strip(),
            })
    return {"records": records}


@router.get("/noaa-daily-risk")
def get_noaa_daily_risk():
    """Daily NOAA SIR risk segment counts from noaa_sir_resumen_diario.csv."""
    import csv as _csv
    fp = ROOT / "noaa_sir_resumen_diario.csv"
    if not fp.exists():
        return {"records": []}
    records = []
    with open(fp, newline="", encoding="utf-8") as f:
        reader = _csv.DictReader(f)
        for row in reader:
            date_raw = str(row.get("date", "")).strip()
            if not date_raw:
                continue
            date_key = date_raw.replace("-", "")  # normalize to YYYYMMDD
            records.append({
                "date": date_key,
                "total": int(row.get("total_segments", 0) or 0),
                "high": int(row.get("count_high", 0) or 0),
                "medium": int(row.get("count_medium", 0) or 0),
                "warning": int(row.get("count_warning", 0) or 0),
                "low": int(row.get("count_low", 0) or 0),
            })
    return {"records": records}
