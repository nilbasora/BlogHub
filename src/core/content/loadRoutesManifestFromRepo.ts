import { readRepoJsonFile } from "@/core/github/readFile"

export type RoutesManifest = {
  routes: Record<string, string> // url -> markdown path
}

export async function loadRoutesManifestFromRepo(branch: string = "develop"): Promise<RoutesManifest> {
  return readRepoJsonFile<RoutesManifest>({
    repoFilePath: "public/generated/routes-manifest.json",
    branch,
  })
}
