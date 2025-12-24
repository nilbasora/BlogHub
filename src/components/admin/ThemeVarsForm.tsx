import type { ThemeSchema } from "@/core/utils/types"

type Props = {
  schema: ThemeSchema
  values: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

export function ThemeVarsForm({ schema, values, onChange }: Props) {
  function set(key: string, value: unknown) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-6">
      {schema.fields.map((field) => {
        const v = values[field.key]

        return (
          <div key={field.key} className="space-y-2">
            <div className="text-sm font-medium">{field.label}</div>

            {field.type === "string" ? (
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={typeof v === "string" ? v : ""}
                onChange={(e) => set(field.key, e.target.value)}
              />
            ) : null}

            {field.type === "boolean" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(v)}
                  onChange={(e) => set(field.key, e.target.checked)}
                />
                <span>{Boolean(v) ? "Enabled" : "Disabled"}</span>
              </label>
            ) : null}

            {field.type === "number" ? (
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="number"
                value={typeof v === "number" ? v : 0}
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                onChange={(e) =>
                  set(field.key, e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            ) : null}

            {field.type === "select" ? (
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={typeof v === "string" ? v : field.default}
                onChange={(e) => set(field.key, e.target.value)}
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="text-xs opacity-60">Key: {field.key}</div>
          </div>
        )
      })}
    </div>
  )
}
