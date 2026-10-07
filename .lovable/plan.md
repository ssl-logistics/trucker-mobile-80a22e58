# Fix job category filter on Home (frontend only)

## How it filters now
- BL: job has a BL number.
- Booking: job has a Booking number.
- Multi-drop: the job has more than 1 drop-off point.
- Single trip: the job has 0 or 1 drop-off point.
- If you tick more than one box, a job shows when it matches any of them.

## Why results don't match what you picked
1. "Single trip" also picks up BL and Booking jobs, because they usually have only 1 drop-off point. Tick only "Single trip" and international jobs still show.
2. If a job comes with no drop-off list, it counts as having 0 drop-offs, so it always lands in "Single trip". That happens even when the job's send mode is actually multi-drop.
3. The job's own send mode from the system (`send_mode` / `transport_type`) is never checked.

## Fix
- BL and Booking: no change.
- Multi-drop and Single trip will only include domestic jobs. Jobs with a BL or Booking number are left out.
- Multi-drop: the job's send mode says multi, or it has more than 1 drop-off point.
- Single trip: a domestic job that isn't multi-drop.
- Ticking several boxes still shows jobs that match any of them. Clear filter still shows everything.

## Technical details
- Only `applyCategoryFilter` in `src/pages/Home.tsx` changes. `isIntl = hasBl || hasBooking || job.job_type === 'international'`.
- `isMulti = !isIntl && (destCount > 1 || /multi/i.test(job.transport_type || ''))`. `isSingle = !isIntl && !isMulti`.
- Fetching jobs, job cards and all other flows stay as they are.
