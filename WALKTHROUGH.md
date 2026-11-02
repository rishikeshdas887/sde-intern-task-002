# Shared Bill Splitter: Comprehensive Code Walkthrough & Interview Q&A

This document serves as an exhaustive reference guide to the entire codebase. It contains:
1. **Plain-English Code Tour**: A file-by-file breakdown explaining what each file does, why it exists, and how it integrates into the architecture.
2. **15 Technical Live-Call Questions & Answers**: Thorough, production-grade answers to deep-dive questions an interviewer might ask during code review.

---

## Part 1: Plain-English Code Tour

### Database & Backend Domain

#### 1. `api/migrations/0001_init.sql`

- **What it does**: Declares the relational schema for Cloudflare D1 (SQLite), creating four core tables: `homes`, `members`, `bills`, and `shares`.
- **Why it exists**: Provides an immutable, version-controlled foundation for data persistence. It specifies 10 named constraints (foreign keys with cascade deletion, unique constraints, and check constraints) that prevent corrupted financial or relational state at the storage layer.
- **How it fits**: Automatically applied by Wrangler during local development (`pnpm dev`) and before test suite execution in Vitest.

#### 2. `api/src/domain/splitter.ts`

- **What it does**: Contains the pure function `splitBill(totalCents: number, memberIds: string[])`.
- **Why it exists**: Encapsulates the core business requirement: dividing a monetary amount into integer cents and distributing any remainder sequentially to members in join order.
- **How it fits**: Keeps calculation logic 100% decoupled from HTTP request handling, D1 database drivers, and side effects, enabling rapid unit testing with 0 mocks.

#### 3. `api/src/lib/errors.ts`

- **What it does**: Defines a strongly typed error hierarchy inheriting from `AppError`: `BadRequestError` (400), `NotFoundError` (404), `ConflictError` (409), and `UnprocessableEntityError` (422).
- **Why it exists**: Eliminates ad-hoc error response handling. Guarantees that any thrown application error is translated into a uniform `{ "error": "message" }` JSON contract with the appropriate HTTP status code.
- **How it fits**: Caught by Hono's `app.onError` middleware in `api/src/index.ts`.

#### 4. `api/src/index.ts`

- **What it does**: The central Cloudflare Worker API router built with Hono. Implements all REST endpoints:
  - `POST /api/homes`: Creates a home.
  - `GET /api/homes`: Lists all homes (supporting the UI workspace switcher).
  - `POST /api/homes/:homeId/members`: Adds a member with monotonic join position.
  - `GET /api/homes/:homeId/members`: Lists members ordered by position.
  - `POST /api/homes/:homeId/bills`: Creates a bill and generates shares atomically using `c.env.DB.batch()`.
  - `GET /api/homes/:homeId/bills`: Fetches all bills and shares in a single aggregated batch.
  - `POST /api/bills/:billId/shares/:shareId/pay`: Atomic, concurrency-safe, idempotent payment processor.
  - `GET /api/homes/:homeId/balances`: Calculates outstanding debt per member in a single SQL query.
- **Why it exists**: Serves as the API edge boundary, handling input validation, routing, database interactions, and error mapping.
- **How it fits**: Exports the default Cloudflare Workers fetch handler.

---

### Backend Test Suite

#### 5. `api/test/helpers.ts` (Unmodified)

- **What it does**: Provides helper utilities (`call`, `createHome`, `createBill`) for issuing in-memory requests against the Cloudflare Workers runtime.
- **Why it exists**: Standard test infrastructure provided by the upstream template.

#### 6. `api/test/homes.test.ts` & `api/test/bills.test.ts` & `api/test/payments.test.ts` (Unmodified)

- **What it does**: The 24 official visible evaluation tests validating home creation, bill distribution, payment idempotency, and balance calculations.
- **Why it exists**: Mandated assignment tests that cannot be modified or weakened.

#### 7. `api/test/splitter.unit.test.ts`

- **What it does**: 11 unit tests evaluating `splitBill` directly across boundary conditions (single member, uneven division, total cents less than member count, large totals).
- **Why it exists**: Fast, deterministic unit verification of the core arithmetic domain logic.

#### 8. `api/test/hardening.test.ts`

- **What it does**: 17 edge-case and concurrency hardening tests covering:
  - Bill creation in homes with zero members (422).
  - Validation of zero, negative, float, string, and extreme integer amounts (422).
  - Uneven split exact sum invariant verification.
  - Idempotency replays with matching timestamp assertions.
  - Simultaneous race conditions using `Promise.all` with conflicting idempotency keys (one 200, one 409).
  - Cross-resource mismatched share IDs (404).
  - Malformed JSON payloads and whitespace-only strings (400).
- **Why it exists**: Guarantees production-grade resilience against real-world failure modes.

---

### Frontend Web Application

#### 9. `web/src/api.ts`

- **What it does**: Strongly typed HTTP API client interacting with the Cloudflare Worker.
- **Why it exists**: Centralizes network calls, attaches a 10-second `AbortController` timeout to prevent hanging connections, extracts error messages into typed `Error` objects, and guarantees strict TypeScript interfaces for all responses.

#### 10. `web/src/index.css`

- **What it does**: Design tokens, custom utility classes, CSS custom variables, and accessibility configurations (such as `@media (prefers-reduced-motion)` and tabular numbers).
- **Why it exists**: Implements the "Obsidian Ledger" fintech design system detailed in `DESIGN.md`.

#### 11. `web/src/lib/format.ts`

- **What it does**: Formatting utilities including `formatCents(cents: number)` (e.g. 1000 -> "$10.00") and deterministic initials and color avatar generation (`getAvatarInfo`).
- **Why it exists**: Centralizes currency formatting and user visual identification across components.

#### 12. `web/src/components/ErrorBoundary.tsx`

- **What it does**: React class component error boundary capturing rendering errors.
- **Why it exists**: Prevents full-page white screens if unexpected runtime errors occur, providing a clean alert and a recovery button.

#### 13. `web/src/components/Skeletons.tsx`

- **What it does**: Animated placeholder loading components (`DashboardSkeleton`).
- **Why it exists**: Prevents layout shifts and provides immediate visual feedback while queries fetch data.

#### 14. `web/src/components/Navbar.tsx`

- **What it does**: Top navigation header featuring home switcher dropdown, "New Home" trigger, active home status indicator, and repository links.
- **Why it exists**: Allows seamless switching between different households.

#### 15. `web/src/components/HomeMetrics.tsx`

- **What it does**: Metric summary cards showing total bills amount, total outstanding balance, and member-by-member breakdown table.
- **Why it exists**: Gives immediate financial clarity on who owes what in the household.

#### 16. `web/src/components/CreateHomeModal.tsx` & `AddMemberModal.tsx`

- **What it does**: Modal dialogs for creating households and registering new members.
- **Why it exists**: Provides intuitive forms with error handling and automatic query invalidation upon success.

#### 17. `web/src/components/CreateBillModal.tsx`

- **What it does**: Modal dialog for splitting a new bill. Features a real-time live preview calculating each member's exact cent share as the user types the dollar amount.
- **Why it exists**: Gives immediate feedback on how remainder cents will be distributed before submitting the bill to the server.

#### 18. `web/src/components/ShareRow.tsx`

- **What it does**: Individual share row displaying member avatar, share amount, payment badge (`PAID` with timestamp or `UNPAID`), inline error message banner, and "Pay Share" action button.
- **Why it exists**: Isolates the payment mutation lifecycle. Generates and persists a stable idempotency key across retries until payment succeeds.

#### 19. `web/src/components/BillCard.tsx`

- **What it does**: Renders a bill container with progress bar (percentage paid), title, total amount, formatted date, and a list of member shares.
- **Why it exists**: Organizes bills into scannable, interactive cards.

#### 20. `web/src/routes/$homeId.tsx`

- **What it does**: Main dashboard route fetching and displaying the active household's members, bills, and balances using TanStack Query.
- **Why it exists**: Houses the core user experience, coordinating modal states, skeleton loading, empty states, and automatic background refresh.

#### 21. `web/src/routes/index.tsx` & `web/src/routes/__root.tsx` & `web/src/main.tsx`

- **What it does**: Root application entry points setting up TanStack Router, TanStack QueryClientProvider, and automated redirection to the first available home or home creation prompt.

---

## Part 2: 15 Live-Call Interview Questions & Answers

### 1. Why did you use an atomic conditional UPDATE instead of an explicit database transaction (`BEGIN...COMMIT`) for payment processing?

**Answer:**
"Cloudflare D1 is built on SQLite, running over an edge replication layer. While SQLite supports transactions, multi-statement interactive transactions in distributed environments introduce latency overhead and connection lock contention. More importantly, an interactive transaction with a separate `SELECT` followed by an `UPDATE` still requires strict isolation levels (`EXCLUSIVE`) to prevent check-then-act races.
By consolidating both the verification (`WHERE paid_at IS NULL`) and state mutation (`SET paid_at = ?, idempotency_key = ?`) into a single atomic SQL statement:
```sql
UPDATE shares SET paid_at = ?, idempotency_key = ? 
WHERE id = ? AND bill_id = ? AND paid_at IS NULL
```
SQLite guarantees atomic row locking at the database engine level. We inspect `meta.changes`. If `changes === 1`, we are guaranteed that this specific request executed the transition. If `changes === 0`, we simply read the current state to differentiate between an idempotent replay (same key -> 200 OK), a double payment (different key -> 409 Conflict), or a missing resource (404 Not Found). This achieves linearizable race safety in a single round-trip without locking contention."

---

### 2. How do you guarantee the bill splitting algorithm always conserves total cents without rounding drift?

**Answer:**
"Floating-point numbers are completely barred from the domain model. All amounts are integer cents.
In `api/src/domain/splitter.ts`, the function `splitBill(totalCents, memberIds)` calculates:
1. `base = Math.floor(totalCents / N)`
2. `remainder = totalCents % N`
   Because `remainder < N`, distributing 1 extra cent (`base + 1`) to the first `remainder` members and `base` to the remaining members mathematically guarantees:
   $$\text{remainder} \times (\text{base} + 1) + (N - \text{remainder}) \times \text{base} = N \times \text{base} + \text{remainder} = \text{totalCents}$$
   We wrote 11 unit tests verifying this invariant across edge cases, including `totalCents < memberCount`, large prime numbers, and single-member households."

---

### 3. Why did you introduce a monotonic `position` column instead of relying on `created_at` or SQLite `ROWID`?

**Answer:**
"In distributed systems, timestamps (`created_at`) are subject to clock skew, NTP sync jumps, and millisecond collisions when multiple members are inserted rapidly. Similarly, SQLite `ROWID` or auto-increment integers are table-global rather than scoped to a specific household, making them non-deterministic if records are deleted or imported.
By adding a dedicated `position INTEGER NOT NULL` column scoped to `home_id`:
```sql
INSERT INTO members (id, home_id, name, position)
VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM members WHERE home_id = ?))
```
and enforcing a unique constraint `uq_members_home_position UNIQUE (home_id, position)`, we guarantee that member join order is strictly monotonic (1, 2, 3...) per home. This ensures remainder cents and balance reports are 100% deterministic."

---

### 4. What happens when an idempotency key is reused across two different shares?

**Answer:**
"In our schema, we defined:
```sql
CONSTRAINT uq_shares_bill_idempotency UNIQUE (bill_id, idempotency_key)
```
This ensures an idempotency key cannot be accidentally or maliciously reused to mark multiple different shares as paid on the same bill. If a client attempts to pass the same idempotency key for a different share on that bill, the database rejects the write, and our handler surfaces the appropriate conflict."

---

### 5. How does your system prevent SQL injection and malformed input?

**Answer:**
"Every single query in the application uses parameterized statements with `db.prepare(...).bind(...)`. Dynamic SQL string concatenation is strictly prohibited.
Furthermore, request bodies are parsed defensively. In `api/src/index.ts`, inputs are checked for nullability, type, and bounds before touching the database. For example, `totalCents` must satisfy `typeof totalCents === 'number' && Number.isSafeInteger(totalCents) && totalCents > 0 && totalCents <= 1_000_000_000`. String fields like titles and names are trimmed and validated for non-zero length and character caps."

---

### 6. Why did you choose TanStack Query alongside TanStack Router?

**Answer:**
"TanStack Router handles URL state, path parameters (like `$homeId`), and client-side transitions. However, managing server state (caching, background refetching, mutation lifecycles, and deduping) in vanilla React state quickly leads to stale data and race conditions.
TanStack Query provides declarative data fetching with automatic cache invalidation. For instance, when a user pays a share in `ShareRow.tsx`, the `useMutation` onSuccess handler triggers `queryClient.invalidateQueries({ queryKey: ['bills', homeId] })` and `queryClient.invalidateQueries({ queryKey: ['balances', homeId] })`. This immediately synchronizes the outstanding debt cards and bill progress bars across the UI without manual state stitching."

---

### 7. How does the frontend handle payment retries without causing duplicate charges or key collisions?

**Answer:**
"In `web/src/components/ShareRow.tsx`, we generate a UUID idempotency key using `useRef(crypto.randomUUID())` when the row mounts. If a user clicks 'Pay Share' and the network drops or times out, the user can click 'Retry'.
Because the key is stored in the ref and not regenerated upon failure, the retry request transmits the **exact same** `Idempotency-Key` header. If the first attempt actually reached the server and succeeded, the retry receives the idempotent `200 OK` replay. If the first attempt never reached the server, the retry processes cleanly. Only once a `200 OK` is confirmed does the component reset or disable the action."

---

### 8. How does the balance aggregation query work without causing N+1 query bottlenecks?

**Answer:**
"Instead of looping through members and executing individual queries to sum their unpaid shares (N+1 queries), `GET /api/homes/:homeId/balances` executes a single SQL aggregation:
```sql
SELECT 
  m.id AS memberId,
  m.name AS name,
  COALESCE(SUM(s.amount_cents), 0) AS outstandingCents
FROM members m
LEFT JOIN bills b ON b.home_id = m.home_id
LEFT JOIN shares s ON s.bill_id = b.id AND s.member_id = m.id AND s.paid_at IS NULL
WHERE m.home_id = ?
GROUP BY m.id, m.name, m.position
ORDER BY m.position ASC
```
This joins members with unpaid shares in a single pass, groups by member, orders by join position, and defaults members with no debt to 0 cents. Query complexity is $O(1)$ database calls regardless of member count."

---

### 9. Why is `any` completely eliminated from the codebase, and how did you enforce strict typing?

**Answer:**
"The project constraints explicitly forbade `any`, `as any`, and `@ts-ignore`. In TypeScript, `any` disables compiler type-checking, allowing runtime type mismatches to go unnoticed.
Instead, we used `unknown` combined with type narrowing and runtime type guards. In API endpoints, request bodies are initially typed as `unknown`, checked with `typeof` guards, and safely cast only after structural validation. In Biome and TypeScript compiler settings, `noImplicitAny` and strict checking are enabled. Both `pnpm check` and `pnpm typecheck` pass with zero diagnostics."

---

### 10. How does the frontend ensure it never crashes on 500 errors or slow networks?

**Answer:**
"Three layers of defense protect the user interface:
1. **Network Timeout**: In `web/src/api.ts`, all `fetch` requests are wrapped in an `AbortController` with a 10,000ms timeout, ensuring no hanging states.
2. **Component Error Boundaries**: `web/src/components/ErrorBoundary.tsx` wraps route trees to catch any React rendering errors and display an informative error screen with a 'Reload' button.
3. **Query Error States**: TanStack Query gracefully captures non-2xx responses. When an endpoint returns a 500 or network error, the dashboard displays an inline error banner with a 'Retry' button while keeping existing UI elements intact."

---

### 11. Why is integer cents used everywhere instead of decimal numbers with rounding?

**Answer:**
"In floating-point binary representation (IEEE 754), fractional numbers like `0.1` or `0.01` cannot be represented exactly. Performing arithmetic with floats leads to precision errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). In financial systems, accumulated rounding errors result in unbalanced ledgers where $\sum \text{shares} \ne \text{total}$.
By treating cents as the atomic unit of account, all operations are whole integer arithmetic. Division remainder is handled explicitly via modulo, and formatting to dollars (e.g. `$10.00`) is restricted to the presentation boundary using `Intl.NumberFormat`."

---

### 12. What design considerations were made for accessibility (a11y) in the UI?

**Answer:**
"The web application adheres to modern accessibility guidelines:
- Non-interactive icons use `aria-hidden="true"`.
- Interactive buttons and links feature descriptive `aria-label` tags.
- Form inputs are paired with `<label>` elements with matching `htmlFor` attributes.
- Animated loaders use `role="status"` and include hidden `<span className="sr-only">Loading...</span>` elements.
- The CSS includes a `@media (prefers-reduced-motion: reduce)` media query that disables transitions for users with vestibular sensitivities.
- All interactive components passed Biome's strict accessibility linting without warnings."

---

### 13. How does Cloudflare D1 handle concurrency and what are its limitations?

**Answer:**
"Cloudflare D1 is built on SQLite, running at the Cloudflare edge. In D1, read queries can be distributed across edge read replicas, while write queries are routed to a primary instance where SQLite serializes writes through write-ahead logging (WAL) or equivalent transaction mechanisms.
Because writes are serialized on the primary instance, high write concurrency on a single row must avoid long-running locks. Our design avoids multi-step lock holding by executing single-statement atomic conditional updates, ensuring execution times are measured in single-digit milliseconds."

---

### 14. How does the batch insertion in bill creation guarantee atomicity?

**Answer:**
"When a bill is created, the bill record and all its individual member shares must be inserted together. If the server crashed after creating the bill but before creating the shares, the database would contain an invalid bill with zero shares.
In `api/src/index.ts:221`, we utilize `c.env.DB.batch([insertBillStmt, ...insertShareStmts])`. D1 executes batch statements inside a single atomic SQLite transaction. If any statement fails, the entire batch rolls back, guaranteeing zero partial writes."

---

### 15. If this system had to scale to 100,000 requests per second, what architectural changes would you make?

**Answer:**
"To scale to 100k req/sec:
1. **Read Path Caching**: Balance calculations and bill queries would leverage Cloudflare Workers KV or Cache API with short TTLs and stale-while-revalidate headers, invalidated via event hooks upon mutations.
2. **Sharding Households**: Cloudflare Durable Objects or sharded D1 databases partitioned by `home_id` would distribute write workloads across independent SQLite instances, removing the single primary write bottleneck.
3. **Queue-Based Asynchronous Ingestion**: High-throughput bill creation could be accepted into Cloudflare Queues with immediate 202 Accepted status, processed asynchronously in batches into storage."
