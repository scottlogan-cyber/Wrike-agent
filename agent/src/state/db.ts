import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(join(DATA_DIR, "agent.db"));
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      title TEXT,
      state TEXT NOT NULL DEFAULT 'discovered',
      assigner TEXT,
      sf_opp_id TEXT,
      client_name TEXT,
      topic_guess TEXT,
      urgency TEXT,
      summary TEXT,
      payload_json TEXT,
      slack_dm_count INTEGER NOT NULL DEFAULT 0,
      call_datetime TEXT,
      enriched_at TEXT,
      last_progress_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      subagent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      payload_json TEXT,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      task_id TEXT,
      subagent TEXT,
      tool TEXT,
      input_json TEXT,
      output_preview TEXT,
      payload_json TEXT,
      fingerprint TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      target TEXT,
      current_json TEXT,
      proposed_json TEXT,
      decision TEXT,
      edited_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      task_id TEXT,
      trigger TEXT NOT NULL,
      classification TEXT,
      hypothesis TEXT,
      resolution TEXT,
      pr_url TEXT,
      slack_ts TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS improvements (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      evidence_json TEXT,
      hypothesis TEXT,
      proposed_change TEXT,
      risk TEXT,
      estimated_effort TEXT,
      pr_url TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      dismissed_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watcher_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
