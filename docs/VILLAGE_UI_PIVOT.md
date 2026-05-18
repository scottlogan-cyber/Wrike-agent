# Village UI pivot — WoW-style HUD + client huts

## Why we’re pivoting

The original brief used **Tamagotchi as inspiration** (compact stage, companion energy, clear state). The implementation drifted toward **imitating a Tamagotchi shell** (device frame, pet-forward layout). That’s the wrong abstraction for your workflow.

This doc reframes the UI as a **fantasy village command surface** inspired by **World of Warcraft-style MMO HUDs**: framed panels, readable chrome, minimap-style orientation, quest-log metaphors — not a virtual pet toy.

## Metaphor

| Concept | Meaning |
|--------|---------|
| **Village** | Your practice: all active clients / contexts Leonidas serves. |
| **Hut** | One client (or one bounded engagement). New client → **new hut** appears in the village. |
| **Leonidas** | The commander you talk to; he moves through the village on your orders. |
| **Entering a hut** | Focused session: agent scope narrows to that client’s tasks, tokens, vault paths, and MCP context. |
| **The scroll / paper** | The **Obsidian markdown** note(s) that hold curated client intel you’ve approved or stored. |

## Core user flow

1. **Command bar (primary)** — Single text field: questions and orders to Leonidas. This is the main affordance (WoW chat / quest-style input, not a pet clicker).
2. **Village view** — Overhead or isometric-style **map panel**: icons for huts (clients). Optional: “pin” or quest-tracker strip for active clients.
3. **“Walk in” transition** — When you ask for info from a specific hut (or pick one), Leonidas **paths to that hut** (light animation or state change — keep it cheap until polished).
4. **Interior cut** — Scene swaps to **inside the hut** (simple 2D/illustrated panel is enough). Scope = this client only.
5. **Scroll reveal** — Leonidas **holds up** the canonical MD (rendered from vault content): your Obsidian-sourced client brief.

Backend/agent behavior stays the same in spirit: **MCPs + stored tokens** resolve tasks and tools **scoped to the active hut (client id)**.

## Data model (keep it boring)

- **`client_id`** (or `hut_id`) — stable key for routing.
- **`obsidian_path` or vault-relative URI** — where the “scroll” MD lives (your Obsidian vault; the app reads via allowed paths or a sync’d copy on Vercel — see below).
- **`task_ids` / Wrike folder** — association table in SQLite you already have; hut selection filters these.

Speed as data grows: **index by `client_id`**, lazy-load MD when entering a hut, don’t render the whole village list if you add pagination later.

## Obsidian

- **Source of truth:** Obsidian on disk (your vault).
- **App reads:** Either (a) build step / CI that copies approved notes into `public/clients/<id>.md`, (b) server route that reads from a mounted path in dev and from committed or synced content in prod, or (c) future: Obsidian Sync / Git-based vault submodule. Start with **one MD path per hut** in config (e.g. `config/huts.json` mapping `client_id` → relative vault path).

Leonidas’s “paper” is always **rendered MD**, not freeform LLM invention, unless you explicitly ask for synthesis on top of it.

## Hosting (GitHub + Vercel)

- **Static / edge UI** on Vercel; **API routes** or **existing Fastify agent** behind env-based URL (CORS + auth).
- **Secrets:** Vercel env for `CURSOR_API_KEY`, client PATs, MCP proxy tokens — **never** in the repo. Per-hut secrets can stay namespaced env vars or encrypted blobs later; start with **global + client_id filter** in agent logic.

## TDD / red–green / refactor (discipline)

Keep velocity as the village grows:

1. **Red:** Characterization test for “given client X, resolving hut + MD path returns Y.”
2. **Green:** Minimal mapping + one API/WS message.
3. **Refactor:** Extract `resolveHut`, `loadScrollMarkdown`, `setActiveHut` without changing tests.

Suggested first slices (order matters):

- `resolveHut(clientId)` from SQLite + config (unit).
- WS event `hut:focus` / `scene:interior` (contract test or integration).
- UI state machine: `village` | `interior` + `activeHutId` (React test or Playwright smoke later).

Avoid building **full animation** before **focus + MD render** works.

## What to retire from “Tamagotchi” language

- Replace **device bezel / pet stage** as the primary metaphor with **village map + command bar + interior panel**.
- Keep what still fits: **Spartan voice**, **Battle Log**, **Forge** can become **Blacksmith / War Table** naming if you want consistency with the new theme — optional cosmetic rename later.

## Relationship to existing components

Current `Stage` / `Leonidas` sprite can evolve into:

- **VillageMap** (replaces or wraps `Stage` for the default view).
- **HutInterior** (conditional full-width panel when `scene === "interior"`).
- **ScrollPanel** (MD renderer + frontmatter strip if needed).

`ChatPanel` becomes the **command bar** (possibly docked bottom like MMO chat).

---

*Next step in repo: implement `scene` + `activeHutId` in the UI store and a stub `VillageMap` with one hut per distinct `client_id` from tasks — tests first.*
