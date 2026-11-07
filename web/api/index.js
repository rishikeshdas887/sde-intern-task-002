// src/api/index.ts
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";

// src/api/db.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
var BLOB_PUBLIC_URL = "https://pmyhjwq2tlkcwmum.public.blob.vercel-storage.com/split_zero_ledger.db";
var dbPath = path.join(os.tmpdir(), "split_zero_ledger.db");
var dbInstance = null;
var SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

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
`;
var isSyncing = false;
var syncPending = false;
async function syncFromBlobIfAvailable() {
  if (fs.existsSync(dbPath)) {
    return true;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e3);
    const res = await fetch(`${BLOB_PUBLIC_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    const SQLITE_HEADER = "SQLite format 3";
    if (buf.length >= 16 && buf.subarray(0, 15).toString() === SQLITE_HEADER) {
      fs.writeFileSync(dbPath, buf);
      return true;
    }
  } catch {
  }
  return false;
}
async function uploadToBlob(data) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4e3);
    await put("split_zero_ledger.db", data, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
      abortSignal: controller.signal
    });
    clearTimeout(timer);
    return true;
  } catch (err) {
    console.warn("Failed to upload to blob storage:", err);
    return false;
  }
}
async function syncToBlob() {
  if (isSyncing) {
    syncPending = true;
    return;
  }
  isSyncing = true;
  try {
    do {
      syncPending = false;
      if (!dbInstance) break;
      try {
        dbInstance.exec("PRAGMA wal_checkpoint(PASSIVE);");
      } catch {
      }
      if (fs.existsSync(dbPath) && process.env.BLOB_READ_WRITE_TOKEN) {
        const data = fs.readFileSync(dbPath);
        await uploadToBlob(data);
      }
    } while (syncPending);
  } catch {
  } finally {
    isSyncing = false;
  }
}
function triggerBackgroundSync() {
  try {
    waitUntil(syncToBlob());
  } catch {
    void syncToBlob();
  }
}
async function getDatabase() {
  if (!dbInstance) {
    if (!fs.existsSync(dbPath)) {
      await syncFromBlobIfAvailable();
    }
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec(SCHEMA);
  }
  return dbInstance;
}
function createD1Adapter() {
  return {
    prepare(sql) {
      let boundParams = [];
      const stmt = {
        bind(...params) {
          boundParams = params;
          return stmt;
        },
        async first() {
          const db = await getDatabase();
          const s = db.prepare(sql);
          const row = s.get(...boundParams);
          return row ?? null;
        },
        async all() {
          const db = await getDatabase();
          const s = db.prepare(sql);
          const results = s.all(...boundParams);
          return { results };
        },
        async run() {
          const db = await getDatabase();
          const s = db.prepare(sql);
          const res = s.run(...boundParams);
          triggerBackgroundSync();
          return { meta: { changes: Number(res.changes) } };
        },
        _execInTx(db) {
          const s = db.prepare(sql);
          const res = s.run(...boundParams);
          return { changes: Number(res.changes) };
        }
      };
      return stmt;
    },
    async batch(statements) {
      const db = await getDatabase();
      db.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) {
          results.push(s._execInTx(db));
        }
        db.exec("COMMIT");
        triggerBackgroundSync();
        return results;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    }
  };
}

// src/api/index.ts
var AppError = class extends Error {
  status;
  statusCode;
  constructor(message, status = 500) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.statusCode = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
};
var BadRequestError = class extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
    this.name = "BadRequestError";
  }
};
var UnprocessableEntityError = class extends AppError {
  constructor(message = "Unprocessable entity") {
    super(message, 422);
    this.name = "UnprocessableEntityError";
  }
};
var ConflictError = class extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
};
function splitBill(totalCents, memberIds) {
  const n = memberIds.length;
  if (n === 0) {
    throw new Error("Cannot split bill among 0 members");
  }
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error("totalCents must be a positive safe integer");
  }
  const base = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return memberIds.map((memberId, index) => ({
    memberId,
    amountCents: index < remainder ? base + 1 : base
  }));
}
var app = new Hono();
app.use("*", async (c, next) => {
  c.set("db", createD1Adapter());
  await next();
});
app.get("/api/health", (c) => c.json({ status: "ok" }));
app.get("/api/homes", async (c) => {
  const db = c.get("db");
  const { results } = await db.prepare(`
    SELECT 
      h.id, 
      h.name, 
      h.created_at AS createdAt,
      COUNT(m.id) AS memberCount
    FROM homes h
    LEFT JOIN members m ON m.home_id = h.id
    GROUP BY h.id, h.name, h.created_at
    ORDER BY h.created_at DESC
  `).all();
  return c.json({ homes: results });
});
app.post("/api/homes", async (c) => {
  const db = c.get("db");
  let body;
  try {
    body = await c.req.json();
  } catch {
    throw new BadRequestError("Malformed JSON body");
  }
  if (typeof body !== "object" || body === null || !("name" in body)) {
    throw new BadRequestError("Name is required");
  }
  const nameVal = body.name;
  if (typeof nameVal !== "string") {
    throw new BadRequestError("Name must be a string");
  }
  const trimmed = nameVal.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new BadRequestError("Name must be between 1 and 200 characters");
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO homes (id, name) VALUES (?, ?)").bind(id, trimmed).run();
  return c.json({ id, name: trimmed }, 201);
});
app.get("/api/homes/:homeId", async (c) => {
  const db = c.get("db");
  const homeId = c.req.param("homeId");
  const home = await db.prepare("SELECT id, name, created_at AS createdAt FROM homes WHERE id = ?").bind(homeId).first();
  if (!home) {
    throw new NotFoundError("Home not found");
  }
  const { results: members } = await db.prepare(
    "SELECT id, home_id AS homeId, name, position FROM members WHERE home_id = ? ORDER BY position ASC"
  ).bind(homeId).all();
  return c.json({ ...home, members });
});
app.post("/api/homes/:homeId/members", async (c) => {
  const db = c.get("db");
  const homeId = c.req.param("homeId");
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first();
  if (!home) {
    throw new NotFoundError("Home not found");
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    throw new BadRequestError("Malformed JSON body");
  }
  if (typeof body !== "object" || body === null || !("name" in body)) {
    throw new BadRequestError("Name is required");
  }
  const nameVal = body.name;
  if (typeof nameVal !== "string") {
    throw new BadRequestError("Name must be a string");
  }
  const trimmed = nameVal.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new BadRequestError("Name must be between 1 and 200 characters");
  }
  const id = crypto.randomUUID();
  await db.prepare(`
      INSERT INTO members (id, home_id, name, position)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM members WHERE home_id = ?))
    `).bind(id, homeId, trimmed, homeId).run();
  return c.json({ id, homeId, name: trimmed }, 201);
});
app.get("/api/homes/:homeId/members", async (c) => {
  const db = c.get("db");
  const homeId = c.req.param("homeId");
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first();
  if (!home) {
    throw new NotFoundError("Home not found");
  }
  const { results } = await db.prepare(
    "SELECT id, home_id AS homeId, name, position FROM members WHERE home_id = ? ORDER BY position ASC"
  ).bind(homeId).all();
  return c.json({ members: results });
});
app.post("/api/homes/:homeId/bills", async (c) => {
  const db = c.get("db");
  const homeId = c.req.param("homeId");
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first();
  if (!home) {
    throw new NotFoundError("Home not found");
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    throw new BadRequestError("Malformed JSON body");
  }
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Invalid request body");
  }
  const record = body;
  const title = record.title;
  const totalCents = record.totalCents;
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 200) {
    throw new BadRequestError("Title must be a non-empty string under 200 characters");
  }
  if (typeof totalCents !== "number" || !Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 1e9) {
    throw new UnprocessableEntityError(
      "totalCents must be a positive safe integer under 1,000,000,000"
    );
  }
  const { results: members } = await db.prepare("SELECT id FROM members WHERE home_id = ? ORDER BY position ASC").bind(homeId).all();
  if (members.length === 0) {
    throw new UnprocessableEntityError("Home has no members");
  }
  const splitShares = splitBill(
    totalCents,
    members.map((m) => m.id)
  );
  const billId = crypto.randomUUID();
  const insertBillStmt = db.prepare("INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)").bind(billId, homeId, title.trim(), totalCents);
  const shareRows = [];
  const insertShareStmts = [];
  for (const s of splitShares) {
    const shareId = crypto.randomUUID();
    shareRows.push({
      id: shareId,
      memberId: s.memberId,
      amountCents: s.amountCents,
      paidAt: null
    });
    insertShareStmts.push(
      db.prepare("INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)").bind(shareId, billId, s.memberId, s.amountCents)
    );
  }
  await db.batch([insertBillStmt, ...insertShareStmts]);
  return c.json(
    {
      id: billId,
      homeId,
      title: title.trim(),
      totalCents,
      shares: shareRows
    },
    201
  );
});
app.get("/api/homes/:homeId/bills", async (c) => {
  const db = c.get("db");
  const homeId = c.req.param("homeId");
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first();
  if (!home) {
    throw new NotFoundError("Home not found");
  }
  const { results: bills } = await db.prepare(`
      SELECT id, home_id AS homeId, title, total_cents AS totalCents, created_at AS createdAt
      FROM bills
      WHERE home_id = ?
      ORDER BY created_at DESC
    `).bind(homeId).all();
  const { results: shares } = await db.prepare(`
      SELECT 
        s.id,
        s.bill_id AS billId,
        s.member_id AS memberId,
        m.name AS memberName,
        s.amount_cents AS amountCents,
        s.paid_at AS paidAt
      FROM shares s
      JOIN bills b ON s.bill_id = b.id
      JOIN members m ON s.member_id = m.id
      WHERE b.home_id = ?
      ORDER BY m.position ASC
    `).bind(homeId).all();
  const sharesByBill = /* @__PURE__ */ new Map();
  for (const s of shares) {
    const list = sharesByBill.get(s.billId) ?? [];
    list.push(s);
    sharesByBill.set(s.billId, list);
  }
  const billsWithShares = bills.map((b) => ({
    ...b,
    shares: sharesByBill.get(b.id) ?? []
  }));
  return c.json({ bills: billsWithShares });
});
app.post("/api/bills/:billId/shares/:shareId/pay", async (c) => {
  const db = c.get("db");
  const billId = c.req.param("billId");
  const shareId = c.req.param("shareId");
  const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
  if (!idempotencyKey) {
    throw new BadRequestError("Idempotency-Key header is required");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updateResult = await db.prepare(`
      UPDATE shares 
      SET paid_at = ?, idempotency_key = ? 
      WHERE id = ? AND bill_id = ? AND paid_at IS NULL
    `).bind(now, idempotencyKey, shareId, billId).run();
  if (updateResult.meta.changes === 1) {
    const row = await db.prepare(`
        SELECT id, member_id AS memberId, amount_cents AS amountCents, paid_at AS paidAt
        FROM shares
        WHERE id = ? AND bill_id = ?
      `).bind(shareId, billId).first();
    if (!row) {
      throw new NotFoundError("Share not found");
    }
    return c.json(row, 200);
  }
  const bill = await db.prepare("SELECT id FROM bills WHERE id = ?").bind(billId).first();
  if (!bill) {
    throw new NotFoundError("Bill not found");
  }
  const share = await db.prepare(`
      SELECT id, bill_id AS billId, member_id AS memberId, amount_cents AS amountCents, paid_at AS paidAt, idempotency_key AS idempotencyKey
      FROM shares
      WHERE id = ?
    `).bind(shareId).first();
  if (!share || share.billId !== billId) {
    throw new NotFoundError("Share not found");
  }
  if (share.paidAt !== null) {
    if (share.idempotencyKey === idempotencyKey) {
      return c.json(
        {
          id: share.id,
          memberId: share.memberId,
          amountCents: share.amountCents,
          paidAt: share.paidAt
        },
        200
      );
    }
    throw new ConflictError("Share already paid with a different idempotency key");
  }
  throw new ConflictError("Payment state conflict");
});
app.get("/api/homes/:homeId/balances", async (c) => {
  const db = c.get("db");
  const homeId = c.req.param("homeId");
  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first();
  if (!home) {
    throw new NotFoundError("Home not found");
  }
  const { results } = await db.prepare(`
      SELECT 
        m.id AS memberId,
        m.name AS name,
        COALESCE(sub.unpaid, 0) AS outstandingCents
      FROM members m
      LEFT JOIN (
        SELECT s.member_id, SUM(s.amount_cents) AS unpaid
        FROM shares s
        JOIN bills b ON s.bill_id = b.id
        WHERE b.home_id = ? AND s.paid_at IS NULL
        GROUP BY s.member_id
      ) sub ON sub.member_id = m.id
      WHERE m.home_id = ?
      ORDER BY m.position ASC
    `).bind(homeId, homeId).all();
  return c.json({ balances: results }, 200);
});
app.notFound((c) => {
  return c.json({ error: "Route not found" }, 404);
});
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof SyntaxError) {
    return c.json({ error: "Malformed JSON body" }, 400);
  }
  console.error("Unhandled server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});
var index_default = getRequestListener(app.fetch);
export {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
  index_default as default,
  splitBill
};
