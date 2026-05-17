import { getDb } from "./db.js";
import { newId } from "./events.js";

export interface ApprovalRow {
  id: string;
  task_id: string;
  kind: string;
  target: string;
  current_json: string | null;
  proposed_json: string | null;
  decision: string | null;
  edited_json: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function createApproval(input: {
  taskId: string;
  kind: string;
  target: string;
  current?: unknown;
  proposed: unknown;
}): ApprovalRow {
  const id = newId("draft");
  getDb()
    .prepare(
      `INSERT INTO approvals (id, task_id, kind, target, current_json, proposed_json)
       VALUES (@id, @task_id, @kind, @target, @current_json, @proposed_json)`
    )
    .run({
      id,
      task_id: input.taskId,
      kind: input.kind,
      target: input.target,
      current_json: input.current ? JSON.stringify(input.current) : null,
      proposed_json: JSON.stringify(input.proposed),
    });
  return getApproval(id)!;
}

export function getApproval(id: string): ApprovalRow | undefined {
  return getDb()
    .prepare("SELECT * FROM approvals WHERE id = ?")
    .get(id) as ApprovalRow | undefined;
}

export function listPendingApprovals(taskId: string): ApprovalRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM approvals WHERE task_id = ? AND decision IS NULL ORDER BY created_at`
    )
    .all(taskId) as ApprovalRow[];
}

export function listAllPendingApprovals(): ApprovalRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM approvals WHERE decision IS NULL ORDER BY created_at`
    )
    .all() as ApprovalRow[];
}

export function resolveApproval(
  id: string,
  decision: string,
  edited?: unknown
): void {
  getDb()
    .prepare(
      `UPDATE approvals SET decision = ?, edited_json = ?, resolved_at = datetime('now') WHERE id = ?`
    )
    .run(
      decision,
      edited ? JSON.stringify(edited) : null,
      id
    );
}
