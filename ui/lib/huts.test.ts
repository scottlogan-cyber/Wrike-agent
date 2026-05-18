import { describe, expect, it } from "vitest";
import {
  aggregateHutsFromTasks,
  clientKey,
  resolveHutByQuery,
  slugifyClientName,
} from "./huts";

describe("slugifyClientName", () => {
  it("normalizes names for filenames", () => {
    expect(slugifyClientName("Acme Corp")).toBe("acme-corp");
    expect(slugifyClientName("  Foo & Bar!!  ")).toBe("foo-bar");
  });
});

describe("clientKey", () => {
  it("uses slugified client_name when present", () => {
    expect(
      clientKey({
        task_id: "X-1",
        title: "T",
        client_name: "Acme Corp",
      })
    ).toBe("acme-corp");
  });

  it("falls back to task-prefixed id when no client", () => {
    expect(
      clientKey({ task_id: "DEMO-001", title: "Hello", client_name: null })
    ).toBe("task-DEMO-001");
  });
});

describe("aggregateHutsFromTasks", () => {
  it("merges tasks by client slug and lists task ids", () => {
    const huts = aggregateHutsFromTasks([
      {
        task_id: "a",
        title: "One",
        client_name: "Acme Corp",
      },
      {
        task_id: "b",
        title: "Two",
        client_name: "Acme Corp",
      },
      {
        task_id: "c",
        title: "Solo",
        client_name: null,
      },
    ]);
    expect(huts).toHaveLength(2);
    const acme = huts.find((h) => h.id === "acme-corp");
    expect(acme?.taskIds.sort()).toEqual(["a", "b"]);
    expect(acme?.label).toBe("Acme Corp");
  });
});

describe("resolveHutByQuery", () => {
  const huts = aggregateHutsFromTasks([
    { task_id: "1", title: "T", client_name: "Acme Corp" },
  ]);

  it("matches id and partial label", () => {
    expect(resolveHutByQuery(huts, "acme-corp")?.id).toBe("acme-corp");
    expect(resolveHutByQuery(huts, "acme")?.id).toBe("acme-corp");
    expect(resolveHutByQuery(huts, "corp")?.id).toBe("acme-corp");
  });
});
