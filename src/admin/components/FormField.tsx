import * as React from "react"

type Props = {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}

export function FormField({ label, hint, error, children }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {error ? (
        <div className="text-xs text-red-600">{error}</div>
      ) : hint ? (
        <div className="text-xs opacity-60">{hint}</div>
      ) : null}
    </div>
  )
}
