---
name: Booking Closing Date Alert
description: One-shot push + in-app notification when driver confirms empty container pickup on a Booking (outbound) job, telling them the CY closing date deadline.
type: feature
---

When a freelance/internal driver confirms **empty container pickup** for a
**Booking** (outbound) job in `ContainerSOPPage`, the client invokes the
`notify-booking-closing-date` edge function.

- Source field: `closing_time` from job data (fallbacks: `closingTime`, `closing_date`).
- Skipped silently if office did not configure `closing_time`.
- Edge function dedupes by `(user_id, reference_id)` where
  `reference_id = booking_closing_date:<order_number>`.
- Sends in-app `notifications` row + push notification (Thai + English).
- Mirrors the BL-side `notify-container-return-deadline` pattern but uses an
  absolute timestamp instead of `container_free_days`.
- No banner on job detail — push + in-app only (per user request).
