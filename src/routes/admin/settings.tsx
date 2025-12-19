import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { loadSettings } from "@/core/content/loadSettings"
import type { SiteSettings } from "@/core/content/types"
import { FormField } from "@/admin/components/FormField"
import { writePreviewSettings, clearPreviewSettings } from "@/core/preview/previewSettings"

export const Route = createFileRoute("/admin/settings")({
  loader: async () => {
    const settings = await loadSettings()
    return { settings }
  },
  component: AdminSettingsPage,
})

function normalizePostPermalink(v: string) {
  // keep it simple + safe: always starts/ends with "/"
  let s = (v ?? "").trim()
  if (!s.startsWith("/")) s = "/" + s
  if (!s.endsWith("/")) s = s + "/"
  // collapse double slashes
  s = s.replace(/\/{2,}/g, "/")
  return s
}

type PermalinkPreset = {
  id: string
  label: string
  pattern: string
  example: string
}

const PERMALINK_PRESETS: PermalinkPreset[] = [
  {
    id: "plain",
    label: "Plain",
    pattern: "/:slug/",
    example: "/my-post/",
  },
  {
    id: "day_name",
    label: "Day and name",
    pattern: "/:year/:month/:day/:slug/",
    example: "/2025/12/19/my-post/",
  },
  {
    id: "month_name",
    label: "Month and name",
    pattern: "/:year/:month/:slug/",
    example: "/2025/12/my-post/",
  },
  {
    id: "numeric",
    label: "Numeric",
    pattern: "/archives/:id/",
    example: "/archives/12345/",
  },
  {
    id: "category_name",
    label: "Category and name",
    pattern: "/:category/:slug/",
    example: "/tech/my-post/",
  },
  {
    id: "custom",
    label: "Custom",
    pattern: "/:slug/",
    example: "/my-post/",
  },
]

const AVAILABLE_TOKENS = [
  { token: ":slug", desc: "Post slug" },
  { token: ":year", desc: "4-digit year (from date)" },
  { token: ":month", desc: "2-digit month (from date)" },
  { token: ":day", desc: "2-digit day (from date)" },
  { token: ":id", desc: "Post id (frontmatter id)" },
  { token: ":category", desc: "First category (if set)" },
]

function detectPreset(pattern: string) {
  const normalized = normalizePostPermalink(pattern)
  const preset = PERMALINK_PRESETS.find((p) => normalizePostPermalink(p.pattern) === normalized)
  return preset?.id ?? "custom"
}

function AdminSettingsPage() {
  const { settings } = Route.useLoaderData()

  const [draft, setDraft] = React.useState<SiteSettings>(() => settings)

  // Permalink selector mode
  const [permalinkMode, setPermalinkMode] = React.useState<string>(() =>
    detectPreset(draft.permalinks?.post ?? "/:slug/")
  )

  // Auto-preview toggle (persisted)
  const [autoPreview, setAutoPreview] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("bloghub.previewAutoSettings") === "true"
    } catch {
      return false
    }
  })

  // persist toggle
  React.useEffect(() => {
    try {
      localStorage.setItem("bloghub.previewAutoSettings", String(autoPreview))
    } catch {
      // ignore
    }
  }, [autoPreview])

  // auto-write preview when enabled
  React.useEffect(() => {
    if (!autoPreview) return
    writePreviewSettings(draft)
  }, [autoPreview, draft])

  const onChange = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const onChangePermalink = (value: string) => {
    setPermalinkMode("custom")
    setDraft((prev) => ({
      ...prev,
      permalinks: {
        ...prev.permalinks,
        post: normalizePostPermalink(value),
      },
    }))
  }

  const applyPreset = (presetId: string) => {
    setPermalinkMode(presetId)

    const preset = PERMALINK_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    if (presetId !== "custom") {
      setDraft((prev) => ({
        ...prev,
        permalinks: {
          ...prev.permalinks,
          post: normalizePostPermalink(preset.pattern),
        },
      }))
    }
  }

  const currentPermalink = normalizePostPermalink(draft.permalinks?.post ?? "/:slug/")

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Site settings</h1>
        <p className="text-sm opacity-80">
          Configure global settings used by the generator and themes.
        </p>
      </header>

      <section className="space-y-5 rounded-lg border bg-white p-5">
        <div className="text-sm font-semibold">General</div>

        <FormField label="Site name" hint="Shown in themes and browser titles (depending on theme).">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={draft.siteName ?? ""}
            onChange={(e) => onChange("siteName", e.target.value as any)}
          />
        </FormField>

        <FormField label="Tagline" hint="Optional short description.">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={draft.tagline ?? ""}
            onChange={(e) => onChange("tagline", e.target.value as any)}
          />
        </FormField>

        <FormField
          label="Site URL"
          hint="Optional. Used for canonical URLs, feeds, SEO. Example: https://user.github.io/repo/"
        >
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={(draft.siteUrl ?? "") as any}
            onChange={(e) => onChange("siteUrl", e.target.value as any)}
            placeholder="https://example.com/"
          />
        </FormField>
      </section>

      <section className="space-y-5 rounded-lg border bg-white p-5">
        <div className="text-sm font-semibold">Permalinks</div>

        <div className="space-y-3">
          {PERMALINK_PRESETS.filter((p) => p.id !== "custom").map((p) => {
            const selected =
              permalinkMode !== "custom" &&
              normalizePostPermalink(p.pattern) === currentPermalink

            return (
              <label
                key={p.id}
                className={[
                  "flex items-start gap-3 rounded-md border p-3 cursor-pointer",
                  selected ? "border-neutral-900" : "hover:bg-neutral-50",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="permalink"
                  checked={selected}
                  onChange={() => applyPreset(p.id)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs opacity-70 font-mono break-all">
                    {normalizePostPermalink(p.pattern)}
                  </div>
                  <div className="text-xs opacity-60">Example: {p.example}</div>
                </div>
              </label>
            )
          })}

          {/* Custom */}
          <label
            className={[
              "flex items-start gap-3 rounded-md border p-3 cursor-pointer",
              permalinkMode === "custom" ? "border-neutral-900" : "hover:bg-neutral-50",
            ].join(" ")}
          >
            <input
              type="radio"
              name="permalink"
              checked={permalinkMode === "custom"}
              onChange={() => setPermalinkMode("custom")}
              className="mt-1"
            />
            <div className="min-w-0 w-full space-y-2">
              <div className="text-sm font-medium">Custom structure</div>

              <input
                className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                value={draft.permalinks?.post ?? "/:slug/"}
                onChange={(e) => onChangePermalink(e.target.value)}
                disabled={permalinkMode !== "custom"}
              />

              <div className="text-xs opacity-70">
                Available tags:
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_TOKENS.map((t) => (
                    <div key={t.token} className="rounded border px-2 py-1">
                      <span className="font-mono">{t.token}</span>{" "}
                      <span className="opacity-70">— {t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs opacity-70 leading-5">
                After saving permalinks, you’ll run{" "}
                <span className="font-mono">npm run generate</span> (later we’ll automate this in CI).
              </div>
            </div>
          </label>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoPreview}
            onChange={(e) => setAutoPreview(e.target.checked)}
          />
          Auto update live preview
        </label>

        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => {
            // placeholder for GitHub commit later
            alert("Save: TODO (will commit content/site/settings.json to GitHub later).")
          }}
        >
          Save
        </button>

        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => {
            writePreviewSettings(draft)
            const base = import.meta.env.BASE_URL || "/"
            window.open(`${window.location.origin}${base}?preview=true`, "_blank")
          }}
        >
          Live preview
        </button>

        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => {
            clearPreviewSettings()
            alert("Preview cleared.")
          }}
        >
          Clear preview
        </button>
      </section>

      <section className="rounded-lg border p-4 text-xs whitespace-pre-wrap bg-white">
        <div className="font-medium mb-2">Draft settings (what would be saved)</div>
        {JSON.stringify(draft, null, 2)}
      </section>

      <section className="rounded-lg border p-4 text-xs whitespace-pre-wrap bg-white">
        <div className="font-medium mb-2">Repo settings (read-only)</div>
        {JSON.stringify(settings, null, 2)}
      </section>
    </div>
  )
}
