import * as React from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"

import { loadSettingsFromRepo } from "@/core/content/loadSettingsFromRepo"
import { loadPostsIndexFromRepo } from "@/core/content/loadPostsIndexFromRepo"
import { loadRoutesManifestFromRepo } from "@/core/content/loadRoutesManifestFromRepo"
import { loadMarkdownPostFromRepo } from "@/core/content/loadMarkdownPostFromRepo"

import { resolvePostPermalink } from "@/../scripts/permalink"
import { FormField } from "@/components/admin/FormField"
import { writePreviewPostDraft } from "@/core/preview/previewPost"
import { writePreviewSettings } from "@/core/preview/previewSettings"
import { MarkdownEditor } from "@/components/admin/MarkdownEditor"
import { parseFrontmatterBlock, buildMarkdownFile } from "@/core/posts/frontmatter"

const BRANCH = "develop"

export const Route = createFileRoute("/admin/posts/$postId")({
  loader: async ({ params }) => {
    const postId = params.postId

    if (postId === "new") {
      const settings = await loadSettingsFromRepo(BRANCH)
      const today = new Date().toISOString().slice(0, 10)

      return {
        mode: "new" as const,
        settings,
        existing: null,
        initial: {
          id: crypto.randomUUID(),
          title: "",
          slug: "",
          date: today,
          status: "draft" as const,
          excerpt: "",
          tags: [] as string[],
          categories: [] as string[],
          seo_title: "",
          seo_description: "",
          seo_image: "",
          body: "",
        },
      }
    }

    const [settings, index, manifest] = await Promise.all([
      loadSettingsFromRepo(BRANCH),
      loadPostsIndexFromRepo(BRANCH),
      loadRoutesManifestFromRepo(BRANCH),
    ])

    const postMeta = index.posts.find((p) => p.id === postId)
    if (!postMeta) {
      return {
        mode: "missing" as const,
        settings,
        existing: null,
        initial: null,
      }
    }

    const mdPath = manifest.routes[postMeta.url]
    if (!mdPath) {
      return {
        mode: "missing" as const,
        settings,
        existing: postMeta,
        initial: null,
      }
    }

    const raw = await loadMarkdownPostFromRepo(mdPath, BRANCH)
    const parsed = parseFrontmatterBlock(raw)

    return {
      mode: "edit" as const,
      settings,
      existing: postMeta,
      initial: {
        ...(parsed.frontmatter as any),
        body: parsed.body,
      },
    }
  },
  component: AdminPostEditorPage,
})

type Draft = {
  id: string
  title: string
  slug: string
  date: string
  status: "draft" | "published"
  excerpt?: string
  tags: string[]
  categories: string[]
  seo_title?: string
  seo_description?: string
  seo_image?: string
  body: string
}

function shortId(id: string): string {
  return (id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "untitled"
}

function slugifyTitle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
}

function ensureTitleAndSlug(draft: Draft): Draft {
  let next = { ...draft }
  const sid = shortId(next.id)

  if (!next.title?.trim()) {
    next.title = `Untitled - ${sid}`
  }

  if (!next.slug?.trim()) {
    const base = slugifyTitle(next.title)
    next.slug = base || `untitled-${sid}`
  }

  return next
}

function deepEqualDraft(a: Draft, b: Draft): boolean {
  const norm = (d: Draft) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    date: d.date,
    status: d.status,
    excerpt: d.excerpt ?? "",
    tags: d.tags ?? [],
    categories: d.categories ?? [],
    seo_title: d.seo_title ?? "",
    seo_description: d.seo_description ?? "",
    seo_image: d.seo_image ?? "",
    body: d.body ?? "",
  })

  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

function AdminPostEditorPage() {
  const data = Route.useLoaderData()
  const postId = Route.useParams().postId
  const navigate = useNavigate()

  if (data.mode === "missing") {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Post not found</h1>
        <Link to="/admin/posts" className="underline">
          Back to posts
        </Link>
      </div>
    )
  }

  const initial = data.initial as Draft
  const [draft, setDraft] = React.useState<Draft>(() => initial)

  React.useEffect(() => {
    setDraft(initial)
  }, [postId])

  const lastSavedRef = React.useRef<Draft>(initial)
  React.useEffect(() => {
    lastSavedRef.current = initial
  }, [initial])

  const isDirty = !deepEqualDraft(draft, lastSavedRef.current)

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  function confirmLeave(): boolean {
    if (!isDirty) return true
    return window.confirm(
      "You have unsaved/unpublished changes. If you leave now, you will lose them."
    )
  }

  const resolvedUrl = React.useMemo(() => {
    try {
      return resolvePostPermalink(
        {
          id: draft.id,
          title: draft.title,
          slug: draft.slug,
          date: draft.date,
          status: draft.status,
          excerpt: draft.excerpt,
          tags: draft.tags,
          categories: draft.categories,
        } as any,
        data.settings as any
      )
    } catch {
      const slug = draft.slug?.trim() || "untitled"
      return `/${slug}/`
    }
  }, [draft, data.settings])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function updateList(key: "tags" | "categories", value: string) {
    const arr = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    setDraft((prev) => ({ ...prev, [key]: arr }))
  }

  function normalizeNewDraftIfNeeded(): Draft {
    if (postId !== "new") return draft
    const normalized = ensureTitleAndSlug(draft)
    setDraft(normalized)
    return normalized
  }

  const publishLabel = draft.status === "draft" ? "Save as Draft" : "Publish"

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold">
            {data.mode === "new" ? "New post" : "Edit post"}
          </h1>
          <div className="text-xs opacity-70 truncate">
            URL: <span className="font-mono">{resolvedUrl}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm bg-white"
            onClick={() => {
              if (!confirmLeave()) return
              navigate({ to: "/admin/posts" })
            }}
          >
            Back
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-white"
            onClick={() => {
              const d = normalizeNewDraftIfNeeded()

              writePreviewSettings(data.settings as any)

              const previewUrl = resolvedUrl

              writePreviewPostDraft({
                id: postId === "new" ? d.id : postId,
                frontmatter: { ...d },
                body: d.body,
                url: previewUrl,
                updatedAt: new Date().toISOString(),
              })

              const base = import.meta.env.BASE_URL || "/"
              window.open(
                `${window.location.origin}${base}${previewUrl.replace(
                  /^\//,
                  ""
                )}?preview=true&postPreview=${postId === "new" ? d.id : postId}`,
                "_blank"
              )
            }}
          >
            Preview
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900"
            onClick={() => {
              const d = normalizeNewDraftIfNeeded()
              const file = buildMarkdownFile(d)
              console.log(`${publishLabel.toUpperCase()} FILE:\n`, file)

              lastSavedRef.current = d
              setDraft(d)
              alert(`${publishLabel}: TODO (will commit .md to GitHub later).`)
            }}
          >
            {publishLabel}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main editor */}
        <section className="lg:col-span-8 space-y-4">
          <div className="rounded-lg border bg-white p-5 space-y-4">
            <FormField label="Title">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </FormField>

            <FormField label="Body">
              <MarkdownEditor
                value={draft.body}
                onChange={(v) => update("body", v)}
                onInsertImage={(placeholderPath) => {
                  const text = `\n\n![alt](${placeholderPath})\n\n`
                  update("body", draft.body + text)
                }}
              />
            </FormField>
          </div>
        </section>

        {/* Sidebar meta */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-lg border bg-white p-5 space-y-4">
            <div className="text-sm font-semibold">Post settings</div>

            <FormField label="Slug" hint="Used in the permalink pattern.">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                value={draft.slug}
                onChange={(e) => update("slug", e.target.value)}
              />
            </FormField>

            <FormField label="Date">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="date"
                value={draft.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </FormField>

            <FormField label="Status">
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={draft.status}
                onChange={(e) => update("status", e.target.value as any)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </FormField>

            <FormField label="Excerpt">
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={draft.excerpt ?? ""}
                onChange={(e) => update("excerpt", e.target.value)}
              />
            </FormField>

            <FormField label="Tags" hint='Comma-separated. Example: "hello, dev"'>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={(draft.tags ?? []).join(", ")}
                onChange={(e) => updateList("tags", e.target.value)}
              />
            </FormField>

            <FormField
              label="Categories"
              hint='Comma-separated. Example: "general, tech"'
            >
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={(draft.categories ?? []).join(", ")}
                onChange={(e) => updateList("categories", e.target.value)}
              />
            </FormField>
          </div>

          <div className="rounded-lg border bg-white p-5 space-y-4">
            <div className="text-sm font-semibold">SEO</div>

            <FormField label="SEO title">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={draft.seo_title ?? ""}
                onChange={(e) => update("seo_title", e.target.value)}
              />
            </FormField>

            <FormField label="SEO description">
              <textarea
                className="rounded-md border px-3 py-2 text-sm w-full"
                rows={3}
                value={draft.seo_description ?? ""}
                onChange={(e) => update("seo_description", e.target.value)}
              />
            </FormField>

            <FormField label="SEO image">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                value={draft.seo_image ?? ""}
                onChange={(e) => update("seo_image", e.target.value)}
                placeholder="/media/..."
              />
            </FormField>
          </div>
        </aside>
      </div>
    </div>
  )
}
