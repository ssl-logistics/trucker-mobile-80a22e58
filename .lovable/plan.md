

## Problem Analysis

The freelance driver sees express rent (เช่าด่วน) jobs that have already been assigned to a company driver. This happens because the `loadJobs` function in `Home.tsx` doesn't filter by the post's `status` field or `express_rent_expiry`.

From the API response, each express rent post has:
- `status` field (e.g., "open", could become "assigned"/"closed" when a driver is selected)
- `express_rent_expiry` field (timestamp after which the post should no longer be available)

Currently the code only filters by:
- `is_express_rent === true`
- Past pickup dates
- Jobs this specific driver already accepted
- Truck type compatibility

It does NOT filter by `status !== 'open'` or expired `express_rent_expiry`.

## Plan

**File: `src/pages/Home.tsx`** (~lines 378-379)

Add two filters when processing express rent posts:

1. **Filter by status** - Only show posts where `status === 'open'` (exclude "assigned", "closed", etc.)
2. **Filter by express_rent_expiry** - Exclude posts where `express_rent_expiry` has passed

```typescript
const transformedJobs: Job[] = apiJobs
  .filter((item: any) => item.is_express_rent === isExpressRentFilter)
  .filter((item: any) => {
    // Only show posts that are still open (not assigned to another driver)
    const status = (item.status || '').toLowerCase();
    if (status && status !== 'open') return false;
    
    // Filter out expired express rent posts
    if (item.express_rent_expiry) {
      const expiry = new Date(item.express_rent_expiry);
      if (expiry < new Date()) return false;
    }
    
    return true;
  })
  .map((item: any) => { ... });
```

This ensures that when a company driver is selected (and the external API updates the post status or the expiry passes), the freelance driver will no longer see that job on their home page. The 30-second auto-refresh will pick up the change automatically.

