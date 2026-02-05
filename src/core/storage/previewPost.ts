export type PreviewPostDraft = {
  id: string
  frontmatter: Record<string, any>
  body: string
  url: string // resolved permalink (best effort)
  updatedAt: string
}

const KEY = "bloghub.previewPostDraft"

export function writePreviewPostDraft(draft: PreviewPostDraft) {
  localStorage.setItem(KEY, JSON.stringify(draft))
}

export function readPreviewPostDraft(): PreviewPostDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PreviewPostDraft) : null
  } catch {
    return null
  }
}

export function clearPreviewPostDraft() {
  localStorage.removeItem(KEY)
}
