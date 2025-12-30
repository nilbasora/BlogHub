// scripts/generate.ts
import { execSync } from "node:child_process"
import path from "node:path"

const ROOT = process.cwd()

function runTsx(scriptFile: string) {
  const fullPath = path.join(ROOT, "scripts", scriptFile)
  console.log(`▶️  ${scriptFile}`)
  execSync(`npx tsx "${fullPath}"`, {
    stdio: "inherit",
    env: process.env,
  })
}

function main() {
  console.log("🚀 Generating site assets…\n")

  runTsx("generate-content.ts")
  runTsx("generate-media.ts")

  console.log("\n✅ All assets generated")
}

main()
