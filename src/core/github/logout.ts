// @/core/github/logout.ts
let logoutHandler: ((reason?: string) => void) | null = null

export function registerLogoutHandler(fn: (reason?: string) => void) {
  logoutHandler = fn
}

export function forceLogout(reason?: string) {
  logoutHandler?.(reason)
}
