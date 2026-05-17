/**
 * Resolve scott.logan@team.wrike.com → Slack user ID and verify bot token.
 * Usage: SLACK_BOT_TOKEN=xoxb-... npx tsx src/scripts/slack-setup.ts
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(repoRoot, ".env") });

const EMAIL = process.env.SLACK_SETUP_EMAIL ?? "scott.logan@team.wrike.com";
const token = process.env.SLACK_BOT_TOKEN;

if (!token?.startsWith("xox")) {
  console.error(
    "Set SLACK_BOT_TOKEN (Bot User OAuth Token from api.slack.com → your app → OAuth & Permissions)."
  );
  process.exit(1);
}

async function slackApi(method: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  return res.json();
}

const auth = (await slackApi("auth.test", {})) as {
  ok: boolean;
  error?: string;
  team?: string;
  user_id?: string;
  bot_id?: string;
};
if (!auth.ok) {
  console.error("auth.test failed:", auth.error);
  process.exit(1);
}
console.log("Bot connected to workspace:", auth.team);
console.log("Bot user id:", auth.user_id);

const lookup = (await slackApi("users.lookupByEmail", {
  email: EMAIL,
})) as { ok: boolean; error?: string; user?: { id: string; name: string } };
if (!lookup.ok || !lookup.user) {
  console.error("users.lookupByEmail failed:", lookup.error);
  console.error(
    "Add scope users:read.email, reinstall app to workspace, then retry."
  );
  process.exit(1);
}

console.log(`Your Slack user: ${lookup.user.name} (${lookup.user.id})`);

const envPath = resolve(repoRoot, ".env");
const lines = existsSync(envPath)
  ? readFileSync(envPath, "utf-8").split("\n")
  : readFileSync(resolve(repoRoot, ".env.example"), "utf-8").split("\n");

function setKey(key: string, value: string): void {
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
}

setKey("SLACK_BOT_TOKEN", token);
setKey("MY_SLACK_USER_ID", lookup.user.id);

if (!lines.some((l) => l.startsWith("SLACK_SIGNING_SECRET=") && l.length > 22)) {
  console.log(
    "\nAdd SLACK_SIGNING_SECRET from api.slack.com → Basic Information → App Credentials"
  );
}

writeFileSync(envPath, lines.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n") + "\n");
console.log(`\nUpdated ${envPath}`);
console.log("MY_SLACK_USER_ID=", lookup.user.id);
