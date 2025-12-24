// scripts/check-env.ts
import { loadEnv } from "vite"

const mode = process.env.NODE_ENV || "development"

// Load .env, .env.local, .env.[mode], .env.[mode].local into process.env
const env = loadEnv(mode, process.cwd(), "")

// merge into process.env so the rest of your script can read it normally
for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v
}

const requiredEnvVars = ["VITE_GITHUB_CLIENT_ID", "VITE_REPO_URL"] as const

const missing = requiredEnvVars.filter(
  (key) => !process.env[key] || process.env[key]!.trim() === "",
)

if (missing.length) {
  console.error("❌ Missing required environment variables:")
  for (const key of missing) console.error(`   - ${key}`)
  process.exit(1)
}

console.log("✅ All required environment variables are set:")
for (const key of requiredEnvVars) console.log(`   - ${key}`)
