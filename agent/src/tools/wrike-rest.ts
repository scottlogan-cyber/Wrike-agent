import { env } from "../config.js";

async function demoRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!env.wrikeDemoPat) {
    throw new Error("WRIKE_DEMO_PAT not configured");
  }
  const res = await fetch(`${env.wrikeApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.wrikeDemoPat}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Demo Wrike ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: T };
  return Array.isArray(json.data) ? (json.data[0] as T) : (json.data as T);
}

export async function demoCreateCustomField(
  title: string,
  fieldType: string,
  settings?: Record<string, unknown>
): Promise<unknown> {
  const body: Record<string, unknown> = { title, type: fieldType };
  if (settings) body.settings = settings;
  return demoRequest("/customfields", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function demoSetCustomField(
  taskId: string,
  fieldId: string,
  value: string
): Promise<unknown> {
  return demoRequest(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({
      customFields: [{ id: fieldId, value }],
    }),
  });
}

export async function demoCreateFolder(
  parentId: string,
  title: string,
  project?: Record<string, unknown>
): Promise<unknown> {
  const body: Record<string, unknown> = { title };
  if (project) body.project = project;
  return demoRequest(`/folders/${parentId}/folders`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function demoCreateTask(
  folderId: string,
  title: string,
  description = "",
  customFields?: Array<{ id: string; value: string }>
): Promise<unknown> {
  const body: Record<string, unknown> = {
    title,
    description,
    status: "Active",
  };
  if (customFields) body.customFields = customFields;
  return demoRequest(`/folders/${folderId}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function demoListCustomFields(): Promise<unknown[]> {
  const res = await fetch(`${env.wrikeApiBase}/customfields`, {
    headers: { Authorization: `Bearer ${env.wrikeDemoPat}` },
  });
  const json = (await res.json()) as { data: unknown[] };
  return json.data ?? [];
}
