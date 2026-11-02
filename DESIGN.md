# Design System & UI Architecture: SplitZero

This document details the visual direction, design tokens, and user interface specifications for **SplitZero (Shared Bill Splitter)**, generated and refined via Stitch MCP.

---

## 1. Design Exploration & Stitch Variants

To establish a calm, trustworthy, and high-density fintech aesthetic (drawing inspiration from **Linear**, **Stripe Dashboard**, **Mercury**, and **Splitwise**), two distinct design variants were generated within Stitch MCP (`projects/6060769216606102477`):

### Variant A: "Obsidian Ledger" (Screen `3d835baccecb415ba2817a62611e41e6`)

- **Visual Tenor**: Deep obsidian dark mode (`#090D16` / `#0F131C`) with hairline precision borders (`#1F2937`), electric indigo interactive triggers (`#6366F1`), and luminous emerald telemetry for paid/settled shares (`#10B981`).
- **Typography**: Dual hierarchy using Geist for UI chrome and structure, paired with JetBrains Mono / tabular numbers (`font-variant-numeric: tabular-nums`) for currency figures and split calculations.
- **Data Density**: High-density 12-column layout with hero household balance KPI, member debt badges with deterministic avatar coloring, bill progress meters (paid vs unpaid ratio), and itemized member share rows.

### Variant B: "Executive Clean Fintech" (Screen `cae738a6aeb9467abae69634182efb74`)

- **Visual Tenor**: High-contrast slate-50 (`#F8FAFC`) with pure white elevated cards, subtle executive drop shadows, deep indigo anchors, and floating quick-split action controls.
- **Typography**: Tabular figures in monospaced lining, high-contrast dark text (`#0F172A`).
- **Layout**: Floating action control dock with card-based settlement pills.

---

## 2. Selection & Justification

**Selected Variant**: **Variant A ("Obsidian Ledger") with Adaptive Light Theme Support**.

### Rationale:

1. **Financial Focus & Reduced Visual Fatigue**: Co-living expense tracking often happens in ambient household settings or late evenings. The obsidian substrate eliminates glare, allowing crucial financial signals (unpaid liabilities vs. settled assets) to pop instantly through surgical chromatic accents (Crimson `#F43F5E` vs. Emerald `#10B981`).
2. **Clear Action vs. State Separation**: Electric Indigo (`#6366F1`) is reserved exclusively for interactive elements (CTA buttons, modals, dropdowns), while Emerald (`#10B981`) and Amber (`#F59E0B`) are strictly semantic state indicators. This prevents user confusion between "clickable buttons" and "informational badges".
3. **Information Density & Legibility**: The 4/8px spacing system and micro-hairline borders (`#1F2937`) maximize visible screen real estate, displaying all active bills and member shares above the fold without overwhelming horizontal scrolling.

---

## 3. Design Tokens & CSS Variables

The design tokens are codified into CSS variables for seamless dark/light mode toggling and zero runtime styling overhead.

```css
:root {
  /* Light Mode Palette */
  --bg-canvas: #f8fafc;
  --bg-surface-1: #ffffff;
  --bg-surface-2: #f1f5f9;
  --bg-surface-3: #e2e8f0;
  --border-subtle: #e2e8f0;
  --border-strong: #cbd5e1;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --accent-primary: #4f46e5;
  --accent-primary-hover: #4338ca;
  --accent-success: #059669;
  --accent-success-bg: rgba(5, 150, 105, 0.1);
  --accent-warning: #d97706;
  --accent-warning-bg: rgba(217, 119, 6, 0.1);
  --accent-error: #e11d48;
  --accent-error-bg: rgba(225, 29, 72, 0.1);
}

.dark {
  /* Dark Mode Palette (Obsidian Ledger) */
  --bg-canvas: #090d16;
  --bg-surface-1: #0f1422;
  --bg-surface-2: #161e31;
  --bg-surface-3: #1f2942;
  --border-subtle: #1f293d;
  --border-strong: #2e3e5c;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent-primary: #6366f1;
  --accent-primary-hover: #818cf8;
  --accent-success: #10b981;
  --accent-success-bg: rgba(16, 185, 129, 0.12);
  --accent-warning: #f59e0b;
  --accent-warning-bg: rgba(245, 158, 11, 0.12);
  --accent-error: #f43f5e;
  --accent-error-bg: rgba(244, 63, 94, 0.12);
}
```

---

## 4. Key UI Components & Interactions

1. **Member Avatars & Deterministic Colors**:
   - Members are assigned consistent, distinct avatar hues based on a hash of their `name` or `memberId` (e.g., Indigo, Emerald, Amber, Rose, Cyan, Violet).
   - Shows member initials and an online/status dot indicating if their balance is fully settled (`$0.00`).

2. **Tabular Numerics for Currency**:
   - All monetary amounts use integer cents formatted via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.
   - `font-feature-settings: 'tnum' on, 'zero' on` prevents column jitter when numbers change.

3. **Bill Progress Indicator**:
   - Visual progress bar displays the proportion of total cents paid:
     $$\text{Percent Paid} = \frac{\sum \text{Paid Shares}}{\text{Total Bill Cents}} \times 100\%$$
   - Green fill for paid share portion, dark track for remaining unpaid.

4. **Pay Button Lifecycle & Idempotency**:
   - **Idle**: "Pay Share" button enabled.
   - **Pending**: Button disabled, spinner/skeleton pulse, `aria-busy="true"`.
   - **Confirmed Paid**: Transitions to "Paid" badge with checkmark and formatted timestamp.
   - **Error / Failure**: Button re-enables with "Retry Payment" text, inline error banner displays exact API message, and the _same_ `Idempotency-Key` is retained for retry to guarantee zero double charges.

5. **Loading, Empty, and Error States**:
   - **Loading**: High-fidelity skeleton screens mimicking card layout, hero metric, and rows (no blank spinners).
   - **Empty**: Context-aware empty state with clear calls to action (e.g., "No members yet - add your first roommate", "No bills created - split an expense").
   - **Error**: Polished error state card with alert icon, error message, and "Try Again" refetch button.
