# Wrike Agent — Logic & Rules of Governance

This document captures the agent system's reasoning model, persona behavior, workflow, and the hard rules that govern what each agent can and cannot do. It is the canonical reference for "how Leonidas thinks." Source files live under `agent/src/prompts/`, `.cursor/rules/`, `.cursor/subagents/`, and the orchestrator/dispatch modules in `agent/src/`.

---

## 1. System Shape

The system is a **local-first, event-driven observer**. It is intentionally **not** a fixed pipeline:

- A **deterministic Watcher** (no LLM) polls Wrike every `WATCH_INTERVAL_SECONDS` (default 60s) and emits state transitions.
- An **Orchestrator** confirms the transition in SQLite and dispatches the correct specialist sub-agent.
- Sub-agents are **event-triggered**, each with a curated tool set and a single responsibility.
- A **Watchdog** monitors sub-agent runs and wakes **Kratos** when something breaks.
- All writes to Wrike or Obsidian are **approval-gated** through the UI.

> Core invariant: the Watcher decides *when*; the Orchestrator decides *who*; the sub-agent decides *what*; the human decides whether it *ships*.

### Personas (voice)

Persona voice is enforced by `.cursor/rules/personas.mdc` and applies to every UI string, Slack message, and chat reply:

- **Leonidas** — Spartan voice. Says "forging" not "updating", "Battle Log" not "trace". Stands at "the Hot Gates" watching the queue.
- **Kratos** — calm, capable, minimal words. Watchdog and improvement architect.
- **Architect** — speaks plainly; describes demos as constructions.
- **IA mode** (Kratos IA) — "wears spectacles": studying → pondering → proposing.

---

## 2. Rules of Governance (non-negotiable)

These rules apply to every agent, every run, every chat reply. They override any sub-agent prompt.

### 2.1 Safety (from `.cursor/rules/safety.mdc`)

1. **Never** write to Scott's real Wrike account or Obsidian vault without an explicit `approval` event from the UI or Slack.
2. The **Architect may only** use demo-account REST tools (`WRIKE_DEMO_PAT`). It must never touch the real Wrike account.
3. **Kratos must not** write customer-facing data — only code, incidents, and internal proposals.
4. Respect the **4 Slack DM per task** notification budget.

### 2.2 Human-in-the-loop

- Every write produces an **approval draft** (`createApproval`) and a `drafts_ready` WS event. No writer (`updateSubtaskDescription`, `writeObsidianNote`, demo REST tools) is invoked outside `handleApproval()`.
- On approve → write; on edit → write the edited content; on reject → no write, no transition.
- A task only transitions to `completed` when **all** pending approvals for it are resolved.

### 2.3 Notification budget

- Max **4 Slack DMs per task lifecycle**: triaged → call detected → transcript ready → stale.
- Watcher cycles emit `watcher_cycle` to the UI only — never Slack.
- 5th and subsequent notifications collapse into a batched UI banner.
- `tasks.slack_dm_count` is the source of truth and is incremented on each DM.

### 2.4 Prompts & configuration

- All sub-agent prompts live in `agent/src/prompts/*.md`. **No inline prompt strings** in TypeScript.
- Sub-agent registration (model + prompt file) lives in `.cursor/subagents/*.json` and is mirrored in `dispatch.ts` (`SUBAGENTS` map).
- The `@cursor/sdk` version is pinned; API usage is verified against the bundled SDK skill before changes.

### 2.5 Logging (non-negotiable)

- Every tool call writes a row to the `events` table: `{ type, ts, task_id, tool, input, output_preview, subagent }`.
- The `postToolUse` hook in `.cursor/hooks.json` enforces this from outside the agent code path.
- Every sub-agent dispatch creates a `runs` row that is updated to `finished` or `error` in a `try/finally` block.

### 2.6 Dispatch hygiene

- One `Agent.create()` per sub-agent run; the agent is disposed in `finally` via `Symbol.asyncDispose`.
- Each sub-agent is given **only the MCP servers it needs** (<8 tools per agent, system-wide 40-tool ceiling).
- Default runtime is **local**; cloud runtime is reserved for **Kratos IA** (long Sunday digest).

### 2.7 Token & cost caps

- `max_turns = 40` per run.
- Soft cost budget: **$0.50** per main-pipeline run, **$1.50** for an Architect build.
- Default model is `composer-2`; `claude-opus-4-7` is reserved for **Orchestrator** routing, **Architect** planning, **Kratos** (reactive + IA).

---

## 3. Task State Machine

State lives in `tasks.state` (SQLite). Transitions are atomic and produce `state_change` WS events.

```
discovered → triaged → enriched → call_pending → transcript_available → drafted → completed
```

Side states (terminal or holding):

- `stale` — idle in `enriched` or `call_pending` past `STALE_THRESHOLD_DAYS` (default 3).
- `stalled` — orchestrator gave up; surfaced in UI.
- `cancelled` — user issued `cancel <TASK-ID>` in chat.

### Transition triggers (Watcher → Orchestrator)

| From | To | Trigger | Notifier |
| --- | --- | --- | --- |
| (none) | `discovered` | New assignment, queue folder, or boss-comment mention | UI only |
| `discovered` | `triaged` | `runIntake()` returns structured JSON | **Slack DM #1** |
| `triaged` | `enriched` | `runResearcher()` returns articles | silent |
| `enriched` / `call_pending` | `call_pending` | `detectCallScheduling()` on a comment, or future call on linked SF opp | **Slack DM #2** |
| `enriched` / `call_pending` | `transcript_available` | `findTranscriptAfter(sfOpp, enrichedAt)` returns a transcript | **Slack DM #3** |
| `transcript_available` | `drafted` | `runScribe()` produced drafts and `createApproval` rows | `drafts_ready` UI event |
| `drafted` | `completed` | All approvals for the task resolved | `write_complete` UI event |
| `enriched` / `call_pending` | `stale` | `last_progress_at` older than threshold | **Slack DM #4** (or batched UI banner if budget spent) |

> Skip-ahead is allowed: a transcript that appears **before** a `call_pending` transition is still valid and advances the task.

### Dedupe

Every transition writes a fingerprint to `events` (e.g. `discovered:VRC-1183`, `transcript:VRC-1183:<call-id>`, `stale:VRC-1183`). `hasFingerprint()` is checked before any side-effectful action, so 100 watcher cycles produce one transition.

---

## 4. Watcher (deterministic, no LLM)

Module: `agent/src/watcher.ts`.

- 60s loop (`startWatcher()`), single-flight via `running` flag and pausable via `pauseWatcher()`.
- `detectNewAssignments()` does three deterministic scans:
  1. Tasks assigned to `MY_WRIKE_USER_ID` since `last_poll`.
  2. Tasks in `MY_QUEUE_FOLDER_ID` (mine, or unassigned).
  3. Comments on queue-folder tasks authored by `RYAN_WRIKE_USER_ID` / `TY_WRIKE_USER_ID` containing a mention pattern.
- `checkTransitions(taskId)` runs the four post-intake transition checks (auto-research → call detected → transcript available → stale) per active task, with fingerprint dedupe.
- The watcher **never calls an LLM** and **never writes** to Wrike or Obsidian. Its only output is a transition.
- On loop error, it wakes Kratos via `dispatchKratos({ reason: "watcher_loop_error" })`.

---

## 5. Orchestrator

Module: `agent/src/orchestrator.ts`. Prompt: `agent/src/prompts/orchestrator.md`.

Orchestrator rules (from the prompt, enforced in code):

1. **No fixed pipeline.** The Watcher detects state transitions; the Orchestrator dispatches the right sub-agent for the current state.
2. **Never call a write tool before receiving an approval event.**
3. **At most 4 Slack DMs per task lifecycle.**
4. If stuck, set state `hungry` (i.e. ask Scott via chat) — do not improvise.

Responsibilities:

- Owns the transition functions (`onTaskDiscovered`, `runIntake`, `runResearcher`, `onCallDetected`, `onTranscriptAvailable`, `runScribe`, `handleApproval`, `handleStale`).
- Reads/writes the `tasks.payload_json` blob via `mergePayload` / `getPayload` so each sub-agent sees the prior sub-agents' structured output.
- Emits all WS events (`task_discovered`, `state_change`, `call_detected`, `transcript_arrived`, `drafts_ready`, `write_complete`, `stale_notice`).
- Handles `handleChat()` — natural-language chat from the UI. Recognized intents: `cancel <ID>`, "architect", "kratos", or "focus on <ID>". All replies are in **Leonidas voice**.

---

## 6. Sub-Agent Catalog

Each sub-agent has: (a) a single triggering state, (b) a strict JSON output schema, (c) a curated tool set, and (d) a model.

### 6.1 Intake

- **Prompt:** `prompts/intake.md`
- **Model:** `composer-2`
- **Trigger:** `discovered`
- **Tools (read-only):** `wrike.get_task`, `get_task_comments`, `get_task_attachments`
- **Output schema:**
  ```json
  {
    "task_id": "", "title": "", "assigner": "",
    "sf_opp_id": null, "client_name": "",
    "topic_guess": "integration_scoping|demo_prep|account_cleanup",
    "urgency": "low|normal|high",
    "summary": "", "links": []
  }
  ```
- **Behavior:** Extract Salesforce opportunity ID (`006...`) from custom fields or description when present. Heuristic fallback (`runHeuristic("intake", ...)`) runs if `CURSOR_API_KEY` is unset.
- **Post-conditions:** transition to `triaged`; merge output into payload; send Slack DM #1.

### 6.2 Researcher

- **Prompt:** `prompts/researcher.md`
- **Model:** `composer-2`
- **Trigger:** `triaged` (runs **once per task** — fingerprint `researcher:<taskId>`)
- **Tools:** `WebSearch` / `WebFetch` allowlisted to `help.wrike.com` and `community.wrike.com`.
- **Output schema:**
  ```json
  {
    "topic": "",
    "articles": [{"title":"","url":"","summary":"","relevance":0.0}],
    "key_concepts": [],
    "recommended_features": []
  }
  ```
- **Behavior:** be concise; **silent** (no Slack DM); transition to `enriched`.

### 6.3 Transcript Hunter

- **Prompt:** `prompts/transcript_hunter.md`
- **Model:** `composer-2`
- **Trigger:** `transcript_available` event (call transcript appears for the linked SF opp).
- **Tools:** Salesloft MCP — `list_recordings`, `get_transcript`, `search_by_account`.
- **Output schema:**
  ```json
  {
    "call_id": "", "call_date": "", "attendees": [],
    "transcript_url": "",
    "extracted": {
      "pain_points": [], "current_tools": [],
      "integration_touchpoints": [], "decision_criteria": [],
      "next_steps": [], "raw_summary": ""
    }
  }
  ```
- **Behavior:** structured extraction only — no writes; output is stored in the task payload and consumed by Scribe.

### 6.4 Scribe

- **Prompt:** `prompts/scribe.md`
- **Model:** `composer-2`
- **Trigger:** `transcript_available`.
- **Tools:** Wrike MCP read (`list_subtasks`); **no writers**.
- **Output schema:**
  ```json
  {
    "subtask_drafts": [{"target": "subtask-id", "proposed": "markdown notes"}],
    "obsidian_note": {"path": "", "content": ""}
  }
  ```
- **Hard rules:**
  - **Never write files directly — drafts only.**
  - **Do NOT restate context already in the parent task description.**
- **Behavior:** for each subtask, create a `wrike_subtask` approval; also create an `obsidian_note` approval whose target path is resolved via `obsidian-routing` (see §8.1). The engagement note follows the `agent/templates/engagement-note.md` shape: Request → Research → Call Notes → My Plan → Open Questions.
- **Post-conditions:** transition to `drafted`; emit `drafts_ready`. Writes only happen later, inside `handleApproval()`.

### 6.5 Architect

- **Prompt:** `prompts/architect.md`
- **Model:** `claude-opus-4-7`
- **Trigger:** chat command ("Architect, build me a marketing agency demo for Acme Co").
- **Tools:** **only** `wrike_demo_*` tools defined in `agent/src/tools/wrike-rest.ts` (authenticated with `WRIKE_DEMO_PAT`).
- **Templates:** `agent/templates/demos/*.yaml` (e.g. `marketing-agency.yaml`, `prof-services.yaml`, `creative-team.yaml`).
- **Flow:** parse request → pick a template → produce a demo plan JSON → emit `demo_plan` WS event → wait for approval → `executeDemoPlan()` creates custom fields → folders → sample tasks → Slack talk-track message.
- **Hard rules:**
  - **Never touches Scott's real Wrike account.** Any attempt to call non-demo Wrike tools is a violation.
  - All structural changes go through the approval gate; nothing is created before the user approves the plan.

### 6.6 Kratos (Reactive)

- **Prompt:** `prompts/kratos-reactive.md`
- **Model:** `claude-opus-4-7`
- **Trigger:** Watchdog incident (see §7).
- **Tools:** codebase read; Slack interactive (no Wrike, no Salesloft, no Obsidian write tools).
- **Principles:**
  1. **Retry before refactor.**
  2. Code fixes must be proposed with **traceback + hypothesis + diff + risks**.
  3. **Never write to Wrike or Obsidian.**
  4. **Approvals go through Slack.**
- **Behavior:** investigate the incident, propose the smallest fix, surface for review. Reactive Kratos never auto-merges; merges happen only after human approval and CI.

### 6.7 Kratos (IA — Improvement Architect)

- **Prompt:** `prompts/kratos-ia.md`
- **Model:** `claude-opus-4-7`
- **Runtime:** cloud (only sub-agent allowed cloud runtime).
- **Trigger:** Sunday 6pm cron, plus event-count thresholds.
- **Inputs:** `events`, `runs`, `incidents`, `approvals` tables.
- **Output:** up to **5 proposals**, ranked by impact/effort. Categories: `prompt | pattern | template | workflow | meta`.
- **Hard rules:**
  - **Evidence first** — every proposal must cite **≥ 3 data points** from events/approvals.
  - **Never weaken human-in-the-loop guarantees.** Any proposal that removes an approval gate is invalid.
- **Storage:** writes to `improvements` table and the UI Notebook view; never executes its own proposals.

---

## 7. Watchdog & Incident Handling

Module: `agent/src/watchdog.ts`.

| Trigger                    | Action                                    |
| -------------------------- | ----------------------------------------- |
| MCP fail 3×                | classify, retry, else open incident       |
| Sub-agent run > 90s        | mark stuck, investigate trace             |
| Malformed JSON 2×          | reprompt with stricter schema             |
| Auth expired               | open incident, Slack reauth prompt        |
| Uncaught exception         | open incident, dispatch Kratos reactive   |

Classification (`classifyError`):

- `transient` (timeout/network) — auto-retry up to **3 attempts** per `${reason}:${taskId}` key; logged as `kratos_retry` and resolved as `retried`.
- `auth` — surface to Slack, no auto-retry.
- `schema` — re-prompt with stricter constraints.
- `code` / `unknown` — open incident, notify, optionally dispatch Kratos reactive (only if `CURSOR_API_KEY` is set and an error stack exists).

Every incident has a row in `incidents` and is broadcast as an `incident` WS event.

---

## 8. Skills (curated capabilities)

Skills are small `.cursor/skills/<name>/SKILL.md` files that constrain how specific tools are used.

### 8.1 `obsidian-routing`

- Route engagement notes to Obsidian folders by topic.
- **Read `config/obsidian-routing.json` at runtime.**
- **Never hardcode vault paths.**
- Consumed by Scribe via `resolveNotePath(topic, client, taskId)`.

### 8.2 `wrike-rest`

- Demo Wrike account custom-field operations via REST PAT.
- Use `agent/src/tools/wrike-rest.ts` **only** for the demo account (`WRIKE_DEMO_PAT`).
- **Architect is the only sub-agent allowed to call these tools.**

---

## 9. Coding Conventions

These are the conventions that keep the agent system predictable. They map 1:1 to the files in `agent/src/`.

1. **Prompts are files, not strings.** All sub-agent system prompts live in `agent/src/prompts/*.md`. The dispatcher loads them at runtime via `loadPrompt(name)`. No inline prompts in TS modules.
2. **Watcher is deterministic.** No LLM call from `watcher.ts` or `watcher-patterns.ts`. Pattern detection lives in pure functions (`detectCallScheduling`, `detectMention`) so they can be unit-tested.
3. **One Agent per run.** `dispatch.ts` creates a fresh `Agent` instance per sub-agent run and disposes it in `finally`. No long-lived agents.
4. **JSON-only sub-agent outputs.** Every sub-agent returns a single JSON object matching its declared schema. `parseJsonFromText` extracts the first `{...}` block; if parsing fails, the raw text is stored under `raw` and the run is marked as such.
5. **Heuristic fallback.** When `CURSOR_API_KEY` is absent, `runHeuristic(name, taskId)` produces a deterministic stub for `intake`, `researcher`, `transcript_hunter`, `scribe`. The pipeline still runs end-to-end so local dev never blocks on credentials.
6. **State first, side-effect second.** Every transition function:
   - reads the task,
   - guards on the expected `state`,
   - guards on a fingerprint,
   - writes payload + transition,
   - **then** emits the WS event and any Slack DM.
7. **Approval gating in one place.** Only `handleApproval()` may call `updateSubtaskDescription` or `writeObsidianNote`. Sub-agents never call writers directly.
8. **Tool budget per agent.** Each sub-agent registers fewer than 8 MCP tools; the system-wide budget is 40. Adding a tool to an agent requires removing one or justifying the bump.
9. **Idempotent dedupe.** Any new side effect must compute a fingerprint and check `hasFingerprint` before acting.
10. **Schema-typed transitions.** WebSocket payloads validate against zod schemas in `agent/src/ws/schema.ts` so the UI contract cannot drift silently.
11. **Logs are mandatory.** Use `logEvent({...})` for every meaningful action; do not rely on `console.log`. The hook layer (`.cursor/hooks.json` → `postToolUse`) backstops this for tool calls.
12. **Persona discipline.** All user-facing strings (Slack messages, chat replies, UI labels) follow `personas.mdc` voice rules. "Forging", "Battle Log", "Hot Gates" for Leonidas; minimal, calm phrasing for Kratos.

---

## 10. Workflow Walkthrough (happy path)

For a single Wrike task `VRC-1183`:

1. **Watcher** sees the task assigned to Scott → calls `onTaskDiscovered("VRC-1183", { source: "assignment" })`.
2. Task row inserted as `discovered`; UI receives `task_discovered`. **Intake** dispatches.
3. Intake returns structured JSON → transition to `triaged` → **Slack DM #1** → **Researcher** dispatches.
4. Researcher returns articles → transition to `enriched`. Silent.
5. Watcher polls Salesloft for the linked SF opp; sees a future call → `onCallDetected` → transition to `call_pending` → **Slack DM #2**.
6. Watcher later finds a transcript posted after `enriched_at` → `onTranscriptAvailable` → **Transcript Hunter** dispatches → transition to `transcript_available` → **Slack DM #3** → **Scribe** dispatches.
7. Scribe drafts subtask notes + Obsidian engagement note → creates approvals → transition to `drafted` → `drafts_ready` event.
8. User clicks **ΝΑΙ** on each draft in the Forge → `handleApproval` writes to Wrike subtasks and the Obsidian vault.
9. When the last approval is resolved → transition to `completed`. Watcher stops tracking it.

If anything throws along the way, the **Watchdog** opens an incident, attempts up to 3 retries for transient errors, and otherwise wakes **Kratos**.

---

## 11. Out of Scope (v1)

These are explicitly **not** governed here because the agents will not do them:

- Multi-user support.
- Auto-creating Obsidian folders.
- Writing back to Salesforce.
- Editing the parent Wrike task's description.
- Voice input.
- Any write to Scott's real Wrike account or Obsidian vault outside an explicit approval.
