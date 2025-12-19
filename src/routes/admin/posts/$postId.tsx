import * as React from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { loadSettings } from "@/core/content/loadSettings"
import { loadPostsIndex } from "@/core/content/loadPostsIndex"
import { loadRoutesManifest } from "@/core/content/loadRoutesManifest"
import { loadMarkdownPost } from "@/core/content/loadMarkdownPost"
import { resolvePostPermalink } from "@/../scripts/permalink" // if this isn't importable in your Vite build, we’ll copy the same logic into /src
import { FormField } from "@/admin/components/FormField"
import { writePreviewPostDraft } from "@/core/preview/previewPost"
import { writePreviewSettings } from "@/core/preview/previewSettings"
import { MarkdownEditor } from "@/admin/components/MarkdownEditor"
import { parseFrontmatterBlock, buildMarkdownFile } from "@/core/posts/frontmatter"

export const Route = createFileRoute("/admin/posts/$postId")({
  loader: async ({ params }) => {
    const postId = params.postId
    const [settings, index, manifest] = await Promise.all([
      loadSettings(),
      loadPostsIndex(),
      loadRoutesManifest(),
    ])

    if (postId === "new") {
      const today = new Date().toISOString().slice(0, 10)
      return {
        mode: "new" as const,
        settings,
        existing: null,
        initial: {
          id: `post_${crypto.randomUUID().slice(0, 8)}`,
          title: "",
          slug: "",
          date: today,
          status: "draft",
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

    // existing
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

    const raw = await loadMarkdownPost(mdPath)
    const parsed = parseFrontmatterBlock(raw)

    return {
      mode: "edit" as const,
      settings,
      existing: postMeta,
      initial: {
        ...parsed.frontmatter,
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

const DRAFTS_KEY = "bloghub.postDrafts.v1"

function loadLocalDraft(postId: string): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, Draft>
    return map[postId] ?? null
  } catch {
    return null
  }
}

function saveLocalDraft(postId: string, draft: Draft) {
  const map: Record<string, Draft> = (() => {
    try {
      const raw = localStorage.getItem(DRAFTS_KEY)
      return raw ? (JSON.parse(raw) as Record<string, Draft>) : {}
    } catch {
      return {}
    }
  })()

  map[postId] = draft
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(map))
}

function AdminPostEditorPage() {
  const data = Route.useLoaderData()
  const postId = Route.useParams().postId

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

  const initial = data.initial as any

  const [draft, setDraft] = React.useState<Draft>(() => {
    const local = loadLocalDraft(postId)
    return (local ?? initial) as Draft
  })

  React.useEffect(() => {
    // if user navigates to another post id, reset state
    const local = loadLocalDraft(postId)
    setDraft((local ?? initial) as Draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const resolvedUrl = React.useMemo(() => {
    try {
      // If resolvePostPermalink is not importable, we’ll replace it next step.
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
      // fallback
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

  const canPreview = Boolean(draft.slug?.trim())

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
          <Link to="/admin/posts" className="rounded-md border px-3 py-2 text-sm bg-white">
            Back
          </Link>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-white"
            onClick={() => {
              saveLocalDraft(postId, draft)
              alert("Draft saved locally.")
            }}
          >
            Save draft
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-white"
            disabled={!canPreview}
            onClick={() => {
              // Ensure preview settings exist (so theme + site settings match what admin is editing)
              writePreviewSettings(data.settings as any)

              // Write draft post for preview
              writePreviewPostDraft({
                id: postId === "new" ? draft.id : postId,
                frontmatter: {
                  ...draft,
                },
                body: draft.body,
                url: resolvedUrl,
                updatedAt: new Date().toISOString(),
              })

              const base = import.meta.env.BASE_URL || "/"
              window.open(
                `${window.location.origin}${base}${resolvedUrl.replace(/^\//, "")}?preview=true&postPreview=${
                  postId === "new" ? draft.id : postId
                }`,
                "_blank"
              )
            }}
          >
            Preview
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm bg-neutral-900 text-white border-neutral-900"
            onClick={() => {
              // placeholder for GitHub commit later
              const file = buildMarkdownFile(draft)
              console.log("PUBLISH FILE:\n", file)
              alert("Publish: TODO (will commit .md to GitHub later).")
            }}
          >
            Publish
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
                  // MVP: just inserts a markdown image reference (later uploads/commits)
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

            <FormField label="Categories" hint='Comma-separated. Example: "general, tech"'>
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
                className="w-full rounded-md border px-3 py-2 text-sm"
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
