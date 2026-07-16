/**
 * Notify external waypoint tracker that a checkpoint has been checked in.
 * Fire-and-forget POST to the external Supabase edge function.
 */
const CHECKIN_WAYPOINT_URL =
  'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/checkin-waypoint';

export interface CheckinWaypointPayload {
  room_code: string;
  sequence_order: number;
}

export function notifyCheckinWaypoint(payload: CheckinWaypointPayload): void {
  if (!payload.room_code || !payload.sequence_order) {
    console.warn('[checkin-waypoint] Skipped, missing data:', payload);
    return;
  }

  fetch(CHECKIN_WAYPOINT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('[checkin-waypoint] Non-OK response:', res.status, text);
      } else {
        console.log('[checkin-waypoint] Sent:', payload);
      }
    })
    .catch((err) => {
      console.warn('[checkin-waypoint] Request failed:', err);
    });
}
