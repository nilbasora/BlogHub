import { withBase } from "@/core/config/paths"

async function assertOk(res: Response, path: string) {
  if (!res.ok) {
    throw new Error(`Failed to load ${path}`)
  }
}

export async function fetchJsonWithBase<T>(path: string): Promise<T> {
  const res = await fetch(withBase(path))
  await assertOk(res, path)
  return res.json() as Promise<T>
}

export async function fetchTextWithBase(path: string): Promise<string> {
  const res = await fetch(withBase(path))
  await assertOk(res, path)
  return res.text()
}
