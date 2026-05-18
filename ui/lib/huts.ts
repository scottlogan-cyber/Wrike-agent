/**
 * Pure helpers: one "hut" per client (or per task before client_name is known).
 * Used by the Village HUD and for Obsidian scroll paths (`public/clients/{hutId}.md`).
 */

/** Task fields needed for hut grouping (keeps this module free of ws/store imports). */
export interface TaskHutInput {
  task_id: string;
  title: string;
  client_name?: string | null;
}

export interface Hut {
  /** Stable id — URL-safe slug for markdown filename */
  id: string;
  /** Human-readable label (client name or task title) */
  label: string;
  taskIds: string[];
}

/** Lowercase slug safe for filenames and URLs. */
export function slugifyClientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "client";
}

/** Primary grouping key for tasks → hut. */
export function clientKey(task: Pick<TaskHutInput, "task_id" | "client_name">): string {
  if (task.client_name?.trim()) {
    return slugifyClientName(task.client_name);
  }
  const safeId = task.task_id.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `task-${safeId}`;
}

export function aggregateHutsFromTasks(tasks: TaskHutInput[]): Hut[] {
  const map = new Map<string, Hut>();

  for (const t of tasks) {
    const id = clientKey(t);
    let hut = map.get(id);
    if (!hut) {
      hut = {
        id,
        label: t.client_name?.trim() || t.title || t.task_id,
        taskIds: [],
      };
      map.set(id, hut);
    }
    if (!hut.taskIds.includes(t.task_id)) {
      hut.taskIds.push(t.task_id);
    }
    if (t.client_name?.trim()) {
      hut.label = t.client_name.trim();
    }
  }

  return [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

export function resolveHutByQuery(
  huts: Hut[],
  query: string
): Hut | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    huts.find((h) => h.id === q) ??
    huts.find((h) => h.id.startsWith(q)) ??
    huts.find((h) => h.label.toLowerCase() === q) ??
    huts.find((h) => h.label.toLowerCase().includes(q))
  );
}
