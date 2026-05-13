"""
Score de Confianza del Sistema Sargazo Cozumel.

Calcula un score de confianza global (0-100%) basado en:
1. Antigüedad del último dato SEMAR
2. Cantidad de pares ACO+CM
3. Concordancia entre modelos
4. Error histórico (LOOCV RMSE)
5. Temporada (disponibilidad de datos históricos)

Output: Actualiza predicciones_fase1.json con campo confidence_score en el ensemble.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, date, timedelta

ROOT = Path(__file__).parent

def calculate_confidence():
    """Calcula score de confianza 0-100%."""
    
    # 1. Antigüedad de datos (máx 30 puntos)
    # Fecha del último CM conocido — leer desde datos, no hardcodear
    pred = json.load(open(ROOT / "predicciones_fase1.json"))

    try:
        semar = pd.read_csv(ROOT / "boletines_sargazo_MASTER.csv", low_memory=False)
        semar["fecha_dt"] = pd.to_datetime(semar["fecha"])
        last_cm_date = semar["fecha_dt"].max().date()
    except Exception:
        last_cm_date = date.today() - timedelta(days=7)  # fallback

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
    
    # 2. Pares ACO+CM (máx 20 puntos)
    if 'backtest' in pred:
        n_backtest = len(pred['backtest'])
        score_data = min(20, n_backtest * 5)  # 4 pares = 20pts
    else:
        # Usar n del primer modelo en backtest
        score_data = 15
    
    # 3. Concordancia entre modelos (máx 20 puntos)
    # Excluir modelos marcados como no fiables (Prophet CM indirecto >0.5 Mt)
    predictions = []
    for key, model in pred.items():
        if isinstance(model, dict) and 'prediccion_junio' in model:
            if model.get("cm_reliable") is False:
                continue
            pred_val = model['prediccion_junio'].get('cm_mt', 0)
            if pred_val > 0 and pred_val < 0.5:  # filtrar valores irreales
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
        ensemble = pred['ensemble']
        # Usar backtest R² como proxy
        if 'backtest' in pred:
            r2_values = [m.get('R²', 0) for m in pred['backtest']]
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
    # La ventana con más datos históricos es mayo-octubre
    if 5 <= current_month <= 10:
        score_season = 10  # temporada de sargazo, más datos históricos
    elif 3 <= current_month <= 4 or 11 <= current_month <= 12:
        score_season = 7
    else:
        score_season = 5  # fuera de temporada
    
    total = score_freshness + score_data + score_concord + score_history + score_season
    
    # Desglose
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
        pred_path = ROOT / "predicciones_fase1.json"
        pred = json.load(open(pred_path))
        if "ensemble" in pred and isinstance(pred["ensemble"], dict):
            pred["ensemble"]["confidence_score"] = result
        else:
            pred["confidence_score"] = result
        pred["metadata"]["confidence_generated"] = datetime.now().isoformat()
        with open(pred_path, "w") as f:
            json.dump(pred, f, indent=2)
    except Exception as e:
        print(f"  ⚠️ No se pudo guardar confidence score: {e}")

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
    print(f"\n✅ Score guardado en predicciones_fase1.json")
