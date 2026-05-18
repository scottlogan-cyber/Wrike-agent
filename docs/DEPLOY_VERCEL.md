# Deploy the Village UI to Vercel

The Next.js app lives in **`ui/`** inside an npm workspace. Vercel must install from the **repo root** so the lockfile resolves, then build inside **`ui/`**.

## 1. Push this repo to GitHub

Remote is already set (see `git remote -v`). After you commit, push:

```bash
git push origin main
```

## 2. Create the Vercel project

1. Open [vercel.com/new](https://vercel.com/new) and **Import** `scottlogan-cyber/Wrike-agent` (or your fork).
2. Under **Configure Project**:
   - **Root Directory** → **Edit** → set to **`ui`** (critical).
   - **Framework Preset**: Next.js (auto-detected from `ui/`).
   - **Build Command**: leave default **`npm run build`** (or explicitly `npm run build`; `ui/vercel.json` already sets install).
   - **Install Command** — if the dashboard shows a field, set to: **`cd .. && npm ci`**  
     If you omit it, `ui/vercel.json` still applies **`cd .. && npm ci`** when the project uses that config.

3. **Environment variables** (add before first deploy or in Settings → Env):

   | Name | Value | When |
   |------|--------|------|
   | `NEXT_PUBLIC_WS_URL` | `wss://your-agent-host/ws` | When your agent is reachable on the public internet |
   | `NEXT_PUBLIC_WS_TOKEN` | Same as server `WS_AUTH_TOKEN` | Optional until agent is wired up |

   Until the agent is hosted, you can leave these unset: the UI falls back to `ws://localhost:8000/ws` (only works on your machine, not from the public site).

4. **Deploy**.

## 3. Git integration

Every push to `main` can auto-deploy **Production**; other branches get **Preview** URLs (per your Vercel Git settings).

## 4. Sanity check

Open the production URL: you should see the Village HUD. The bottom status may show **Reconnecting…** until `NEXT_PUBLIC_WS_URL` points at a live WebSocket — that is expected for this step.
