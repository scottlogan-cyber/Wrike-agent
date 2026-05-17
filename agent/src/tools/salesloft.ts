import { env } from "../config.js";

export interface SalesloftCall {
  id: string;
  scheduledAt?: string;
  createdAt?: string;
  transcribed?: boolean;
  recordingUrl?: string;
}

const SALESLOFT_TOKEN = () => process.env.SALESLOFT_TOKEN ?? "";

export async function listConversationsForAccount(
  accountId: string
): Promise<SalesloftCall[]> {
  const token = SALESLOFT_TOKEN();
  if (!token || !accountId) return [];

  const res = await fetch(
    `https://api.salesloft.com/v2/conversations?account_id=${encodeURIComponent(accountId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data: SalesloftCall[] };
  return json.data ?? [];
}

export async function findFutureCall(accountId: string): Promise<SalesloftCall | null> {
  const calls = await listConversationsForAccount(accountId);
  const now = Date.now();
  for (const c of calls) {
    const when = c.scheduledAt ?? c.createdAt;
    if (when && new Date(when).getTime() > now) return c;
  }
  return null;
}

export async function findTranscriptAfter(
  accountId: string,
  afterIso: string
): Promise<SalesloftCall | null> {
  const calls = await listConversationsForAccount(accountId);
  const after = new Date(afterIso).getTime();
  const eligible = calls
    .filter((c) => c.transcribed)
    .filter((c) => {
      const when = c.createdAt ?? c.scheduledAt;
      return when && new Date(when).getTime() >= after;
    })
    .sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.scheduledAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.scheduledAt ?? 0).getTime();
      return tb - ta;
    });
  return eligible[0] ?? null;
}

export async function fetchTranscript(callId: string): Promise<string> {
  const token = SALESLOFT_TOKEN();
  const res = await fetch(
    `https://api.salesloft.com/v2/conversations/${callId}/transcript`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return "";
  const json = (await res.json()) as { data?: { content?: string } };
  return json.data?.content ?? JSON.stringify(json);
}
