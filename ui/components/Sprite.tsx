"use client";

import { motion } from "framer-motion";
import type { PetState } from "@/lib/ws";

const COLORS: Record<string, string> = {
  armor: "#b87333",
  cloak: "#8b1a1a",
  skin: "#e8c4a0",
  shield: "#9a7b4f",
};

const GRIDS: Record<PetState, string[]> = {
  sleeping: [
    "................",
    "....aaaa........",
    "...aaaaaa.......",
    "..aaRRRRaa......",
    "..aaRRRRaa......",
    "...aaaaaa.......",
    "....llll........",
    "................",
  ],
  alerting: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "..aaaaaa........",
    "...llll.........",
    "....||||........",
    "................",
  ],
  thinking: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "...llll.........",
    "....????........",
    "................",
    "................",
  ],
  working: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "...llll.........",
    "....====........",
    "....====........",
    "................",
  ],
  awaiting_approval: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "...llll.........",
    "....[]]]........",
    "................",
    "................",
  ],
  happy: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "...llll.........",
    "..\\  //.........",
    "................",
    "................",
  ],
  confused: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "...llll.........",
    "....????........",
    "....????........",
    "................",
  ],
  hungry: [
    "................",
    "...aaaa.........",
    "..aaaaaa........",
    "..aRRRRa........",
    "...llll.........",
    "....oooo........",
    "................",
    "................",
  ],
};

function cellColor(ch: string): string {
  if (ch === "a") return COLORS.armor;
  if (ch === "R") return COLORS.cloak;
  if (ch === "l") return COLORS.skin;
  if (ch === "|" || ch === "=") return COLORS.shield;
  if (ch === "?") return "#fff";
  if (ch === "[") return COLORS.parchment;
  return "transparent";
}

export function Sprite({ state }: { state: PetState }) {
  const grid = GRIDS[state] ?? GRIDS.sleeping;
  const animate =
    state === "working"
      ? { y: [0, -4, 0] }
      : state === "alerting"
        ? { scale: [1, 1.05, 1] }
        : state === "happy"
          ? { rotate: [0, 5, -5, 0] }
          : {};

  return (
    <motion.div
      animate={animate}
      transition={{
        repeat:
          state === "working" || state === "alerting" ? Infinity : 0,
        duration: state === "working" ? 0.5 : 0.8,
      }}
    >
      <motion.div
        className="grid gap-0"
        style={{
          gridTemplateColumns: "repeat(16, 1fr)",
          width: 256,
          height: 256,
          imageRendering: "pixelated",
        }}
      >
        {grid.join("").split("").map((ch, i) => (
          <motion.div
            key={i}
            style={{
              width: 16,
              height: 16,
              backgroundColor: cellColor(ch),
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
