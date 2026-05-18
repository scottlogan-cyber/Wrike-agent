# Hosting & integration checklist

Use this as the single place to track **what** you’re connecting, **where** secrets live, and **why** it exists. Check items off as you go (`[ ]` → `[x]`).

---

## 1. Simple picture — who talks to whom

```mermaid
flowchart TB
  subgraph you [You]
    Obsidian[Obsidian vault]
    Browser[Browser]
    Cursor[Cursor IDE]
  end

  subgraph hosted [Hosted — typical setup]
    GH[GitHub repo]
    Vercel[Vercel — Next.js Village UI]
    AgentHost[Agent host — Fastify :8000]
  end

  subgraph cursor_cloud [Cursor platform]
    CursorAPI[Cursor API / agents]
  end

  subgraph vendors [Third parties]
    Wrike[Wrike API + optional MCP]
    Slack[Slack API]
    GHApi[GitHub API]
    Salesloft[Salesloft API]
  end

  Obsidian -->|export or CI copy| GH
  Browser --> Vercel
  Vercel -->|"WebSocket wss://…"` AgentHost
  AgentHost --> CursorAPI
  AgentHost --> Wrike
  AgentHost --> Slack
  AgentHost --> GHApi
  AgentHost --> Salesloft
  Cursor --> CursorAPI
  Cursor -->|"MCP: Wrike / Slack / GitHub"| vendors
```

**How to read it**

| Layer | What you’re doing |
|--------|-------------------|
| **GitHub** | Source of truth for the app; hut scrolls can live under `ui/public/clients/` (or CI copies them in). |
| **Vercel** | Serves the **Village UI** (static/edge). It does **not** run the long-lived agent or SQLite by default. |
| **Agent host** | Runs **Fastify** (watcher, WebSocket, webhooks, `@cursor/sdk` subagent calls). Needs a **public URL** if Slack/Wrike webhooks call in. |
| **Cursor API** | `CURSOR_API_KEY` lets the **agent server** run cloud subagents (Intake, Scribe, Kratos, etc.). |
| **Cursor MCP** | Separate: tools available **inside Cursor** while you work (Wrike MCP URL, Slack/GitHub MCP servers). Same *accounts*, different *wiring* than production agent env vars. |

---

## 2. Master checklist (work down in order)

Suggested order: **GitHub → Vercel UI → Agent URL → Cursor → Wrike → Slack → GitHub token → Salesloft → Obsidian sync → Hardening**.

### A. Repository & deploy (UI)

- [ ] **GitHub** — Repo created; you push `wrike-agent` (or your fork).
- [ ] **Vercel project** — Step-by-step: [docs/DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) (root directory **`ui`**, install from repo root).
- [ ] **Vercel env — `NEXT_PUBLIC_WS_URL`** — WebSocket base your browser will use, e.g. `wss://agent.yourdomain.com/ws` (must match real agent host).
- [ ] **Vercel env — `NEXT_PUBLIC_WS_TOKEN`** — Same value as server `WS_AUTH_TOKEN` (treat as a shared secret between browser and agent; not a replacement for full auth hardening).
- [ ] **Production build** — Confirm `npm run build -w ui` in CI or Vercel; Village loads and connects (even if agent is still local behind tunnel for testing).

### B. Agent runtime (backend)

Pick **one** pattern:

- [ ] **Option 1 — Tunnel** (fastest): Cloudflare Tunnel / ngrok → `localhost:8000` for webhooks + `wss`. Good for personal use; your laptop must be up for production.
- [ ] **Option 2 — Always-on host** (real “hosted”): Fly.io / Railway / Render / small VPS running `agent` (`npm run start -w agent` or Docker). Persist `./data/agent.db` on a volume.

Then:

- [ ] **`AGENT_PORT`** — Default `8000`; match reverse proxy.
- [ ] **`WS_AUTH_TOKEN`** — Strong random; copy to Vercel `NEXT_PUBLIC_WS_TOKEN`.
- [ ] **Health check** — `GET /health` exposed for monitoring.
- [ ] **CORS** — If you add HTTP APIs from the browser later, lock origins to your Vercel domain.

### C. Cursor (LLM / subagents)

- [ ] **`CURSOR_API_KEY`** — On the **agent host** env (and local `.env`). Without it, heuristics run only.
- [ ] **Budget caps** — `MAX_TURNS`, `MAX_RUN_COST_USD`, `MAX_ARCHITECT_COST_USD` in `.env` on agent host.

### D. Wrike

- [ ] **`WRIKE_ACCESS_TOKEN`** — REST token for **watcher**, **wrike-client** tools, webhooks validation as implemented.
- [ ] **`WRIKE_API_BASE`** — Usually `https://www.wrike.com/api/v4`.
- [ ] **`MY_QUEUE_FOLDER_ID`** — Folder the watcher treats as your queue.
- [ ] **`MY_WRIKE_USER_ID`** (+ teammates if used) — For routing / mentions as in your config.
- [ ] **`WRIKE_DEMO_PAT`** + **`WRIKE_DEMO_ROOT_FOLDER_ID`** — If you use Architect demo flows.
- [ ] **Wrike webhooks** (optional) — Point to `https://<agent-host>/webhook/wrike` if you use incoming Wrike events (see `registerWrikeWebhooks`).
- [ ] **Wrike MCP (Cursor only)** — OAuth MCP at `https://mcp.wrike.com/mcp` in `.cursor/mcp.json` — for **IDE** sessions, not automatically for Vercel.

### E. Slack

- [ ] **Slack app** — Bot token `xoxb-...` → **`SLACK_BOT_TOKEN`** on agent host.
- [ ] **Signing secret** — **`SLACK_SIGNING_SECRET`** for interactive webhooks.
- [ ] **`SLACK_APP_ID`** — Documented in `.env.example` for your workspace app.
- [ ] **Public URL** — `https://<agent-host>/webhook/slack` for Slack interactivity (requires tunnel or hosted agent).
- [ ] **`MY_SLACK_USER_ID`** — Run `npm run slack-setup` once with token to fill.
- [ ] **Slack MCP (Cursor only)** — `@modelcontextprotocol/server-slack` with `SLACK_BOT_TOKEN` in MCP env — IDE tooling parallel to the bot.

### F. GitHub

- [ ] **`GITHUB_TOKEN`** — PAT with scopes your automations need (PRs, repo read, etc.).
- [ ] **`GITHUB_REPO`** — e.g. `org/Wrike-agent` for Kratos / cloud run targeting.
- [ ] **GitHub MCP (Cursor only)** — `GITHUB_PERSONAL_ACCESS_TOKEN` mapped in `.cursor/mcp.json`.

### G. Salesloft (call + transcript path)

- [ ] **`SALESLOFT_TOKEN`** — Without it, transcript tooling uses placeholders (see `salesloft.ts`).
- [ ] Confirm **account / conversation IDs** match how `watcher` correlates calls to tasks.

### H. Obsidian & hut scrolls (Village UI)

- [ ] **Local dev** — `OBSIDIAN_VAULT_PATH` + `OBSIDIAN_ROUTING_RULES_PATH` on agent for **approval writes**.
- [ ] **Hosted Village scrolls** — Each hut reads **`/clients/<hut-id>.md`** from the **Next.js `public/`** tree. Choose one:
  - [ ] Commit markdown under `ui/public/clients/`, or
  - [ ] CI step copies from vault or another repo into `ui/public/clients/` before `next build`.

### I. SQLite & state

- [ ] **Persistent `data/`** — On the agent host, ensure `data/agent.db` survives restarts (volume mount).
- [ ] **Backup** — Optional: periodic copy of `agent.db` if this becomes critical.

### J. Security & hygiene (before “real” production)

- [ ] **Secrets only in env** — Never commit `.env`; Vercel + agent host dashboards only.
- [ ] **Rotate** — Wrike PAT, Slack bot token, GitHub PAT, `WS_AUTH_TOKEN` on a schedule or after leaks.
- [ ] **WebSocket auth** — `WS_AUTH_TOKEN` is basic shared-secret; for stricter needs, add TLS client certs or session tokens later.

---

## 3. One-page “am I integrated?” map

```text
                    ┌─────────────────────────────────────────┐
                    │            YOUR LAPTOP / IDE             │
                    │  Obsidian ──► notes   Cursor ──► MCPs   │
                    └─────────────────────────────────────────┘
                                        │
                    ┌───────────────────▼────────────────────┐
                    │              GITHUB / VERCEL              │
                    │  Repo ◄── push    Vercel ◄── Village UI   │
                    └───────────────────┬────────────────────┘
                                        │ wss + HTTPS webhooks
                    ┌───────────────────▼────────────────────┐
                    │           AGENT HOST (Fastify)          │
                    │  SQLite · Watcher · Cursor SDK · WS     │
                    └──────┬─────────┬─────────┬────────────┘
                           │         │         │
                      Wrike API   Slack API   GitHub API
                           │         │         └── optional: Salesloft
                           └─────────┘
```

---

## 4. Env quick reference

| Variable (agent) | Role |
|------------------|------|
| `CURSOR_API_KEY` | Subagents via Cursor |
| `WRIKE_ACCESS_TOKEN` | Wrike REST |
| `WRIKE_DEMO_PAT` / `WRIKE_DEMO_ROOT_FOLDER_ID` | Demo / Architect |
| `MY_QUEUE_FOLDER_ID`, `MY_WRIKE_USER_ID`, … | Routing |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | Slack bot + webhooks |
| `GITHUB_TOKEN`, `GITHUB_REPO` | GitHub automation |
| `SALESLOFT_TOKEN` | Transcripts |
| `OBSIDIAN_VAULT_PATH`, `OBSIDIAN_ROUTING_RULES_PATH` | Local writes |
| `WS_AUTH_TOKEN`, `AGENT_PORT` | Socket + port |
| `WATCH_INTERVAL_SECONDS`, `STALE_THRESHOLD_DAYS` | Watcher |

| Variable (Vercel / UI) | Role |
|------------------------|------|
| `NEXT_PUBLIC_WS_URL` | `wss://…/ws` agent WebSocket |
| `NEXT_PUBLIC_WS_TOKEN` | Must match `WS_AUTH_TOKEN` |

---

When every box in **section 2** is checked for your chosen hosting mode (tunnel vs always-on agent), you’re **integrated end-to-end**: Village on Vercel, Leonidas routed to your queue and vendors, scrolls served for each hut.
