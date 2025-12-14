// Ensures this works both locally and on GitHub Pages project sites
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || "/"
  const p = path.startsWith("/") ? path.slice(1) : path
  return new URL(p, window.location.origin + base).toString()
}
