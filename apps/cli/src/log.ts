import { Database } from "bun:sqlite";
import type { Application, Params } from "@feathersjs/feathers";

export class LogService {
  private db: Database;
  private env: string;

  constructor(dbPath: string, app: Application) {
    this.db = new Database(dbPath);
    this.env = process.env.NODE_ENV || "development";
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        env       TEXT NOT NULL,
        phase     TEXT NOT NULL,
        service   TEXT NOT NULL,
        method    TEXT NOT NULL,
        keyboard  TEXT,
        side      TEXT,
        run_id    TEXT,
        workflow  TEXT,
        detail    TEXT,
        error     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_event_service ON event_log(service);
      CREATE INDEX IF NOT EXISTS idx_event_phase   ON event_log(phase);
      CREATE INDEX IF NOT EXISTS idx_event_env     ON event_log(env);
      CREATE INDEX IF NOT EXISTS idx_event_ts      ON event_log(timestamp);
    `);
  }

  async find(params: Params) {
    const limit = params?.query?.limit ?? 20;
    const rows = this.db.prepare(
      `SELECT timestamp, env, phase, service, method, keyboard, side, run_id, workflow, detail, error
       FROM event_log ORDER BY id DESC LIMIT ?`
    ).all(limit) as any[];
    return rows.reverse();
  }

  async create(data: {
    phase: string;
    service: string;
    method: string;
    keyboard?: string;
    side?: string;
    runId?: string;
    workflow?: string;
    detail?: string;
    error?: string;
  }) {
    this.db.prepare(
      `INSERT INTO event_log (env, phase, service, method, keyboard, side, run_id, workflow, detail, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      this.env,
      data.phase,
      data.service,
      data.method,
      data.keyboard ?? null,
      data.side ?? null,
      data.runId ?? null,
      data.workflow ?? null,
      data.detail ?? null,
      data.error ?? null,
    );

    const parts = [this.env, data.phase, data.service, data.method];
    if (data.keyboard) parts.push(data.keyboard);
    if (data.side) parts.push(data.side);
    if (data.runId) parts.push(`run:${data.runId}`);
    if (data.workflow) parts.push(data.workflow);
    if (data.detail) parts.push(data.detail);
    if (data.error) parts.push(`ERR: ${data.error}`);
    console.debug(`[log] ${parts.join("  ")}`);

    return data;
  }

  close() {
    this.db.close();
  }
}
