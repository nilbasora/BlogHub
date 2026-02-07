import type {
  MediaIndex,
  PostsIndex,
  RoutesManifest,
  SiteSettings,
} from "@/core/domain/types"
import { readRepoJsonFile, readRepoTextFile } from "@/core/api/github/files"

const DEFAULT_BRANCH = "develop"

export function loadSettingsFromRepo(branch: string = DEFAULT_BRANCH): Promise<SiteSettings> {
  return readRepoJsonFile<SiteSettings>({
    repoFilePath: "public/site/settings.json",
    branch,
  })
}

export function loadPostsIndexFromRepo(branch: string = DEFAULT_BRANCH): Promise<PostsIndex> {
  return readRepoJsonFile<PostsIndex>({
    repoFilePath: "public/generated/posts-index.json",
    branch,
  })
}

export function loadRoutesManifestFromRepo(branch: string = DEFAULT_BRANCH): Promise<RoutesManifest> {
  return readRepoJsonFile<RoutesManifest>({
    repoFilePath: "public/generated/routes-manifest.json",
    branch,
  })
}

export function loadMediaIndexFromRepo(branch: string = DEFAULT_BRANCH): Promise<MediaIndex> {
  return readRepoJsonFile<MediaIndex>({
    repoFilePath: "public/generated/media-index.json",
    branch,
  })
}

export function loadMarkdownPostFromRepo(
  publicPath: string,
  branch: string = DEFAULT_BRANCH
): Promise<string> {
  const repoPath = `public/${publicPath.replace(/^\/+/, "")}`
  return readRepoTextFile({
    repoFilePath: repoPath,
    branch,
  })
}
