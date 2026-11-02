-- 0001_init.sql: Initial schema for Shared Bill Splitter
PRAGMA foreign_keys = ON;

-- Homes table
CREATE TABLE IF NOT EXISTS homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Members table with explicit monotonic position sequence
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  CONSTRAINT uq_members_home_position UNIQUE (home_id, position)
);

-- Bills table with positive total amount check
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
  CONSTRAINT chk_bills_total_cents CHECK (total_cents > 0)
);

-- Shares table with positive amount and payment state check
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT fk_shares_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_shares_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
  CONSTRAINT chk_shares_amount_cents CHECK (amount_cents > 0),
  CONSTRAINT chk_shares_payment_state CHECK (
    (paid_at IS NULL AND idempotency_key IS NULL) OR
    (paid_at IS NOT NULL AND idempotency_key IS NOT NULL)
  )
);

-- Indexes on foreign keys and frequently queried access paths
CREATE INDEX IF NOT EXISTS idx_members_home_id ON members(home_id);
CREATE INDEX IF NOT EXISTS idx_bills_home_id ON bills(home_id);
CREATE INDEX IF NOT EXISTS idx_shares_bill_id ON shares(bill_id);
CREATE INDEX IF NOT EXISTS idx_shares_member_id ON shares(member_id);
CREATE INDEX IF NOT EXISTS idx_shares_member_paid ON shares(member_id, paid_at);
