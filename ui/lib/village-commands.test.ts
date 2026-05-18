import { describe, expect, it } from "vitest";
import type { Hut } from "./huts";
import { tryParseLocalVillageCommand } from "./village-commands";

const sample: Hut[] = [
  { id: "acme-corp", label: "Acme Corp", taskIds: ["1"] },
];

describe("tryParseLocalVillageCommand", () => {
  it("detects leave", () => {
    expect(tryParseLocalVillageCommand("leave", sample)).toEqual({
      handled: true,
      kind: "leave",
    });
    expect(tryParseLocalVillageCommand("/leave", sample)).toEqual({
      handled: true,
      kind: "leave",
    });
  });

  it("detects enter by label fragment", () => {
    expect(tryParseLocalVillageCommand("enter acme", sample)).toEqual({
      handled: true,
      kind: "enter",
      hutId: "acme-corp",
    });
  });
});
