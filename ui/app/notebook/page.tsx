"use client";

import Link from "next/link";
import { ProposalCard, type Proposal } from "@/components/ProposalCard";
import { theme } from "@/lib/theme";
import { useState } from "react";

const SAMPLE: Proposal[] = [
  {
    id: "imp_sample_001",
    category: "prompt",
    title: "Tighten Scribe drafting on cleanup-type tasks",
    hypothesis: "Scribe restates parent context as padding on account_cleanup tasks.",
    proposed_change: "Add to scribe.md: Do not restate context in parent description.",
    risk: "Low",
  },
];

export default function NotebookPage() {
  const [proposals, setProposals] = useState(SAMPLE);

  return (
    <div
      className="min-h-screen p-8 max-w-2xl mx-auto"
      style={{ backgroundColor: "#0f0d0b", color: theme.parchment }}
    >
      <Link href="/" className="text-amber-600 text-sm font-mono">
        ← Leonidas
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-2" style={{ color: theme.bronze }}>
        Kratos&apos;s Notebook
      </h1>
      <p className="text-sm opacity-70 mb-6">
        Improvement proposals from Kratos IA runs (Sunday digest).
      </p>
      <div className="space-y-4">
        {proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            onDismiss={(id) =>
              setProposals((prev) => prev.filter((x) => x.id !== id))
            }
          />
        ))}
      </div>
    </div>
  );
}
