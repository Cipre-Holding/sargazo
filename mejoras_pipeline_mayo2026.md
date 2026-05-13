# Mejoras al Pipeline de Datos — Mayo 2026

Cuatro correcciones aplicadas a `combine_datasets.py` y `prepare_features.py` después de identificar problemas de calidad en los datasets de features. Todas las mejoras se reconstruyeron en cascada: MASTER → combinado mensual → 4 CSVs de features.

---

## Mejora A — Lags ACO calculados solo con datos SEMAR

### Problema

`prepare_features.py` calculaba `log_aco_lag1/lag2/lag3` desplazando la columna `log_biomasa` de `features_fuente.csv`. Esa columna mezcla `Mend_GASB_Mt` (para meses ≤2024) con `SEMAR_ACO_Mt` (para meses ≥2024).

Para filas SEMAR (2024–2026), el lag-1 llegaba de un mes Mendeley donde `log_aco_lag1` era en realidad `log(GASB_Atlántico)`:

```
2024-03: log_aco_lag1 = log(6.85 Mt)  ← GASB Atlántico Norte
         log_cm       = log(0.0006 Mt) ← Caribe Mexicano Cozumel
```

El GASB (cinturón atlántico abierto, ~7–30 Mt) tiene una escala completamente distinta al ACO costero SEMAR (~0.05–0.7 Mt). La correlación resultante en `features_prediccion_cm.csv` era r=0.47.

### Corrección — `prepare_features.py` líneas 134–138 y 179–184

```python
# Antes: lags desde la serie combinada Mendeley+SEMAR
semar["log_aco_lag1"] = fuente_df["log_biomasa"].shift(1)

# Después: lags calculados únicamente sobre el índice SEMAR
semar_aco = semar.dropna(subset=["log_aco"]).set_index("month")["log_aco"]
for lag in [1, 2, 3]:
    semar[f"log_aco_lag{lag}"] = semar["month"].map(
        lambda m, l=lag: _get_lag(semar_aco, m, l)
    )
```

`_get_lag` busca el mes `m - l` exactamente en el índice SEMAR; si no existe (gap), devuelve `NaN`.

### Resultado

| Métrica | Antes | Después |
|---|---|---|
| Pares válidos en features_prediccion_cm.csv | 15 (con mezcla) | **14 (100% SEMAR)** |
| Pearson r (log_aco_lag1 → log_cm) | 0.47 | **0.918** |
| Spearman r | ~0.47 | **0.912** |

Los 14 pares coinciden exactamente con el análisis de referencia en `sargazo_correlaciones_lag.csv` (r=0.890 Spearman con pares consecutivos verificados).

---

## Mejora B — Mediana en lugar de media mensual

### Problema

La agregación mensual de biomasa diaria usaba `.mean()`. Las distribuciones diarias son fuertemente sesgadas: unos pocos días de pulso de sargazo elevan la media muy por encima del valor típico del mes.

```
Mes        | n días | Media    | Mediana  | Ratio
2025-12    |   29   |  390 ton |   45 ton | 8.7×
2024-06    |   25   | 4,477 ton| 1,198 ton | 3.7×
2025-11    |   28   |  138 ton |   34 ton | 4.1×
```

Un modelo entrenado con la media de diciembre 2025 (390 ton) interpretaría ese mes como "abundante", cuando el 50% de los días registró ≤45 ton.

### Corrección — `combine_datasets.py` línea 74

```python
# Antes
num_agg = df.groupby("month")[num_cols].mean()

# Después
num_agg = df.groupby("month")[num_cols].median()
```

### Resultado

Los valores mensuales ahora representan el día típico del mes, no el promedio distorsionado por pulsos. El ratio media/mediana colapsó de hasta 8.7× a 1.0× (por definición). Las corrientes y conteos de conglomerados también se agregaron por mediana, lo que es igualmente correcto para distribuciones asimétricas.

---

## Mejora C — Umbral de detección de saltos |z| > 1.5

### Problema

`build_residuos_estocasticos()` marcaba `es_salto = 1` cuando `|z_score| > 2.0`. Con 288 meses de GASB y una distribución log-normal con kurtosis = 7.78, el umbral z=2 capturaba solo los eventos más extremos. El resultado era **0 saltos detectados** en 288 meses — incluso el mega-bloom de 2024 (z=2.44 en escala raw) quedaba en z=1.46 en escala log, debajo del umbral.

### Corrección — `prepare_features.py` línea 113

```python
# Antes
out["es_salto"] = (out["z_score"].abs() > 2.0).astype(int)

# Después
out["es_salto"] = (out["z_score"].abs() > 1.5).astype(int)
```

### Resultado

**11 eventos de salto** detectados en 288 meses (3.8% de la serie):

```
2004-08  2004-10  2006-01  2006-03  2007-05
2009-07  2018-02  2018-03  2018-11  2023-03  2023-12
```

Estos corresponden a picos documentados en la literatura (bloom 2018, escalada 2023). El mega-bloom de 2024 tiene z=1.46 en log-escala — justo en el límite, coherente con que la transformación logarítmica comprime la magnitud del evento. El campo `es_salto` ahora es útil como feature para modelos ARFIMA y como indicador en análisis exploratorio.

---

## Mejora D — Winsorización al P99 antes de agregar

### Problema

El dataset MASTER diario contenía 3 valores de biomasa CM extremadamente altos:

```
82,699 ton  (1 día)
79,571 ton  (1 día)
78,978 ton  (1 día)
```

Aunque ya se usa mediana (que es robusta a outliers), en meses con pocas lecturas (ej. solo 3–5 días de datos) un único outlier puede contaminar la mediana. La winsorización es la segunda línea de defensa.

### Corrección — `combine_datasets.py` líneas 66–70

```python
# Winsorizar biomasa diaria al P99 antes de agregar
bio_cols = list(SEMAR_COLS.keys())
for c in bio_cols:
    p99 = df[c].quantile(0.99)
    df[c] = df[c].clip(upper=p99)
```

### Resultado

| Métrica | Valor |
|---|---|
| Umbral P99 | **74,342 ton** |
| Valores capados | **3 de 533** (0.56%) |
| Valores afectados | 82,699 → 74,342; 79,571 → 74,342; 78,978 → 74,342 |

Los tres valores eran claramente aberrantes (ratio ~10× respecto al P95). El P99 preserva todos los eventos legítimos de alta biomasa. Se aplica solo a columnas de biomasa — corrientes y vientos no se winsoriza.

---

## Estado de los datasets después de las 4 mejoras

| Dataset | Filas | Cambio principal |
|---|---|---|
| `sargazo_combinado_2000_2026.csv` | 311 | Valores mensuales por mediana; 3 outliers capados al P99 |
| `features_prediccion_cm.csv` | 23 (14 con log_aco_lag1) | Lags ACO 100% SEMAR; r 0.47 → 0.918 |
| `features_semaforo.csv` | 23 (21 con semáforo_ord) | Lags ACO 100% SEMAR |
| `residuos_estocasticos.csv` | 288 | 11 saltos detectados (era 0) |
| `features_fuente.csv` | 303 | Sin cambios (usa Mendeley GASB; z-score y lags internamente consistentes) |

---

## Dependencias entre mejoras

```
MASTER.csv (diario)
    │
    ├─ D (winsorizar P99)   → protege la capa de agregación
    │
    ▼
combine_datasets.py
    │
    ├─ B (mediana)          → mensual robusto a pulsos extremos
    │
    ▼
sargazo_combinado_2000_2026.csv
    │
    ▼
prepare_features.py
    │
    ├─ A (lags SEMAR-only)  → elimina contaminación geográfica en features_prediccion_cm
    ├─ C (umbral |z|>1.5)   → activa detección de saltos en residuos_estocasticos
    │
    ▼
4 CSVs de features
```

D debe aplicarse antes que B; A y C son independientes entre sí pero requieren el combinado actualizado como entrada.
