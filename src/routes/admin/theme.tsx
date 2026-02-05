import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { loadSettings } from "@/core/content/local"
import { resolveTheme } from "@/core/domain/themes/resolveTheme"
import { normalizeThemeVars } from "@/core/domain/themes/validateVars"
import { ThemeVarsForm } from "@/components/admin/ThemeVarsForm"
import { getThemeById, listThemes } from "@/core/domain/themes/registry"
import { writePreviewSettings, clearPreviewSettings } from "@/core/storage/previewSettings"
import { commitThemeSettings } from "@/core/api/github/commit"

export const Route = createFileRoute("/admin/theme")({
  loader: async () => {
    const settings = await loadSettings()
    const { theme, vars } = resolveTheme(settings)
    return { settings, activeThemeId: theme.id, vars }
  },
  component: AdminThemePage,
})

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function inputBase(className?: string) {
  return cx(
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
    "outline-none transition",
    "focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10",
    className
  )
}

function cardShell(selected: boolean) {
  return cx(
    "group rounded-2xl border bg-white shadow-sm overflow-hidden transition",
    selected
      ? "border-neutral-900 ring-4 ring-neutral-900/10"
      : "border-neutral-200 hover:border-neutral-300 hover:shadow-md hover:-translate-y-[1px]"
  )
}

function ThemeThumbPlaceholder({
  accent = "neutral",
}: {
  accent?: "neutral" | "warm" | "cool"
}) {
  const accentBg =
    accent === "warm"
      ? "from-amber-100 to-rose-100"
      : accent === "cool"
      ? "from-sky-100 to-indigo-100"
      : "from-neutral-100 to-neutral-50"

  return (
    <div className={cx("h-44 w-full bg-gradient-to-br", accentBg)}>
      <div className="h-full w-full p-4">
        <div className="h-full w-full rounded-xl border border-white/60 bg-white/70 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b border-neutral-200/60 px-3 py-2">
            <div className="h-2 w-24 rounded-full bg-neutral-200" />
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-neutral-300" />
              <div className="h-2 w-2 rounded-full bg-neutral-300" />
              <div className="h-2 w-2 rounded-full bg-neutral-300" />
            </div>
          </div>
          <div className="p-3">
            <div className="h-3 w-3/5 rounded bg-neutral-200" />
            <div className="mt-3 space-y-2">
              <div className="h-2 w-full rounded bg-neutral-200/70" />
              <div className="h-2 w-5/6 rounded bg-neutral-200/70" />
              <div className="h-2 w-4/6 rounded bg-neutral-200/70" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="h-12 rounded-lg bg-neutral-200/60" />
              <div className="h-12 rounded-lg bg-neutral-200/60" />
              <div className="h-12 rounded-lg bg-neutral-200/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeFeatured({
  src,
  accent,
  title,
}: {
  src?: string | null
  accent: "neutral" | "warm" | "cool"
  title: string
}) {
  if (!src) return <ThemeThumbPlaceholder accent={accent} />

  return (
    <div className="h-44 w-full bg-neutral-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${title} preview`}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  )
}

function AdminThemePage() {
  const { settings, activeThemeId, vars } = Route.useLoaderData() as {
    settings: any
    activeThemeId: string
    vars: Record<string, unknown>
  }

  const themes = listThemes()

  // Draft (what will be saved)
  const [draftThemeId, setDraftThemeId] = React.useState(activeThemeId)
  const [draftVars, setDraftVars] = React.useState<Record<string, unknown>>(vars)

  // UI state
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [query, setQuery] = React.useState("")

  // Auto-preview toggle (persists)
  const [autoPreview, setAutoPreview] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("bloghub.previewAuto") === "true"
    } catch {
      return false
    }
  })

  function buildNextSettings() {
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

  const filteredThemes = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return themes
    return themes.filter((t) => {
      const hay = `${t.id} ${t.schema?.title ?? ""} ${t.schema?.description ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [themes, query])

  const isDirty =
    draftThemeId !== activeThemeId || JSON.stringify(draftVars) !== JSON.stringify(vars)

  const activeTheme = getThemeById(activeThemeId)
  const draftTheme = getThemeById(draftThemeId) ?? activeTheme

  const schema = draftTheme?.schema
  if (!draftTheme || !schema) {
    return (
      <div className="p-6 text-sm text-red-700">
        Theme not found or missing schema: <span className="font-mono">{draftThemeId}</span>
      </div>
    )
  }

  async function onSave() {
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
  }

  function openLivePreview() {
    writePreviewSettings(buildNextSettings())
    const base = import.meta.env.BASE_URL || "/"
    window.open(`${window.location.origin}${base}?preview=true`, "_blank")
  }

  function openCustomize(themeId: string) {
    setDraftThemeId(themeId)
    setDrawerOpen(true)
  }

  function activateTheme(themeId: string) {
    setDraftThemeId(themeId)
    // keep drawer closed unless user explicitly customizes
    setDrawerOpen(false)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Themes</h1>
            <p className="text-sm text-neutral-600">
              Choose a theme and customize its settings. Use Live preview to open the site with{" "}
              <span className="font-mono">?preview=true</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={cx(
                "rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm",
                "hover:bg-neutral-50 active:translate-y-[1px] transition"
              )}
              onClick={openLivePreview}
              disabled={saving}
            >
              Live preview
            </button>

            <button
              className={cx(
                "rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm",
                "hover:bg-neutral-50 active:translate-y-[1px] transition"
              )}
              onClick={() => {
                clearPreviewSettings()
                alert("Preview cleared.")
              }}
              disabled={saving}
            >
              Clear preview
            </button>

            <button
              className={cx(
                "rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white shadow-sm",
                "hover:bg-neutral-800 active:translate-y-[1px] transition"
              )}
              onClick={onSave}
              disabled={saving || !isDirty}
              title={!isDirty ? "No changes to save" : undefined}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>

        {/* Top controls */}
        <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-neutral-900">Installed</div>
              <span className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-600">
                {themes.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <input
                className={inputBase("sm:w-[360px]")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search installed themes…"
              />

              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={autoPreview}
                  onChange={(e) => setAutoPreview(e.target.checked)}
                  disabled={saving}
                />
                Auto preview
              </label>
            </div>
          </div>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredThemes.map((t, i) => {
            const isActive = t.id === activeThemeId
            const isSelected = t.id === draftThemeId

            const accent: "neutral" | "warm" | "cool" =
              i % 3 === 0 ? "neutral" : i % 3 === 1 ? "warm" : "cool"

            // OPTIONAL: if your theme schema includes previewImage, show it
            // Add to your theme schema in registry: schema.previewImage = "/media/themes/<id>.png"
            const previewImage = (t.schema as any).previewImage as string | undefined

            return (
              <div key={t.id} className={cardShell(isSelected)}>
                <ThemeFeatured src={previewImage} accent={accent} title={t.schema.title} />

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 truncate">{t.schema.title}</div>
                      <div className="text-xs text-neutral-500 truncate">{t.id}</div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {isActive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                          Active
                        </span>
                      ) : null}

                      {isSelected && !isActive ? (
                        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {t.schema.description ? (
                    <div className="text-sm text-neutral-600 line-clamp-2">{t.schema.description}</div>
                  ) : (
                    <div className="text-sm text-neutral-500">A theme for your site.</div>
                  )}

                  {/* WP-like footer actions */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button
                          type="button"
                          className={cx(
                            "rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white shadow-sm",
                            "hover:bg-neutral-800 active:translate-y-[1px] transition"
                          )}
                          onClick={() => activateTheme(t.id)}
                          disabled={saving}
                          title="Select this theme (it will be saved when you click Save changes)"
                        >
                          Activate
                        </button>
                      )}
                    </div>

                    {/* Customize moved to bottom-right */}
                    <button
                      type="button"
                      className={cx(
                        "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
                        "hover:bg-neutral-50 active:translate-y-[1px] transition"
                      )}
                      onClick={() => openCustomize(t.id)}
                      disabled={saving}
                      title="Open settings for this theme"
                    >
                      Customize
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Customizer drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-white shadow-2xl">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900">Customize theme</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {draftTheme?.schema.title} <span className="font-mono">({draftThemeId})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cx(
                        "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm",
                        "hover:bg-neutral-50 active:translate-y-[1px] transition"
                      )}
                      onClick={openLivePreview}
                      disabled={saving}
                    >
                      Preview
                    </button>

                    <button
                      type="button"
                      className={cx(
                        "rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white shadow-sm",
                        "hover:bg-neutral-800 active:translate-y-[1px] transition"
                      )}
                      onClick={onSave}
                      disabled={saving || !isDirty}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>

                    <button
                      type="button"
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                      onClick={() => setDrawerOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-5">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-neutral-900">
                            {draftTheme?.schema.title}
                          </div>
                          <div className="text-xs text-neutral-600">
                            Theme ID: <span className="font-mono">{draftThemeId}</span>
                          </div>
                        </div>

                        {draftThemeId !== activeThemeId ? (
                          <button
                            type="button"
                            className={cx(
                              "rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white shadow-sm",
                              "hover:bg-neutral-800 active:translate-y-[1px] transition"
                            )}
                            onClick={() => activateTheme(draftThemeId)}
                            disabled={saving}
                            title="Select this theme (remember to Save changes)"
                          >
                            Activate
                          </button>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    <ThemeVarsForm
                      schema={schema}
                      values={draftVars}
                      onChange={setDraftVars}
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-neutral-600">
                      {isDirty ? (
                        <span>
                          You have <span className="font-semibold text-neutral-900">unsaved</span>{" "}
                          changes.
                        </span>
                      ) : (
                        <span>All changes saved.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={cx(
                          "rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm shadow-sm",
                          "hover:bg-neutral-50 active:translate-y-[1px] transition"
                        )}
                        onClick={() => {
                          setDraftThemeId(activeThemeId)
                          setDraftVars(vars)
                        }}
                        disabled={saving || !isDirty}
                      >
                        Discard
                      </button>

                      <button
                        type="button"
                        className={cx(
                          "rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white shadow-sm",
                          "hover:bg-neutral-800 active:translate-y-[1px] transition"
                        )}
                        onClick={onSave}
                        disabled={saving || !isDirty}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}




