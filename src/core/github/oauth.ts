import { getRepoRef } from "./repo"

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
const TOKEN_URL = "https://github.com/login/oauth/access_token"
const API = "https://api.github.com"

const TOKEN_KEY = "bloghub.githubToken"
const VERIFIER_KEY = "bloghub.pkce.verifier"
const STATE_KEY = "bloghub.pkce.state"
const NEXT_KEY = "bloghub.loginNext"
const LOGIN_ERROR_KEY = "bloghub.loginError"

// DEV bypass token
const DEV_BYPASS_TOKEN = "__DEV_BYPASS__"

function randomString(len = 64) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ""
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length]
  return out
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return new Uint8Array(digest)
}

function base64Url(bytes: Uint8Array) {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function challengeFromVerifier(verifier: string) {
  return base64Url(await sha256(verifier))
}

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

export function getRedirectUri() {
  // Works for dev + GH Pages (BASE_URL includes /repo/ when deployed)
  const base = window.location.origin
  const viteBase = import.meta.env.BASE_URL || "/"
  const prefix = viteBase.endsWith("/") ? viteBase.slice(0, -1) : viteBase
  return `${base}${prefix}/login/callback`
}

export async function startGithubLogin(next = "/admin/") {
  // DEV: bypass OAuth completely
  if (import.meta.env.DEV) {
    setGithubToken(DEV_BYPASS_TOKEN)
    localStorage.setItem(NEXT_KEY, next)
    window.location.href = next
    return
  }

  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
  if (!clientId) throw new Error("Missing VITE_GITHUB_CLIENT_ID")

  const verifier = randomString(64)
  const challenge = await challengeFromVerifier(verifier)
  const state = randomString(24)

  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(NEXT_KEY, next)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: "repo",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })

  window.location.href = `${AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string, state: string) {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
  if (!clientId) throw new Error("Missing VITE_GITHUB_CLIENT_ID")

  const expectedState = localStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) throw new Error("Invalid OAuth state")

  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error("Missing PKCE verifier")

  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
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
  if (!res.ok) throw new Error(data?.error_description || "Token exchange failed")
  if (!data.access_token) throw new Error("No access_token returned")

  localStorage.removeItem(VERIFIER_KEY)
  localStorage.removeItem(STATE_KEY)

  return String(data.access_token)
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

export async function validateTokenForRepo(token: string) {
  // DEV: always valid
  if (import.meta.env.DEV && token === DEV_BYPASS_TOKEN) {
    return true
  }

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

  if (!canWrite) throw new Error("Token does not have write permissions to repo")

  return true
}
