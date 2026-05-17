import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "../config.js";

export interface RoutingRules {
  [topic: string]: string;
  default: string;
}

export function loadRoutingRules(): RoutingRules {
  const raw = readFileSync(env.obsidianRoutingRulesPath, "utf-8");
  return JSON.parse(raw) as RoutingRules;
}

export function resolveNotePath(topic: string, clientName: string, taskId: string): string {
  const rules = loadRoutingRules();
  const folder = rules[topic] ?? rules.default;
  const slug = clientName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "client";
  const date = new Date().toISOString().slice(0, 10);
  return join(folder, `${date}-${slug}-${taskId}.md`);
}

export function buildEngagementNote(input: {
  taskId: string;
  client: string;
  topic: string;
  request: string;
  research: string;
  callNotes: string;
  plan: string;
  questions: string;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  return `---
task_id: ${input.taskId}
client: ${input.client}
topic: ${input.topic}
date: ${date}
---

## Request
${input.request}

## Research
${input.research}

## Call Notes
${input.callNotes}

## My Plan
${input.plan}

## Open Questions
${input.questions}
`;
}

export function writeObsidianNote(relativePath: string, content: string): string {
  if (!env.obsidianVaultPath) {
    throw new Error("OBSIDIAN_VAULT_PATH not set");
  }
  const full = join(env.obsidianVaultPath, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf-8");
  return full;
}

export function readObsidianNoteIfExists(relativePath: string): string | null {
  if (!env.obsidianVaultPath) return null;
  const full = join(env.obsidianVaultPath, relativePath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf-8");
}
