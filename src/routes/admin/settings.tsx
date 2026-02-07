import * as React from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { loadSettingsFromRepo } from "@/core/content/repo"
import type { SiteSettings } from "@/core/domain/types"
import { FormField } from "@/components/admin/FormField"
import { commitSiteSettings } from "@/core/api/github/commit"
import { MediaPicker } from "@/components/MediaPicker"
import { Toast, type ToastKind } from "@/components/Toast"

export const Route = createFileRoute("/admin/settings")({
  loader: async () => {
    const settings = await loadSettingsFromRepo()
    return { settings }
  },
  component: AdminSettingsPage,
})

function normalizePostPermalink(v: string) {
  let s = (v ?? "").trim()
  if (!s.startsWith("/")) s = "/" + s
  if (!s.endsWith("/")) s = s + "/"
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
  { id: "plain", label: "Plain", pattern: "/:slug/", example: "/my-post/" },
  { id: "day_name", label: "Day + name", pattern: "/:year/:month/:day/:slug/", example: "/2025/12/19/my-post/" },
  { id: "month_name", label: "Month + name", pattern: "/:year/:month/:slug/", example: "/2025/12/my-post/" },
  { id: "numeric", label: "Numeric", pattern: "/archives/:id/", example: "/archives/12345/" },
  { id: "category_name", label: "Category + name", pattern: "/:category/:slug/", example: "/tech/my-post/" },
  { id: "custom", label: "Custom", pattern: "/:slug/", example: "/my-post/" },
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

function getWriteBranchFromCd(cd: boolean | undefined) {
  return cd ? "main" : "develop"
}

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

function Card({
  title,
  description,
  children,
  right,
}: {
  title: string
  description?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white/80 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          {description ? <div className="text-xs text-neutral-500">{description}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function deepEqual(a: any, b: any) {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (a == null || b == null) return a === b
  if (typeof a !== "object") return a === b

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) if (!deepEqual(a[k], b[k])) return false
  return true
}

function normalizeSettings(settings: any): SiteSettings {
  return {
    ...settings,
    language: settings?.language ?? "en",
    logo: settings?.logo ?? "",
    favicon: settings?.favicon ?? "",
    cd: settings?.cd ?? false,
    indexCategories: settings?.indexCategories ?? true,
    permalinks: {
      ...(settings?.permalinks ?? {}),
      post: normalizePostPermalink(settings?.permalinks?.post ?? "/:slug/"),
    },
  } as SiteSettings
}

function AdminSettingsPage() {
  const router = useRouter()
  const { settings } = Route.useLoaderData()

  const normalizedFromLoader = React.useMemo(() => normalizeSettings(settings as any), [settings])

  const [base, setBase] = React.useState<SiteSettings>(() => normalizedFromLoader)
  const [draft, setDraft] = React.useState<SiteSettings>(() => normalizedFromLoader)

  // ✅ Toast state
  const [toast, setToast] = React.useState<{ kind: ToastKind; message: string; duration?: number } | null>(null)

  const showToast = React.useCallback((kind: ToastKind, message: string, duration?: number) => {
    // remount toast even if same message/kind
    setToast(null)
    requestAnimationFrame(() => setToast({ kind, message, duration }))
  }, [])

  React.useEffect(() => {
    setBase(normalizedFromLoader)
    setDraft(normalizedFromLoader)
  }, [normalizedFromLoader])

  const [permalinkMode, setPermalinkMode] = React.useState<string>(() =>
    detectPreset(draft.permalinks?.post ?? "/:slug/")
  )

  React.useEffect(() => {
    setPermalinkMode(detectPreset(draft.permalinks?.post ?? "/:slug/"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.permalinks?.post])

  const onChange = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const onChangePermalink = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      permalinks: {
        ...prev.permalinks,
        post: normalizePostPermalink(value),
      },
    }))
  }

  const applyPreset = (presetId: string) => {
    const preset = PERMALINK_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    if (presetId === "custom") return

    setDraft((prev) => ({
      ...prev,
      permalinks: {
        ...prev.permalinks,
        post: normalizePostPermalink(preset.pattern),
      },
    }))
  }

  const currentPermalink = normalizePostPermalink(draft.permalinks?.post ?? "/:slug/")
  const writeBranch = getWriteBranchFromCd((draft as any).cd)
  const isDirty = !deepEqual(base, draft)

  React.useEffect(() => {
    if (!isDirty) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)

    let unblock: null | (() => void) = null
    try {
      unblock = router.history.block({
        blockerFn: (tx: any) => {
          const ok = window.confirm("You have unsaved changes. If you leave, they will be lost. Continue?")
          if (ok) {
            unblock?.()
            tx?.retry?.()
          }
        },
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[settings-guard] router.history.block failed:", e)
    }

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      unblock?.()
    }
  }, [isDirty, router])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-neutral-50 to-white">
      {/* ✅ Toast container (fixed, top-right) */}
      {toast ? (
        <div className="fixed right-4 top-4 z-[100] w-[min(420px,calc(100vw-2rem))]">
          <Toast
            kind={toast.kind}
            message={toast.message}
            duration={toast.duration}
            onClose={() => setToast(null)}
          />
        </div>
      ) : null}

      <div className={cx("mx-auto max-w-4xl px-4 py-8 space-y-6", isDirty ? "pb-28" : "pb-8")}>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Site settings</h1>
          <p className="text-sm text-neutral-600">Configure global settings used by the generator and themes.</p>
        </header>

        <Card title="General" description="Branding, language, deployment behavior.">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Site name" hint="Shown in themes and browser titles (depending on theme).">
                <input
                  className={inputBase()}
                  value={(draft as any).siteName ?? ""}
                  onChange={(e) => onChange("siteName" as any, e.target.value as any)}
                />
              </FormField>

              <FormField label="Tagline" hint="Optional short description.">
                <input
                  className={inputBase()}
                  value={(draft as any).tagline ?? ""}
                  onChange={(e) => onChange("tagline" as any, e.target.value as any)}
                />
              </FormField>
            </div>

            <FormField label="Site URL" hint="Optional. Used for canonical URLs, feeds, SEO. Example: https://user.github.io/repo/">
              <input
                className={inputBase()}
                value={(draft as any).siteUrl ?? ""}
                onChange={(e) => onChange("siteUrl" as any, e.target.value as any)}
                placeholder="https://example.com/"
              />
            </FormField>

            <FormField label="Language" hint='Site language code (used by themes/SEO). Examples: "en", "es", "fr".'>
              <input
                className={inputBase()}
                value={(draft as any).language ?? "en"}
                onChange={(e) => onChange("language" as any, e.target.value as any)}
                placeholder="en"
              />
            </FormField>

            <FormField label="Logo">
              <MediaPicker
                label="Select a logo"
                value={(draft as any).logo ?? ""}
                onChange={(v) => onChange("logo" as any, v as any)}
                branch={writeBranch}
                help="Tip: A square-ish PNG/WebP works well. SVG also OK if your site supports it."
              />
            </FormField>

            <FormField label="Favicon">
              <MediaPicker
                label="Select a favicon"
                value={(draft as any).favicon ?? ""}
                onChange={(v) => onChange("favicon" as any, v as any)}
                branch={writeBranch}
                compactPreview
                help="Tip: 32×32 or 48×48 PNG works great. ICO is fine too (preview may vary)."
              />
            </FormField>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField
                label="Continuous deployment (CD)"
                hint='If enabled, Save commits to "main" (redeploy). If disabled, Save commits to "develop" and you’ll deploy later.'
              >
                <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={Boolean((draft as any).cd)}
                    onChange={(e) => onChange("cd" as any, e.target.checked as any)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900">Enable CD</div>
                    <div className="text-xs text-neutral-500">
                      Save goes to <span className="font-mono">{getWriteBranchFromCd(true)}</span>
                    </div>
                  </div>
                </label>
              </FormField>

              <FormField
                label="Index categories"
                hint="If enabled, categories will be indexed/visible in the site navigation (theme-dependent)."
              >
                <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={Boolean((draft as any).indexCategories)}
                    onChange={(e) => onChange("indexCategories" as any, e.target.checked as any)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900">Enable category index</div>
                    <div className="text-xs text-neutral-500">Expose categories to themes/navigation</div>
                  </div>
                </label>
              </FormField>
            </div>
          </div>
        </Card>

        <Card title="Permalinks" description="Choose how post URLs are generated.">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {PERMALINK_PRESETS.filter((p) => p.id !== "custom").map((p) => {
                const selected = permalinkMode !== "custom" && normalizePostPermalink(p.pattern) === currentPermalink

                return (
                  <label
                    key={p.id}
                    className={cx(
                      "group flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm cursor-pointer transition",
                      selected
                        ? "border-neutral-900 ring-4 ring-neutral-900/10"
                        : "border-neutral-200 hover:border-neutral-300 hover:shadow-md hover:-translate-y-[1px]"
                    )}
                  >
                    <input
                      type="radio"
                      name="permalink"
                      checked={selected}
                      onChange={() => applyPreset(p.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-neutral-900">{p.label}</div>
                      <div className="text-xs font-mono text-neutral-600 break-all">{normalizePostPermalink(p.pattern)}</div>
                      <div className="text-xs text-neutral-500">Example: {p.example}</div>
                    </div>
                  </label>
                )
              })}

              <label
                className={cx(
                  "flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm cursor-pointer transition",
                  permalinkMode === "custom"
                    ? "border-neutral-900 ring-4 ring-neutral-900/10"
                    : "border-neutral-200 hover:border-neutral-300 hover:shadow-md hover:-translate-y-[1px]"
                )}
              >
                <input
                  type="radio"
                  name="permalink"
                  checked={permalinkMode === "custom"}
                  onChange={() => setPermalinkMode("custom")}
                  className="mt-1"
                />
                <div className="min-w-0 w-full space-y-3">
                  <div className="text-sm font-semibold text-neutral-900">Custom structure</div>

                  <input
                    className={inputBase("font-mono")}
                    value={(draft as any).permalinks?.post ?? "/:slug/"}
                    onChange={(e) => onChangePermalink(e.target.value)}
                  />

                  <div className="text-xs text-neutral-600">
                    Available tags:
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_TOKENS.map((t) => (
                        <div key={t.token} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <div className="text-xs font-mono text-neutral-900">{t.token}</div>
                          <div className="text-[11px] text-neutral-500">{t.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
                    Current normalized permalink: <span className="font-mono">{currentPermalink}</span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </Card>
      </div>

      {isDirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 via-black/5 to-transparent" />

          <div className="relative mx-auto max-w-4xl px-4 pb-4">
            <div className="rounded-2xl border border-neutral-300 bg-white/95 px-4 py-3 shadow-2xl ring-1 ring-black/10 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-neutral-800">
                  <span className="font-medium">You have unsaved changes.</span>
                  <span className="ml-2 text-xs text-neutral-600">
                    Saving commits to <span className="font-mono text-neutral-900">{writeBranch}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={cx(
                      "rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm shadow-sm",
                      "hover:bg-neutral-50 active:translate-y-[1px] transition"
                    )}
                    onClick={() => {
                      setDraft(base as any)
                      showToast("warning", "Changes discarded.", 2500)
                    }}
                  >
                    Discard
                  </button>

                  <button
                    className={cx(
                      "rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white shadow-sm",
                      "hover:bg-neutral-800 active:translate-y-[1px] transition"
                    )}
                    onClick={async () => {
                      try {
                        const branch = getWriteBranchFromCd((draft as any).cd)
                        await commitSiteSettings(draft, branch)
                        setBase(draft)
                        showToast("success", "Settings saved successfully.", 3000)
                      } catch (e: any) {
                        showToast("error", e?.message ?? String(e), 6000)
                      }
                    }}
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}




