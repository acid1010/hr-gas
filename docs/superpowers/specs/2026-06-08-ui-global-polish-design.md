# UI Global Polish — Design Spec

**Date:** 2026-06-08  
**Scope:** Frontend global polish across overtime, shifts, attendance, and performance pages.  
**Approach:** B — Targeted fixes + shared primitives + spacing normalization.

---

## Problem Statement

Three inconsistencies degrade the UI quality:

1. `overtime/page.jsx` and `shifts/page.jsx` use raw browser `alert()`, `confirm()`, and `prompt()` while every other page uses the toast system and styled components.
2. `overtime/page.jsx` shows plain "Loading…" text; `shifts/page.jsx` and `employee/performance/page.jsx` have no loading state at all.
3. Card inner padding is `p-4` in overtime/shifts, `p-5` elsewhere. The supertitle typography pattern (`text-[10px] tracking-[0.25em]` + h1) is missing from attendance and performance pages.

---

## Section 1: Native Dialogs → Toast + Modals

### Files affected
- `src/app/overtime/page.jsx`
- `src/app/shifts/page.jsx`

### New components
- **`src/app/components/ConfirmModal.jsx`** — Generic two-button confirm dialog.
  - Props: `open: bool`, `title: string`, `message: string`, `confirmLabel: string`, `onConfirm: fn`, `onClose: fn`
  - Theme-aware via `useAppSettings()` → `p` palette
  - ESC key closes it
  - `framer-motion` `AnimatePresence` fade+scale (matches Drawer animation style)
  - Backdrop click closes
  - Used by: shifts delete shift action. Available for Leave module and future modules.

- **`src/app/overtime/RejectModal.jsx`** — Overtime-specific reject dialog.
  - Props: `open: bool`, `onConfirm: fn(reason: string)`, `onClose: fn`
  - Contains a labeled `<textarea>` for reject reason
  - Confirm button disabled when textarea is empty
  - Same animation and theme pattern as `ConfirmModal`

### Changes in overtime/page.jsx
| Before | After |
|--------|-------|
| `alert(e?.error \|\| "Approve failed")` | `toast(e?.error \|\| "Approve failed", "error")` |
| `const reason = prompt("Reject reason:")` | Open `RejectModal`; reason passed via `onConfirm` callback |
| `alert(e?.error \|\| "Reject failed")` | `toast(e?.error \|\| "Reject failed", "error")` |

### Changes in shifts/page.jsx
| Before | After |
|--------|-------|
| `if (!confirm("Delete this shift?")) return;` | Open `ConfirmModal`; proceed on `onConfirm` |
| `alert(e?.error \|\| "Delete failed")` | `toast(e?.error \|\| "Delete failed", "error")` |
| `alert(e?.error \|\| "Add failed")` | `toast(e?.error \|\| "Add failed", "error")` |
| `alert(e?.error \|\| "Delete failed")` (holiday) | `toast(e?.error \|\| "Delete failed", "error")` |

---

## Section 2: Loading Skeletons

### New export in SkeletonRow.jsx
- **`SkeletonCard`** — A single card-shaped skeleton.
  - Renders a `rounded-2xl` rectangle at ~h-24 with 2 shimmer bars inside.
  - Uses existing `skeleton-pulse` CSS class — no new styles.
  - `SkeletonCardGrid` — wraps 4 `SkeletonCard` items in a `flex flex-col gap-3` for overtime, or `grid grid-cols-1 lg:grid-cols-2 gap-6` for shifts.

### Per-page changes
| Page | Current | After |
|------|---------|-------|
| `overtime/page.jsx` | `<p>Loading…</p>` | `<SkeletonCardGrid count={4} />` (column layout) |
| `shifts/page.jsx` | No loading state | Add `loading` state to `loadShifts`/`loadHolidays`; show `<SkeletonCardGrid count={4} layout="grid" />` while fetching |
| `employee/performance/page.jsx` | No loading state | Add `loading` state; show existing `<SkeletonTable rows={6} cols={7} />` while fetching |

---

## Section 3: Spacing / Padding Normalization

### Card inner padding
Normalize to `p-5` everywhere:
- `overtime/page.jsx`: overtime request cards `p-4` → `p-5`
- `shifts/page.jsx`: shift cards and holiday list cards `p-4` → `p-5`

### Supertitle typography
Add `<p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>HR Management</p>` above the `<h1>` in:
- `attendance/page.jsx` — currently missing
- `employee/performance/page.jsx` — currently missing

Overtime and shifts already have it. Employee page already has it via a different pattern — verify and align if needed.

---

## File Change Summary

| File | Change type |
|------|-------------|
| `src/app/components/ConfirmModal.jsx` | **New** |
| `src/app/overtime/RejectModal.jsx` | **New** |
| `src/app/components/SkeletonRow.jsx` | Add `SkeletonCard`, `SkeletonCardGrid` exports |
| `src/app/overtime/page.jsx` | Replace dialogs, replace loading text, normalize padding |
| `src/app/shifts/page.jsx` | Replace dialogs, add loading state, normalize padding |
| `src/app/employee/performance/page.jsx` | Add loading state, add supertitle |
| `src/app/attendance/page.jsx` | Add supertitle |

---

## Out of Scope

- Spacing outside of card inner padding (outer `p-8`, `mb-8` already consistent)
- Filter/toolbar row patterns (already consistent across pages)
- Any new features or data changes
- Mobile layout (no mobile requirement stated)
