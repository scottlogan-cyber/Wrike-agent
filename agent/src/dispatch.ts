import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import { env, REPO_ROOT } from "./config.js";
import { getTask, mergePayload, getPayload } from "./state/tasks.js";
import { getDb } from "./state/db.js";
import { logEvent, newId } from "./state/events.js";
import { broadcast, broadcastToolCall } from "./ws/broadcast.js";
import { getTask as fetchWrikeTask, extractSfOppId } from "./tools/wrike-client.js";
import { fetchTranscript } from "./tools/salesloft.js";

export type SubagentName =
  | "orchestrator"
  | "intake"
  | "researcher"
  | "transcript_hunter"
  | "scribe"
  | "architect"
  | "kratos-reactive"
  | "kratos-ia";

interface SubagentConfig {
  model: string;
  promptFile: string;
  cloud?: boolean;
}

const SUBAGENTS: Record<SubagentName, SubagentConfig> = {
  orchestrator: { model: "claude-opus-4-7", promptFile: "orchestrator.md" },
  intake: { model: "composer-2", promptFile: "intake.md" },
  researcher: { model: "composer-2", promptFile: "researcher.md" },
  transcript_hunter: { model: "composer-2", promptFile: "transcript_hunter.md" },
  scribe: { model: "composer-2", promptFile: "scribe.md" },
  architect: { model: "claude-opus-4-7", promptFile: "architect.md" },
  "kratos-reactive": { model: "claude-opus-4-7", promptFile: "kratos-reactive.md" },
  "kratos-ia": { model: "claude-opus-4-7", promptFile: "kratos-ia.md", cloud: true },
};

function loadPrompt(name: SubagentName): string {
  const file = SUBAGENTS[name].promptFile;
  return readFileSync(join(REPO_ROOT, "agent/src/prompts", file), "utf-8");
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function runHeuristic(
  name: SubagentName,
  taskId: string
): Promise<Record<string, unknown>> {
  const task = getTask(taskId);
  const payload = getPayload(taskId);
  let wrikeTask;
  try {
    wrikeTask = await fetchWrikeTask(taskId);
  } catch {
    wrikeTask = {
      id: taskId,
      title: task?.title ?? taskId,
      description: task?.summary ?? "",
    };
  }

  switch (name) {
    case "intake":
      return {
        task_id: taskId,
        title: wrikeTask.title,
        assigner: task?.assigner ?? "unknown",
        sf_opp_id: extractSfOppId(wrikeTask),
        client_name: guessClient(wrikeTask.title, wrikeTask.description ?? ""),
        topic_guess: guessTopic(wrikeTask.title, wrikeTask.description ?? ""),
        urgency: "normal",
        summary: (wrikeTask.description ?? "").slice(0, 500),
        links: wrikeTask.permalink ? [wrikeTask.permalink] : [],
      };
    case "researcher":
      return {
        topic: task?.topic_guess ?? "integration_scoping",
        articles: [
          {
            title: "Wrike Integrations Overview",
            url: "https://help.wrike.com/integrations",
            summary: "Overview of Wrike integration options.",
            relevance: 0.8,
          },
        ],
        key_concepts: ["integrations", "automation"],
        recommended_features: ["Wrike Integrate", "API"],
      };
    case "transcript_hunter": {
      const call = payload.transcript_call as { id?: string } | undefined;
      const useLive =
        call?.id &&
        !call.id.startsWith("dev-") &&
        Boolean(process.env.SALESLOFT_TOKEN);
      let transcript =
        "Transcript placeholder — configure SALESLOFT_TOKEN for live data.";
      if (useLive && call?.id) {
        try {
          transcript = await fetchTranscript(call.id);
        } catch {
          transcript =
            "Transcript unavailable (Salesloft fetch failed) — using stub summary.";
        }
      } else if (call?.id?.startsWith("dev-")) {
        transcript =
          "Dev transcript stub: customer wants Wrike ↔ Salesforce sync, weekly status rituals, and API-based provisioning.";
      }
      return {
        call_id: call?.id ?? "unknown",
        call_date: new Date().toISOString(),
        attendees: [],
        transcript_url: "",
        extracted: {
          pain_points: [],
          current_tools: [],
          integration_touchpoints: [],
          decision_criteria: [],
          next_steps: [],
          attendees: [],
          raw_summary: transcript.slice(0, 2000),
        },
      };
    }
    case "scribe": {
      const intake = payload.intake as Record<string, unknown> | undefined;
      const research = payload.research as Record<string, unknown> | undefined;
      const transcript = payload.transcript as Record<string, unknown> | undefined;
      return {
        subtask_drafts: [
          {
            target: "subtask-1",
            proposed: `Engagement notes for ${task?.client_name ?? "client"}:\n\n${intake?.summary ?? ""}\n\nResearch: ${JSON.stringify(research?.key_concepts ?? [])}\n\nCall: ${(transcript?.extracted as { raw_summary?: string })?.raw_summary ?? "pending"}`,
          },
        ],
        obsidian_note: {
          path: "",
          content: "",
        },
      };
    }
    default:
      return { ok: true };
  }
}

function guessClient(title: string, desc: string): string {
  const m = `${title} ${desc}`.match(
    /\bfor\s+([A-Z][A-Za-z0-9 &.-]{2,40})\b/
  );
  return m?.[1] ?? "Unknown Client";
}

function guessTopic(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();
  if (t.includes("demo")) return "demo_prep";
  if (t.includes("cleanup") || t.includes("clean up")) return "account_cleanup";
  if (t.includes("integrat")) return "integration_scoping";
  return "integration_scoping";
}

export async function dispatchSubagent(
  name: SubagentName,
  taskId: string,
  extraContext = ""
): Promise<Record<string, unknown>> {
  const runId = newId("run");
  const cfg = SUBAGENTS[name];
  getDb()
    .prepare(
      `INSERT INTO runs (id, task_id, subagent, status) VALUES (?, ?, ?, 'running')`
    )
    .run(runId, taskId, name);

  broadcastToolCall({ taskId, tool: `dispatch:${name}`, subagent: name });

  try {
    let output: Record<string, unknown>;

    if (!env.cursorApiKey) {
      output = await runHeuristic(name, taskId);
    } else {
      const system = loadPrompt(name);
      const task = getTask(taskId);
      const payload = getPayload(taskId);
      const userPrompt = [
        `Task ID: ${taskId}`,
        `Current state: ${task?.state}`,
        `Context JSON: ${JSON.stringify(payload)}`,
        extraContext,
        "Respond with a single JSON object matching your output schema.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const agent = await Agent.create({
        apiKey: env.cursorApiKey,
        model: { id: cfg.model },
        ...(cfg.cloud && env.githubRepo
          ? {
              cloud: {
                repos: [
                  {
                    url: env.githubRepo.startsWith("http")
                      ? env.githubRepo
                      : `https://github.com/${env.githubRepo}`,
                  },
                ],
              },
            }
          : { local: { cwd: REPO_ROOT, settingSources: [] } }),
      });

      try {
        const run = await agent.send(`${system}\n\n---\n\n${userPrompt}`);
        let text = "";
        for await (const event of run.stream()) {
          if (event.type === "assistant") {
            for (const block of event.message.content) {
              if (block.type === "text") text += block.text;
            }
          }
        }
        const result = await run.wait();
        if (result.status === "error") {
          throw new Error(`Subagent ${name} failed: ${result.id}`);
        }
        output = parseJsonFromText(text) ?? { raw: text };
      } finally {
        await agent[Symbol.asyncDispose]();
      }
    }

    getDb()
      .prepare(
        `UPDATE runs SET status = 'finished', payload_json = ?, finished_at = datetime('now') WHERE id = ?`
      )
      .run(JSON.stringify(output), runId);

    logEvent({
      type: "subagent_complete",
      taskId,
      subagent: name,
      payload: output,
    });

    return output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    getDb()
      .prepare(
        `UPDATE runs SET status = 'error', error = ?, finished_at = datetime('now') WHERE id = ?`
      )
      .run(message, runId);

    if (err instanceof CursorAgentError) {
      broadcast({
        type: "error",
        task_id: taskId,
        payload: {
          stage: name,
          message,
          retryable: err.isRetryable,
        },
      });
    }
    throw err;
  }
}
