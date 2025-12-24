import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { loadSettings } from "@/core/content/loadSettings"
import type { SiteSettings } from "@/core/utils/types"
import { FormField } from "@/components/admin/FormField"
import { commitSiteSettings } from "@/core/github/commit"

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
  { id: "plain", label: "Plain", pattern: "/:slug/", example: "/my-post/" },
  { id: "day_name", label: "Day and name", pattern: "/:year/:month/:day/:slug/", example: "/2025/12/19/my-post/" },
  { id: "month_name", label: "Month and name", pattern: "/:year/:month/:slug/", example: "/2025/12/my-post/" },
  { id: "numeric", label: "Numeric", pattern: "/archives/:id/", example: "/archives/12345/" },
  { id: "category_name", label: "Category and name", pattern: "/:category/:slug/", example: "/tech/my-post/" },
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

// Branch rule based on "cd"
function getWriteBranchFromCd(cd: boolean | undefined) {
  return cd ? "main" : "develop"
}

function AdminSettingsPage() {
  const { settings } = Route.useLoaderData()

  const [draft, setDraft] = React.useState<SiteSettings>(() => {
    // Ensure defaults exist so UI doesn’t break if fields are missing in file
    return {
      ...settings,
      language: (settings as any).language ?? "en",
      logo: (settings as any).logo ?? "",
      favicon: (settings as any).favicon ?? "",
      cd: (settings as any).cd ?? false,
      indexCategories: (settings as any).indexCategories ?? true,
      permalinks: {
        ...(settings as any).permalinks,
        post: normalizePostPermalink((settings as any).permalinks?.post ?? "/:slug/"),
      },
    } as SiteSettings
  })

  // Permalink selector mode
  const [permalinkMode, setPermalinkMode] = React.useState<string>(() =>
    detectPreset(draft.permalinks?.post ?? "/:slug/")
  )

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
  const writeBranch = getWriteBranchFromCd((draft as any).cd)

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Site settings</h1>
        <p className="text-sm opacity-80">Configure global settings used by the generator and themes.</p>
      </header>

      {/* General */}
      <section className="space-y-5 rounded-lg border bg-white p-5">
        <div className="text-sm font-semibold">General</div>

        <FormField label="Site name" hint="Shown in themes and browser titles (depending on theme).">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={(draft as any).siteName ?? ""}
            onChange={(e) => onChange("siteName" as any, e.target.value as any)}
          />
        </FormField>

        <FormField label="Tagline" hint="Optional short description.">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={(draft as any).tagline ?? ""}
            onChange={(e) => onChange("tagline" as any, e.target.value as any)}
          />
        </FormField>

        <FormField
          label="Site URL"
          hint="Optional. Used for canonical URLs, feeds, SEO. Example: https://user.github.io/repo/"
        >
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={(draft as any).siteUrl ?? ""}
            onChange={(e) => onChange("siteUrl" as any, e.target.value as any)}
            placeholder="https://example.com/"
          />
        </FormField>

        <FormField
          label="Language"
          hint='Site language code (used by themes/SEO). Examples: "en", "es", "ca".'
        >
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={(draft as any).language ?? "en"}
            onChange={(e) => onChange("language" as any, e.target.value as any)}
            placeholder="en"
          />
        </FormField>

        <FormField
          label="Logo"
          hint='Path or URL to a logo. Example: "/assets/logo.png".'
        >
          <input
            className="w-full rounded-md border px-3 py-2 text-sm font-mono"
            value={(draft as any).logo ?? ""}
            onChange={(e) => onChange("logo" as any, e.target.value as any)}
            placeholder="/assets/logo.png"
          />
        </FormField>

        <FormField
          label="Favicon"
          hint='Path or URL to a favicon. Example: "/assets/favicon.ico".'
        >
          <input
            className="w-full rounded-md border px-3 py-2 text-sm font-mono"
            value={(draft as any).favicon ?? ""}
            onChange={(e) => onChange("favicon" as any, e.target.value as any)}
            placeholder="/assets/favicon.ico"
          />
        </FormField>

        <FormField
          label="Continuous deployment (CD)"
          hint='If enabled, Save will commit to "main" (redeploy). If disabled, Save commits to "develop" and you’ll deploy later.'
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean((draft as any).cd)}
              onChange={(e) => onChange("cd" as any, e.target.checked as any)}
            />
            Enable CD (commit to main)
          </label>

          <div className="mt-2 text-xs opacity-70">
            Current save branch: <span className="font-mono">{writeBranch}</span>
          </div>
        </FormField>

        <FormField
          label="Index categories"
          hint="If enabled, categories will be indexed/visible in the site navigation (theme-dependent)."
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean((draft as any).indexCategories)}
              onChange={(e) => onChange("indexCategories" as any, e.target.checked as any)}
            />
            Enable category index
          </label>
        </FormField>
      </section>

      {/* Permalinks */}
      <section className="space-y-5 rounded-lg border bg-white p-5">
        <div className="text-sm font-semibold">Permalinks</div>

        <div className="space-y-3">
          {PERMALINK_PRESETS.filter((p) => p.id !== "custom").map((p) => {
            const selected =
              permalinkMode !== "custom" && normalizePostPermalink(p.pattern) === currentPermalink

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
                value={(draft as any).permalinks?.post ?? "/:slug/"}
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
            </div>
          </label>
        </div>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={async () => {
            try {
              const branch = getWriteBranchFromCd((draft as any).cd)
              await commitSiteSettings(draft, branch)
              alert(`Settings saved to GitHub ✅ (branch: ${branch})`)
            } catch (e: any) {
              alert(e?.message ?? String(e))
            }
          }}
        >
          Save
        </button>
      </section>
    </div>
  )
}
