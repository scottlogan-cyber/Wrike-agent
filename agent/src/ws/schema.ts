import { z } from "zod";

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task_discovered"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      title: z.string(),
      assigner: z.string().optional(),
      source: z.enum(["assignment", "comment_mention", "queue_folder"]),
    }),
  }),
  z.object({
    type: z.literal("state_change"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      from: z.string(),
      to: z.string(),
      reason: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("watcher_cycle"),
    ts: z.string(),
    payload: z.object({
      tasks_checked: z.number(),
      transitions_detected: z.number(),
    }),
  }),
  z.object({
    type: z.literal("tool_call"),
    ts: z.string(),
    task_id: z.string().optional(),
    payload: z.object({
      tool: z.string(),
      input: z.unknown(),
      subagent: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("tool_result"),
    ts: z.string(),
    task_id: z.string().optional(),
    payload: z.object({
      tool: z.string(),
      ok: z.boolean(),
      output_preview: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("call_detected"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      call_datetime: z.string(),
      source: z.enum(["comment", "salesloft"]),
    }),
  }),
  z.object({
    type: z.literal("transcript_arrived"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      call_id: z.string().optional(),
      extracted_summary: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("drafts_ready"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      drafts: z.array(
        z.object({
          id: z.string(),
          kind: z.string(),
          target: z.string(),
          current: z.unknown().optional(),
          proposed: z.unknown(),
        })
      ),
    }),
  }),
  z.object({
    type: z.literal("write_complete"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      kind: z.string(),
      target: z.string(),
      url: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("demo_plan"),
    ts: z.string(),
    payload: z.object({
      plan: z.unknown(),
    }),
  }),
  z.object({
    type: z.literal("stale_notice"),
    ts: z.string(),
    task_id: z.string(),
    payload: z.object({
      task_id: z.string(),
      days_idle: z.number(),
      last_state: z.string(),
    }),
  }),
  z.object({
    type: z.literal("error"),
    ts: z.string(),
    task_id: z.string().optional(),
    payload: z.object({
      stage: z.string(),
      message: z.string(),
      retryable: z.boolean(),
      incident_id: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("chat_reply"),
    ts: z.string(),
    payload: z.object({ text: z.string() }),
  }),
  z.object({
    type: z.literal("incident"),
    ts: z.string(),
    payload: z.object({
      incident_id: z.string(),
      trigger: z.string(),
      message: z.string(),
    }),
  }),
]);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("approval"),
    payload: z.object({
      draft_id: z.string(),
      decision: z.enum(["approve", "reject", "edit"]),
      edited: z.unknown().optional(),
    }),
  }),
  z.object({
    type: z.literal("chat"),
    payload: z.object({ text: z.string() }),
  }),
  z.object({
    type: z.literal("force_rerun"),
    payload: z.object({
      task_id: z.string(),
      stage: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("cancel_task"),
    payload: z.object({
      task_id: z.string(),
      reason: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("pause_watcher"),
    payload: z.object({}).optional(),
  }),
  z.object({
    type: z.literal("resume_watcher"),
    payload: z.object({}).optional(),
  }),
  z.object({
    type: z.literal("approve_demo"),
    payload: z.object({ plan_id: z.string().optional() }),
  }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
