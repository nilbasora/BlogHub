import type {
  MediaIndex,
  PostsIndex,
  RoutesManifest,
  SiteSettings,
} from "@/core/domain/types"
import { fetchJsonWithBase, fetchTextWithBase } from "./contentClient"

export function loadSettings(): Promise<SiteSettings> {
  return fetchJsonWithBase<SiteSettings>("site/settings.json")
}

export function loadPostsIndex(): Promise<PostsIndex> {
  return fetchJsonWithBase<PostsIndex>("generated/posts-index.json")
}

export function loadRoutesManifest(): Promise<RoutesManifest> {
  return fetchJsonWithBase<RoutesManifest>("generated/routes-manifest.json")
}

export function loadMediaIndex(): Promise<MediaIndex> {
  return fetchJsonWithBase<MediaIndex>("generated/media-index.json")
}

export function loadMarkdownPost(markdownPath: string): Promise<string> {
  return fetchTextWithBase(markdownPath)
}
