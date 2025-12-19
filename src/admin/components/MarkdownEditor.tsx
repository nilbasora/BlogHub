import * as React from "react"

type Props = {
  value: string
  onChange: (v: string) => void
  onInsertImage?: (placeholderPath: string) => void
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  before: string,
  after: string = before
) {
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  const selected = value.slice(start, end) || ""
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const cursor = start + before.length + selected.length + after.length
  return { next, cursor }
}

export function MarkdownEditor({ value, onChange, onInsertImage }: Props) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null)

  function apply(before: string, after?: string) {
    const el = ref.current
    if (!el) return
    const { next, cursor } = wrapSelection(el, value, before, after)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md border px-2 py-1 text-xs" type="button" onClick={() => apply("**", "**")}>
          Bold
        </button>
        <button className="rounded-md border px-2 py-1 text-xs" type="button" onClick={() => apply("_", "_")}>
          Italic
        </button>
        <button className="rounded-md border px-2 py-1 text-xs" type="button" onClick={() => apply("`", "`")}>
          Code
        </button>
        <button
          className="rounded-md border px-2 py-1 text-xs"
          type="button"
          onClick={() => {
            const el = ref.current
            if (!el) return
            const start = el.selectionStart ?? 0
            const end = el.selectionEnd ?? 0
            const selected = value.slice(start, end) || "link text"
            const insert = `[${selected}](https://)`
            const next = value.slice(0, start) + insert + value.slice(end)
            onChange(next)
          }}
        >
          Link
        </button>

        <button
          className="rounded-md border px-2 py-1 text-xs"
          type="button"
          onClick={() => {
            // MVP: placeholder path (later: upload to repo and insert real path)
            onInsertImage?.("/media/your-image.png")
          }}
        >
          Image
        </button>
      </div>

      <textarea
        ref={ref}
        className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[420px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  )
}
