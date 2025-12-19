export type MediaType = "image" | "video" | "gif" | "other"

export type MediaIndexItem = {
  path: string // e.g. "/media/foo.png"
  type: MediaType
  createdAt?: string
}

export type MediaIndex = {
  version: number
  generatedAt: string
  items: MediaIndexItem[]
}

export type MediaUsage = {
  version: number
  generatedAt: string
  usage: Record<string, string[]> // path -> [postId...]
}

// UI model
export type MediaRow = MediaIndexItem & {
  usedBy: string[]
}
