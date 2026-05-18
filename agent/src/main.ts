import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { env } from "./config.js";
import { getDb } from "./state/db.js";
import { registerClient, broadcast } from "./ws/broadcast.js";
import { clientMessageSchema } from "./ws/schema.js";
import { startWatcher, pauseWatcher, resumeWatcher } from "./watcher.js";
import { registerSlackWebhooks } from "./webhooks/slack.js";
import { registerWrikeWebhooks } from "./webhooks/wrike.js";
import {
  handleApproval,
  handleChat,
} from "./orchestrator.js";
import {
  runArchitect,
  executeDemoPlan,
  getPendingDemoPlan,
  clearPendingDemoPlan,
} from "./architect.js";
import cron from "node-cron";
import { dispatchSubagent } from "./dispatch.js";
import { listOpenImprovements } from "./state/improvements.js";

const app = Fastify({ logger: true });

await app.register(websocket);

getDb();

app.get("/health", async () => ({ ok: true, service: "leonidas-agent" }));

app.get("/api/improvements", async () => {
  return { improvements: listOpenImprovements() };
});

await registerSlackWebhooks(app);
await registerWrikeWebhooks(app);

app.register(async (fastify) => {
  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (token !== env.wsAuthToken) {
      socket.close(4001, "unauthorized");
      return;
    }
    registerClient(socket);

    socket.on("message", async (raw) => {
      try {
        const parsed = JSON.parse(String(raw));
        const msg = clientMessageSchema.parse(parsed);

        if (msg.type === "approval") {
          await handleApproval(
            msg.payload.draft_id,
            msg.payload.decision,
            msg.payload.edited
          );
        }
        if (msg.type === "chat") {
          const text = msg.payload.text;
          if (text.toLowerCase().includes("architect")) {
            const parent = process.env.WRIKE_DEMO_ROOT_FOLDER_ID ?? "";
            if (parent) await runArchitect(text, parent);
            else {
              broadcast({
                type: "chat_reply",
                payload: {
                  text: "Set WRIKE_DEMO_ROOT_FOLDER_ID to build demos.",
                },
              });
            }
          } else {
            const reply = await handleChat(text, {
              activeHutId: msg.payload.active_hut_id,
              hutLabel: msg.payload.hut_label,
            });
            broadcast({ type: "chat_reply", payload: { text: reply } });
          }
        }
        if (msg.type === "cancel_task") {
          const { transitionTask } = await import("./state/tasks.js");
          transitionTask(msg.payload.task_id, "cancelled");
        }
        if (msg.type === "pause_watcher") pauseWatcher();
        if (msg.type === "resume_watcher") resumeWatcher();
        if (msg.type === "approve_demo") {
          const plan = getPendingDemoPlan();
          const parent = process.env.WRIKE_DEMO_ROOT_FOLDER_ID ?? "";
          if (plan && parent) {
            await executeDemoPlan(plan, parent);
            clearPendingDemoPlan();
          }
        }
      } catch (e) {
        console.error("[ws] message error", e);
      }
    });
  });
});

app.addHook("onReady", () => {
  startWatcher();

  cron.schedule("0 18 * * 0", () => {
    if (env.cursorApiKey) {
      void dispatchSubagent("kratos-ia", "global", "Weekly improvement review.");
    }
  });
});

const port = env.port;
await app.listen({ port, host: "0.0.0.0" });
console.log(`Leonidas agent listening on http://localhost:${port}`);
