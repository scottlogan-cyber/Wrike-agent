"use client";

import { create } from "zustand";

export type PetState =
  | "sleeping"
  | "alerting"
  | "thinking"
  | "working"
  | "awaiting_approval"
  | "happy"
  | "confused"
  | "hungry";

export interface TaskView {
  task_id: string;
  title: string;
  state: string;
}

export interface LogEntry {
  ts: string;
  text: string;
}

export interface DraftView {
  id: string;
  kind: string;
  target: string;
  current?: string;
  proposed: string;
}

interface AgentStore {
  connected: boolean;
  petState: PetState;
  focusedTaskId: string | null;
  tasks: TaskView[];
  battleLog: LogEntry[];
  drafts: DraftView[];
  chatMessages: { role: "user" | "leonidas"; text: string }[];
  mood: string;
  stamina: number;
  draftProgress: string;
  setConnected: (v: boolean) => void;
  setPetState: (s: PetState) => void;
  setFocusedTask: (id: string | null) => void;
  pushLog: (text: string) => void;
  setDrafts: (drafts: DraftView[]) => void;
  addChat: (role: "user" | "leonidas", text: string) => void;
  upsertTask: (t: TaskView) => void;
  setMood: (m: string) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  connected: false,
  petState: "sleeping",
  focusedTaskId: null,
  tasks: [],
  battleLog: [],
  drafts: [],
  chatMessages: [],
  mood: "At rest",
  stamina: 80,
  draftProgress: "0 / 0 forged",
  setConnected: (v) => set({ connected: v }),
  setPetState: (petState) => set({ petState }),
  setFocusedTask: (focusedTaskId) => set({ focusedTaskId }),
  pushLog: (text) =>
    set({
      battleLog: [
        { ts: new Date().toISOString(), text },
        ...get().battleLog,
      ].slice(0, 50),
    }),
  setDrafts: (drafts) =>
    set({
      drafts,
      petState: "awaiting_approval",
      mood: "Awaiting decree",
      draftProgress: `0 / ${drafts.length} forged`,
    }),
  addChat: (role, text) =>
    set({ chatMessages: [...get().chatMessages, { role, text }] }),
  upsertTask: (t) => {
    const tasks = [...get().tasks.filter((x) => x.task_id !== t.task_id), t];
    set({ tasks: tasks.sort((a, b) => a.task_id.localeCompare(b.task_id)) });
  },
  setMood: (mood) => set({ mood }),
}));

let socket: WebSocket | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function resetIdle() {
  const store = useAgentStore.getState();
  if (store.petState === "awaiting_approval" || store.petState === "working") return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    useAgentStore.getState().setPetState("sleeping");
    useAgentStore.getState().setMood("At rest");
  }, 5 * 60 * 1000);
}

export function connectAgentWs(): void {
  if (socket?.readyState === WebSocket.OPEN) return;
  const token = process.env.NEXT_PUBLIC_WS_TOKEN ?? "leonidas-dev-token";
  const url =
    process.env.NEXT_PUBLIC_WS_URL ??
    `ws://localhost:8000/ws?token=${token}`;
  socket = new WebSocket(url);

  socket.onopen = () => {
    useAgentStore.getState().setConnected(true);
    useAgentStore.getState().pushLog("Connected to the agora");
  };

  socket.onclose = () => {
    useAgentStore.getState().setConnected(false);
    setTimeout(connectAgentWs, 3000);
  };

  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string) as {
      type: string;
      task_id?: string;
      payload: Record<string, unknown>;
    };
    const store = useAgentStore.getState();
    resetIdle();

    switch (msg.type) {
      case "task_discovered": {
        const p = msg.payload as { task_id: string; title: string };
        store.upsertTask({ task_id: p.task_id, title: p.title, state: "discovered" });
        store.setPetState("alerting");
        store.setMood("AROO! New request");
        store.setFocusedTask(p.task_id);
        store.pushLog(`New task: ${p.title}`);
        break;
      }
      case "state_change": {
        const p = msg.payload as { task_id: string; to: string };
        const t = store.tasks.find((x) => x.task_id === p.task_id);
        store.upsertTask({
          task_id: p.task_id,
          title: t?.title ?? p.task_id,
          state: p.to,
        });
        if (p.to === "enriched") {
          store.setPetState("thinking");
          store.setMood("Reading scrolls");
          store.pushLog("Consulted scrolls");
        }
        if (p.to === "drafted") store.setPetState("awaiting_approval");
        if (p.to === "completed") {
          store.setPetState("happy");
          store.setMood("ΝΙΚΗ!");
          store.pushLog("Victory — writes complete");
        }
        break;
      }
      case "tool_call": {
        const p = msg.payload as { tool: string; subagent?: string };
        store.setPetState("thinking");
        store.pushLog(
          `→ ${p.subagent ?? "agent"}: ${p.tool}`
        );
        break;
      }
      case "drafts_ready": {
        const p = msg.payload as {
          task_id: string;
          drafts: DraftView[];
        };
        const drafts = p.drafts.map((d) => ({
          ...d,
          proposed:
            typeof d.proposed === "string"
              ? d.proposed
              : JSON.stringify(d.proposed, null, 2),
          current:
            d.current !== undefined
              ? String(d.current)
              : undefined,
        }));
        store.setDrafts(drafts);
        store.setFocusedTask(p.task_id);
        store.pushLog("Drafts ready for approval");
        break;
      }
      case "write_complete":
        store.pushLog("Forged a draft into reality");
        break;
      case "watcher_cycle":
        break;
      case "chat_reply": {
        const p = msg.payload as { text: string };
        store.addChat("leonidas", p.text);
        break;
      }
      case "error": {
        store.setPetState("confused");
        const p = msg.payload as { message: string };
        store.pushLog(`Error: ${p.message}`);
        break;
      }
      case "incident":
        store.setPetState("confused");
        store.pushLog("Kratos dispatched");
        break;
      default:
        store.pushLog(msg.type);
    }
  };
}

export function sendWs(message: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function sendChat(text: string): void {
  useAgentStore.getState().addChat("user", text);
  sendWs({ type: "chat", payload: { text } });
}

export function sendApproval(
  draftId: string,
  decision: "approve" | "reject",
  edited?: string
): void {
  sendWs({
    type: "approval",
    payload: {
      draft_id: draftId,
      decision,
      edited: edited ? edited : undefined,
    },
  });
}
