# Correcciones al Análisis de Correlaciones — Mayo 2026

## Problema detectado

Al reejecutar el análisis de correlaciones con el dataset expandido (23 meses SEMAR, todos con `aligned_CM`), se encontraron dos errores que invalidaban los resultados anteriores del `sargazo_correlaciones_lag.csv`.

---

## Error 1 — Mezcla de fuentes incompatibles en la correlación ACO→CM

### Qué pasaba

El CSV `sargazo_correlaciones_lag.csv` original calculaba la correlación `ACO→CM` usando **todas las filas** del dataset combinado (311 filas: 288 Mendeley + 23 SEMAR). El problema es que `aligned_CM` y `aligned_ACO` significan cosas geográficamente distintas según la fuente:

| Fuente | `aligned_CM` | `aligned_ACO` |
|---|---|---|
| Mendeley (288 filas) | `Mend_NWGoM_Mt` — Golfo de México noroccidental | `Mend_GASB_Mt` — Cinturón Atlántico |
| SEMAR (23 filas) | Biomasa costera Caribe Mexicano (Cozumel) | Biomasa Atlántico Caribe Oceánico |

**El Golfo de México noroccidental no es el Caribe Mexicano.** Son corrientes distintas — el sargaso que entra al Golfo sigue una trayectoria diferente al que arriba a Cozumel.

### Consecuencia

Con 288 filas Mendeley dominando la muestra, la correlación "ACO→CM" reflejaba la relación `GASB→NWGoM`, que resultó ser **ligeramente negativa** (r ≈ −0.14 a lag-1). La correlación operativa SEMAR quedaba diluida e invertida.

```
Resultado erróneo (mezcla):     ACO→CM lag-1, n=285, r = −0.116
Resultado correcto (SEMAR):     ACO→CM lag-1, n=14,  r = +0.890
```

### Corrección

El `sargazo_correlaciones_lag.csv` fue reconstruido **separando fuentes**:

- Sección `dataset=SEMAR`: pares consecutivos mes a mes (máx ±45 días por lag), solo filas SEMAR
- Sección `dataset=Mendeley`: pares Mendeley-a-Mendeley para series largas (GASB, ACR, NWGoM, NSS, SSS)

---

## Error 2 — Inflación del r=0.950 por muestra pequeña (n=9)

### Qué pasaba

La correlación Spearman `log(ACO_lag1)→log(CM)` r=0.950 se calculó cuando el dataset solo tenía **9 pares válidos** (los meses ago2025–abr2026 donde coincidían ACO y CM en SEMAR). Era estadísticamente significativo pero el tamaño de muestra pequeño hacía que el estimado fuera poco estable.

### Corrección

Con el dataset completo de 23 meses SEMAR (todos con `aligned_CM` y `aligned_ACO` disponibles desde mar2025), ahora hay **14 pares consecutivos**. El resultado actualizado:

```
r(n=9)  = 0.950  ← estimado anterior (muestra pequeña)
r(n=14) = 0.890  ← estimado actualizado (más estable)
```

La correlación bajó levemente pero sigue siendo muy sólida. El valor r=0.950 era real para esos 9 meses; simplemente la muestra más grande produce un estimado más conservador.

---

## Estado final de correlaciones SEMAR (tabla corregida)

Todos los valores usan **pares de meses consecutivos** (gap máx 45 días por lag), fuente SEMAR exclusivamente.

| Predictor | lag | n | Spearman r | p | Uso operativo |
|---|---|---|---|---|---|
| **ACO → CM** | 1 mes | 14 | **0.8901** | 0.00002 | Predictor principal del sistema de alerta |
| CO → CM | 0 (contemporáneo) | 15 | 0.8321 | 0.0001 | Confirmación en tiempo real |
| ACO → CO | 1 mes | 14 | 0.8593 | 0.0001 | Propagación de señal ACO hacia costa |
| **ACO → CM** | 2 meses | 13 | **0.7253** | 0.005 | Predicción de mediano plazo |
| ACO → CO | 2 meses | 13 | 0.8132 | 0.001 | Útil para planificación a 8 semanas |
| CO → CM | 1 mes | 14 | 0.6571 | 0.011 | Predictor secundario |
| ACO → CM | 3 meses | 12 | 0.336 | 0.286 | **No significativo — límite del horizonte** |
| ACO → CO | 3 meses | 12 | 0.629 | 0.028 | Marginal |

**Conclusión operativa**: la ventana de predicción útil es **1-2 meses**. A lag-3 la señal ACO ya no predice CM con significancia.

---

## Correlaciones Mendeley (contexto GASB largo plazo)

Usadas para monitoreo del stock atlántico (2000–2024), no para predicción costera directa.

| Predictor | lag | n | Spearman r | p | Nota |
|---|---|---|---|---|---|
| GASB → ACR | 0–3 meses | 285–288 | 0.64–0.66 | <0.001 | Correlación estable sin dirección clara |
| GASB → SSS | 3 meses | 278 | 0.43 | <0.001 | South Sargasso Sea sigue a GASB con delay |
| GASB → NWGoM | 1 mes | 270 | −0.14 | 0.025 | Negativo — corrientes divergentes |
| GASB → NSS | 1–3 meses | ~284 | 0.09–0.16 | 0.02–0.12 | Muy débil, North Sargasso |

El par `GASB→NWGoM` negativo confirma que el Golfo de México no comparte dinámica con el Caribe Mexicano en la escala mensual. Esto validada por separado la necesidad de usar datos SEMAR (no Mendeley) para predicción en Cozumel.

---

## Archivos actualizados

| Archivo | Cambio |
|---|---|
| `sargazo_correlaciones_lag.csv` | Reconstruido: separado por `dataset` (SEMAR / Mendeley), pares consecutivos con check de brecha temporal |
| `analisis_estocastico.md` | r=0.950 → r=0.890 (n=14); añadida nota de incompatibilidad geográfica Mendeley |
| `memory/analisis_estocastico.md` | Tabla de predictores corregida; nota crítica sobre NWGoM ≠ CM |

---

## Datasets no modificados

Los datasets de features operativos **no requirieron cambios** porque ya usaban únicamente datos SEMAR:

- `features_prediccion_cm.csv` — 23 filas SEMAR, target `log_cm` válido en todos
- `features_semaforo.csv` — 23 filas SEMAR, semáforo_ord válido en 21
- `features_fuente.csv` — 303 filas Mendeley, `aligned_ACO`/`aligned_CM` como proxy de largo plazo (GASB/NWGoM), **no para predicción CM**
- `residuos_estocasticos.csv` — 288 filas Mendeley, residuos OU sobre GASB

La separación correcta es: `features_fuente.csv` y `residuos_estocasticos.csv` modelan la **dinámica GASB** (stock atlántico); `features_prediccion_cm.csv` y `features_semaforo.csv` modelan la **llegada a costa** (Caribe Mexicano operativo).
