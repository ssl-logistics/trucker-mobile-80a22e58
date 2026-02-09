

## Fix: Back Navigation from Pickup Summary to Job Detail (History)

### Problem
When pressing back from the Pickup Summary page (SOP info), it navigates to `/job/{orderCode}?from=history` but does NOT pass the job data through `location.state`. The Job Detail page then tries to fetch the job from the API, but since the job is in `completed` status (which is not fetched), it shows "Job not found".

### Solution
Pass the job data through `location.state` when navigating back from PickupSummaryPage, so the JobDetailPage can use it as a fallback.

### Technical Details

**File: `src/pages/PickupSummaryPage.tsx`**

Update the back button (line 202) to pass job data through navigation state:

```typescript
// Before
navigate(`/job/${job.order_code}${fromHistory ? '?from=history' : ''}`)

// After  
navigate(`/job/${job.order_code}${fromHistory ? '?from=history' : ''}`, { 
  state: { jobData: location.state?.jobData || job } 
})
```

This preserves the original full job data from navigation state (which contains all fields the JobDetailPage needs), falling back to the local `job` object if state is unavailable.

