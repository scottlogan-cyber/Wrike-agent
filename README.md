# Wrike Solution Consultant Agent (Leonidas)

Leonidas and his watchdog Kratos — local agents for Wrike solution consulting.

Local event-driven agent that watches your Wrike queue, researches topics, hunts Salesloft transcripts, drafts subtasks and Obsidian notes for approval, and surfaces everything in the **Village UI** (WoW-style HUD: command bar, client huts, interior + scroll from Obsidian). See [docs/VILLAGE_UI_PIVOT.md](docs/VILLAGE_UI_PIVOT.md). For **Vercel + agent hosting and every integration**, see [docs/HOSTING_INTEGRATION_CHECKLIST.md](docs/HOSTING_INTEGRATION_CHECKLIST.md).

**Repository:** [github.com/scottlogan-cyber/Wrike-agent](https://github.com/scottlogan-cyber/Wrike-agent)

## Quick start

```bash
cp .env.example .env
# Set CURSOR_API_KEY for real subagents; WRIKE_ACCESS_TOKEN for live Wrike reads

npm install
npm run dev
```

- Agent API: http://localhost:8000/health
- UI: http://localhost:3000
- WebSocket: `ws://localhost:8000/ws?token=leonidas-dev-token`

**Deploy the Village UI to Vercel:** [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)

## Smoke tests

```bash
npm run hello-cursor -- "what's 2+2"
make eval
curl http://localhost:8000/health
```

## Test agents (no Slack)

Slack DMs are skipped when `SLACK_BOT_TOKEN` is unset. The pipeline still runs and events appear in the UI.

1. Set `CURSOR_API_KEY` in `.env` for real subagents (otherwise deterministic heuristics run).
2. `npm run dev` — open http://localhost:3000
3. Trigger a fake task:

```bash
curl -X POST http://localhost:8000/webhook/wrike \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"DEMO-001","title":"Integration scoping for Acme Corp"}'
```

Watch **Roster**, **Battle Log**, the **Village** (client huts), and approval cards over WebSocket.

### Village HUD

- Each **hut** groups tasks by `client_name` (after intake) or `task-*` before a name exists.
- **Command bar** (fixed bottom): chat to Leonidas over the socket, plus local commands `enter <name>`, `leave`, `/hut <name>`, `/leave`.
- **Scroll:** Obsidian-aligned markdown at `ui/public/clients/<hut-id>.md` (sample: `acme-corp.md`). The id is shown on each hut card.

Run **`npm test`** for hut / command-bar unit tests.

## Architecture

- **Watcher** — deterministic 60s poller (no LLM)
- **Sub-agents** — Intake, Researcher, Transcript Hunter, Scribe, Architect, Kratos via `@cursor/sdk`
- **SQLite** — `data/agent.db` for tasks, events, approvals, incidents
- **Human-in-the-loop** — all Wrike/Obsidian writes require UI approval

## Phases

Implemented end-to-end: Watcher → Intake → Research → Call detection → Transcript → Scribe drafts → Approval → Kratos watchdog → Architect demos.

## Slack (scott.logan@team.wrike.com)

Leonidas cannot read tokens from the **desktop Slack app** — you need a [Slack API app](https://api.slack.com/apps) in the Wrike workspace.

1. Follow [docs/slack-setup.md](docs/slack-setup.md) to create **Leonidas** and copy `xoxb-...` + signing secret.
2. Run: `SLACK_BOT_TOKEN=xoxb-... npm run slack-setup` — writes your user ID to `.env`.

## Tunnel (Slack interactive)

Expose port 8000 with Cloudflare Tunnel or ngrok and set Slack Interactive URL to `https://<tunnel>/webhook/slack`.

Set `GITHUB_REPO=scottlogan-cyber/Wrike-agent` in `.env` so Kratos cloud runs target this repo.
