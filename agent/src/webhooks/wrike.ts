import type { FastifyInstance } from "fastify";
import { onTaskDiscovered } from "../orchestrator.js";

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
}
