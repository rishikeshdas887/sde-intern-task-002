import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { waitUntil } from '@vercel/functions'

type SupportedValueType = null | number | bigint | string | Uint8Array

const BLOB_PUBLIC_URL =
  'https://pmyhjwq2tlkcwmum.public.blob.vercel-storage.com/split_zero_ledger.db'

const dbPath = path.join(os.tmpdir(), 'split_zero_ledger.db')
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

let isSyncing = false
let syncPending = false

async function syncFromBlobIfAvailable(): Promise<boolean> {
  if (fs.existsSync(dbPath)) {
    return true
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${BLOB_PUBLIC_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    const SQLITE_HEADER = 'SQLite format 3'
    if (buf.length >= 16 && buf.subarray(0, 15).toString() === SQLITE_HEADER) {
      fs.writeFileSync(dbPath, buf)
      return true
    }
  } catch {
    // Timeout or network error; gracefully proceed with fresh schema
  }
  return false
}

async function uploadToBlob(data: Buffer): Promise<boolean> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const url = 'https://vercel.com/api/blob/?pathname=split_zero_ledger.db'
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-version': '13',
        'x-vercel-blob-access': 'public',
        'x-add-random-suffix': '0',
        'x-allow-overwrite': '1',
        'content-type': 'application/octet-stream',
      },
      body: new Uint8Array(data),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

async function syncToBlob(): Promise<void> {
  if (isSyncing) {
    syncPending = true
    return
  }
  isSyncing = true
  try {
    do {
      syncPending = false
      if (!dbInstance) break
      dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE);')
      if (fs.existsSync(dbPath) && process.env.BLOB_READ_WRITE_TOKEN) {
        const data = fs.readFileSync(dbPath)
        await uploadToBlob(data)
      }
    } while (syncPending)
  } catch {
    // Ignore background sync errors
  } finally {
    isSyncing = false
  }
}

function triggerBackgroundSync(): void {
  try {
    waitUntil(syncToBlob())
  } catch {
    void syncToBlob()
  }
}

async function getDatabase(): Promise<DatabaseSync> {
  if (!dbInstance) {
    if (!fs.existsSync(dbPath)) {
      await syncFromBlobIfAvailable()
    }
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
  _execInTx(db: DatabaseSync): { changes: number }
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

export function createD1Adapter(): D1Database {
  return {
    prepare(sql: string): D1PreparedStatement {
      let boundParams: SupportedValueType[] = []

      const stmt: D1PreparedStatement = {
        bind(...params: unknown[]) {
          boundParams = params as SupportedValueType[]
          return stmt
        },

        async first<T = Record<string, unknown>>(): Promise<T | null> {
          const db = await getDatabase()
          const s = db.prepare(sql)
          const row = s.get(...boundParams)
          return (row as T) ?? null
        },

        async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
          const db = await getDatabase()
          const s = db.prepare(sql)
          const results = s.all(...boundParams) as T[]
          return { results }
        },

        async run(): Promise<{ meta: { changes: number } }> {
          const db = await getDatabase()
          const s = db.prepare(sql)
          const res = s.run(...boundParams)
          // Background sync to Blob using Vercel waitUntil
          triggerBackgroundSync()
          return { meta: { changes: Number(res.changes) } }
        },

        _execInTx(db: DatabaseSync) {
          const s = db.prepare(sql)
          const res = s.run(...boundParams)
          return { changes: Number(res.changes) }
        },
      }

      return stmt
    },

    async batch(statements: D1PreparedStatement[]): Promise<unknown[]> {
      const db = await getDatabase()
      db.exec('BEGIN')
      try {
        const results = []
        for (const s of statements) {
          results.push(s._execInTx(db))
        }
        db.exec('COMMIT')
        // Background sync to Blob using Vercel waitUntil
        triggerBackgroundSync()
        return results
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
  }
}
