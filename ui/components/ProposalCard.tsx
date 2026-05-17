"use client";

import { theme } from "@/lib/theme";

export interface Proposal {
  id: string;
  title: string;
  category: string;
  hypothesis?: string;
  proposed_change?: string;
  risk?: string;
}

export function ProposalCard({
  proposal,
  onDismiss,
}: {
  proposal: Proposal;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="rounded border p-3 text-sm space-y-2"
      style={{ borderColor: theme.bronze, color: theme.parchment }}
    >
      <div className="flex justify-between gap-2">
        <span className="text-xs uppercase opacity-60">{proposal.category}</span>
        <span className="text-xs">{proposal.id}</span>
      </div>
      <h4 className="font-bold text-amber-600">{proposal.title}</h4>
      {proposal.hypothesis && <p>{proposal.hypothesis}</p>}
      {proposal.proposed_change && (
        <pre className="text-xs opacity-80 whitespace-pre-wrap">
          {proposal.proposed_change}
        </pre>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="text-xs px-2 py-1 rounded"
          style={{ backgroundColor: theme.bronze }}
        >
          Open PR
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border"
          style={{ borderColor: theme.bronze }}
          onClick={() => onDismiss(proposal.id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
