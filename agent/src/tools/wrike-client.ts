import { env } from "../config.js";
import { broadcastToolCall, broadcastToolResult } from "../ws/broadcast.js";

export interface WrikeTask {
  id: string;
  title: string;
  description?: string;
  responsibleIds?: string[];
  permalink?: string;
  customFields?: Array<{ id: string; value: string }>;
  updatedDate?: string;
}

export interface WrikeComment {
  id: string;
  text: string;
  authorId: string;
  createdDate: string;
}

async function wrikeFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = env.wrikeAccessToken;
  if (!token) {
    throw new Error("WRIKE_ACCESS_TOKEN not configured");
  }
  broadcastToolCall({ tool: `wrike:${path}`, inputData: { path } });
  const res = await fetch(`${env.wrikeApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    broadcastToolResult({
      tool: `wrike:${path}`,
      ok: false,
      outputPreview: body.slice(0, 500),
    });
    throw new Error(`Wrike API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: T };
  broadcastToolResult({
    tool: `wrike:${path}`,
    ok: true,
    outputPreview: JSON.stringify(json.data).slice(0, 500),
  });
  return json.data;
}

export async function listTasksAssignedSince(
  userId: string,
  updatedSince: string
): Promise<WrikeTask[]> {
  const params = new URLSearchParams({
    responsibles: JSON.stringify([userId]),
    updatedDate: JSON.stringify({ start: updatedSince }),
    fields: JSON.stringify(["description", "responsibleIds", "permalink", "customFields"]),
  });
  return wrikeFetch<WrikeTask[]>(`/tasks?${params}`);
}

export async function listFolderTasks(folderId: string): Promise<WrikeTask[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(["description", "responsibleIds", "permalink", "customFields"]),
  });
  return wrikeFetch<WrikeTask[]>(`/folders/${folderId}/tasks?${params}`);
}

export async function getTask(taskId: string): Promise<WrikeTask> {
  const params = new URLSearchParams({
    fields: JSON.stringify(["description", "responsibleIds", "permalink", "customFields"]),
  });
  const tasks = await wrikeFetch<WrikeTask[]>(`/tasks/${taskId}?${params}`);
  return tasks[0];
}

export async function getTaskComments(taskId: string): Promise<WrikeComment[]> {
  return wrikeFetch<WrikeComment[]>(`/tasks/${taskId}/comments`);
}

export async function getSubtasks(taskId: string): Promise<WrikeTask[]> {
  return wrikeFetch<WrikeTask[]>(`/tasks/${taskId}/subtasks`);
}

export async function updateSubtaskDescription(
  taskId: string,
  description: string
): Promise<WrikeTask> {
  const tasks = await wrikeFetch<WrikeTask[]>(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ description }),
  });
  return tasks[0];
}

export async function addTaskComment(
  taskId: string,
  text: string
): Promise<unknown> {
  return wrikeFetch(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function extractSfOppId(task: WrikeTask): string | null {
  const fields = task.customFields ?? [];
  for (const f of fields) {
    const v = f.value?.toLowerCase() ?? "";
    if (v.includes("salesforce") || v.match(/006[a-z0-9]{12,15}/i)) {
      const match = v.match(/006[a-z0-9]{12,15}/i);
      if (match) return match[0];
    }
  }
  const desc = task.description ?? "";
  const match = desc.match(/006[a-z0-9]{12,15}/i);
  return match?.[0] ?? null;
}
