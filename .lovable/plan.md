

## Fix: Include coordinates in destinations mapping for tracking waypoints

### Problem
The `destinations` array mapped from the API only contains `sequence`, `location`, and `company_name`. The waypoints extraction code filters by `d.latitude && d.longitude`, which always returns empty because those fields were never mapped.

### Solution
Add `latitude` and `longitude` fields to the destinations mapping in all three places where jobs are transformed, and update the TypeScript interface accordingly.

### Technical Details

**File: `src/pages/Home.tsx`**

1. Update the `Job` interface to include coordinates in `destinations`:
```typescript
destinations?: Array<{
  sequence: number;
  location: string;
  company_name?: string;
  latitude?: number;
  longitude?: number;
}>;
```

2. Update the factory jobs mapping (around line 221-225) to include coordinates:
```typescript
destinations: Array.isArray(item.destinations) ? item.destinations.map((d: any, idx: number) => ({
  sequence: d.sequence_number || d.sequence || idx + 1,
  location: ...,
  company_name: d.company_name || '',
  latitude: d.latitude || d.destination_latitude || undefined,
  longitude: d.longitude || d.destination_longitude || undefined,
})) : undefined
```

3. Apply the same change to the freelance/express-rent jobs mapping (around line 377-381).

**File: `src/pages/PickupDetailPage.tsx`**

4. Same fix for the PickupDetailPage waypoints extraction -- the `jobAny.destinations` fields also need the correct property names (`latitude`/`longitude`) which should now be available from the mapped data passed via navigation state or API response.

No changes needed to the Edge Function (`create-tracking-room`) -- it already handles `waypoints` correctly.

