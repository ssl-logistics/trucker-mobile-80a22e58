---
name: Repair Report Form Reset
description: After submitting a repair report, clear the form (success or failure) and stay on the page; failures must show the backend reason
type: feature
---
Vehicle repair report (`/repair-report`, "แจ้งซ่อม"):

- Submitting clears the form completely — details text emptied and all attached photos/videos removed (blob previews revoked) — whether the send succeeded or failed.
- After a successful send the page stays on `/repair-report` (no auto-navigate back) so the driver can file another report immediately.
- Failed sends show the actual reason returned by the backend in the red alert (edge function response body when parseable); only when no reason can be read does it fall back to the generic "could not submit" text.
- GPS captured once when the page opens is reused for the next report (no new permission prompt).
- Details text is required before sending; the license plate is resolved in order: login profile `plate_number`/`plate_province` → vehicle data from `fetchDriverProfileData` (same source as the Vehicle Info page — the AuthContext user never carries plate fields) → `auth_truck_plate` fallback, and sent with the report. The plate input stays hidden while the vehicle fetch is in flight (`plateLoading`) and is shown as a required first field only when no plate exists after the fetch — and a manually entered plate survives `resetForm()` so the next report keeps it.
