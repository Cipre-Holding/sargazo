import os
import sys
import unittest
import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.database import SessionLocal, init_db, engine
from backend.models import (
    Base, MendeleyObservation, SEMARObservation, SatelliteObservation,
    ClimatologyObservation, ModelFeature, ModelPrediction, ManualInput
)
from backend.routers.predictions import get_predictions
from backend.routers.observations import get_semar, get_satsum_caribe, get_satsum_zee


class TestDatabasePipeline(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # We run the tests on the actual database but inside a transaction
        # or we just initialize to make sure all tables exist
        init_db()
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_1_database_seeded(self):
        """Verifica que la base de datos se haya poblado correctamente con datos históricos."""
        mendeley_count = self.db.query(MendeleyObservation).count()
        semar_count = self.db.query(SEMARObservation).count()
        sat_count = self.db.query(SatelliteObservation).count()
        clim_count = self.db.query(ClimatologyObservation).count()
        
        print(f"\n  [TEST] Registros en base de datos:")
        print(f"    Mendeley: {mendeley_count}")
        print(f"    SEMAR: {semar_count}")
        print(f"    Satélite (SATsum): {sat_count}")
        print(f"    Climatología (SST/Vientos): {clim_count}")
        
        self.assertGreater(mendeley_count, 0, "La tabla de Mendeley debería tener registros.")
        self.assertGreater(semar_count, 0, "La tabla de SEMAR debería tener registros.")
        self.assertGreater(sat_count, 0, "La tabla de Satélites debería tener registros.")
        self.assertGreater(clim_count, 0, "La tabla de Climatología debería tener registros.")

    def test_2_manual_input_processing(self):
        """Prueba la inserción de un reporte manual y su posterior fusión en la tabla semar_observations."""
        # 1. Crear un ManualInput pendiente
        test_fecha = "2026-05-15"
        
        # Eliminar si ya existe para consistencia de pruebas repetidas
        self.db.query(ManualInput).filter(ManualInput.fecha == test_fecha).delete()
        self.db.query(SEMARObservation).filter(SEMARObservation.fecha == test_fecha).delete()
        self.db.commit()
        
        m_input = ManualInput(
            fecha=test_fecha,
            cm_ton=777.0,
            aco_mt=0.5,
            cc_ton=222.0,
            co_ton=333.0,
            semaforo="MUY BAJO",
            conglomerado_cozumel="NO",
            processed=False
        )
        self.db.add(m_input)
        self.db.commit()
        
        # Verificar que esté pendiente
        pending = self.db.query(ManualInput).filter(ManualInput.fecha == test_fecha, ManualInput.processed == False).first()
        self.assertIsNotNone(pending)
        
        # 2. Ejecutar el procesador de entradas manuales importado de combine_datasets
        from combine_datasets import process_manual_inputs
        process_manual_inputs(self.db)
        
        # 3. Verificar que se haya insertado en SEMARObservation
        obs = self.db.query(SEMARObservation).filter(SEMARObservation.fecha == test_fecha).first()
        self.assertIsNotNone(obs)
        self.assertEqual(obs.biomasa_caribe_mexicano_ton, 777.0)
        self.assertEqual(obs.semaforo, "MUY BAJO")
        self.assertEqual(obs.conglomerado_cozumel, "NO")
        
        # 4. Verificar que se haya marcado como procesado
        self.db.refresh(pending)
        self.assertTrue(pending.processed)
        
        # Limpieza
        self.db.query(ManualInput).filter(ManualInput.fecha == test_fecha).delete()
        self.db.query(SEMARObservation).filter(SEMARObservation.fecha == test_fecha).delete()
        self.db.commit()

    def test_3_feature_generation_and_persistence(self):
        """Verifica que se generen y persistan características correctas en la base de datos."""
        # Ejecutar prepare_features para regenerar características y guardarlas en SQLite
        from prepare_features import main as prepare_main
        try:
            prepare_main()
        except Exception as e:
            self.fail(f"La preparación de características falló con el error: {e}")
            
        # Comprobar que existan en la base de datos
        feat_count = self.db.query(ModelFeature).count()
        self.assertGreater(feat_count, 0, "Debería haber características generadas guardadas en model_features.")
        
        # Verificar un tipo específico
        cm_feats = self.db.query(ModelFeature).filter(ModelFeature.dataset_type == "prediccion_cm").all()
        self.assertGreater(len(cm_feats), 0)
        
        # Validar formato JSON
        sample_json = json.loads(cm_feats[0].feature_json)
        self.assertIn("month", sample_json)
        self.assertIn("log_cm", sample_json)
        self.assertIn("log_aco_lag1", sample_json)

    def test_4_prediction_persistence_and_endpoints(self):
        """Verifica que modelos guarden predicciones en SQLite y que los endpoints del API las consuman."""
        # 1. Asegurar que haya predicciones en la base de datos (corriendo modelos_fase0)
        from modelos_fase0 import main as models_main
        try:
            models_main()
        except Exception as e:
            self.fail(f"La corrida de modelos_fase0 falló con el error: {e}")
            
        pred_count = self.db.query(ModelPrediction).count()
        self.assertGreater(pred_count, 0, "Debería haber predicciones de modelos guardadas en model_predictions.")
        
        # 2. Probar llamado directo al endpoint de predicciones para verificar que retorne los datos de la base de datos
        response = get_predictions(self.db)
        self.assertIn("predicciones_fase0", response)
        self.assertIn("0.1_regresion_lineal", response["predicciones_fase0"])
        self.assertIn("prediccion_junio", response["predicciones_fase0"]["0.1_regresion_lineal"])


if __name__ == "__main__":
    unittest.main()
