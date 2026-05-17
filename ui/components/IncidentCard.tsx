"use client";

import { theme } from "@/lib/theme";

export function IncidentCard({
  incidentId,
  message,
}: {
  incidentId: string;
  message: string;
}) {
  return (
    <div
      className="rounded border-2 p-3 text-sm"
      style={{ borderColor: theme.crimson, color: theme.parchment }}
    >
      <p className="font-bold text-red-400">Kratos — incident {incidentId}</p>
      <p className="mt-1 opacity-90">{message}</p>
    </div>
  );
}
