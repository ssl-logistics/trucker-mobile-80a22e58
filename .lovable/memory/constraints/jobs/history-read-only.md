---
name: History Jobs Read-Only
description: Jobs opened from history (?from=history) are fully view-only — no status changes, no expense add/delete, no photo editing, no check-in actions.
type: constraint
---
Jobs opened from the history page (`?from=history`) are strictly read-only. This supersedes older rules that allowed photo editing within 72h and expense editing from history.

- `HistoryJobCard`: no "ปิดงาน" self-close button (removed).
- `JobActionButtons`: from history show only "ดูค่าใช้จ่าย" (view); hide "เพิ่มค่าใช้จ่าย".
- `JobExpensesPage`: `isFromHistory` hides delete expense, delete receipt photo, add photo, upload photo.
- `EditablePhoto`: `fromHistory=true` → `canEdit=false` always (ownership/3-day window no longer applies in history).
- `DomesticJobDetail`: action buttons disabled with `isFromHistory && <step not completed>` (generalized from the old transferred-only condition); completed steps still navigate to view/summary pages.

**Why:** user requirement — history is for viewing only, no updates after completion.
