import { env } from "./config.js";
import {
  getActiveTasks,
  getTask,
  upsertTask,
  getWatcherMeta,
  setWatcherMeta,
} from "./state/tasks.js";
import { hasFingerprint, logEvent } from "./state/events.js";
import { broadcast } from "./ws/broadcast.js";
import {
  listTasksAssignedSince,
  listFolderTasks,
  getTaskComments,
  extractSfOppId,
} from "./tools/wrike-client.js";
import {
  detectCallScheduling,
  detectMention,
} from "./tools/watcher-patterns.js";
import { findFutureCall, findTranscriptAfter } from "./tools/salesloft.js";
import {
  onTaskDiscovered,
  runResearcher,
  onCallDetected,
  onTranscriptAvailable,
  handleStale,
} from "./orchestrator.js";
import { dispatchKratos } from "./watchdog.js";

let paused = false;
let running = false;

export function pauseWatcher(): void {
  paused = true;
}
export function resumeWatcher(): void {
  paused = false;
}

export async function detectNewAssignments(): Promise<number> {
  let count = 0;
  const lastPoll =
    getWatcherMeta("last_poll") ??
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (env.myWrikeUserId && env.wrikeAccessToken) {
    try {
      const assigned = await listTasksAssignedSince(
        env.myWrikeUserId,
        lastPoll
      );
      for (const t of assigned) {
        const fp = `assign:${t.id}`;
        if (hasFingerprint(fp)) continue;
        await onTaskDiscovered(t.id, {
          title: t.title,
          source: "assignment",
        });
        logEvent({ type: "watcher_assign", taskId: t.id, fingerprint: fp });
        count++;
      }
    } catch (e) {
      console.error("[watcher] assignment poll failed", e);
    }
  }

  if (env.myQueueFolderId && env.wrikeAccessToken) {
    try {
      const folderTasks = await listFolderTasks(env.myQueueFolderId);
      for (const t of folderTasks) {
        const fp = `queue:${t.id}`;
        if (hasFingerprint(fp)) continue;
        const responsibles = t.responsibleIds ?? [];
        const mine =
          env.myWrikeUserId && responsibles.includes(env.myWrikeUserId);
        if (mine || responsibles.length === 0) {
          await onTaskDiscovered(t.id, {
            title: t.title,
            source: "queue_folder",
          });
          logEvent({ type: "watcher_queue", taskId: t.id, fingerprint: fp });
          count++;
        }
      }
    } catch (e) {
      console.error("[watcher] queue poll failed", e);
    }
  }

  if (env.myQueueFolderId) {
    try {
      const folderTasks = await listFolderTasks(env.myQueueFolderId);
      const bossIds = [env.ryanWrikeUserId, env.tyWrikeUserId].filter(Boolean);
      for (const t of folderTasks) {
        const comments = await getTaskComments(t.id);
        for (const c of comments) {
          if (!bossIds.includes(c.authorId)) continue;
          if (!detectMention(c.text)) continue;
          const fp = `comment:${c.id}`;
          if (hasFingerprint(fp)) continue;
          await onTaskDiscovered(t.id, {
            title: t.title,
            assigner: c.authorId,
            source: "comment_mention",
          });
          logEvent({
            type: "watcher_comment",
            taskId: t.id,
            fingerprint: fp,
          });
          count++;
        }
      }
    } catch (e) {
      console.error("[watcher] comment poll failed", e);
    }
  }

  setWatcherMeta("last_poll", new Date().toISOString());
  return count;
}

export async function checkTransitions(taskId: string): Promise<number> {
  const task = getTask(taskId);
  if (!task) return 0;
  let transitions = 0;

  if (task.state === "triaged") {
    const fp = `auto_research:${taskId}`;
    if (!hasFingerprint(fp)) {
      await runResearcher(taskId);
      transitions++;
    }
  }

  if (task.state === "enriched" || task.state === "call_pending") {
    const sfOpp = task.sf_opp_id;
    if (sfOpp) {
      const future = await findFutureCall(sfOpp);
      if (future) {
        const when = future.scheduledAt ?? future.createdAt ?? "";
        if (when && task.state === "enriched") {
          await onCallDetected(taskId, when, "salesloft");
          transitions++;
        }
      }
    }

    try {
      const comments = await getTaskComments(taskId);
      const since = task.enriched_at ?? task.updated_at;
      for (const c of comments) {
        if (c.createdDate < since) continue;
        if (detectCallScheduling(c.text)) {
          await onCallDetected(taskId, c.createdDate, "comment");
          transitions++;
          break;
        }
      }
    } catch {
      /* comments optional */
    }

    const enrichedAt = task.enriched_at ?? task.created_at;
    if (sfOpp) {
      const transcript = await findTranscriptAfter(sfOpp, enrichedAt);
      if (transcript?.id) {
        await onTranscriptAvailable(taskId, { id: transcript.id });
        transitions++;
      }
    }

    const idleMs = Date.now() - new Date(task.last_progress_at ?? task.updated_at).getTime();
    const staleDays = idleMs / (1000 * 60 * 60 * 24);
    if (staleDays >= env.staleThresholdDays) {
      await handleStale(taskId, Math.floor(staleDays));
      transitions++;
    }
  }

  if (task.state === "call_pending") {
    const sfOpp = task.sf_opp_id;
    const enrichedAt = task.enriched_at ?? task.created_at;
    if (sfOpp) {
      const transcript = await findTranscriptAfter(sfOpp, enrichedAt);
      if (transcript?.id) {
        await onTranscriptAvailable(taskId, { id: transcript.id });
        transitions++;
      }
    }
  }

  return transitions;
}

export async function watchCycle(): Promise<void> {
  if (paused || running) return;
  running = true;
  let transitions = 0;
  try {
    transitions += await detectNewAssignments();
    const active = getActiveTasks();
    for (const t of active) {
      transitions += await checkTransitions(t.task_id);
    }
    broadcast({
      type: "watcher_cycle",
      payload: {
        tasks_checked: active.length,
        transitions_detected: transitions,
      },
    });
  } catch (e) {
    console.error("[watcher] cycle error", e);
    await dispatchKratos({
      reason: "watcher_loop_error",
      error: e instanceof Error ? e : new Error(String(e)),
    });
  } finally {
    running = false;
  }
}

export function startWatcher(): void {
  const interval = env.watchIntervalSeconds * 1000;
  void watchCycle();
  setInterval(() => void watchCycle(), interval);
}
