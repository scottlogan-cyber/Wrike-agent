"use client";

import Link from "next/link";
import { useAgentStore } from "@/lib/ws";
import { theme } from "@/lib/theme";

export default function TracePage() {
  const battleLog = useAgentStore((s) => s.battleLog);

  return (
    <div
      className="min-h-screen p-8 max-w-3xl mx-auto font-mono text-sm"
      style={{ backgroundColor: "#0f0d0b", color: theme.parchment }}
    >
      <Link href="/" className="text-amber-600">
        ← Leonidas
      </Link>
      <h1 className="text-xl mt-4 mb-4" style={{ color: theme.bronze }}>
        ⚔ Full Battle Log
      </h1>
      <div className="space-y-1">
        {battleLog.map((e, i) => (
          <div key={i} className="opacity-90">
            <span className="text-xs opacity-50">{e.ts}</span> → {e.text}
          </div>
        ))}
        {battleLog.length === 0 && (
          <p className="opacity-50">No events yet — connect to the agent.</p>
        )}
      </div>
    </div>
  );
}
