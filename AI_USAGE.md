# AI Usage & Engineering Methodology

This document transparently details the artificial intelligence tools, prompt workflows, human corrections, and architectural engineering decisions utilized throughout the implementation of the Shared Bill Splitter platform.

---

## 1. AI Tools & Agents Utilized

1. **Antigravity AI Agent (Google DeepMind)**:
   - _Role_: End-to-end autonomous pair programmer for planning, database schema generation, TypeScript implementation, testing, and handoff documentation.
2. **Stitch MCP (Google Design System & UI Generation)**:
   - _Role_: Rapid visual ideation, color tokens extraction, and typography pairing. Generated high-fidelity fintech design concepts ("Obsidian Ledger" and "Executive Clean") that informed `DESIGN.md`.
3. **Get-Stuff-Done (GSD) & Ralph Loop Methodology**:
   - _Role_: Structured planning, incremental checkpointing, test verification, and proactive verification loops (`pnpm check && pnpm typecheck && pnpm test && pnpm build`).

---

## 2. Workflows & High-Yield Prompts

### 2.1 Database & Concurrency Modeling

- **High-Yield Prompt**:
  > _"Analyze the payment requirement in README.md: 'If the same Idempotency-Key is sent again for the same share, answer 200 with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.' How can we guarantee race safety in SQLite/Cloudflare D1 without interactive transaction locking?"_
- **Outcome**: The AI suggested using an atomic conditional update (`UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL`) and checking `meta.changes`. This completely avoided distributed locking while guaranteeing linearizability.

### 2.2 Live Split Preview Math

- **High-Yield Prompt**:
  > _"In the bill creation modal, create a reactive preview calculating exact integer cent shares as the user inputs dollars, accurately showing who receives the remainder cents."_
- **Outcome**: The AI ported the pure arithmetic logic of `splitBill` directly into the React modal component, giving users real-time feedback prior to submitting the form.

---

## 3. Where AI Fell Short & Required Engineering Correction

While the AI accelerated scaffolding, several subtle edge cases and domain traps required strict human engineering correction:

1. **Floating-Point Input in Financial Systems**:
   - _AI Tendency_: Initially, AI code snippets suggested converting input with `parseFloat(input) * 100`.
   - _Correction_: `parseFloat('19.99') * 100` evaluates to `1998.9999999999998` in JavaScript floating-point arithmetic. The human engineer enforced integer string parsing (`Math.round(parsed * 100)` and integer validation) to eliminate rounding drift.
2. **Biome Accessibility Rules (a11y)**:
   - _AI Tendency_: Suggested `autoFocus` on inputs and backdrop `div` elements with `onClick`.
   - _Correction_: Biome flags `noAutofocus` and `noStaticElementInteractions`. The engineer corrected these by removing autofocus for screen reader compatibility and using accessible semantic `<button>` backdrops.
3. **TypeScript `noUncheckedIndexedAccess` Traps**:
   - _AI Tendency_: In `web/src/lib/format.ts`, `AVATAR_PALETTES[index]` was assumed non-null. Under `noUncheckedIndexedAccess`, TypeScript flags this as potentially undefined.
   - _Correction_: The engineer introduced a strongly-typed `DEFAULT_PALETTE` fallback and explicit `AvatarPalette` interfaces to satisfy strict type-checking without `@ts-ignore` or `any`.

---

## 4. Reflections on AI-Assisted Engineering

- **TDD (Test-Driven Development) as the Ultimate Guardrail**: Autonomous AI agents excel when given strict, immutable test fixtures. Because the visible tests (`api/test/*.test.ts`) were locked and non-modifiable, the agent could not 'cheat' or weaken assertions.
- **The Power of Pure Domain Functions**: Isolating `splitBill` into a pure function allowed instant unit test verification before touching any HTTP or database plumbing.
- **Velocity with Rigor**: Pairing AI speed with strict linters (Biome), type-checkers (TypeScript strict mode), and automated test suites produces production-grade software that meets the highest engineering standards.
