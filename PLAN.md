# Implementation Plan: Shared Bill Splitter

This phased plan outlines the end-to-end delivery of the Shared Bill Splitter system for Cloudflare Workers (Hono + D1) and web client (React + Vite + TanStack Router + TanStack Query + Tailwind CSS).

---

## Phase 1: Planning, Schema & Architecture Specification
- **Requirements Matrix**: Map all 7 core edge cases and API specifications to strict invariants.
- **Database Schema**: Design `api/migrations/0001_init.sql` with SQLite D1 tables: `homes`, `members`, `bills`, `shares`.
- **Named Constraints**:
  1. `chk_bills_total_cents`: `CHECK (total_cents > 0)` prevents zero and negative bill amounts at the database engine level.
  2. `chk_shares_amount_cents`: `CHECK (amount_cents > 0)` prevents invalid share allocations.
  3. `chk_shares_payment_state`: `CHECK ((paid_at IS NULL AND idempotency_key IS NULL) OR (paid_at IS NOT NULL AND idempotency_key IS NOT NULL))` enforces strict atomic transition between unpaid and paid states.
  4. `uq_members_home_position`: `UNIQUE (home_id, position)` guarantees deterministic join order per home.
  5. Foreign keys:
     - `fk_members_home`: `FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE`
     - `fk_bills_home`: `FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE`
     - `fk_shares_bill`: `FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE`
     - `fk_shares_member`: `FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT`
- **Definition of Done**: `PLAN.md` committed; `0001_init.sql` created; migrations apply cleanly in local test runner.

---

## Phase 2: Core Domain Logic & Pure Functions
- **Split Algorithm (`api/src/domain/splitter.ts`)**:
  - Pure function `splitBill(totalCents: number, memberIds: string[]): Array<{ memberId: string, amountCents: number }>`
  - Computes `base = Math.floor(totalCents / n)` and `remainder = totalCents % n`.
  - Assigns `base + 1` to the first `remainder` members according to their monotonic sequence, and `base` to the rest.
  - Verifies invariant: `sum(shares) === totalCents`.
- **Validation & Errors (`api/src/lib/errors.ts`, `api/src/lib/validator.ts`)**:
  - Custom typed error classes: `NotFoundError`, `ValidationError` (400 or 422), `ConflictError` (409), `UnauthorizedError`.
  - Centralized Hono error handler formatting all errors as `{ "error": message }`.
  - Global `app.notFound()` handler returning 404 JSON.
- **Definition of Done**: Unit tests for `splitBill` pass with 100% branch coverage; validation helpers reject bad input cleanly.

---

## Phase 3: Backend API Vertical Slices
- **Slice 3.1: Homes & Members**:
  - `POST /api/homes`: Validates name, generates ID (UUID), stores in DB.
  - `POST /api/homes/:homeId/members`: Validates home existence (404), calculates next monotonic sequence position, inserts member.
  - `GET /api/homes`: List homes (convenience for UI).
  - `GET /api/homes/:homeId`: Fetch home details.
- **Slice 3.2: Bills & Shares Creation**:
  - `POST /api/homes/:homeId/bills`:
    - Validates home exists (404).
    - Validates `totalCents` is a positive safe integer (`Number.isSafeInteger(n) && n > 0`); rejects 0, negatives, decimals, strings, nulls with 422.
    - Validates members count > 0; if 0 members, returns 422.
    - Executes pure split.
    - Persists bill and all shares in a single atomic `db.batch([insertBillStmt, ...insertShareStmts])`.
  - `GET /api/homes/:homeId/bills`: Lists all bills and nested shares for a home.
- **Slice 3.3: Idempotent Payment & Concurrency**:
  - `POST /api/bills/:billId/shares/:shareId/pay`:
    - Checks `Idempotency-Key` header (400 if missing or whitespace).
    - Executes single atomic conditional update:
      `UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL`
    - Evaluates `meta.changes`:
      - If 1: Payment succeeded; return 200 with updated share.
      - If 0: Row was already paid, does not exist, or does not belong to bill.
        - Query share by `id` and `bill_id`.
        - If not found: return 404.
        - If `idempotency_key === headerKey`: Replay match; return 200 with existing share data.
        - If `idempotency_key !== headerKey`: Conflict; return 409.
- **Slice 3.4: Balances Aggregation**:
  - `GET /api/homes/:homeId/balances`:
    - Checks home exists (404).
    - Executes single aggregated query joining members with unpaid shares for that home, ordered by member `position ASC`.
    - Returns `{ balances: [{ memberId, name, outstandingCents }] }`.
- **Definition of Done**: All visible tests (`homes.test.ts`, `bills.test.ts`, `payments.test.ts`) pass.

---

## Phase 4: UI Design with Stitch MCP
- **Stitch MCP Design Generation**:
  - Generate 2 distinct screen design variants in Stitch:
    - Variant A: High-density fintech dashboard inspired by Linear & Stripe Dashboard.
    - Variant B: Modern card-based dashboard with micro-interactions and prominent balance display inspired by Mercury / Splitwise.
  - Evaluate variants against user requirements and select the superior design.
  - Document evaluation and justification in `DESIGN.md`.
- **Definition of Done**: 2 Stitch variants generated, design system extracted, `DESIGN.md` committed.

---

## Phase 5: Frontend Implementation (React + Vite + TanStack Router)
- **Design System & Tailwind**:
  - Set up CSS variables for dark/light themes, sleek typography (tabular numbers for money), 4/8px spacing system, responsive layout (360px to 4K).
- **State Management & Data Layer**:
  - TanStack Query client with configured retry, cache, and timeout settings.
  - Fully typed API client (`web/src/lib/api.ts`) using native `fetch` + `AbortController` (10s timeout) and strict error handling.
  - Format money using `Intl.NumberFormat` from integer cents.
- **UI Components & Features**:
  - Home selector & creator modal/bar.
  - Member management and quick-add form.
  - Member balance overview with deterministic avatar initials and clean status badges.
  - Bill creation dialog with real-time validation and split preview.
  - Bill list with progress bar (paid vs total amount) and collapsible share items.
  - Pay action with:
    - Per-attempt idempotency key generation & preservation across retries.
    - Loading skeletons for fetching and disabled states during mutation.
    - Inline error alerts with retry button on payment failure.
    - Immediate UI update only upon 200 confirmation (no optimistic desync).
  - Robust Error Boundary at root and route levels to prevent white-screens.
  - Theme toggle (light/dark mode) with persistence.
- **Definition of Done**: Web app builds with zero errors; full browser verification passes (happy path, error states, slow network, races).

---

## Phase 6: Hardening & Comprehensive Testing
- **New Test Suites**:
  - `api/test/edge-cases.test.ts`: Test Case 1 (0 members), Case 2 (bad amounts: 0, negative, float, string, NaN, MAX_SAFE_INTEGER+1), Case 3 (uneven splits with diverse member counts), Case 4 (idempotent replay), Case 5 (concurrent racing payments using `Promise.all`), Case 6 (404s for mismatched bill/share IDs, nonexistent entities), Case 7 (error format compliance).
  - `api/test/security-input.test.ts`: Malformed JSON bodies, missing content-type, unicode names (emojis, RTL, accents), SQL injection strings, duplicate member names.
- **Definition of Done**: All original visible tests and new hardening tests pass; 100% green.

---

## Phase 7: Code Review & Quality Gates
- **CodeRabbit Review**:
  - Audit every file against strict guidelines: no `any`, no `@ts-ignore`, correct error codes, atomic D1 batching, Biome cleanliness.
  - Record audit results and rationale in `REVIEW_NOTES.md`.
- **Biome & Typecheck Verification**:
  - `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` must pass cleanly.
- **Definition of Done**: Zero lint/type errors, all checks passing.

---

## Phase 8: Handoff Documentation
- Update `README.md` with Decisions section (3 architectural decisions).
- Write `ARCHITECTURE.md` with Mermaid diagram, database constraint analysis, and payment lifecycle/race sequence diagram.
- Write `VIDEO_SCRIPT.md` (3-minute walk-through script with exact file/line references).
- Write `WALKTHROUGH.md` (code tour and 15 live-call questions & answers).
- Write `AI_USAGE.md` detailing all AI tools and workflows used.
- **Definition of Done**: All documentation committed and verified.
