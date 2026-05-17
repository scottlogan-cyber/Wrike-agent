import type { FastifyInstance } from "fastify";
import { env } from "../config.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { transitionTask } from "../state/tasks.js";
import { handleApproval } from "../orchestrator.js";

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const base = `v0:${timestamp}:${body}`;
  const hmac = createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${hmac}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function registerSlackWebhooks(app: FastifyInstance): Promise<void> {
  app.post("/webhook/slack", async (req, reply) => {
    const rawBody = JSON.stringify(req.body);
    const timestamp = String(req.headers["x-slack-request-timestamp"] ?? "");
    const signature = String(req.headers["x-slack-signature"] ?? "");

    if (env.slackSigningSecret) {
      const ok = verifySlackSignature(
        env.slackSigningSecret,
        timestamp,
        rawBody,
        signature
      );
      if (!ok) {
        return reply.status(401).send({ error: "invalid signature" });
      }
    }

    const body = req.body as {
      type?: string;
      challenge?: string;
      actions?: Array<{ action_id: string; value: string }>;
    };

    if (body.type === "url_verification") {
      return { challenge: body.challenge };
    }

    if (body.actions?.length) {
      for (const action of body.actions) {
        const taskId = action.value;
        if (action.action_id === "stale_close") {
          transitionTask(taskId, "cancelled");
        }
        if (action.action_id.startsWith("approve_")) {
          await handleApproval(action.value, "approve");
        }
      }
    }

    return { ok: true };
  });
}
