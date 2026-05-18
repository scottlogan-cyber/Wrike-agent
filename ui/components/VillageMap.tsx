"use client";

import type { CSSProperties } from "react";
import { Home } from "lucide-react";
import { theme } from "@/lib/theme";
import type { Hut } from "@/lib/huts";

const panelStyle: CSSProperties = {
  borderColor: theme.bronze,
  background:
    "linear-gradient(180deg, rgba(42,37,32,0.95) 0%, rgba(15,13,11,0.98) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(184,115,51,0.25), 0 4px 24px rgba(0,0,0,0.6)",
};

export function VillageMap({
  huts,
  activeHutId,
  onEnterHut,
}: {
  huts: Hut[];
  activeHutId: string | null;
  onEnterHut: (hutId: string) => void;
}) {
  return (
    <div
      className="relative rounded-sm border-2 p-4 min-h-[360px] overflow-hidden"
      style={panelStyle}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 30% 20%, rgba(0,131,143,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(139,26,26,0.12) 0%, transparent 45%)",
        }}
      />

      <header className="relative flex items-center gap-2 mb-4 border-b border-amber-900/40 pb-2">
        <Home className="w-5 h-5 text-amber-600 shrink-0" aria-hidden />
        <div>
          <h1 className="text-lg font-bold tracking-wide text-amber-500/90 uppercase">
            Spartan Village
          </h1>
          <p className="text-xs font-mono opacity-70" style={{ color: theme.parchment }}>
            Each hut is a client. Click a roof or say{" "}
            <kbd className="px-1 bg-stone-800 rounded border border-amber-800/50">
              enter &lt;name&gt;
            </kbd>
          </p>
        </div>
      </header>

      {huts.length === 0 ? (
        <p className="relative text-sm font-mono opacity-70" style={{ color: theme.parchment }}>
          No huts yet — when tasks arrive from Wrike, new longhouses appear here.
        </p>
      ) : (
        <ul className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {huts.map((h) => {
            const active = activeHutId === h.id;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onEnterHut(h.id)}
                  className={[
                    "w-full text-left rounded border-2 px-3 py-3 transition-all",
                    "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-600/60",
                    active ? "ring-2 ring-amber-400/80" : "",
                  ].join(" ")}
                  style={{
                    borderColor: active ? "#d4a574" : theme.bronze,
                    backgroundColor: active
                      ? "rgba(184,115,51,0.18)"
                      : "rgba(26,21,16,0.9)",
                    color: theme.parchment,
                  }}
                >
                  <span className="block text-2xl leading-none mb-1" aria-hidden>
                    ⌂
                  </span>
                  <span className="block text-sm font-semibold leading-tight truncate">
                    {h.label}
                  </span>
                  <span className="block text-[10px] font-mono opacity-60 mt-1 truncate">
                    {h.taskIds.length} task{h.taskIds.length === 1 ? "" : "s"} · {h.id}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
