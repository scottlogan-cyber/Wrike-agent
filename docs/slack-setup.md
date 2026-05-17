# Slack setup for Leonidas (Wrike workspace)

Your email: **scott.logan@team.wrike.com**

**Leonidas app (created):** [A0B4AL450AE](https://api.slack.com/apps/A0B4AL450AE) in workspace **Wrike** (`T0259C89T`)

Quick links:
- [OAuth & Permissions](https://api.slack.com/apps/A0B4AL450AE/oauth)
- [Install App](https://api.slack.com/apps/A0B4AL450AE/install-on-team)
- [App Manifest](https://api.slack.com/apps/A0B4AL450AE/app-manifest) — paste [`config/slack-manifest.yaml`](../config/slack-manifest.yaml)

## 1. Apply manifest (recommended)

1. Open [App Manifest](https://api.slack.com/apps/A0B4AL450AE/app-manifest).
2. Switch to **YAML**, paste contents of `config/slack-manifest.yaml`, **Save Changes**.
3. Go to [Install App](https://api.slack.com/apps/A0B4AL450AE/install-on-team) → **Install to Workspace** → Allow.

## 1b. Or configure manually

Skip if you used the manifest.

## 2. Bot scopes (OAuth & Permissions → Bot Token Scopes)

- `chat:write`
- `chat:write.public`
- `users:read`
- `users:read.email`
- `im:write` (optional, for DMs)

## 3. Install & copy tokens

1. **Install App** → **Install to Workspace** → Allow.
2. Copy **Bot User OAuth Token** (`xoxb-...`) → `SLACK_BOT_TOKEN`
3. **Basic Information** → **App Credentials** → **Signing Secret** → `SLACK_SIGNING_SECRET`

## 4. Interactive components (for Kratos buttons)

1. **Interactivity & Shortcuts** → On
2. Request URL: `https://<your-tunnel-host>/webhook/slack` (after Cloudflare Tunnel / ngrok on port 8000)

## 5. Auto-fill `.env`

```bash
cd ~/wrike-agent
SLACK_BOT_TOKEN=xoxb-your-token npx tsx agent/src/scripts/slack-setup.ts
```

Then add `SLACK_SIGNING_SECRET=...` manually to `.env`.

## 6. Test DM

```bash
npm run dev -w agent
# Trigger a test task or:
curl -X POST http://localhost:8000/webhook/wrike \
  -H 'Content-Type: application/json' \
  -d '{"taskId":"SLACK-TEST","title":"Slack ping test"}'
```

You should receive a DM from Leonidas within ~60s (or immediately on webhook).
