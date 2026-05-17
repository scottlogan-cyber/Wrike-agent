#!/usr/bin/env node
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
let input = "";
try {
  input = readFileSync(0, "utf-8");
} catch {
  process.exit(0);
}

if (!input.trim()) process.exit(0);

try {
  const payload = JSON.parse(input);
  const db = new Database(join(root, "data/agent.db"));
  db.prepare(
    `INSERT INTO events (type, tool, input_json, output_preview)
     VALUES ('tool_hook', ?, ?, ?)`
  ).run(
    payload.tool ?? payload.toolName ?? "unknown",
    JSON.stringify(payload.input ?? payload),
    String(payload.output ?? "").slice(0, 2000)
  );
} catch {
  /* db may not exist yet */
}
