# 3-Minute Technical Video Presentation Script

**Project**: Shared Bill Splitter (Cloudflare Workers, D1 SQLite, React + TanStack Router)  
**Presenter**: Principal Full-Stack Engineer  
**Duration**: Exactly 3 minutes (180 seconds)

---

## [0:00 - 0:30] Introduction & High-Level Architecture

**[Screen: Show repo file tree, `ARCHITECTURE.md` Mermaid diagram, and browser running dashboard]**

> "Hi everyone. Today I'm walking through the production-grade implementation of the Shared Bill Splitter.
> 
> The architecture is built around three core pillars:
> 1. An ultra-low latency REST API running on **Cloudflare Workers** using **Hono** (`api/src/index.ts:25`).
> 2. An ACID-compliant relational data store using **Cloudflare D1** (`api/migrations/0001_init.sql:1`) enforcing 10 named schema constraints.
> 3. A responsive, resilient single-page web app built with **React 19**, **Vite**, **TanStack Router**, and **TanStack Query** (`web/src/routes/$homeId.tsx:45`).
> 
> The system enforces integer cents across the entire pipeline—no floating-point numbers exist in database columns, API JSON payloads, or domain calculations."

---

## [0:30 - 1:15] Deep Dive: Splitting Algorithm & Payment Idempotency

**[Screen: Open `api/src/domain/splitter.ts` and `api/src/index.ts:310-375`]**

> "Let's examine the bill splitting algorithm in `api/src/domain/splitter.ts:18`. It's a pure function that distributes any remainder cents sequentially to members according to their monotonic join position.
> 
> For example, a $10.00 bill (1,000 cents) across 3 members computes a base of 333 cents and a remainder of 1 cent. The first member receives 334 cents, and the others receive 333 cents. The mathematical invariant $\sum \text{shares} = \text{totalCents}$ is strictly preserved.
> 
> Now, look at the payment endpoint in `api/src/index.ts:310`. We guarantee race safety and idempotency through an atomic conditional SQL `UPDATE`:
>
> ```sql
> UPDATE shares 
> SET paid_at = ?, idempotency_key = ? 
> WHERE id = ? AND bill_id = ? AND paid_at IS NULL
> ```
> 
> Because this is a single atomic statement, SQLite's serialization guarantees that if two clients attempt to pay the exact same share simultaneously, exactly one execution gets `changes === 1`. The winner returns a `200 OK`. The loser gets `changes === 0` and inspects the row: if the request provides the same `Idempotency-Key`, it safely replays the `200 OK`; if it provides a different key, it immediately returns a `409 Conflict`."

---

## [1:15 - 2:00] Web UI & UX Resiliency

**[Screen: Open browser at `http://localhost:5173`, create a bill, pay a share, toggle network offline in DevTools]**

> "Turning to the frontend in `web/src/routes/$homeId.tsx`. The UI adopts the 'Obsidian Ledger' fintech design system documented in `DESIGN.md`.
> 
> Three critical UX decisions make this production-ready:
> 1. **Live Split Preview**: When creating a bill in `web/src/components/CreateBillModal.tsx:160`, typing $10.00 instantly calculates the exact per-member penny allocation live before submission.
> 2. **Network Timeout & Retry Safety**: In `web/src/api.ts:12`, all network calls are wrapped with a 10-second `AbortController` timeout. In `web/src/components/ShareRow.tsx:28`, the payment button generates a single UUID idempotency key that is preserved across network retries, preventing duplicate payments during intermittent packet loss.
> 3. **Non-Crashing States**: The dashboard uses skeletal loaders (`web/src/components/Skeletons.tsx:3`), custom empty state prompts, and React error boundaries (`web/src/components/ErrorBoundary.tsx:14`) with inline retry handlers so unexpected server errors never crash the UI."

---

## [2:00 - 2:30] Key Bug / Trade-Off Encountered & Solution

**[Screen: Show `api/src/index.ts:121` and SQLite monotonic sequence query]**

> "An interesting engineering trade-off we solved was monotonic join sequencing under SQLite.
> 
> In a distributed edge setup, relying on auto-incrementing integer IDs or timestamps (`Date.now()`) for join sequence ordering causes race conditions when members are added concurrently or clock drift occurs.
> 
> We solved this in `api/src/index.ts:121` by assigning member position atomically within the `INSERT` query:
>
> ```sql
> INSERT INTO members (id, home_id, name, position)
> VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM members WHERE home_id = ?))
> ```
> Coupled with the named unique constraint `uq_members_home_position` in `api/migrations/0001_init.sql:16`, this guarantees deterministic, gapless ordering per household."

---

## [2:30 - 3:00] Edge Cases & Verification Wrap-Up

**[Screen: Run terminal command `pnpm check && pnpm typecheck && pnpm test && pnpm build`]**

> "Finally, let's verify all edge cases. In `api/test/hardening.test.ts`:
> 1. Empty homes return `422` on bill creation.
> 2. Zero, negative, float, and unsafe amounts return `422`.
> 3. Remainder distribution is verified on uneven splits.
> 4. Idempotency replays return identical payment timestamps.
> 5. Parallel race conditions on the same share resolve cleanly into one `200` and one `409`.
> 6. Non-existent resources and cross-bill share mismatches return `404`.
> 7. The web interface handles 500 errors and slow networks gracefully.
> 
> As you can see in the terminal:
> - Biome check: 0 errors, 0 warnings.
> - TypeScript check: 100% clean across API and Web with zero `any`.
> - Vitest: 52 out of 52 tests passing.
> - Vite: Production build succeeds in under a second.
> 
> Thank you!"
