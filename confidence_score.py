"""
Score de Confianza del Sistema Sargazo Cozumel.

Calcula un score de confianza global (0-100%) y lo guarda en predicciones y SQLite.
"""

import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, date, timedelta

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backend.database import SessionLocal
from backend.models import SEMARObservation, ModelPrediction


def calculate_confidence():
    """Calcula score de confianza 0-100%."""
    
    # 1. Antigüedad de datos (máx 30 puntos)
    try:
        db = SessionLocal()
        last_obs = db.query(SEMARObservation).order_by(SEMARObservation.fecha.desc()).first()
        last_cm_date = pd.to_datetime(last_obs.fecha).date() if last_obs else date.today() - timedelta(days=7)
        db.close()
    except Exception as db_err:
        print(f"Error loading SEMAR from DB for confidence: {db_err}")
        last_cm_date = date.today() - timedelta(days=7)

    days_ago = (date.today() - last_cm_date).days
    if days_ago <= 3:
        score_freshness = 30  # datos recientes
    elif days_ago <= 7:
        score_freshness = 25
    elif days_ago <= 14:
        score_freshness = 20
    elif days_ago <= 30:
        score_freshness = 15
    else:
        score_freshness = 5
    
    # Cargar predicciones del archivo JSON de fase 1
    pred_path = ROOT / "predicciones_fase1.json"
    try:
        with open(pred_path) as f:
            pred = json.load(f)
    except Exception:
        pred = {}

    # 2. Pares ACO+CM (máx 20 puntos)
    if 'backtest' in pred:
        n_backtest = len(pred['backtest'])
        score_data = min(20, n_backtest * 5)  # 4 pares = 20pts
    else:
        score_data = 15
    
    # 3. Concordancia entre modelos (máx 20 puntos)
    predictions = []
    for key, model in pred.items():
        if isinstance(model, dict) and 'prediccion_junio' in model:
            if model.get("cm_reliable") is False:
                continue
            pred_val = model['prediccion_junio'].get('cm_mt', 0)
            if pred_val > 0 and pred_val < 0.5:
                predictions.append(pred_val)
    
    if len(predictions) >= 3:
        cv = np.std(predictions) / np.mean(predictions) if np.mean(predictions) > 0 else 1
        if cv < 0.3:
            score_concord = 20  # alta concordancia
        elif cv < 0.5:
            score_concord = 15
        elif cv < 1.0:
            score_concord = 10
        else:
            score_concord = 5
    else:
        score_concord = 10
    
    # 4. Error histórico (máx 20 puntos)
    if 'ensemble' in pred and isinstance(pred['ensemble'], dict):
        if 'backtest' in pred:
            r2_values = [m.get('R²', 0) for m in pred['backtest'] if m.get('Modelo') != '0.2_delta']
            if r2_values:
                avg_r2 = np.mean(r2_values)
                score_history = min(20, max(0, int(avg_r2 * 25)))
            else:
                score_history = 10
        else:
            score_history = 10
    else:
        score_history = 10
    
    # 5. Temporada (máx 10 puntos)
    current_month = datetime.now().month
    if 5 <= current_month <= 10:
        score_season = 10  # temporada de sargazo
    elif 3 <= current_month <= 4 or 11 <= current_month <= 12:
        score_season = 7
    else:
        score_season = 5  # fuera de temporada
    
    total = score_freshness + score_data + score_concord + score_history + score_season
    
    breakdown = {
        "freshness": {"puntos": score_freshness, "max": 30, "label": "Actualidad datos"},
        "data_quality": {"puntos": score_data, "max": 20, "label": "Cantidad pares ACO+CM"},
        "concordance": {"puntos": score_concord, "max": 20, "label": "Concordancia modelos"},
        "history": {"puntos": score_history, "max": 20, "label": "Precisión histórica"},
        "season": {"puntos": score_season, "max": 10, "label": "Ventana temporal"},
    }
    
    result = {
        "score": total,
        "max": 100,
        "porcentaje": round(total, 0),
        "nivel": "ALTA" if total >= 70 else "MEDIA" if total >= 50 else "BAJA",
        "desglose": breakdown,
    }

    # Guardar en predicciones_fase1.json
    try:
        if "ensemble" in pred and isinstance(pred["ensemble"], dict):
            pred["ensemble"]["confidence_score"] = result
        else:
            pred["confidence_score"] = result
        pred.setdefault("metadata", {})["confidence_generated"] = datetime.now().isoformat()
        with open(pred_path, "w") as f:
            json.dump(pred, f, indent=2)
        print(f"  ✅ Score guardado en {pred_path.name}")
    except Exception as e:
        print(f"  ⚠️ No se pudo guardar confidence score en JSON: {e}")

    # Guardar en base de datos SQLite
    try:
        db = SessionLocal()
        ensemble_pred = db.query(ModelPrediction).filter(
            ModelPrediction.model_name == "ensemble"
        ).order_by(ModelPrediction.id.desc()).first()
        if ensemble_pred:
            pred_json_dict = json.loads(ensemble_pred.prediction_json)
            pred_json_dict["confidence_score"] = result
            ensemble_pred.prediction_json = json.dumps(pred_json_dict, default=str)
            db.commit()
            print("  ✅ Ensemble confidence score actualizado en SQLite.")
        db.close()
    except Exception as db_err:
        print(f"  ⚠️ No se pudo actualizar confidence score en SQLite: {db_err}")

    return result


if __name__ == "__main__":
    confidence = calculate_confidence()
    
    print("=" * 60)
    print("SCORE DE CONFIANZA DEL SISTEMA")
    print("=" * 60)
    print(f"\nScore total: {confidence['score']}/{confidence['max']} ({confidence['porcentaje']:.0f}%)")
    print(f"Nivel: {confidence['nivel']}")
    print(f"\nDesglose:")
    for key, val in confidence['desglose'].items():
        bar = "█" * (val['puntos'] // 2) + "░" * ((val['max'] - val['puntos']) // 2)
        print(f"  {val['label']:25s}: {bar} {val['puntos']}/{val['max']}")
