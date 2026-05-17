import type { FastifyInstance } from "fastify";
import { onTaskDiscovered, onTranscriptAvailable } from "../orchestrator.js";

export async function registerWrikeWebhooks(app: FastifyInstance): Promise<void> {
  app.post("/webhook/wrike", async (req) => {
    const body = req.body as {
      taskId?: string;
      title?: string;
      eventType?: string;
    };
    if (body.taskId) {
      await onTaskDiscovered(body.taskId, {
        title: body.title ?? body.taskId,
        source: "assignment",
      });
    }
    return { ok: true };
  });

  /** Dev-only: skip call wait and run Transcript Hunter → Scribe for UI testing */
  app.post("/webhook/dev/transcript", async (req) => {
    const body = req.body as { taskId?: string };
    if (body.taskId) {
      await onTranscriptAvailable(body.taskId, { id: `dev-${body.taskId}` });
    }
    return { ok: true };
  });
}
