import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

config({ path: resolve(repoRoot, ".env") });

function repoPath(p: string | undefined, fallback: string): string {
  const raw = p?.trim() || fallback;
  return raw.startsWith("/") ? raw : resolve(repoRoot, raw.replace(/^\.\//, ""));
}

export const REPO_ROOT = repoRoot;
export const DATA_DIR = resolve(repoRoot, "data");

export const env = {
  cursorApiKey: process.env.CURSOR_API_KEY ?? "",
  port: Number(process.env.AGENT_PORT ?? 8000),
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  mySlackUserId: process.env.MY_SLACK_USER_ID ?? "",
  myWrikeUserId: process.env.MY_WRIKE_USER_ID ?? "",
  ryanWrikeUserId: process.env.RYAN_WRIKE_USER_ID ?? "",
  tyWrikeUserId: process.env.TY_WRIKE_USER_ID ?? "",
  myQueueFolderId: process.env.MY_QUEUE_FOLDER_ID ?? "",
  wrikeDemoPat: process.env.WRIKE_DEMO_PAT ?? "",
  wrikeApiBase: process.env.WRIKE_API_BASE ?? "https://www.wrike.com/api/v4",
  wrikeAccessToken: process.env.WRIKE_ACCESS_TOKEN ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubRepo: process.env.GITHUB_REPO ?? "",
  obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH ?? "",
  obsidianRoutingRulesPath: repoPath(
    process.env.OBSIDIAN_ROUTING_RULES_PATH,
    "config/obsidian-routing.json"
  ),
  watchIntervalSeconds: Number(process.env.WATCH_INTERVAL_SECONDS ?? 60),
  staleThresholdDays: Number(process.env.STALE_THRESHOLD_DAYS ?? 3),
  wsAuthToken: process.env.WS_AUTH_TOKEN ?? "leonidas-dev-token",
  maxTurns: Number(process.env.MAX_TURNS ?? 40),
  maxRunCostUsd: Number(process.env.MAX_RUN_COST_USD ?? 0.5),
  maxArchitectCostUsd: Number(process.env.MAX_ARCHITECT_COST_USD ?? 1.5),
};
