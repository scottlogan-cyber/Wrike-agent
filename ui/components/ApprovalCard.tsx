"use client";

import { useState } from "react";
import { sendApproval } from "@/lib/ws";
import type { DraftView } from "@/lib/ws";
import { theme } from "@/lib/theme";

export function ApprovalCard({ draft }: { draft: DraftView }) {
  const [edited, setEdited] = useState(draft.proposed);

  return (
    <div
      className="rounded border-2 p-4 space-y-3"
      style={{
        borderColor: theme.bronze,
        backgroundColor: theme.parchment,
        color: theme.stone,
      }}
    >
      <h4 className="font-bold">
        Wax-sealed parchment — {draft.kind}
      </h4>
      <p className="text-xs opacity-70">{draft.target}</p>
      {draft.current && (
        <div>
          <p className="text-xs font-bold">Current</p>
          <pre className="text-xs whitespace-pre-wrap opacity-80 max-h-24 overflow-y-auto">
            {draft.current}
          </pre>
        </div>
      )}
      <textarea
        className="w-full h-32 text-sm p-2 rounded border font-mono"
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          title="Yes"
          className="px-4 py-2 rounded font-bold"
          style={{ backgroundColor: theme.bronze, color: theme.parchment }}
          onClick={() =>
            sendApproval(
              draft.id,
              edited !== draft.proposed ? "approve" : "approve",
              edited !== draft.proposed ? edited : undefined
            )
          }
        >
          ΝΑΙ
        </button>
        <button
          type="button"
          title="No"
          className="px-4 py-2 rounded font-bold border-2"
          style={{ borderColor: theme.crimson, color: theme.crimson }}
          onClick={() => sendApproval(draft.id, "reject")}
        >
          ΟΧΙ
        </button>
      </div>
    </div>
  );
}
