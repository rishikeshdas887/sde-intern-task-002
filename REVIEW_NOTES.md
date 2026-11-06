# Code Self-Review & Quality Audit: Shared Bill Splitter

Conducted by: Principal Software Engineer  
Scope: Entire repository (`api` and `web` packages)  
Date: November 2026

---

## 1. Backend Self-Review (`api/`)

### 1.1 Hard Constraints Verification

- **Stack Compliance**: Uses Hono on Cloudflare Workers, Cloudflare D1 with binding `DB` configured in `wrangler.jsonc`, TypeScript everywhere.
- **Strict Typing (Zero `any`)**:
  - `grep -rn "any" api/src` confirmed zero usages of `any`, `as any`, or `@ts-ignore`.
  - Replaced untyped requests with `unknown` and runtime narrowing.
- **Unmodified Tests**:
  - `git diff origin/main -- api/test/homes.test.ts api/test/bills.test.ts api/test/payments.test.ts api/test/helpers.ts` verified completely empty. No existing tests or helpers were altered or weakened.
- **Integer Cents Modeling**:
  - Database schema columns `total_cents` and `amount_cents` are typed `INTEGER`.
  - Domain splitter operates purely on integers (`Math.floor` and modulo `%`).
  - No floating-point operations in arithmetic pathways.
- **Uniform Error Envelope**:
  - All errors map to `{ "error": "message" }`.
  - Handled consistently via `AppError` subclasses and centralized `app.onError` middleware.

### 1.2 Database & Concurrency Review

- **Named Constraints**: 11 explicit named constraints in `api/migrations/0001_init.sql` protecting foreign key cascades, non-empty text, unique sequence positions, positive totals, non-negative share amounts, unique member shares per bill, and payment state consistency.
- **Race Safety**: Atomic conditional `UPDATE ... WHERE id = ? AND bill_id = ? AND paid_at IS NULL` guarantees linearizable execution under concurrent requests.
- **Batching**: Bill and share creations use `db.batch()` to ensure transactional all-or-nothing execution.
- **Aggregations**: Balance aggregation uses a single `LEFT JOIN` and `GROUP BY` query, avoiding N+1 roundtrips.

---

## 2. Frontend Self-Review (`web/`)

### 2.1 UI/UX & Design System

- **Design Tokens**: Custom CSS variables, dark Obsidian Ledger palette, modern typography (Inter), glassmorphic backdrops, and subtle micro-animations.
- **Live Preview**: Bill creation modal provides real-time allocation feedback showing exactly who gets remainder cents as the user types dollar figures.
- **Resilient States**:
  - **Loading**: `DashboardSkeleton` simulates cards and tables during data fetching without layout shifts.
  - **Empty States**: Clear, actionable prompts when a home has no members or no bills.
  - **Error States**: Inline banners with retry triggers; React `ErrorBoundary` wraps top-level routes to catch uncaught runtime exceptions.

### 2.2 Network & Idempotency Safeguards

- **Timeout Protection**: `web/src/api.ts` attaches a 10-second `AbortController` signal to prevent indefinite hanging on slow or stalled networks.
- **Stable Idempotency Key**: `ShareRow.tsx` retains a persistent UUID in a React ref across retry clicks until a confirmed `200 OK` response is received, protecting against duplicate payments during network drops.
- **Accessibility (a11y)**:
  - Form inputs feature descriptive `<label>` elements.
  - Non-text buttons have explicit `aria-label` tags.
  - Loaders specify `role="status"` and visually hidden announcements.
  - Reduced-motion media query respects user accessibility preferences.

---

## 3. Tooling & Test Suite Audit

| Check                 | Command          | Result                          | Details                                                                   |
| :-------------------- | :--------------- | :------------------------------ | :------------------------------------------------------------------------ |
| **Lint & Formatting** | `pnpm check`     | **PASS (0 errors, 0 warnings)** | Biome verified across all 41 source files.                                |
| **Type Safety**       | `pnpm typecheck` | **PASS (0 errors)**             | `tsc --noEmit` clean in both `web` and `api`.                             |
| **Test Suite**        | `pnpm test`      | **PASS (52/52 tests)**          | 5 test suites (12 bills, 9 payments, 3 homes, 11 splitter, 17 hardening). |
| **Production Build**  | `pnpm build`     | **PASS (under 1s)**             | Rolldown/Vite bundle compiled cleanly.                                    |

---

## 4. Compromises, Trade-offs & Future Improvements

1. **Member Ordering Pagination**:
   - _Current Implementation_: Fetches all members in a single query ordered by `position ASC`.
   - _Trade-off_: Acceptable for household sharing apps (typically 2-10 members). For enterprise splits (thousands of members), cursor-based pagination would be required.
2. **Offline-First Synchronization**:
   - _Current Implementation_: Network queries rely on TanStack Query cache with background invalidation.
   - _Future Improvement_: Add IndexedDB persistence via TanStack Query's persist plugins for full offline read capability.
3. **Multi-Currency Support**:
   - _Current Implementation_: Hardcoded to USD cents ($) using `Intl.NumberFormat('en-US')`.
   - _Future Improvement_: Store currency ISO code (`USD`, `EUR`, `GBP`) on `homes` and format dynamically based on household preference.

---

## 5. Comprehensive Line-by-Line Code Review & DevOps Audit

### 5.1 Architecture & Domain Invariants

- **Database (`api/migrations/0001_init.sql`)**:
  - Verified 11 named constraints ensuring relational integrity, non-negative shares, monotonic member sequence, and positive bill amounts.
  - Indexes on foreign keys prevent table scans during join operations.
- **Pure Split Algorithm (`api/src/domain/splitter.ts`)**:
  - Verified exact cent conservation: $\sum \text{shares} = \text{totalCents}$.
  - Sequential remainder cent allocation adheres strictly to monotonic member join order.
- **Payment Idempotency & Race Protection (`api/src/index.ts`)**:
  - Verified atomic conditional `UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL`.
  - Zero double-charge race windows under high concurrency.
- **Frontend Resiliency (`web/src/routes/$homeId.tsx` & components)**:
  - Skeletons handle loading states without layout shifts.
  - AbortController with 10s timeout prevents hung requests.
  - Error boundaries wrap application roots to eliminate white screens.
  - Payment buttons reuse idempotency keys across retries to prevent duplicate charges.

### 5.2 Serverless ESM Packaging Bug Resolution

- **Finding**: During Vercel serverless deployment, dynamic import of Node built-ins triggered `Error: Dynamic require of "node:fs/promises" is not supported`.
- **Resolution**: Updated `web/package.json` esbuild configuration to `--packages=external` for the Node 24 runtime. This preserves native ES module imports and eliminates CommonJS dynamic require polyfill traps.

### 5.3 Cloud & DevOps CI/CD Deployment

- **Live Cloud Deployment**:
  - **Production URL**: `https://web-eight-inky-78.vercel.app`
  - **Health Endpoint**: `https://web-eight-inky-78.vercel.app/api/health` (`200 OK`)
  - **API Contract**: Fully tested end-to-end (`/api/homes`, `/api/homes/:homeId/members`, `/api/homes/:homeId/bills`, `/api/bills/:billId/shares/:shareId/pay`, `/api/homes/:homeId/balances`).
- **DevOps Workflows**:
  - `.github/workflows/ci.yml`: Automated quality gate on every push and pull request (Biome, TypeScript, Vitest, Vite build).
  - `.github/workflows/deploy-cloudflare.yml`: Automated Cloudflare Workers deployment action.
