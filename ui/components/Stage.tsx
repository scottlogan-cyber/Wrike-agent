"use client";

import { Leonidas } from "./Leonidas";
import { Kratos, type KratosState } from "./Kratos";
import { Forge } from "./Forge";
import type { PetState } from "@/lib/ws";
import { theme } from "@/lib/theme";

export function Stage({
  petState,
  kratosState,
  draftCount,
}: {
  petState: PetState;
  kratosState: KratosState;
  draftCount: number;
}) {
  return (
    <div
      className="relative rounded-lg border-4 p-4 flex flex-col items-center justify-end min-h-[320px]"
      style={{
        borderColor: theme.bronze,
        background: `linear-gradient(180deg, ${theme.stone} 0%, #1a1510 100%)`,
      }}
    >
      {petState === "working" ? (
        <Forge draftCount={draftCount} />
      ) : (
        <Leonidas state={petState} />
      )}
      <div className="absolute bottom-4 left-4">
        <Kratos state={kratosState} />
      </div>
    </div>
  );
}
