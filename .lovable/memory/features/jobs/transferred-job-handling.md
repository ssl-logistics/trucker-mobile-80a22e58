---
name: Transferred Job Handling
description: Jobs with is_transferred flag excluded from current jobs. Photo editing is ownership-based — each driver can only edit their own uploaded photos.
type: feature
---
Jobs with `is_transferred: true` from the `get-driver-assigned-jobs` API:

1. **Current Jobs**: Excluded from the active jobs list (`CurrentJobsPage`).
2. **History**: Shown with grey styling (`bg-gray-100 opacity-70`) and "โอนงานแล้ว" badge.
3. **Detail View (from history)**: 
   - A "โอนงานแล้ว" banner is shown at the top.
   - Only steps that were completed before transfer can be viewed.
   - Uncompleted steps have their action buttons disabled.
   - The `isTransferred` flag is detected from `location.state.jobData.is_transferred`.

4. **Photo Editing (Ownership-Based)**:
   - `EditablePhoto` uses `isOwnData` prop to control editing per-photo.
   - Driver ID is extracted from checkin/SOP/OCR records (`internal_driver_id`, `external_driver_id`, `freelance_driver_id`).
   - Driver 1 can edit their own photos (within 3-day window from history).
   - Driver 2 can only edit photos they uploaded, not Driver 1's.
   - Applied in: `ContainerSummaryPage` (pickup/return/OCR), `PickupSummaryPage` (SOP), `DeliveryDetailPage` (POD).
