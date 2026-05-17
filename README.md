# Wrike Solution Consultant Agent (Leonidas)

Local event-driven agent that watches your Wrike queue, researches topics, hunts Salesloft transcripts, drafts subtasks and Obsidian notes for approval, and surfaces everything in a Spartan Tamagotchi UI.

**Repository:** [github.com/scottlogan-cyber/Wrike-agent](https://github.com/scottlogan-cyber/Wrike-agent)

## Quick start

```bash
cp .env.example .env
# Fill in tokens (see .env.example)

npm install
npm run dev
```

- Agent API: http://localhost:8000/health
- UI: http://localhost:3000
- WebSocket: `ws://localhost:8000/ws?token=leonidas-dev-token`

## Smoke tests

```bash
npm run hello-cursor -- "what's 2+2"
make eval
curl http://localhost:8000/health
```

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

A browser sign-in for `scott.logan@team.wrike.com` was started in Cursor’s browser panel; finish login there, then create the app.

## Tunnel (Slack interactive)

Expose port 8000 with Cloudflare Tunnel or ngrok and set Slack Interactive URL to `https://<tunnel>/webhook/slack`.

## Publish to GitHub

Local `main` is ahead of the remote (remote is only an initial README). After reviewing changes:

```bash
cd ~/wrike-agent
git add -A
git commit -m "Implement Leonidas Wrike agent (phases 0–7)"
git pull origin main --allow-unrelated-histories
git push -u origin main
```

Set `GITHUB_REPO=scottlogan-cyber/Wrike-agent` in `.env` so Kratos cloud runs target this repo.
