
## Fix: "Job not found" when navigating back to Job Detail from SOP/POD in History

### Problem
The `JobDetailPage` fetches jobs from the API with statuses `in_progress`, `in_transit`, and `delivered`, but NOT `completed`. Jobs shown in the history page are all completed, so they are never found in the API response. While `location.state` is passed initially, navigating to SOP/POD sub-pages and pressing back can lose this state, causing the "Job not found" error.

### Solution
When the URL contains `?from=history`, also fetch jobs with `completed` status from the API. This ensures the job data is always findable regardless of navigation state.

### Technical Details

**File: `src/pages/JobDetailPage.tsx`**

1. Detect `from=history` query parameter at the start of `loadJobDetail()`
2. For Internal/External drivers: add a 4th parallel fetch for `completed` status and merge into `combinedData`
3. For Freelance drivers: the existing freelance API already returns all statuses, so no change needed there

```typescript
// Current: only fetches 3 statuses
const [inProgressResult, inTransitResult, deliveredResult] = await Promise.all([
  getDriverAssignedJobs(user.id, driverType, 50, 'in_progress'),
  getDriverAssignedJobs(user.id, driverType, 50, 'in_transit'),
  getDriverAssignedJobs(user.id, driverType, 50, 'delivered'),
]);

// Updated: also fetch completed when coming from history
const isFromHistory = new URLSearchParams(location.search).get('from') === 'history';
const fetches = [
  getDriverAssignedJobs(user.id, driverType, 50, 'in_progress'),
  getDriverAssignedJobs(user.id, driverType, 50, 'in_transit'),
  getDriverAssignedJobs(user.id, driverType, 50, 'delivered'),
];
if (isFromHistory) {
  fetches.push(getDriverAssignedJobs(user.id, driverType, 50, 'completed'));
}
const results = await Promise.all(fetches);
// Combine all results
const combinedData = results.flatMap(r => (r.data as any)?.data || []);
```

This ensures that completed jobs are always findable when the user is browsing from the history page, eliminating the "Job not found" error on back navigation.
