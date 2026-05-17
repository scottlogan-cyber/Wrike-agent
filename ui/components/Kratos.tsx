"use client";

import { motion } from "framer-motion";

export type KratosState =
  | "sleeping"
  | "alert"
  | "dispatched"
  | "sniffing"
  | "digging"
  | "studying"
  | "pondering"
  | "proposing"
  | "presenting"
  | "victory";

const KRATOS_COLORS = {
  body: "#1a1a1a",
  patch: "#f0f0f0",
  spectacles: "#c0a060",
};

export function Kratos({ state }: { state: KratosState }) {
  const hasGlasses = ["studying", "pondering", "proposing"].includes(state);
  return (
    <motion.div
      className="relative"
      style={{ width: 80, height: 48 }}
      animate={
        state === "victory"
          ? { x: [0, 3, 0] }
          : state === "dispatched"
            ? { x: [0, 20, 40] }
            : {}
      }
      transition={{ repeat: state === "victory" ? Infinity : 0, duration: 0.4 }}
    >
      <motion.div
        className="rounded-lg"
        style={{
          width: 64,
          height: 40,
          backgroundColor: KRATOS_COLORS.body,
          marginTop: 8,
        }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 12,
          height: 12,
          backgroundColor: KRATOS_COLORS.patch,
          top: 20,
          left: 26,
        }}
      />
      {hasGlasses && (
        <motion.div
          className="absolute flex gap-1"
          style={{ top: 4, left: 18 }}
        >
          <div
            className="rounded-full border-2"
            style={{
              width: 14,
              height: 14,
              borderColor: KRATOS_COLORS.spectacles,
            }}
          />
          <motion.div
            className="rounded-full border-2"
            style={{
              width: 14,
              height: 14,
              borderColor: KRATOS_COLORS.spectacles,
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
