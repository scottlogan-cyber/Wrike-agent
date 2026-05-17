import { dispatchSubagent } from "./dispatch.js";
import {
  getTask,
  transitionTask,
  upsertTask,
  mergePayload,
  getPayload,
} from "./state/tasks.js";
import { hasFingerprint, logEvent } from "./state/events.js";
import { broadcast } from "./ws/broadcast.js";
import {
  sendTaskSlackDm,
  triagedSlackMessage,
  buildStaleBlocks,
} from "./tools/slack.js";
import { createApproval } from "./state/approvals.js";
import {
  buildEngagementNote,
  resolveNotePath,
} from "./tools/obsidian.js";
import { getSubtasks, updateSubtaskDescription } from "./tools/wrike-client.js";
import { writeObsidianNote } from "./tools/obsidian.js";
import { listPendingApprovals, resolveApproval, getApproval } from "./state/approvals.js";

export async function onTaskDiscovered(
  taskId: string,
  meta: { title: string; assigner?: string; source: string }
): Promise<void> {
  const fp = `discovered:${taskId}`;
  if (hasFingerprint(fp)) return;

  upsertTask(taskId, {
    title: meta.title,
    state: "discovered",
    assigner: meta.assigner,
  });
  logEvent({
    type: "task_discovered",
    taskId,
    fingerprint: fp,
    payload: meta,
  });

  broadcast({
    type: "task_discovered",
    task_id: taskId,
    payload: {
      task_id: taskId,
      title: meta.title,
      assigner: meta.assigner,
      source: meta.source as "assignment" | "comment_mention" | "queue_folder",
    },
  });

  await runIntake(taskId);
}

export async function runIntake(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task || task.state !== "discovered") return;

  const output = await dispatchSubagent("intake", taskId);
  mergePayload(taskId, "intake", output);

  transitionTask(taskId, "triaged", {
    title: String(output.title ?? task.title),
    sf_opp_id: (output.sf_opp_id as string) ?? null,
    client_name: (output.client_name as string) ?? null,
    topic_guess: (output.topic_guess as string) ?? null,
    urgency: (output.urgency as string) ?? null,
    summary: (output.summary as string) ?? null,
  });

  broadcast({
    type: "state_change",
    task_id: taskId,
    payload: {
      task_id: taskId,
      from: "discovered",
      to: "triaged",
    },
  });

  await sendTaskSlackDm(
    taskId,
    triagedSlackMessage({
      title: String(output.title ?? task.title ?? taskId),
      assigner: String(output.assigner ?? task.assigner ?? ""),
      clientName: String(output.client_name ?? ""),
      topicGuess: String(output.topic_guess ?? ""),
      urgency: String(output.urgency ?? ""),
      summary: String(output.summary ?? ""),
      taskId,
    })
  );

  await runResearcher(taskId);
}

export async function runResearcher(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task || task.state !== "triaged") return;
  const fp = `researcher:${taskId}`;
  if (hasFingerprint(fp)) return;

  const output = await dispatchSubagent("researcher", taskId);
  mergePayload(taskId, "research", output);
  logEvent({ type: "research_complete", taskId, fingerprint: fp, payload: output });

  transitionTask(taskId, "enriched", {
    topic_guess: String(output.topic ?? task.topic_guess ?? ""),
    enriched_at: new Date().toISOString(),
  });

  broadcast({
    type: "state_change",
    task_id: taskId,
    payload: { task_id: taskId, from: "triaged", to: "enriched" },
  });
}

export async function onCallDetected(
  taskId: string,
  callDatetime: string,
  source: "comment" | "salesloft"
): Promise<void> {
  const task = getTask(taskId);
  if (!task || !["enriched", "call_pending"].includes(task.state)) return;
  const fp = `call:${taskId}:${callDatetime}`;
  if (hasFingerprint(fp)) return;

  transitionTask(taskId, "call_pending", { call_datetime: callDatetime });
  logEvent({ type: "call_detected", taskId, fingerprint: fp, payload: { source } });

  broadcast({
    type: "call_detected",
    task_id: taskId,
    payload: { task_id: taskId, call_datetime: callDatetime, source },
  });

  await sendTaskSlackDm(
    taskId,
    `Call detected for ${task.client_name ?? "client"} on ${callDatetime}. I'll grab the transcript once it's published.`
  );
}

export async function onTranscriptAvailable(
  taskId: string,
  call: { id: string }
): Promise<void> {
  const task = getTask(taskId);
  if (!task) return;
  const fp = `transcript:${taskId}:${call.id}`;
  if (hasFingerprint(fp)) return;

  mergePayload(taskId, "transcript_call", call);
  const output = await dispatchSubagent("transcript_hunter", taskId);
  mergePayload(taskId, "transcript", output);
  logEvent({ type: "transcript_available", taskId, fingerprint: fp, payload: output });

  transitionTask(taskId, "transcript_available");
  broadcast({
    type: "state_change",
    task_id: taskId,
    payload: {
      task_id: taskId,
      from: task.state,
      to: "transcript_available",
    },
  });

  broadcast({
    type: "transcript_arrived",
    task_id: taskId,
    payload: {
      task_id: taskId,
      call_id: call.id,
      extracted_summary: String(
        (output.extracted as { raw_summary?: string })?.raw_summary ?? ""
      ).slice(0, 300),
    },
  });

  await sendTaskSlackDm(
    taskId,
    `Call transcript ready for ${task.client_name ?? "client"}. Drafting subtasks and notes now.`
  );

  await runScribe(taskId);
}

export async function runScribe(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task || task.state !== "transcript_available") return;
  const fp = `scribe:${taskId}`;
  if (hasFingerprint(fp)) return;

  const output = await dispatchSubagent("scribe", taskId);
  const payload = getPayload(taskId);
  const intake = payload.intake as Record<string, unknown> | undefined;
  const research = payload.research as Record<string, unknown> | undefined;
  const transcript = payload.transcript as Record<string, unknown> | undefined;

  const topic = String(task.topic_guess ?? "integration_scoping");
  const client = String(task.client_name ?? "client");
  const notePath = resolveNotePath(topic, client, taskId);
  const noteContent = buildEngagementNote({
    taskId,
    client,
    topic,
    request: String(intake?.summary ?? task.summary ?? ""),
    research: JSON.stringify(research?.articles ?? [], null, 2),
    callNotes: String(
      (transcript?.extracted as { raw_summary?: string })?.raw_summary ?? ""
    ),
    plan: "Draft plan pending approval.",
    questions: "- ",
  });

  const drafts: Array<{
    id: string;
    kind: string;
    target: string;
    current?: unknown;
    proposed: unknown;
  }> = [];

  try {
    const subtasks = await getSubtasks(taskId);
    const subDrafts =
      (output.subtask_drafts as Array<{ target: string; proposed: string }>) ?? [];
    for (let i = 0; i < Math.max(subtasks.length, subDrafts.length); i++) {
      const st = subtasks[i];
      const draft = subDrafts[i];
      const approval = createApproval({
        taskId,
        kind: "wrike_subtask",
        target: st?.id ?? draft?.target ?? `subtask-${i}`,
        current: st?.description,
        proposed: draft?.proposed ?? `Notes for subtask ${i + 1}`,
      });
      drafts.push({
        id: approval.id,
        kind: "wrike_subtask",
        target: approval.target,
        current: st?.description,
        proposed: draft?.proposed,
      });
    }
  } catch {
    const approval = createApproval({
      taskId,
      kind: "wrike_subtask",
      target: taskId,
      proposed: String((output as { raw?: string }).raw ?? "Draft notes"),
    });
    drafts.push({
      id: approval.id,
      kind: "wrike_subtask",
      target: approval.target,
      proposed: approval.proposed_json
        ? JSON.parse(approval.proposed_json)
        : "",
    });
  }

  const noteApproval = createApproval({
    taskId,
    kind: "obsidian_note",
    target: notePath,
    proposed: noteContent,
  });
  drafts.push({
    id: noteApproval.id,
    kind: "obsidian_note",
    target: notePath,
    proposed: noteContent,
  });

  mergePayload(taskId, "drafts", drafts);
  logEvent({ type: "drafts_ready", taskId, fingerprint: fp });

  transitionTask(taskId, "drafted");
  broadcast({
    type: "drafts_ready",
    task_id: taskId,
    payload: { task_id: taskId, drafts },
  });
}

export async function handleApproval(
  draftId: string,
  decision: "approve" | "reject" | "edit",
  edited?: unknown
): Promise<void> {
  const approval = getApproval(draftId);
  if (!approval) return;

  resolveApproval(draftId, decision, edited);

  if (decision === "reject") return;

  let content: unknown =
    decision === "edit" && edited !== undefined
      ? edited
      : JSON.parse(approval.proposed_json ?? "{}");
  if (typeof content === "string") {
    /* already string for writes */
  } else if (approval.kind === "obsidian_note" && typeof edited === "string") {
    content = edited;
  }

  const taskId = approval.task_id;

  if (approval.kind === "wrike_subtask" && typeof content === "string") {
    await updateSubtaskDescription(approval.target, content);
    broadcast({
      type: "write_complete",
      task_id: taskId,
      payload: {
        task_id: taskId,
        kind: "wrike_subtask",
        target: approval.target,
      },
    });
  }

  if (approval.kind === "obsidian_note" && typeof content === "string") {
    const url = writeObsidianNote(approval.target, content);
    broadcast({
      type: "write_complete",
      task_id: taskId,
      payload: {
        task_id: taskId,
        kind: "obsidian_note",
        target: approval.target,
        url,
      },
    });
  }

  const pending = listPendingApprovals(taskId);
  if (pending.length === 0) {
    transitionTask(taskId, "completed");
    broadcast({
      type: "state_change",
      task_id: taskId,
      payload: { task_id: taskId, from: "drafted", to: "completed" },
    });
  }
}

export async function handleStale(taskId: string, daysIdle: number): Promise<void> {
  const task = getTask(taskId);
  if (!task) return;
  const fp = `stale:${taskId}`;
  if (hasFingerprint(fp)) return;

  transitionTask(taskId, "stale");
  logEvent({ type: "stale", taskId, fingerprint: fp, payload: { daysIdle } });

  broadcast({
    type: "stale_notice",
    task_id: taskId,
    payload: {
      task_id: taskId,
      days_idle: daysIdle,
      last_state: task.state,
    },
  });

  await sendTaskSlackDm(
    taskId,
    `${task.title} has been waiting ${daysIdle} days without a scheduled call.`,
    buildStaleBlocks(taskId, task.title ?? taskId)
  );
}

export async function handleChat(text: string): Promise<string> {
  const lower = text.toLowerCase();
  if (lower.startsWith("cancel ")) {
    const id = text.split(/\s+/)[1];
    if (id) {
      transitionTask(id, "cancelled");
      return `Task ${id} cancelled.`;
    }
  }
  if (lower.includes("architect")) {
    return "Architect is ready. Say: Architect, build me a marketing agency demo for Acme Co.";
  }
  if (lower.includes("kratos")) {
    return "Kratos stands watch. He will sniff out errors and file PRs when needed.";
  }
  const active = getTask(
    text.match(/[A-Z]{2,4}-\d+/)?.[0] ?? ""
  );
  if (active) {
    return `Focused on ${active.task_id} (${active.state}). ${
      active.state === "drafted"
        ? "Drafts await your approval at the forge."
        : "I remain at the Hot Gates, watching."
    }`;
  }
  return "Speak, citizen. I guard your Wrike queue. Assign a task or ask what I forge.";
}
