import { useState } from "react"
import { X, Plus } from "lucide-react"

const SEMAFOROS = ["ESCASO", "MUY BAJO", "BAJO", "MODERADO", "ALTO", "MUY ALTO"]

interface ManualInputDialogProps {
  onSuccess: () => void
}

export function ManualInputDialog({ onSuccess }: ManualInputDialogProps) {
  const [open, setOpen]         = useState(false)
  const [sending, setSending]   = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [form, setForm]         = useState({
    fecha:       new Date().toISOString().slice(0, 10),
    cm_ton:      "",
    aco_mt:      "",
    semaforo:    "",
    conglomerado:"",
  })

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/manual/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha:               form.fecha,
          cm_ton:              form.cm_ton      ? parseFloat(form.cm_ton)  : null,
          aco_mt:              form.aco_mt      ? parseFloat(form.aco_mt)  : null,
          semaforo:            form.semaforo    || null,
          conglomerado_cozumel:form.conglomerado|| null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Error HTTP ${res.status}`)
      }
      setOpen(false)
      setForm({ fecha: new Date().toISOString().slice(0, 10), cm_ton: "", aco_mt: "", semaforo: "", conglomerado: "" })
      onSuccess()
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const inputCls = [
    "w-full rounded-xl border px-3 py-2 text-sm transition-colors duration-150",
    "bg-surface-raised border-border/50 text-fg placeholder-muted/50",
    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
  ].join(" ")

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/40 px-4 py-2.5 text-sm text-muted hover:text-fg transition-all duration-150 cursor-pointer"
        style={{ background: 'var(--color-surface-raised)' }}
      >
        <Plus className="size-4" />
        Entrada manual
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 rounded-2xl border border-border/50 shadow-2xl shadow-black/60"
            style={{ background: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-bold text-fg">Entrada manual de datos</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-xl text-muted hover:text-fg hover:bg-surface-raised transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">

              {/* Fecha */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => set("fecha", e.target.value)}
                  className={inputCls}
                  required
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* CM + ACO side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                    CM (ton)
                  </label>
                  <input
                    type="number" step="0.001"
                    value={form.cm_ton}
                    onChange={(e) => set("cm_ton", e.target.value)}
                    placeholder="ej: 51837"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                    ACO (Mt)
                  </label>
                  <input
                    type="number" step="0.001"
                    value={form.aco_mt}
                    onChange={(e) => set("aco_mt", e.target.value)}
                    placeholder="ej: 0.512"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Semáforo */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                  Semáforo
                </label>
                <select
                  value={form.semaforo}
                  onChange={(e) => set("semaforo", e.target.value)}
                  className={inputCls}
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">Seleccionar nivel…</option>
                  {SEMAFOROS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Conglomerado Cozumel */}
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                  Conglomerado Cozumel
                </label>
                <select
                  value={form.conglomerado}
                  onChange={(e) => set("conglomerado", e.target.value)}
                  className={inputCls}
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="">Seleccionar…</option>
                  <option value="SI">SI</option>
                  <option value="NO">NO</option>
                </select>
              </div>

              {errorMsg && (
                <div className="px-3 py-2 rounded-lg text-xs border"
                  style={{ background: 'oklch(0.62 0.22 28 / 0.1)', borderColor: 'oklch(0.62 0.22 28 / 0.25)', color: 'var(--color-error)' }}>
                  {errorMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {sending ? "Guardando…" : "Guardar entrada"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/50 text-sm text-muted hover:text-fg hover:bg-surface-raised transition-all duration-150 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
