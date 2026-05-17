import { getDb } from "./db.js";

export type TaskState =
  | "discovered"
  | "triaged"
  | "enriched"
  | "call_pending"
  | "transcript_available"
  | "drafted"
  | "completed"
  | "stale"
  | "stalled"
  | "cancelled";

export interface TaskRow {
  task_id: string;
  title: string | null;
  state: TaskState;
  assigner: string | null;
  sf_opp_id: string | null;
  client_name: string | null;
  topic_guess: string | null;
  urgency: string | null;
  summary: string | null;
  payload_json: string | null;
  slack_dm_count: number;
  call_datetime: string | null;
  enriched_at: string | null;
  last_progress_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getTask(taskId: string): TaskRow | undefined {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE task_id = ?")
    .get(taskId) as TaskRow | undefined;
}

export function upsertTask(
  taskId: string,
  patch: Partial<Omit<TaskRow, "task_id" | "created_at" | "updated_at">>
): TaskRow {
  const existing = getTask(taskId);
  const db = getDb();
  if (!existing) {
    db.prepare(
      `INSERT INTO tasks (task_id, title, state, assigner, sf_opp_id, client_name, topic_guess, urgency, summary, payload_json, last_progress_at)
       VALUES (@task_id, @title, @state, @assigner, @sf_opp_id, @client_name, @topic_guess, @urgency, @summary, @payload_json, datetime('now'))`
    ).run({
      task_id: taskId,
      title: patch.title ?? null,
      state: patch.state ?? "discovered",
      assigner: patch.assigner ?? null,
      sf_opp_id: patch.sf_opp_id ?? null,
      client_name: patch.client_name ?? null,
      topic_guess: patch.topic_guess ?? null,
      urgency: patch.urgency ?? null,
      summary: patch.summary ?? null,
      payload_json: patch.payload_json ?? null,
    });
  } else {
    const fields: string[] = ["updated_at = datetime('now')"];
    const params: Record<string, unknown> = { task_id: taskId };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) {
        fields.push(`${k} = @${k}`);
        params[k] = v;
      }
    }
    if (patch.state && patch.state !== existing.state) {
      fields.push("last_progress_at = datetime('now')");
    }
    db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE task_id = @task_id`).run(
      params
    );
  }
  return getTask(taskId)!;
}

export function transitionTask(
  taskId: string,
  to: TaskState,
  patch: Partial<TaskRow> = {}
): TaskRow {
  return upsertTask(taskId, { ...patch, state: to });
}

export function getActiveTasks(): TaskRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM tasks WHERE state NOT IN ('completed', 'cancelled') ORDER BY updated_at DESC`
    )
    .all() as TaskRow[];
}

export function incrementSlackDmCount(taskId: string): number {
  const db = getDb();
  db.prepare(
    `UPDATE tasks SET slack_dm_count = slack_dm_count + 1, updated_at = datetime('now') WHERE task_id = ?`
  ).run(taskId);
  return getTask(taskId)!.slack_dm_count;
}

export function getWatcherMeta(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM watcher_meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setWatcherMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO watcher_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export function mergePayload(
  taskId: string,
  key: string,
  value: unknown
): Record<string, unknown> {
  const task = getTask(taskId);
  const payload = task?.payload_json
    ? (JSON.parse(task.payload_json) as Record<string, unknown>)
    : {};
  payload[key] = value;
  upsertTask(taskId, { payload_json: JSON.stringify(payload) });
  return payload;
}

export function getPayload(taskId: string): Record<string, unknown> {
  const task = getTask(taskId);
  if (!task?.payload_json) return {};
  return JSON.parse(task.payload_json) as Record<string, unknown>;
}
