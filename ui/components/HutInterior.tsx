"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { theme } from "@/lib/theme";
import type { Hut } from "@/lib/huts";

export function HutInterior({
  hut,
  onLeave,
}: {
  hut: Hut;
  onLeave: () => void;
}) {
  const [scrollText, setScrollText] = useState<string | null>(null);
  const [scrollError, setScrollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setScrollText(null);
    setScrollError(null);
    const path = `/clients/${encodeURIComponent(hut.id)}.md`;
    fetch(path)
      .then((r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404
              ? "No scroll file yet — add public/clients/" + hut.id + ".md (sync from Obsidian)."
              : `Could not load scroll (${r.status})`
          );
        }
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setScrollText(t);
      })
      .catch((e: Error) => {
        if (!cancelled) setScrollError(e.message ?? "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [hut.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-sm border-2 p-4 min-h-[360px] flex flex-col gap-4"
      style={{
        borderColor: theme.bronze,
        background:
          "linear-gradient(180deg, #1c1814 0%, #0f0d0b 60%, #120f0c 100%)",
        boxShadow: "inset 0 2px 12px rgba(0,0,0,0.55)",
        color: theme.parchment,
      }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-amber-900/35 pb-3">
        <button
          type="button"
          onClick={onLeave}
          className="inline-flex items-center gap-1 text-xs font-mono uppercase px-2 py-1 rounded border border-amber-800/60 bg-stone-900/80 hover:bg-stone-800 text-amber-200/90"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden />
          Village
        </button>
        <div>
          <h2 className="text-base font-bold text-amber-500/90 uppercase tracking-wide">
            Inside {hut.label}&apos;s longhouse
          </h2>
          <p className="text-[11px] font-mono opacity-65">
            Scroll path: clients/{hut.id}.md
          </p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div
          className="lg:w-36 shrink-0 flex flex-col items-center justify-end gap-2"
          aria-hidden
        >
          <div
            className="text-6xl leading-none opacity-90 drop-shadow-md"
            title="Leonidas"
          >
            ⚔️
          </div>
          <p className="text-[10px] font-mono text-center opacity-60 uppercase">
            Leonidas
            <br />
            holds the scroll
          </p>
        </div>

        <div
          className="flex-1 min-h-[240px] rounded border-2 border-amber-900/45 bg-[#faf6ec] text-stone-900 shadow-inner p-4 overflow-auto"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #faf6ec 0%, #ede4d3 100%)",
          }}
        >
          {scrollError && (
            <p className="text-sm text-red-900 font-mono whitespace-pre-wrap">
              {scrollError}
            </p>
          )}
          {!scrollError && scrollText === null && (
            <p className="text-sm font-mono opacity-70 animate-pulse">
              Unrolling the scroll…
            </p>
          )}
          {scrollText !== null && (
            <article
              className="text-sm max-w-none font-serif text-stone-900 whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {scrollText}
            </article>
          )}
        </div>
      </div>
    </motion.div>
  );
}
