import { getDb } from "./db.js";
import { newId } from "./events.js";

export interface IncidentRow {
  id: string;
  run_id: string | null;
  task_id: string | null;
  trigger: string;
  classification: string | null;
  hypothesis: string | null;
  resolution: string | null;
  pr_url: string | null;
  slack_ts: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function createIncident(input: {
  runId?: string;
  taskId?: string;
  trigger: string;
  classification?: string;
  hypothesis?: string;
}): IncidentRow {
  const id = newId("inc");
  getDb()
    .prepare(
      `INSERT INTO incidents (id, run_id, task_id, trigger, classification, hypothesis)
       VALUES (@id, @run_id, @task_id, @trigger, @classification, @hypothesis)`
    )
    .run({
      id,
      run_id: input.runId ?? null,
      task_id: input.taskId ?? null,
      trigger: input.trigger,
      classification: input.classification ?? null,
      hypothesis: input.hypothesis ?? null,
    });
  return getIncident(id)!;
}

export function getIncident(id: string): IncidentRow | undefined {
  return getDb()
    .prepare("SELECT * FROM incidents WHERE id = ?")
    .get(id) as IncidentRow | undefined;
}

export function resolveIncident(
  id: string,
  resolution: string,
  prUrl?: string
): void {
  getDb()
    .prepare(
      `UPDATE incidents SET resolution = ?, pr_url = ?, resolved_at = datetime('now') WHERE id = ?`
    )
    .run(resolution, prUrl ?? null, id);
}
