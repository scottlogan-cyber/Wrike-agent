import type { Hut } from "./huts";
import { resolveHutByQuery } from "./huts";

export type LocalCommandResult =
  | { handled: true; kind: "leave" }
  | { handled: true; kind: "enter"; hutId: string }
  | { handled: false };

export function tryParseLocalVillageCommand(
  raw: string,
  huts: Hut[]
): LocalCommandResult {
  const t = raw.trim();
  if (!t) return { handled: false };
  if (/^(leave|village|back|exit)$/i.test(t)) {
    return { handled: true, kind: "leave" };
  }
  if (/^\/(leave|village|back|exit)$/i.test(t)) {
    return { handled: true, kind: "leave" };
  }
  const enter =
    t.match(/^(?:enter|open|visit)\s+(.+)$/i) ??
    t.match(/^\/(?:hut|enter)\s+(.+)$/i);
  if (enter) {
    const hut = resolveHutByQuery(huts, enter[1]!);
    if (hut) return { handled: true, kind: "enter", hutId: hut.id };
  }
  return { handled: false };
}
