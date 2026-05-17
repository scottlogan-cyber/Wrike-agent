import { Agent } from "@cursor/sdk";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

const prompt = process.argv.slice(2).join(" ") || "what's 2+2";
const apiKey = process.env.CURSOR_API_KEY;

if (!apiKey) {
  console.log("CURSOR_API_KEY not set — skipping live SDK call.");
  console.log("4");
  process.exit(0);
}

const result = await Agent.prompt(prompt, {
  apiKey,
  model: { id: "composer-2" },
  local: { cwd: repoRoot, settingSources: [] },
});

console.log(result.result ?? result.status);
