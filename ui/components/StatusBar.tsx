"use client";

import { theme } from "@/lib/theme";

export function StatusBar({
  mood,
  focusedTask,
  draftProgress,
  stamina,
  connected,
}: {
  mood: string;
  focusedTask: string | null;
  draftProgress: string;
  stamina: number;
  connected: boolean;
}) {
  const bars = Math.round(stamina / 10);
  return (
    <div
      className="rounded border-2 p-3 space-y-2 font-mono text-sm"
      style={{ borderColor: theme.bronze, color: theme.parchment }}
    >
      <h2 className="text-lg tracking-widest" style={{ color: theme.bronze }}>
        Λ LEONIDAS
      </h2>
      <p>Mood: {mood}</p>
      <p>Focused: {focusedTask ?? "—"}</p>
      <p>Drafts: {draftProgress}</p>
      <p>
        Stamina:{" "}
        {"█".repeat(bars)}
        {"░".repeat(10 - bars)}
      </p>
      <p className="text-xs opacity-70">
        {connected ? "Agora linked" : "Reconnecting…"}
      </p>
    </div>
  );
}
