import { Database } from "bun:sqlite";
import type { Application, Params } from "@feathersjs/feathers";

export class LogService {
  db: Database;

  constructor(dbPath: string, app: Application) {
    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`
      CREATE TABLE IF NOT EXISTS event_log (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        phase     TEXT NOT NULL,
        service   TEXT NOT NULL,
        method    TEXT NOT NULL,
        data      TEXT,
        error     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_event_service ON event_log(service);
      CREATE INDEX IF NOT EXISTS idx_event_phase   ON event_log(phase);
      CREATE INDEX IF NOT EXISTS idx_event_ts      ON event_log(timestamp);
    `);
  }

  async find(params: Params) {
    const limit = params?.query?.limit ?? 20;
    const rows = this.db.prepare(
      `SELECT timestamp, phase, service, method, data, error
       FROM event_log ORDER BY id DESC LIMIT ?`
    ).all(limit) as any[];
    return rows.reverse();
  }

  async create(entry: {
    phase: string;
    service: string;
    method: string;
    data?: Record<string, any>;
    error?: string;
  }) {
    this.db.prepare(
      `INSERT INTO event_log (phase, service, method, data, error)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      entry.phase,
      entry.service,
      entry.method,
      entry.data ? JSON.stringify(entry.data) : null,
      entry.error ?? null,
    );

    const parts = [entry.phase, entry.service, entry.method];
    if (entry.data) {
      for (const [k, v] of Object.entries(entry.data)) {
        if (v != null && v !== "") parts.push(`${k}:${v}`);
      }
    }
    if (entry.error) parts.push(`ERR: ${entry.error}`);
    console.debug(`[log] ${parts.join("  ")}`);

    return entry;
  }

  close() {
    this.db.close();
  }
}
