import type { WebSocket } from "ws";
import type { ServerMessage } from "./schema.js";

const clients = new Set<WebSocket>();

export function registerClient(ws: WebSocket): void {
  clients.add(ws);
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
