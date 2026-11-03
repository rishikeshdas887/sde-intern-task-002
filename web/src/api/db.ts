import { DatabaseSync } from 'node:sqlite'
import os from 'node:os'
import path from 'node:path'

let dbInstance: DatabaseSync | null = null

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT ck_homes_name_non_empty CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  CONSTRAINT uq_members_home_position UNIQUE (home_id, position),
  CONSTRAINT ck_members_name_non_empty CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  CONSTRAINT ck_bills_total_cents_positive CHECK (total_cents > 0),
  CONSTRAINT ck_bills_title_non_empty CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT DEFAULT NULL,
  idempotency_key TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT fk_shares_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_shares_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT ck_shares_amount_cents_non_negative CHECK (amount_cents >= 0),
  CONSTRAINT ck_shares_paid_idempotency CHECK ((paid_at IS NULL AND idempotency_key IS NULL) OR (paid_at IS NOT NULL AND idempotency_key IS NOT NULL)),
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_members_home_id ON members(home_id);
CREATE INDEX IF NOT EXISTS idx_bills_home_id ON bills(home_id);
CREATE INDEX IF NOT EXISTS idx_shares_bill_id ON shares(bill_id);
CREATE INDEX IF NOT EXISTS idx_shares_member_id ON shares(member_id);
CREATE INDEX IF NOT EXISTS idx_shares_paid_at ON shares(paid_at);
`

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = path.join(os.tmpdir(), 'split_zero_ledger.db')
    dbInstance = new DatabaseSync(dbPath)
    dbInstance.exec(SCHEMA)
  }
  return dbInstance
}

export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
  _execInTx(): { changes: number }
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

export function createD1Adapter(): D1Database {
  const db = getDatabase()

  return {
    prepare(sql: string): D1PreparedStatement {
      let boundParams: unknown[] = []

      const stmt: D1PreparedStatement = {
        bind(...params: unknown[]) {
          boundParams = params
          return stmt
        },
        async first<T = Record<string, unknown>>(): Promise<T | null> {
          const s = db.prepare(sql)
          const row = s.get(...(boundParams as any[]))
          return (row as T) ?? null
        },
        async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
          const s = db.prepare(sql)
          const results = s.all(...(boundParams as any[])) as T[]
          return { results }
        },
        async run(): Promise<{ meta: { changes: number } }> {
          const s = db.prepare(sql)
          const res = s.run(...(boundParams as any[]))
          return { meta: { changes: Number(res.changes) } }
        },
        _execInTx() {
          const s = db.prepare(sql)
          const res = s.run(...(boundParams as any[]))
          return { changes: Number(res.changes) }
        },
      }

      return stmt
    },

    async batch(statements: D1PreparedStatement[]): Promise<unknown[]> {
      db.exec('BEGIN')
      try {
        const results = []
        for (const s of statements) {
          results.push(s._execInTx())
        }
        db.exec('COMMIT')
        return results
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
  }
}
