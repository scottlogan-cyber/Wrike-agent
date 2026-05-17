"use client";

import type { LogEntry } from "@/lib/ws";
import { theme } from "@/lib/theme";

export function BattleLog({ entries }: { entries: LogEntry[] }) {
  return (
    <div
      className="rounded border p-2 max-h-32 overflow-y-auto text-xs font-mono"
      style={{ borderColor: theme.bronze, color: theme.parchment }}
    >
      <h3 className="text-amber-600/90 mb-1">⚔ Battle Log</h3>
      {entries.map((e, i) => (
        <div key={i} className="opacity-90">
          → {e.text}
        </div>
      ))}
    </div>
  );
}
