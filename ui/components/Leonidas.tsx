"use client";

import { Sprite } from "./Sprite";
import type { PetState } from "@/lib/ws";

export function Leonidas({ state }: { state: PetState }) {
  return <Sprite state={state} />;
}
