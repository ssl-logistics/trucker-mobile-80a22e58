---
name: Transferred Job Handling
description: Jobs with is_transferred flag are excluded from current jobs and shown in history with grey styling. When viewed from history, only completed steps are accessible; uncompleted steps are disabled.
type: feature
---
Jobs with `is_transferred: true` from the `get-driver-assigned-jobs` API:

1. **Current Jobs**: Excluded from the active jobs list (`CurrentJobsPage`).
2. **History**: Shown with grey styling (`bg-gray-100 opacity-70`) and "โอนงานแล้ว" badge.
3. **Detail View (from history)**: 
   - A "โอนงานแล้ว" banner is shown at the top.
   - Only steps that were completed before transfer (check-in, SOP, POD) can be viewed.
   - Uncompleted steps have their action buttons disabled.
   - The `isTransferred` flag is detected from `location.state.jobData.is_transferred`.
   - Applies to all step types: empty container, pickup, delivery, container return.
