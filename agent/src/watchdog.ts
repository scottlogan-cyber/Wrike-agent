import { createIncident, resolveIncident } from "./state/incidents.js";
import { broadcast } from "./ws/broadcast.js";
import { sendSlackDm } from "./tools/slack.js";
import { dispatchSubagent } from "./dispatch.js";
import { env } from "./config.js";
import { logEvent } from "./state/events.js";

const retryCounts = new Map<string, number>();

export async function dispatchKratos(input: {
  reason: string;
  error?: Error;
  taskId?: string;
  runId?: string;
}): Promise<void> {
  const incident = createIncident({
    runId: input.runId,
    taskId: input.taskId,
    trigger: input.reason,
    classification: classifyError(input.error),
    hypothesis: input.error?.message,
  });

  broadcast({
    type: "incident",
    payload: {
      incident_id: incident.id,
      trigger: input.reason,
      message: input.error?.message ?? input.reason,
    },
  });

  const key = `${input.reason}:${input.taskId ?? "global"}`;
  const count = (retryCounts.get(key) ?? 0) + 1;
  retryCounts.set(key, count);

  if (count < 3 && classifyError(input.error) === "transient") {
    logEvent({
      type: "kratos_retry",
      taskId: input.taskId,
      payload: { incident_id: incident.id, attempt: count },
    });
    resolveIncident(incident.id, "retried");
    return;
  }

  await sendSlackDm(
    `Kratos detected an incident (${incident.id}): ${input.error?.message ?? input.reason}`
  );

  if (env.cursorApiKey && input.error) {
    try {
      await dispatchSubagent(
        "kratos-reactive",
        input.taskId ?? "global",
        `Incident ${incident.id}\n${input.error.stack ?? input.error.message}`
      );
    } catch {
      /* Kratos may fail independently */
    }
  }

  resolveIncident(incident.id, "notified");
}

function classifyError(err?: Error): string {
  const msg = err?.message?.toLowerCase() ?? "";
  if (msg.includes("401") || msg.includes("auth")) return "auth";
  if (msg.includes("schema") || msg.includes("json")) return "schema";
  if (msg.includes("timeout") || msg.includes("network")) return "transient";
  if (msg.includes("code")) return "code";
  return "unknown";
}

export function trackSubagentStuck(
  runId: string,
  subagent: string,
  startedAt: number
): void {
  const elapsed = Date.now() - startedAt;
  if (elapsed > 90_000) {
    void dispatchKratos({
      reason: "stuck",
      error: new Error(`Run ${runId} stuck in ${subagent} for ${elapsed}ms`),
    });
  }
}
