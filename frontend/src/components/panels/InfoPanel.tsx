import { useState } from "react"
import { X, Waves, Info, Database, Sigma, HelpCircle, ChevronRight } from "lucide-react"

type InfoTab = "features" | "data" | "math" | "explain"

interface InfoPanelProps {
  onClose: () => void
}

const TABS: { id: InfoTab; Icon: any; label: string }[] = [
  { id: "features", Icon: Info,        label: "Funcionalidades" },
  { id: "data",     Icon: Database,    label: "Datos y Variables" },
  { id: "math",     Icon: Sigma,       label: "Modelos Matemáticos" },
  { id: "explain",  Icon: HelpCircle,  label: "Conceptos Clave" },
]

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <Icon className="size-4 shrink-0 text-accent" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-accent">
        {title}
      </h3>
    </div>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/30 bg-surface-raised/30 p-4 mb-3.5 shadow-lg shadow-black/10 ${className}`}>
      {children}
    </div>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mr-1.5 mb-1 ${
      !color ? "bg-accent-soft text-accent border border-accent/20" : "border"
    }`}
      style={color ? {
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
        borderColor: `color-mix(in oklch, ${color} 20%, transparent)`,
        color: color,
      } : undefined}>
      {children}
    </span>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/20 last:border-0 text-sm">
      <span className="text-muted pr-2">{label}</span>
      <span className="text-fg/90 font-mono text-right max-w-[60%] shrink-0">{value}</span>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm text-fg/85 leading-relaxed mb-2 flex gap-2">
      <span className="text-accent mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

export function InfoPanel({ onClose }: InfoPanelProps) {
  const [tab, setTab] = useState<InfoTab>("features")

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/70 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border/40 m-4 shadow-2xl shadow-black/60 bg-surface/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 sticky top-0 z-10 backdrop-blur-xl bg-surface/95">
          <div className="flex items-center gap-2.5">
            <Waves className="size-4 text-primary animate-pulse" />
            <h2 className="text-sm font-bold text-fg tracking-tight">Sargazo - monitoreo y predicción · Centro de Información</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl hover:bg-surface-raised transition-colors cursor-pointer text-muted hover:text-fg"
            title="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border/40 px-3 pt-2 gap-1.5">
          {TABS.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 pb-3 pt-2.5 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-150 cursor-pointer rounded-t-lg ${
                tab === id
                  ? "border-primary text-fg"
                  : "border-transparent text-muted hover:text-fg hover:border-border/50"
              }`}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ════════════════ FEATURES ════════════════ */}
          {tab === "features" && (
            <div className="space-y-1">

              <p className="text-sm text-muted mb-4 leading-relaxed">
                Este sistema integra modelos estadísticos, aprendizaje automático y simulación
                Lagrangiana para predecir el arribo de sargazo a las costas de Cozumel con
                1–14 días y hasta 1–2 meses de anticipación.
              </p>

              <SectionTitle icon={Info} title="Monitoreo satelital NOAA SIR" />
              <Card>
                <p className="text-sm text-fg/85 mb-2 leading-relaxed">
                  El <strong>Sargasso Information Report (SIR)</strong> de NOAA AOML proporciona
                  evaluación diaria del riesgo costero en el Caribe mexicano. Se procesan
                  <strong> 315 días históricos</strong> con interpolación Wendland C2 para estimar
                  riesgo en una malla de ~4 km alrededor de Cozumel, Isla Mujeres y Cancún.
                </p>
                <Tag color="var(--color-risk-high)">ALTO</Tag>
                <Tag color="var(--color-risk-medium)">MEDIO</Tag>
                <Tag color="var(--color-risk-warning)">WARN</Tag>
                <Tag color="var(--color-risk-low)">LOW</Tag>
              </Card>

              <SectionTitle icon={Info} title="Predicción Ensemble ML (mensual)" />
              <Card>
                <p className="text-sm text-fg/85 mb-2 leading-relaxed">
                  Combina 3 modelos (Ridge, Bayesian Ridge, Regresión Lineal) ponderados por su
                  R² de LOOCV. Incluye <strong>bias correction por tendencia</strong> (+25% si
                  la serie reciente sube, −15% si baja). La predicción actual para junio 2026 es
                  de <strong>52,571 ton</strong> de biomasa en Caribe Mexicano (CM).
                </p>
                <Tag>R² LOOCV 0.78</Tag>
                <Tag>IC 80% calibrado</Tag>
                <Tag>Confianza 83%</Tag>
              </Card>

              <SectionTitle icon={Info} title="Forecast Lagrangiano (14 días)" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  Simula <strong>2,000 partículas</strong> con OpenDrift usando corrientes RTOFS
                  y viento GFS. Genera horizontes cada 12h hasta 336h con KDE (kernel gaussiano,
                  bandwidth 0.08° ≈ 9 km). El resultado es direccional: indica zonas probables
                  de impacto, no magnitudes exactas.
                </p>
              </Card>

              <SectionTitle icon={Info} title="Riesgo por Playa" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  Perfil de riesgo para <strong>10 segmentos costeros</strong> basado en 315 días
                  de datos NOAA SIR. Incluye Isla Mujeres (71%), Cancún (66%) y Cozumel Norte (65%)
                  como zonas de mayor riesgo HIGH+MED.
                </p>
              </Card>

              <SectionTitle icon={Info} title="Pipeline Automático" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  <strong>10 pasos secuenciales</strong> ejecutados semanalmente (lunes 06:00 UTC):
                  descarga NOAA SIR → descarga boletines SEMAR → extracción OCR →
                  combinación Mendeley+SEMAR → features → modelos Fase 0 y 1 →
                  confidence score → interpolación ML risk → perfil playas → forecast
                  Lagrangiano. Cada paso se monitorea individualmente.
                </p>
              </Card>

            </div>
          )}

          {/* ════════════════ DATA ════════════════ */}
          {tab === "data" && (
            <div className="space-y-1">

              <p className="text-sm text-muted mb-4 leading-relaxed">
                El sistema integra <strong>6 fuentes de datos</strong> que cubren desde 2000
                hasta la fecha actual, combinando observaciones satelitales, boletines oficiales,
                reanálisis oceánicos y atmosféricos.
              </p>

              <SectionTitle icon={Database} title="Fuentes principales" />

              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-fg">SEMAR</span>
                  <Tag color="var(--color-primary)">2024–2026</Tag>
                  <Tag color="var(--color-primary)">~604 registros</Tag>
                </div>
                <p className="text-xs text-muted mb-2 leading-relaxed">
                  Boletines diarios de la Secretaría de Marina con biomasa costera medida
                  en toneladas para las regiones Caribe Mexicano (CM), Costa Central (CC),
                  Costa Oriental (CO) y Acumulación Costa Oriental (ACO).
                </p>
                <div className="bg-surface-raised/40 rounded-lg p-2.5">
                  <p className="text-xs font-bold text-fg/70 uppercase tracking-wider mb-1.5">Variables clave</p>
                  <DataRow label="biomasa_caribe_mexicano_ton (CM)" value="Biomasa total CM en toneladas" />
                  <DataRow label="aco_mt (ACO)" value="Acumulación Costa Oriental en megatoneladas" />
                  <DataRow label="semaforo" value="Nivel: ESCASO → MUY ALTO (1–6)" />
                  <DataRow label="log_cm / log_aco_lag1" value="Transformación log + rezago 1 mes" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-fg">Mendeley (GASB)</span>
                  <Tag color="var(--color-accent)">2000–2024</Tag>
                  <Tag color="var(--color-accent)">288 meses</Tag>
                </div>
                <p className="text-xs text-muted mb-2 leading-relaxed">
                  Dataset histórico de biomasa de sargazo en el Atlántico Central Occidental
                  (Hu et al.). Proporciona la serie larga de <strong>aligned_ACO</strong>
                  usada por los modelos Prophet para detectar tendencia y estacionalidad.
                </p>
                <div className="bg-surface-raised/40 rounded-lg p-2.5">
                  <p className="text-xs font-bold text-fg/70 uppercase tracking-wider mb-1.5">Variables clave</p>
                  <DataRow label="log_biomasa" value="Logaritmo natural de biomasa GASB" />
                  <DataRow label="post_2011" value="Indicador: 0=antes 2011, 1=después" />
                  <DataRow label="z_score" value="Desviación respecto a media histórica" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-fg">NOAA SIR</span>
                  <Tag color="var(--color-risk-high)">315 días</Tag>
                  <Tag color="var(--color-risk-high)">52,551 celdas</Tag>
                </div>
                <p className="text-xs text-muted mb-2 leading-relaxed">
                  Sargasso Information Report — evaluación diaria de riesgo costero
                  para Cancún, Isla Mujeres, Costa Maya y Cozumel. Datos en formato
                  KMZ con geometrías de riesgo categorizadas.
                </p>
                <div className="bg-surface-raised/40 rounded-lg p-2.5">
                  <p className="text-xs font-bold text-fg/70 uppercase tracking-wider mb-1.5">Niveles de riesgo</p>
                  <DataRow label="LOW" value="Riesgo bajo (122 celdas)" />
                  <DataRow label="WARNING" value="Precaución (164 celdas)" />
                  <DataRow label="MEDIUM" value="Riesgo medio (218 celdas)" />
                  <DataRow label="HIGH" value="Riesgo alto (78 celdas)" />
                </div>
              </Card>

              <SectionTitle icon={Database} title="Fuentes secundarias" />

              <Card>
                <DataRow label="OISST SST" value="NOAA OISST v2.1, 76 meses (2020–2026), temperatura superficial del mar" />
                <DataRow label="NCEP/NCAR Wind" value="Reanálisis, 74 meses, componentes U/V + onshore Cozumel" />
                <DataRow label="SATsum" value="Biomasa satelital mensual, Caribe y ZEE Mexicana" />
                <DataRow label="RTOFS" value="Corrientes oceánicas, malla 1/12°, para forecast Lagrangiano" />
                <DataRow label="GFS" value="Viento atmosférico, para forzamiento de partículas" />
              </Card>

            </div>
          )}

          {/* ════════════════ MATH ════════════════ */}
          {tab === "math" && (
            <div className="space-y-1">

              <p className="text-sm text-muted mb-4 leading-relaxed">
                El sistema emplea un enfoque híbrido que combina estadística clásica,
                procesos estocásticos, aprendizaje automático y simulación numérica.
              </p>

              <SectionTitle icon={Sigma} title="Estadística Clásica" />
              <Card>
                <ul className="space-y-2">
                  <Bullet>
                    <strong>Regresión lineal ponderada</strong> — log(CM) = β₀ + β₁·log(ACOₜ₋₁)
                    con kernel <strong>tricúbico</strong> w(t) = (1 − (t/T)³)³ que da más peso
                    a meses recientes (R² = 0.8289 LOOCV).
                  </Bullet>
                  <Bullet>
                    <strong>Regresión delta</strong> — Δlog(CM) ~ log(ACOₜ₋₁) + Δlog(ACOₜ₋₁)
                    para capturar aceleraciones en la acumulación.
                  </Bullet>
                  <Bullet>
                    <strong>Correlación de Pearson</strong> — ACO_lag1 vs CM: r = 0.918 (n=14),
                    el predictor individual más fuerte identificado.
                  </Bullet>
                  <Bullet>
                    <strong>Intervalo de confianza 80%</strong> ajustado por Hurst con
                    n_eff = n^((2−2H)/(2−H)). Para H=0.8047, n=14 → n_eff ≈ 2.37.
                  </Bullet>
                </ul>
              </Card>

              <SectionTitle icon={Sigma} title="Procesos Estocásticos" />
              <Card>
                <ul className="space-y-2">
                  <Bullet>
                    <strong>Exponente de Hurst H = 0.8047</strong> — indica memoria larga
                    en la serie temporal de biomasa CM. Un proceso con H {'>'} 0.5 significa
                    que los valores pasados influyen en el futuro durante períodos extendidos
                    (proceso fractional Browniano persistente).
                  </Bullet>
                  <Bullet>
                    <strong>AR(1) de rezago 1</strong> — modelo autorregresivo de primer orden
                    como fallback cuando ACO no está disponible: log(CMₜ) = β₀ + β₁·log(CMₜ₋₁).
                    R² = 0.3026 (22 meses de CM).
                  </Bullet>
                  <Bullet>
                    <strong>ARIMAX(1,1,0)</strong> — autorregresivo integrado con media móvil
                    y variable exógena (ACO_lag1). Se evalúa con expanding window CV.
                    Versión completa sobre n=23 produce el límite superior (222,753 ton).
                  </Bullet>
                  <Bullet>
                    <strong>Ruido fractional Gaussian (fGn)</strong> — los residuos del modelo
                    muestran estructura de autocorrelación consistente con H {'>'} 0.5.
                  </Bullet>
                </ul>
              </Card>

              <SectionTitle icon={Sigma} title="Aprendizaje Automático" />
              <Card>
                <ul className="space-y-2">
                  <Bullet>
                    <strong>Ridge Regression (L2)</strong> — regularización Ridge con α=1.0,
                    features: log_aco_lag1, log_aco_lag2, month_sin, month_cos. LOOCV R² = 0.7846.
                  </Bullet>
                  <Bullet>
                    <strong>Bayesian Ridge</strong> — versión Bayesiana con priors automáticos.
                    LOOCV R² = 0.7789, proporciona incertidumbre intrínseca.
                  </Bullet>
                  <Bullet>
                    <strong>Logística ordinal</strong> — semáforo ~ log(ACOₜ₋₁). Accuracy LOOCV:
                    0.357 exacta, 0.643 ±1 nivel. Predice MODERADO (28.7%) para junio 2026.
                  </Bullet>
                  <Bullet>
                    <strong>Prophet (Meta)</strong> — modelo aditivo con tendencia y
                    estacionalidad sobre 303 meses de aligned_ACO. Incluye grid search
                    (changepoint_prior_scale, seasonality_prior_scale, modo aditivo/multiplicativo).
                    La estimación indirecta CM se marca como <em>no fiable</em> ({'>'}0.5 Mt).
                  </Bullet>
                </ul>
              </Card>

              <SectionTitle icon={Sigma} title="Ensemble y Calibración" />
              <Card>
                <ul className="space-y-2">
                  <Bullet>
                    <strong>Ensemble ponderado por R²</strong> — los 3 mejores modelos se
                    combinan con peso proporcional a su R² de LOOCV:
                    CM_ens = Σ(wᵢ·CMᵢ) / Σ(wᵢ), donde wᵢ = R²ᵢ.
                  </Bullet>
                  <Bullet>
                    <strong>Bias correction por tendencia</strong> — si la pendiente de los
                    últimos 3 meses {'>'} 0.005 → factor ×1.25; si {'<'} −0.005 → ×0.85.
                    Corrige la subestimación sistemática en períodos de crecimiento.
                  </Bullet>
                  <Bullet>
                    <strong>Calibración isotónica IC</strong> — el intervalo de confianza se
                    ajusta usando el RMSE_log del backtest (1.28) para reflejar la incertidumbre
                    real del modelo, no la teórica.
                  </Bullet>
                </ul>
              </Card>

              <SectionTitle icon={Sigma} title="Interpolación Espacial y ML Risk" />
              <Card>
                <ul className="space-y-2">
                  <Bullet>
                    <strong>Función Wendland C2</strong> — φ(r) = (1−r)⁴·(4r+1) para r ∈ [0,R],
                    compact support con R=1.8. Interpola el riesgo NOAA SIR a una malla de
                    0.04° (~4 km) centrada en Cozumel.
                  </Bullet>
                  <Bullet>
                    <strong>Max-pooling costero</strong> — en lugar de promediar, se toma el
                    riesgo máximo dentro del radio de influencia para no subestimar segmentos
                    críticos cercanos a la costa.
                  </Bullet>
                  <Bullet>
                    <strong>KDE Lagrangiano</strong> — estimación de densidad kernel gaussiana
                    con bandwidth fijo 0.08° (~9 km) sobre posiciones de 2,000 partículas.
                    Se generan 25 horizontes cada 12h hasta 336h.
                  </Bullet>
                </ul>
              </Card>

            </div>
          )}

          {/* ════════════════ EXPLAIN ════════════════ */}
          {tab === "explain" && (
            <div className="space-y-1">

              <p className="text-sm text-muted mb-4 leading-relaxed">
                Conceptos que pueden resultar complejos al navegar el sistema.
              </p>

              <SectionTitle icon={HelpCircle} title="¿Qué es CM vs ACO?" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  <strong>CM</strong> (Caribe Mexicano) es la biomasa de sargazo medida en las
                  costas de Quintana Roo, en <strong>toneladas</strong>. <strong>ACO</strong>
                  (Acumulación Costa Oriental) es la biomasa detectada vía satélite frente a
                  la costa oriental de la península, en <strong>megatoneladas</strong> (Mt).
                  La relación clave: el ACO del <strong>mes anterior</strong> predice el CM
                  del mes actual con correlación r = 0.918.
                </p>
              </Card>

              <SectionTitle icon={HelpCircle} title="¿Qué significa H = 0.8047?" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  El <strong>exponente de Hurst (H)</strong> mide la memoria de una serie temporal:
                </p>
                <ul className="space-y-1.5 mt-2">
                  <Bullet>H = 0.5 → ruido blanco, sin memoria (el pasado no influye)</Bullet>
                  <Bullet>H = 0.8047 → <strong>memoria larga</strong>, tendencias persisten</Bullet>
                  <Bullet>Si H &gt; 0.5, la serie tiende a continuar su dirección actual</Bullet>
                </ul>
                <p className="text-sm text-fg/85 mt-2 leading-relaxed">
                  En la práctica: cuando el sargazo empieza a aumentar, es probable que
                  <strong>siga aumentando</strong>. El IC 80% se amplía porque la
                  información efectiva es menor (n_eff ≈ 2.37 en vez de n = 14).
                </p>
              </Card>

              <SectionTitle icon={HelpCircle} title="¿Por qué solo 14 pares SEMAR?" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  El boletín SEMAR reporta ACO (Acumulación Costa Oriental) desde
                  <strong>abril 2025</strong>, mientras que CM (Caribe Mexicano) se reporta
                  desde marzo 2024. La intersección de ambos con datos válidos produce
                  solo <strong>14 meses de pares ACO+CM</strong>. Esta es la principal
                  limitación del sistema: los modelos se entrenan con muy pocos datos.
                  Las métricas (R², RMSE) son sobre LOOCV, no sobre un test set independiente.
                </p>
              </Card>

              <SectionTitle icon={HelpCircle} title="¿Qué significa IC 80%?" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  El <strong>Intervalo de Confianza del 80%</strong> indica que, si el modelo
                  fuera correcto y repitiéramos el proceso muchas veces, el valor real estaría
                  dentro de este rango el 80% de las veces. No significa que hay 80% de
                  probabilidad de que el valor real esté ahí (eso sería un intervalo creíble
                  Bayesiano). El IC del ensemble actual es [6,596 — 293,445] toneladas,
                  reflejando la alta incertidumbre por los pocos datos de entrenamiento.
                </p>
              </Card>

              <SectionTitle icon={HelpCircle} title="¿Cómo funciona el Ensemble?" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  El ensemble combina <strong>múltiples modelos</strong> para reducir el sesgo
                  individual. Actualmente incluye 3 modelos (Ridge, Bayesian Ridge, Regresión
                  Lineal) ponderados por su R² de LOOCV. Se excluyen modelos con bajo desempeño
                  (delta, logística, Prophet, rolling, ARIMAX). Luego se aplica una
                  <strong>corrección por tendencia</strong> (×1.25 si sube, ×0.85 si baja)
                  basada en los últimos 3 meses. El IC se calibra usando el RMSE promedio
                  del backtest.
                </p>
              </Card>

              <SectionTitle icon={HelpCircle} title="¿Qué es un Forecast Lagrangiano?" />
              <Card>
                <p className="text-sm text-fg/85 leading-relaxed">
                  El enfoque <strong>Lagrangiano</strong> sigue partículas individuales en
                  movimiento (como boyas virtuales) en lugar de calcular concentraciones en
                  celdas fijas (enfoque Euleriano). Se liberan <strong>2,000 partículas</strong>
                  en el Canal de Yucatán y se desplazan con corrientes RTOFS y viento GFS
                  usando OpenDrift. El resultado NO predice cuánto sargazo llegará, sino
                  <strong>dónde es más probable que llegue</strong> (mapa de densidad KDE).
                  Es direccional, no exacto — cobertura del 11% vs NOAA SIR a 48h.
                </p>
              </Card>

              <SectionTitle icon={HelpCircle} title="Limitaciones del Sistema" />
              <Card>
                <ul className="space-y-2">
                  <Bullet>
                    <strong>Datos limitados:</strong> solo 14 pares ACO+CM. MAPE &gt; 100%
                    en todos los modelos. Los R² son sobre LOOCV, no test independiente.
                  </Bullet>
                  <Bullet>
                    <strong>Forecast direccional:</strong> el modelo Lagrangiano indica zonas
                    probables de impacto, no magnitudes. Cobertura del 11% contra NOAA SIR.
                  </Bullet>
                  <Bullet>
                    <strong>SATsum sin API:</strong> los datos satelitales SATsum requieren
                    descarga manual desde el explorador GIS de SEMAR.
                  </Bullet>
                  <Bullet>
                    <strong>SST y viento no mejoran significativamente:</strong> las variables
                    oceánicas y atmosféricas aportan +2.7% y +0.3% marginal de R² sobre
                    ACO_lag1 solo.
                  </Bullet>
                  <Bullet>
                    <strong>IC muy amplio:</strong> el IC 80% del ensemble cubre 2 órdenes
                    de magnitud (de 6,500 a 293,000 toneladas), reflejando la incertidumbre
                    real del modelo con datos escasos.
                  </Bullet>
                </ul>
              </Card>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
