# Phased Execution Plan: Shared Bill Splitter

This plan establishes the end-to-end development phases for the "Shared Bill Splitter" assignment, meeting every requirement and hard constraint.

---

## Phase 1: Requirements & System Architecture

- **Objective**: Formalize functional requirements, data models, invariant boundaries, and system architecture.
- **Deliverables**:
  - `PLAN.md` (this file).
  - Architecture breakdown including concurrency model, idempotency guarantees, and Remainder Distribution Algorithm.
- **Definition of Done**:
  - Full specifications mapped to test vectors; edge cases defined; error handling strategy locked down.

---

## Phase 2: Database Schema & Migrations

- **Objective**: Design SQLite D1 schema with strict referential integrity, indexes, and at least 3 named constraints.
- **Deliverables**:
  - `api/migrations/0001_init.sql`
  - Named constraints:
    1. `CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE`
    2. `CONSTRAINT ck_bills_total_cents_positive CHECK (total_cents > 0)`
    3. `CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id)`
    4. `CONSTRAINT uq_members_home_position UNIQUE (home_id, position)`
    5. `CONSTRAINT ck_homes_name_non_empty CHECK (length(trim(name)) > 0)`
    6. `CONSTRAINT ck_shares_amount_cents_positive CHECK (amount_cents > 0)`
  - Indexes on `members(home_id)`, `bills(home_id)`, `shares(bill_id)`, `shares(member_id)`.
- **Definition of Done**:
  - Migrations apply cleanly via `applyD1Migrations` and `wrangler d1 migrations apply`.

---

## Phase 3: Core Domain Services & Split Logic

- **Objective**: Implement pure domain functions and data access layers.
- **Deliverables**:
  - Pure split algorithm: `splitBill(totalCents: number, memberCount: number): number[]`
    - Base = `Math.floor(totalCents / n)`
    - Remainder = `totalCents % n`
    - First `remainder` members get `base + 1`. Total shares sum exactly to `totalCents`.
  - Comprehensive unit tests for `splitBill`.
- **Definition of Done**:
  - 100% test coverage for split mathematics (positive, zero remainder, large numbers, 1 member, etc.).

---

## Phase 4: API Implementation (Hono on Cloudflare Workers)

- **Objective**: Build robust, typed Hono API with central error handling and atomic transactions.
- **Deliverables**:
  - Central error handling middleware (`app.onError`, `app.notFound`, malformed JSON parser). Every error is `{ "error": "message" }`.
  - Input validation using Zod.
  - Endpoints:
    - `POST /api/homes`: Create home with validated name.
    - `POST /api/homes/:homeId/members`: Add member with monotonic position sequence.
    - `POST /api/homes/:homeId/bills`: Create bill + shares atomically via `db.batch()`.
    - `POST /api/bills/:billId/shares/:shareId/pay`: Single atomic conditional UPDATE with `Idempotency-Key` header; replay vs conflict detection.
    - `GET /api/homes/:homeId/balances`: Single SQL aggregate query with no N+1, ordered by member position.
    - `GET /api/homes/:homeId`: Fetch home details and members for UI.
    - `GET /api/homes/:homeId/bills`: Fetch bills with shares for UI.
    - `GET /api/homes`: List homes for UI switcher.
- **Definition of Done**:
  - All visible tests in `api/test/` (`homes.test.ts`, `bills.test.ts`, `payments.test.ts`) pass 100% green.

---

## Phase 5: UI Design & Prototyping with Stitch MCP

- **Objective**: Create a high-fidelity, fintech-grade design via Stitch MCP.
- **Deliverables**:
  - Generate 2 Stitch design variants with modern fintech aesthetics (Splitwise clarity + Stripe precision + Mercury/Cash App numerics).
  - Document comparison and select the winning variant in `DESIGN.md`.
  - Establish design tokens (colors, typography, spacing, elevations) in CSS variables.
- **Definition of Done**:
  - Stitch generation complete; screenshots and tokens exported; `DESIGN.md` finalized.

---

## Phase 6: Frontend Implementation (React + TanStack Router & Query)

- **Objective**: Build responsive, accessible web application matching the Stitch design.
- **Deliverables**:
  - TanStack Router configuration with route parameters (`/:homeId`).
  - TanStack Query integration with query caching, refetching, and mutations.
  - Skeletons for loading states; rich empty states; retryable error states.
  - Pay button state machine: disabled during mutation, one idempotency key per attempt reused on retry.
  - Request timeout and `AbortController`.
  - Responsive design (360px up), dark & light mode, WCAG AA contrast, reduced motion support.
- **Definition of Done**:
  - `pnpm dev` runs seamlessly; UI renders bills, shares, balances; payments trigger updates; keyboard and screen-reader accessible.

---

## Phase 7: Hardening & Edge-Case Testing

- **Objective**: Write comprehensive, independent tests verifying all 7 mandatory test cases and adversarial inputs.
- **Deliverables**:
  - `api/test/hardening.test.ts`:
    1. Home with no members.
    2. Zero, negative, decimal, string, NaN, safe-integer overflow amounts.
    3. Uneven split exactness.
    4. Idempotency replay with same key.
    5. Concurrent race condition on share payment (simulated parallel requests).
    6. Non-existent bill/share/home, malformed IDs, cross-home/cross-bill share mismatches.
    7. Slow/500 API responses and web error resilience.
    8. Boundary names: Unicode, empty/whitespace, long strings, duplicate member names.
- **Definition of Done**:
  - All hardening tests pass; zero regressions; no `any`; zero linter warnings.

---

## Phase 8: Quality Gate & Code Review

- **Objective**: Verify strict compliance across the entire monorepo.
- **Deliverables**:
  - `REVIEW_NOTES.md` capturing automated and principal architectural reviews.
  - `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
- **Definition of Done**:
  - 100% clean check from root.

---

## Phase 9: Handoff Documentation

- **Objective**: Provide comprehensive, crystal-clear documentation for review and presentation.
- **Deliverables**:
  - Updated `README.md` with Decisions section (3 key decisions + rationale).
  - `ARCHITECTURE.md` (Mermaid diagrams, constraint breakdown, payment lifecycle).
  - `VIDEO_SCRIPT.md` (3-minute script covering architecture, data flow, trade-off, 7 cases).
  - `WALKTHROUGH.md` (plain-English file tour, function explanations, 15 live-call Q&As).
  - `AI_USAGE.md` (tools used and exact workflows).
- **Definition of Done**:
  - All documentation files present and formatted cleanly.
