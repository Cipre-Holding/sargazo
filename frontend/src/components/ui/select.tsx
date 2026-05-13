import * as React from "react"
import { cn } from "@/lib/utils"

type SelectProps = {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder?: string; className?: string;
}
function Select({ value, onChange, options, placeholder = "Select...", className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export { Select }
