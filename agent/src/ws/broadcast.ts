import type { WebSocket } from "ws";
import { getActiveTasks } from "../state/tasks.js";
import { listAllPendingApprovals } from "../state/approvals.js";

const clients = new Set<WebSocket>();

function approvalToDraft(row: {
  id: string;
  kind: string;
  target: string;
  current_json: string | null;
  proposed_json: string | null;
}) {
  return {
    id: row.id,
    kind: row.kind,
    target: row.target,
    current: row.current_json ?? undefined,
    proposed: row.proposed_json ?? "",
  };
}

export function sendClientSnapshot(ws: WebSocket): void {
  if (ws.readyState !== 1) return;
  const tasks = getActiveTasks().map((t) => ({
    task_id: t.task_id,
    title: t.title ?? t.task_id,
    state: t.state,
  }));
  const drafts = listAllPendingApprovals().map(approvalToDraft);
  ws.send(
    JSON.stringify({
      type: "snapshot",
      ts: new Date().toISOString(),
      payload: { tasks, drafts },
    })
  );
}

export function registerClient(ws: WebSocket): void {
  clients.add(ws);
  sendClientSnapshot(ws);
  ws.on("close", () => clients.delete(ws));
}

export function broadcast(msg: Record<string, unknown> & { type: string; ts?: string }): void {
  const envelope = {
    ...msg,
    ts: msg.ts ?? new Date().toISOString(),
  };
  const data = JSON.stringify(envelope);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

export function broadcastToolCall(input: {
  taskId?: string;
  tool: string;
  inputData?: unknown;
  subagent?: string;
}): void {
  broadcast({
    type: "tool_call",
    task_id: input.taskId,
    payload: {
      tool: input.tool,
      input: input.inputData,
      subagent: input.subagent,
    },
  });
}

export function broadcastToolResult(input: {
  taskId?: string;
  tool: string;
  ok: boolean;
  outputPreview?: string;
}): void {
  broadcast({
    type: "tool_result",
    task_id: input.taskId,
    payload: {
      tool: input.tool,
      ok: input.ok,
      output_preview: input.outputPreview,
    },
  });
}
