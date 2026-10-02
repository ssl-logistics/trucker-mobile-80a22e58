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
- Details text is required before sending; the license plate is not shown on the page but is still read from the driver profile (`plate_number`/`plate_province`, fallback `auth_truck_plate`) and sent with the report.
