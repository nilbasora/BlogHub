import { getRepoRef } from "./repo"

const TOKEN_URL = "https://github.com/login/oauth/access_token"
const DEVICE_CODE_URL = "https://github.com/login/device/code"
const API = "https://api.github.com"

const TOKEN_KEY = "bloghub.githubToken"
const NEXT_KEY = "bloghub.loginNext"
const LOGIN_ERROR_KEY = "bloghub.loginError"

/* ------------------------------------------------------------------ */
/* Token storage                                                       */
/* ------------------------------------------------------------------ */

export function getGithubToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setGithubToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearGithubToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function readLoginNext() {
  return localStorage.getItem(NEXT_KEY) || "/admin/"
}

export function clearLoginNext() {
  localStorage.removeItem(NEXT_KEY)
}

export function setLoginError(message: string) {
  localStorage.setItem(LOGIN_ERROR_KEY, message)
}

export function readLoginError(): string | null {
  return localStorage.getItem(LOGIN_ERROR_KEY)
}

export function clearLoginError() {
  localStorage.removeItem(LOGIN_ERROR_KEY)
}

/* ------------------------------------------------------------------ */
/* Device Flow                                                         */
/* ------------------------------------------------------------------ */

export type DeviceSession = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export async function startGithubLoginDevice(next = "/admin/") {
  localStorage.setItem(NEXT_KEY, next)

  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
  if (!clientId) throw new Error("Missing VITE_GITHUB_CLIENT_ID")

  const body = new URLSearchParams({
    client_id: clientId,
    scope: "repo",
  })

  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  const data = (await res.json()) as any
  if (!res.ok)
    throw new Error(data?.error_description || "Device flow start failed")

  return {
    device_code: String(data.device_code),
    user_code: String(data.user_code),
    verification_uri: String(data.verification_uri),
    expires_in: Number(data.expires_in),
    interval: Number(data.interval),
  }
}

export async function pollDeviceFlowToken(opts: {
  device_code: string
  interval: number
  expires_in: number
  onUpdate?: (msg: string) => void
  isCancelled?: () => boolean
}) {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
  if (!clientId) throw new Error("Missing VITE_GITHUB_CLIENT_ID")

  const start = Date.now()
  let intervalMs = Math.max(1, opts.interval) * 1000

  const sleep = (ms: number) =>
    new Promise<void>((r) => setTimeout(r, ms))

  while (true) {
    if (opts.isCancelled?.()) throw new Error("Login cancelled")

    if ((Date.now() - start) / 1000 > opts.expires_in)
      throw new Error("Login expired")

    const body = new URLSearchParams({
      client_id: clientId,
      device_code: opts.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    })

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })

    const data = (await res.json()) as any

    if (data?.access_token) return String(data.access_token)

    if (data?.error === "authorization_pending") {
      opts.onUpdate?.("Waiting for GitHub authorization…")
      await sleep(intervalMs)
      continue
    }

    if (data?.error === "slow_down") {
      intervalMs += 5000
      await sleep(intervalMs)
      continue
    }

    throw new Error(data?.error_description || data?.error || "Login failed")
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export async function validateTokenForRepo(token: string) {
  const { owner, repo } = getRepoRef()

  const res = await fetch(`${API}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  })

  if (!res.ok) throw new Error("Token has no access to configured repo")

  const data = (await res.json()) as any
  const perms = data?.permissions
  const canWrite = Boolean(perms?.push || perms?.admin)

  if (!canWrite)
    throw new Error("Token does not have write permissions to repo")

  return true
}
