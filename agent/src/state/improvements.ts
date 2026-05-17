import { getDb } from "./db.js";

export interface ImprovementRow {
  id: string;
  category: string;
  title: string;
  evidence_json: string | null;
  hypothesis: string | null;
  proposed_change: string | null;
  risk: string | null;
  estimated_effort: string | null;
  pr_url: string | null;
  status: string;
  dismissed_until: string | null;
  created_at: string;
}

export function listOpenImprovements(): ImprovementRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM improvements WHERE status = 'open'
       AND (dismissed_until IS NULL OR dismissed_until < datetime('now'))
       ORDER BY created_at DESC`
    )
    .all() as ImprovementRow[];
}

export function upsertImprovement(row: Omit<ImprovementRow, "created_at">): void {
  getDb()
    .prepare(
      `INSERT INTO improvements (id, category, title, evidence_json, hypothesis, proposed_change, risk, estimated_effort, pr_url, status, dismissed_until)
       VALUES (@id, @category, @title, @evidence_json, @hypothesis, @proposed_change, @risk, @estimated_effort, @pr_url, @status, @dismissed_until)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         pr_url = excluded.pr_url,
         dismissed_until = excluded.dismissed_until`
    )
    .run(row);
}

export function dismissImprovement(id: string, days = 30): void {
  getDb()
    .prepare(
      `UPDATE improvements SET status = 'dismissed', dismissed_until = datetime('now', '+' || ? || ' days') WHERE id = ?`
    )
    .run(days, id);
}
