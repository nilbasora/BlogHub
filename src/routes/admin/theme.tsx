import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { loadSettings } from "@/core/content/loadSettings"
import { resolveTheme } from "@/core/themes/resolveTheme"
import { normalizeThemeVars } from "@/core/themes/validateVars"
import { ThemeVarsForm } from "@/admin/components/ThemeVarsForm"
import { getThemeById, listThemes } from "@/core/themes/registry"
import { writePreviewSettings, clearPreviewSettings } from "@/core/preview/previewSettings"
import { commitThemeSettings } from "@/core/github/commit"

export const Route = createFileRoute("/admin/theme")({
  loader: async () => {
    const settings = await loadSettings()
    const { theme, vars } = resolveTheme(settings)
    return { settings, themeId: theme.id, vars }
  },
  component: AdminThemePage,
})

function AdminThemePage() {
  const { settings, themeId, vars } = Route.useLoaderData()
  const { theme } = resolveTheme(settings)

  // Draft state for editing
  const [draftThemeId, setDraftThemeId] = React.useState(themeId)
  const [draftVars, setDraftVars] = React.useState<Record<string, unknown>>(vars)

  // Save state
  const [saving, setSaving] = React.useState(false)

  // Auto-preview toggle (persists)
  const [autoPreview, setAutoPreview] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("bloghub.previewAuto") === "true"
    } catch {
      return false
    }
  })

  const themes = listThemes()

  function buildNextSettings() {
    // IMPORTANT: keep whatever shape your settings.theme uses
    // You currently use settings.theme.active + settings.theme.vars
    return {
      ...settings,
      theme: {
        ...settings.theme,
        active: draftThemeId,
        vars: draftVars,
      },
    }
  }

  // When switching theme, reset vars to that theme defaults
  React.useEffect(() => {
    const t = getThemeById(draftThemeId)
    if (!t) return
    const normalized = normalizeThemeVars(t, {}) // defaults
    setDraftVars(normalized.vars)
  }, [draftThemeId])

  // Persist toggle state
  React.useEffect(() => {
    try {
      localStorage.setItem("bloghub.previewAuto", String(autoPreview))
    } catch {
      // ignore
    }
  }, [autoPreview])

  // Auto write preview settings on change (for live preview tab)
  React.useEffect(() => {
    if (!autoPreview) return
    writePreviewSettings(buildNextSettings())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPreview, draftThemeId, draftVars])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Theme</h1>
        <p className="text-sm opacity-80">
          Edit theme variables. Use Live preview to open the site with ?preview=true.
        </p>
      </header>

      <section className="space-y-3">
        <div className="text-sm font-medium">Active theme</div>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={draftThemeId}
          onChange={(e) => setDraftThemeId(e.target.value)}
          disabled={saving}
        >
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.schema.title} ({t.id})
            </option>
          ))}
        </select>
      </section>

      <section className="flex items-center gap-3">
        <input
          id="autoPreview"
          type="checkbox"
          checked={autoPreview}
          onChange={(e) => setAutoPreview(e.target.checked)}
          disabled={saving}
        />
        <label htmlFor="autoPreview" className="text-sm">
          Auto update live preview
        </label>
      </section>

      <section className="space-y-4">
        <div className="text-sm font-medium">Theme settings</div>
        <ThemeVarsForm
          schema={(getThemeById(draftThemeId) ?? theme).schema}
          values={draftVars}
          onChange={setDraftVars}
        />
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          disabled={saving}
          onClick={async () => {
            try {
              setSaving(true)
              const nextSettings = buildNextSettings()
              await commitThemeSettings(nextSettings)
              alert("Theme saved to GitHub ✅ (settings.json committed)")
            } catch (e: any) {
              alert(e?.message ?? String(e))
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          disabled={saving}
          onClick={() => {
            writePreviewSettings(buildNextSettings())
            const base = import.meta.env.BASE_URL || "/"
            window.open(`${window.location.origin}${base}?preview=true`, "_blank")
          }}
        >
          Live preview
        </button>

        <button
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          disabled={saving}
          onClick={() => {
            clearPreviewSettings()
            alert("Preview cleared.")
          }}
        >
          Clear preview
        </button>
      </section>

      <section className="rounded-lg border p-4 text-xs whitespace-pre-wrap">
        <div className="font-medium mb-2">Current repo settings (read-only)</div>
        {JSON.stringify(settings.theme, null, 2)}
      </section>

      <section className="rounded-lg border p-4 text-xs whitespace-pre-wrap">
        <div className="font-medium mb-2">Draft theme (what will be saved)</div>
        {JSON.stringify(buildNextSettings().theme, null, 2)}
      </section>
    </div>
  )
}
