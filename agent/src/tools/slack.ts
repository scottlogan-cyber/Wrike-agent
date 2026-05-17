import { env } from "../config.js";
import { incrementSlackDmCount, getTask } from "../state/tasks.js";
import { logEvent } from "../state/events.js";

export async function sendSlackDm(text: string, blocks?: unknown[]): Promise<string | null> {
  if (!env.slackBotToken || !env.mySlackUserId) {
    console.warn("[slack] Missing SLACK_BOT_TOKEN or MY_SLACK_USER_ID");
    return null;
  }
  const open = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.slackBotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users: env.mySlackUserId }),
  });
  const openJson = (await open.json()) as { ok: boolean; channel?: { id: string }; error?: string };
  if (!openJson.ok || !openJson.channel?.id) {
    throw new Error(`Slack conversations.open: ${openJson.error}`);
  }
  const post = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.slackBotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: openJson.channel.id,
      text,
      blocks,
    }),
  });
  const postJson = (await post.json()) as { ok: boolean; ts?: string; error?: string };
  if (!postJson.ok) {
    throw new Error(`Slack chat.postMessage: ${postJson.error}`);
  }
  logEvent({ type: "slack_dm", outputPreview: text.slice(0, 500) });
  return postJson.ts ?? null;
}

export async function sendTaskSlackDm(
  taskId: string,
  text: string,
  blocks?: unknown[]
): Promise<boolean> {
  const task = getTask(taskId);
  if (!task) return false;
  if (task.slack_dm_count >= 4) {
    logEvent({
      type: "slack_budget_exceeded",
      taskId,
      payload: { text },
    });
    return false;
  }
  await sendSlackDm(text, blocks);
  incrementSlackDmCount(taskId);
  return true;
}

export function triagedSlackMessage(input: {
  title: string;
  assigner?: string;
  clientName?: string;
  topicGuess?: string;
  urgency?: string;
  summary?: string;
  taskId: string;
}): string {
  return [
    `New Wrike request: ${input.title} (assigned by ${input.assigner ?? "unknown"})`,
    `Client: ${input.clientName ?? "TBD"} · Topic: ${input.topicGuess ?? "TBD"} · Urgency: ${input.urgency ?? "normal"}`,
    input.summary ?? "",
    `Open in agent UI: http://localhost:3000?task=${input.taskId}`,
    "",
    "I'll keep watching for the call and ping you when the transcript lands.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStaleBlocks(taskId: string, title: string): unknown[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}* has been waiting 3 days without a scheduled call. Want me to keep watching, ping the seller, or close this out?`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Keep watching" },
          action_id: "stale_keep",
          value: taskId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind in 3 days" },
          action_id: "stale_remind",
          value: taskId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Close it" },
          action_id: "stale_close",
          style: "danger",
          value: taskId,
        },
      ],
    },
  ];
}
