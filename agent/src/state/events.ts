import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export function logEvent(input: {
  type: string;
  taskId?: string;
  subagent?: string;
  tool?: string;
  inputJson?: unknown;
  outputPreview?: string;
  payload?: unknown;
  fingerprint?: string;
}): number {
  const db = getDb();
  try {
    const result = db
      .prepare(
        `INSERT INTO events (type, task_id, subagent, tool, input_json, output_preview, payload_json, fingerprint)
         VALUES (@type, @task_id, @subagent, @tool, @input_json, @output_preview, @payload_json, @fingerprint)`
      )
      .run({
        type: input.type,
        task_id: input.taskId ?? null,
        subagent: input.subagent ?? null,
        tool: input.tool ?? null,
        input_json: input.inputJson ? JSON.stringify(input.inputJson) : null,
        output_preview: input.outputPreview?.slice(0, 2000) ?? null,
        payload_json: input.payload ? JSON.stringify(input.payload) : null,
        fingerprint: input.fingerprint ?? null,
      });
    return Number(result.lastInsertRowid);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return -1;
    }
    throw err;
  }
}

export function hasFingerprint(fingerprint: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM events WHERE fingerprint = ?")
    .get(fingerprint);
  return !!row;
}

export function listRecentEvents(limit = 100): unknown[] {
  return getDb()
    .prepare(
      `SELECT * FROM events ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}
