import { Hono } from 'hono'
import { getRequestListener } from '@hono/node-server'
import { createD1Adapter, type D1Database, type D1PreparedStatement } from './db'

export type AppHttpStatus = 400 | 404 | 409 | 422 | 500

export class AppError extends Error {
  readonly status: AppHttpStatus
  readonly statusCode: AppHttpStatus

  constructor(message: string, status: AppHttpStatus = 500) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.statusCode = status
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400)
    this.name = 'BadRequestError'
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422)
    this.name = 'UnprocessableEntityError'
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export interface SplitShare {
  memberId: string
  amountCents: number
}

export function splitBill(totalCents: number, memberIds: readonly string[]): SplitShare[] {
  const n = memberIds.length
  if (n === 0) {
    throw new Error('Cannot split bill among 0 members')
  }

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error('totalCents must be a positive safe integer')
  }

  const base = Math.floor(totalCents / n)
  const remainder = totalCents % n

  return memberIds.map((memberId, index) => ({
    memberId,
    amountCents: index < remainder ? base + 1 : base,
  }))
}

const app = new Hono<{ Variables: { db: D1Database } }>()

// Middleware to inject D1 database adapter
app.use('*', async (c, next) => {
  c.set('db', createD1Adapter())
  await next()
})

// Health check endpoint
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// List all homes (UI helper)
app.get('/api/homes', async (c) => {
  const db = c.get('db')
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
  `).all<{
    id: string
    name: string
    createdAt: string
    memberCount: number
  }>()

  return c.json({ homes: results })
})

// Create a new home
app.post('/api/homes', async (c) => {
  const db = c.get('db')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('Malformed JSON body')
  }

  if (typeof body !== 'object' || body === null || !('name' in body)) {
    throw new BadRequestError('Name is required')
  }

  const nameVal = (body as { name: unknown }).name
  if (typeof nameVal !== 'string') {
    throw new BadRequestError('Name must be a string')
  }

  const trimmed = nameVal.trim()
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new BadRequestError('Name must be between 1 and 200 characters')
  }

  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, trimmed).run()

  return c.json({ id, name: trimmed }, 201)
})

// Get single home details (UI helper)
app.get('/api/homes/:homeId', async (c) => {
  const db = c.get('db')
  const homeId = c.req.param('homeId')
  const home = await db
    .prepare('SELECT id, name, created_at AS createdAt FROM homes WHERE id = ?')
    .bind(homeId)
    .first<{ id: string; name: string; createdAt: string }>()

  if (!home) {
    throw new NotFoundError('Home not found')
  }

  const { results: members } = await db
    .prepare(
      'SELECT id, home_id AS homeId, name, position FROM members WHERE home_id = ? ORDER BY position ASC',
    )
    .bind(homeId)
    .all<{ id: string; homeId: string; name: string; position: number }>()

  return c.json({ ...home, members })
})

// Add a member to a home
app.post('/api/homes/:homeId/members', async (c) => {
  const db = c.get('db')
  const homeId = c.req.param('homeId')
  const home = await db.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    throw new NotFoundError('Home not found')
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('Malformed JSON body')
  }

  if (typeof body !== 'object' || body === null || !('name' in body)) {
    throw new BadRequestError('Name is required')
  }

  const nameVal = (body as { name: unknown }).name
  if (typeof nameVal !== 'string') {
    throw new BadRequestError('Name must be a string')
  }

  const trimmed = nameVal.trim()
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new BadRequestError('Name must be between 1 and 200 characters')
  }

  const id = crypto.randomUUID()
  await db
    .prepare(`
      INSERT INTO members (id, home_id, name, position)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM members WHERE home_id = ?))
    `)
    .bind(id, homeId, trimmed, homeId)
    .run()

  return c.json({ id, homeId, name: trimmed }, 201)
})

// List members of a home (UI helper)
app.get('/api/homes/:homeId/members', async (c) => {
  const db = c.get('db')
  const homeId = c.req.param('homeId')
  const home = await db.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    throw new NotFoundError('Home not found')
  }

  const { results } = await db
    .prepare(
      'SELECT id, home_id AS homeId, name, position FROM members WHERE home_id = ? ORDER BY position ASC',
    )
    .bind(homeId)
    .all<{ id: string; homeId: string; name: string; position: number }>()

  return c.json({ members: results })
})

// Create and split a bill
app.post('/api/homes/:homeId/bills', async (c) => {
  const db = c.get('db')
  const homeId = c.req.param('homeId')

  const home = await db.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    throw new NotFoundError('Home not found')
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('Malformed JSON body')
  }

  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Invalid request body')
  }

  const record = body as Record<string, unknown>
  const title = record.title
  const totalCents = record.totalCents

  if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 200) {
    throw new BadRequestError('Title must be a non-empty string under 200 characters')
  }

  if (
    typeof totalCents !== 'number' ||
    !Number.isSafeInteger(totalCents) ||
    totalCents <= 0 ||
    totalCents > 1_000_000_000
  ) {
    throw new UnprocessableEntityError(
      'totalCents must be a positive safe integer under 1,000,000,000',
    )
  }

  const { results: members } = await db
    .prepare('SELECT id FROM members WHERE home_id = ? ORDER BY position ASC')
    .bind(homeId)
    .all<{ id: string }>()

  if (members.length === 0) {
    throw new UnprocessableEntityError('Home has no members')
  }

  const splitShares = splitBill(
    totalCents,
    members.map((m) => m.id),
  )

  const billId = crypto.randomUUID()
  const insertBillStmt = db
    .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
    .bind(billId, homeId, title.trim(), totalCents)

  const shareRows: Array<{
    id: string
    memberId: string
    amountCents: number
    paidAt: null
  }> = []
  const insertShareStmts: D1PreparedStatement[] = []

  for (const s of splitShares) {
    const shareId = crypto.randomUUID()
    shareRows.push({
      id: shareId,
      memberId: s.memberId,
      amountCents: s.amountCents,
      paidAt: null,
    })
    insertShareStmts.push(
      db
        .prepare(
          'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
        )
        .bind(shareId, billId, s.memberId, s.amountCents),
    )
  }

  await db.batch([insertBillStmt, ...insertShareStmts])

  return c.json(
    {
      id: billId,
      homeId,
      title: title.trim(),
      totalCents,
      shares: shareRows,
    },
    201,
  )
})

// Get bills of a home with nested shares (UI helper)
app.get('/api/homes/:homeId/bills', async (c) => {
  const db = c.get('db')
  const homeId = c.req.param('homeId')
  const home = await db.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    throw new NotFoundError('Home not found')
  }

  const { results: bills } = await db
    .prepare(`
      SELECT id, home_id AS homeId, title, total_cents AS totalCents, created_at AS createdAt
      FROM bills
      WHERE home_id = ?
      ORDER BY created_at DESC
    `)
    .bind(homeId)
    .all<{
      id: string
      homeId: string
      title: string
      totalCents: number
      createdAt: string
    }>()

  const { results: shares } = await db
    .prepare(`
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
    `)
    .bind(homeId)
    .all<{
      id: string
      billId: string
      memberId: string
      memberName: string
      amountCents: number
      paidAt: string | null
    }>()

  const sharesByBill = new Map<string, typeof shares>()
  for (const s of shares) {
    const list = sharesByBill.get(s.billId) ?? []
    list.push(s)
    sharesByBill.set(s.billId, list)
  }

  const billsWithShares = bills.map((b) => ({
    ...b,
    shares: sharesByBill.get(b.id) ?? [],
  }))

  return c.json({ bills: billsWithShares })
})

// Pay a share (idempotent + concurrency-guarded)
app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const db = c.get('db')
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')

  const idempotencyKey = c.req.header('Idempotency-Key')?.trim()
  if (!idempotencyKey) {
    throw new BadRequestError('Idempotency-Key header is required')
  }

  const now = new Date().toISOString()

  // Atomic conditional update: only marks paid if paid_at IS NULL
  const updateResult = await db
    .prepare(`
      UPDATE shares 
      SET paid_at = ?, idempotency_key = ? 
      WHERE id = ? AND bill_id = ? AND paid_at IS NULL
    `)
    .bind(now, idempotencyKey, shareId, billId)
    .run()

  if (updateResult.meta.changes === 1) {
    const row = await db
      .prepare(`
        SELECT id, member_id AS memberId, amount_cents AS amountCents, paid_at AS paidAt
        FROM shares
        WHERE id = ? AND bill_id = ?
      `)
      .bind(shareId, billId)
      .first<{
        id: string
        memberId: string
        amountCents: number
        paidAt: string
      }>()

    if (!row) {
      throw new NotFoundError('Share not found')
    }

    return c.json(row, 200)
  }

  // Row was not modified: investigate reason
  const bill = await db.prepare('SELECT id FROM bills WHERE id = ?').bind(billId).first()
  if (!bill) {
    throw new NotFoundError('Bill not found')
  }

  const share = await db
    .prepare(`
      SELECT id, bill_id AS billId, member_id AS memberId, amount_cents AS amountCents, paid_at AS paidAt, idempotency_key AS idempotencyKey
      FROM shares
      WHERE id = ?
    `)
    .bind(shareId)
    .first<{
      id: string
      billId: string
      memberId: string
      amountCents: number
      paidAt: string | null
      idempotencyKey: string | null
    }>()

  if (!share || share.billId !== billId) {
    throw new NotFoundError('Share not found')
  }

  if (share.paidAt !== null) {
    if (share.idempotencyKey === idempotencyKey) {
      return c.json(
        {
          id: share.id,
          memberId: share.memberId,
          amountCents: share.amountCents,
          paidAt: share.paidAt,
        },
        200,
      )
    }
    throw new ConflictError('Share already paid with a different idempotency key')
  }

  throw new ConflictError('Payment state conflict')
})

// Balances aggregation
app.get('/api/homes/:homeId/balances', async (c) => {
  const db = c.get('db')
  const homeId = c.req.param('homeId')
  const home = await db.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (!home) {
    throw new NotFoundError('Home not found')
  }

  const { results } = await db
    .prepare(`
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
    `)
    .bind(homeId, homeId)
    .all<{
      memberId: string
      name: string
      outstandingCents: number
    }>()

  return c.json({ balances: results }, 200)
})

// 404 Handler for unknown routes: strict JSON {"error": "message"}
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404)
})

// Central Error Handler: strict JSON {"error": "message"}
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status)
  }
  if (err instanceof SyntaxError) {
    return c.json({ error: 'Malformed JSON body' }, 400)
  }
  console.error('Unhandled server error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default getRequestListener(app.fetch)
