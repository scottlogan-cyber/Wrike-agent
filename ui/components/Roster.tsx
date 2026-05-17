"use client";

import type { TaskView } from "@/lib/ws";
import { theme } from "@/lib/theme";

export function Roster({
  tasks,
  focusedId,
  onSelect,
}: {
  tasks: TaskView[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1 text-sm font-mono max-h-40 overflow-y-auto">
      <h3 className="text-amber-600/90 mb-2">Roster</h3>
      {tasks.length === 0 && <p className="opacity-50">No active tasks</p>}
      {tasks.map((t) => (
        <button
          key={t.task_id}
          type="button"
          onClick={() => onSelect(t.task_id)}
          className="w-full text-left cursor-pointer px-2 py-1 rounded"
          style={{
            backgroundColor:
              focusedId === t.task_id ? theme.crimson : "transparent",
            color: theme.parchment,
          }}
        >
          • {t.task_id} — {t.state}
          {t.state === "stale" && " ⚠"}
          {t.state === "transcript_available" && " ✦"}
        </button>
      ))}
    </div>
  );
}
