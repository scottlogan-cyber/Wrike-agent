"use client";

import { motion } from "framer-motion";
import { theme } from "@/lib/theme";

export function Forge({ draftCount }: { draftCount: number }) {
  return (
    <motion.div
      className="relative w-full h-48 rounded border-2 overflow-hidden"
      style={{
        borderColor: theme.bronze,
        backgroundColor: theme.stone,
      }}
    >
      <motion.div
        className="absolute w-8 h-8 rounded-full opacity-60"
        style={{ top: 16, left: 24, backgroundColor: theme.bronze }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
      />
      <motion.div
        className="absolute w-6 h-6 rounded-full opacity-60"
        style={{ top: 32, right: 40, backgroundColor: theme.bronze }}
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
      />
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-12 rounded"
        style={{ backgroundColor: "#ff6b00" }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
      <motion.div
        className="absolute bottom-16 left-0 right-0 h-2 flex gap-2 justify-end px-4"
      >
        {Array.from({ length: Math.min(draftCount, 5) }).map((_, i) => (
          <motion.div
            key={i}
            className="w-4 h-4"
            style={{ backgroundColor: theme.wrikeBlue }}
            animate={{ x: [-200, -400] }}
            transition={{
              repeat: Infinity,
              duration: 3,
              delay: i * 0.4,
              ease: "linear",
            }}
          />
        ))}
      </motion.div>
      <p className="absolute bottom-2 left-2 text-xs text-amber-200/70 font-mono">
        Forge active
      </p>
    </motion.div>
  );
}
