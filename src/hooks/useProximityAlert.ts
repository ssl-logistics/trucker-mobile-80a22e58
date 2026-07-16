import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import {
  getDriverAssignedJobs,
  getFreelanceAcceptedJobs,
  getFactoryAssignedJobs,
  getDriverCheckins,
  driverCheckin,
} from '@/lib/externalApi';
import { notifyCheckinWaypoint, ensureRoomCode } from '@/lib/checkinWaypoint';
import { toast } from 'sonner';

const CHECK_INTERVAL_MS = 30_000; // 30 seconds
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const PROXIMITY_THRESHOLD_KM = 1;
const DEPARTURE_THRESHOLD_KM = 1; // trigger departure alert when moving beyond this

// ── Haversine ──────────────────────────────────────────────
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Cooldown helpers ───────────────────────────────────────
function getCooldownKey(orderCode: string, type: 'pickup' | 'delivery', variant: 'approach' | 'departure' = 'approach') {
  return `proximity_alert_${orderCode}_${type}_${variant}`;
}

function isInCooldown(orderCode: string, type: 'pickup' | 'delivery', variant: 'approach' | 'departure' = 'approach'): boolean {
  try {
    const ts = localStorage.getItem(getCooldownKey(orderCode, type, variant));
    if (!ts) return false;
    return Date.now() - Number(ts) < COOLDOWN_MS;
  } catch { return false; }
}

function setCooldown(orderCode: string, type: 'pickup' | 'delivery', variant: 'approach' | 'departure' = 'approach') {
  try {
    localStorage.setItem(getCooldownKey(orderCode, type, variant), String(Date.now()));
  } catch { /* noop */ }
}

// ── wasNear persistence ────────────────────────────────────
const WAS_NEAR_STORAGE_KEY = 'proximity_was_near';

function loadWasNear(): Set<string> {
  try {
    const raw = localStorage.getItem(WAS_NEAR_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* noop */ }
  return new Set();
}

function saveWasNear(set: Set<string>) {
  try {
    localStorage.setItem(WAS_NEAR_STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* noop */ }
}

// ── Auto check-in tracking (per-order, persisted) ──────────
const AUTO_CHECKIN_KEY = (orderCode: string) => `auto_checkin_done_${orderCode}`;
function isAutoCheckinDone(orderCode: string): boolean {
  try { return localStorage.getItem(AUTO_CHECKIN_KEY(orderCode)) === '1'; } catch { return false; }
}
function markAutoCheckinDone(orderCode: string) {
  try { localStorage.setItem(AUTO_CHECKIN_KEY(orderCode), '1'); } catch { /* noop */ }
}

// ── Missing-coords notice (one-shot per order, session) ────
const MISSING_COORDS_KEY = (orderCode: string) => `missing_pickup_coords_notified_${orderCode}`;
function isMissingCoordsNotified(orderCode: string): boolean {
  try { return sessionStorage.getItem(MISSING_COORDS_KEY(orderCode)) === '1'; } catch { return false; }
}
function markMissingCoordsNotified(orderCode: string) {
  try { sessionStorage.setItem(MISSING_COORDS_KEY(orderCode), '1'); } catch { /* noop */ }
}

// ── Point interface ────────────────────────────────────────
interface CheckPoint {
  orderCode: string;
  type: 'pickup' | 'delivery';
  lat: number;
  lng: number;
  /** unique key for dedup & tracking (includes coords for multi-dest) */
  key: string;
}

// ── Send notification ──────────────────────────────────────
async function sendProximityNotification(
  userId: string,
  orderCode: string,
  type: 'pickup' | 'delivery',
  variant: 'approach' | 'departure' = 'approach',
) {
  const isPickup = type === 'pickup';
  const isDeparture = variant === 'departure';

  let title_th: string, title_en: string, description_th: string, description_en: string;

  if (isDeparture) {
    title_th = isPickup
      ? `⚠️ ออกจากจุดรับสินค้า - ${orderCode}`
      : `⚠️ ออกจากจุดส่งสินค้า - ${orderCode}`;
    title_en = isPickup
      ? `⚠️ Left pickup point - ${orderCode}`
      : `⚠️ Left delivery point - ${orderCode}`;
    description_th = isPickup
      ? `คุณออกจากจุดรับสินค้า งาน ${orderCode} โดยยังไม่ได้อัพโหลดหลักฐาน กรุณากลับไปอัพโหลด`
      : `คุณออกจากจุดส่งสินค้า งาน ${orderCode} โดยยังไม่ได้อัพโหลดหลักฐาน กรุณากลับไปอัพโหลด`;
    description_en = isPickup
      ? `You left the pickup point for job ${orderCode} without uploading evidence. Please go back and upload.`
      : `You left the delivery point for job ${orderCode} without uploading evidence. Please go back and upload.`;
  } else {
    title_th = isPickup
      ? `ใกล้จุดรับสินค้า - ${orderCode}`
      : `ใกล้จุดส่งสินค้า - ${orderCode}`;
    title_en = isPickup
      ? `Near pickup point - ${orderCode}`
      : `Near delivery point - ${orderCode}`;
    description_th = isPickup
      ? `คุณอยู่ใกล้จุดรับสินค้า งาน ${orderCode} แล้ว กรุณาอัพโหลดหลักฐาน`
      : `คุณอยู่ใกล้จุดส่งสินค้า งาน ${orderCode} แล้ว กรุณาอัพโหลดหลักฐาน`;
    description_en = isPickup
      ? `You are near the pickup point for job ${orderCode}. Please upload evidence.`
      : `You are near the delivery point for job ${orderCode}. Please upload evidence.`;
  }

  try {
    await supabase.functions.invoke('get-notifications', {
      body: {
        action: 'create_status_notification',
        user_id: userId,
        title_th,
        title_en,
        description_th,
        description_en,
        notification_type: 'proximity_alert',
        reference_type: 'job',
        order_code: orderCode,
        status: isDeparture ? `departure_${type}` : `proximity_${type}`,
      },
    });
    console.log(`[ProximityAlert] Notification sent: ${variant} ${type} for ${orderCode}`);
  } catch (err) {
    console.error('[ProximityAlert] Failed to send notification:', err);
  }
}

// ── Hook ───────────────────────────────────────────────────
export function useProximityAlert() {
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  // Track points the driver was previously near — persisted to localStorage
  const wasNearRef = useRef<Set<string>>(loadWasNear());

  const getDriverType = useCallback((): 'internal' | 'external' | 'freelance' => {
    if (isInternalDriver) return 'internal';
    if (isExternalDriver) return 'external';
    return 'freelance';
  }, [isInternalDriver, isExternalDriver]);

  const check = useCallback(async () => {
    if (!user?.id || runningRef.current) return;
    runningRef.current = true;

    try {
      // 1. Get current position
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000,
        }),
      );
      const myLat = pos.coords.latitude;
      const myLng = pos.coords.longitude;

      // 2. Load current jobs
      const driverType = getDriverType();
      let jobs: any[] = [];

      if (driverType === 'internal' || driverType === 'external') {
        const { data } = await getDriverAssignedJobs(user.id, driverType, 50, 'in_progress');
        jobs = (data as any)?.data || [];
      } else {
        const [freelanceRes, factoryRes] = await Promise.all([
          getFreelanceAcceptedJobs(user.id),
          getFactoryAssignedJobs(user.id),
        ]);
        const freelanceJobs = (freelanceRes.data as any)?.data || [];
        const factoryJobs = (factoryRes.data as any)?.data || [];
        jobs = [...freelanceJobs, ...factoryJobs];
      }

      if (!jobs.length) { runningRef.current = false; return; }

      // 2.5 Auto Check-in: ตรวจสอบจุดรับสินค้าจุดแรกของแต่ละงาน
      // - ถ้าไม่มีพิกัด → แจ้ง toast ให้คนขับเช็คอินเอง
      // - ถ้ามีพิกัดและอยู่ใกล้ ≤ 1 กม. → ทำ auto check-in
      for (const job of jobs) {
        const orderCode = job.order_number || job.order_code || '';
        if (!orderCode) continue;
        if (isAutoCheckinDone(orderCode)) continue;

        // Check ว่ามี pickup checkin อยู่แล้วใน DB หรือไม่ (กันซ้ำข้ามอุปกรณ์)
        const { data: checkinResult } = await getDriverCheckins(user.id, driverType, orderCode);
        const checkins: any[] = (checkinResult as any)?.data || checkinResult || [];
        const alreadyPickedUp = Array.isArray(checkins) && checkins.some((c: any) => {
          const matchesOrder = c.order_number === orderCode || c.transport_orders?.order_number === orderCode;
          return matchesOrder && c.checkin_type === 'pickup';
        });
        if (alreadyPickedUp) {
          markAutoCheckinDone(orderCode);
          continue;
        }

        // ดึงพิกัดจุดรับสินค้าจุดแรก
        const sLat = Number(job.sender_latitude ?? job.origin_latitude);
        const sLng = Number(job.sender_longitude ?? job.origin_longitude);
        const hasPickupCoords = !!(sLat && sLng && !Number.isNaN(sLat) && !Number.isNaN(sLng));

        if (!hasPickupCoords) {
          // กรณีไม่มีพิกัดจากจุดรับสินค้า → แจ้งให้เช็คอินเอง (one-shot per session)
          if (!isMissingCoordsNotified(orderCode)) {
            toast.warning('ไม่มีพิกัดจากจุดรับสินค้า', {
              description: `งาน ${orderCode} กรุณาเช็คอินที่จุดรับสินค้าด้วยตนเอง`,
              duration: 8000,
            });
            markMissingCoordsNotified(orderCode);
          }
          continue;
        }

        const distToPickup = haversineDistance(myLat, myLng, sLat, sLng);
        if (distToPickup <= PROXIMITY_THRESHOLD_KM) {
          try {
            await driverCheckin({
              order_number: orderCode,
              driver_id: user.id,
              driver_type: driverType,
              checkin_type: 'pickup',
              latitude: myLat,
              longitude: myLng,
              notes: 'Auto check-in (ภายในระยะ 1 กม. จากจุดรับสินค้า)',
            });
            markAutoCheckinDone(orderCode);
            toast.success('เช็คอินจุดรับสินค้าอัตโนมัติ', {
              description: `งาน ${orderCode} (ระยะ ${distToPickup.toFixed(2)} กม.)`,
              duration: 6000,
            });
            console.log(`[AutoCheckin] Done for ${orderCode} at ${distToPickup.toFixed(2)} km`);

            // Notify external waypoint tracker (fire-and-forget)
            // Booking (outbound) pickup = seq 2, otherwise seq 1
            try {
              const roomCode = await ensureRoomCode({
                orderCode,
                truckPlate: job.truck_plate || job.plate_number || null,
                originLat: sLat,
                originLng: sLng,
                destinationLat: Number(job.destination_latitude) || null,
                destinationLng: Number(job.destination_longitude) || null,
                currentLat: myLat,
                currentLng: myLng,
                driverId: user.id,
                context: 'proximity-auto-pickup',
              });
              if (roomCode) {
                const seq = job.booking_no ? 2 : 1;
                notifyCheckinWaypoint({ room_code: roomCode, sequence_order: seq });
              }
            } catch (wpErr) {
              console.warn('[AutoCheckin] waypoint notify failed:', wpErr);
            }
          } catch (e) {
            console.error('[AutoCheckin] Failed:', e);
          }
        }
      }

      // 3. Build check-points from jobs (with unique key including coords)
      const points: CheckPoint[] = [];

      for (const job of jobs) {
        const orderCode = job.order_number || job.order_code || '';
        if (!orderCode) continue;

        // Pickup point
        const sLat = Number(job.sender_latitude ?? job.origin_latitude);
        const sLng = Number(job.sender_longitude ?? job.origin_longitude);
        if (sLat && sLng) {
          points.push({ orderCode, type: 'pickup', lat: sLat, lng: sLng, key: `${orderCode}_pickup_${sLat.toFixed(4)}_${sLng.toFixed(4)}` });
        }

        // Delivery point(s)
        const dLat = Number(job.destination_latitude);
        const dLng = Number(job.destination_longitude);
        if (dLat && dLng) {
          points.push({ orderCode, type: 'delivery', lat: dLat, lng: dLng, key: `${orderCode}_delivery_${dLat.toFixed(4)}_${dLng.toFixed(4)}` });
        }

        // Multi-destination
        const dests: any[] = job.destinations || [];
        for (const d of dests) {
          const dlat = Number(d.latitude ?? d.destination_latitude);
          const dlng = Number(d.longitude ?? d.destination_longitude);
          if (dlat && dlng) {
            points.push({ orderCode, type: 'delivery', lat: dlat, lng: dlng, key: `${orderCode}_delivery_${dlat.toFixed(4)}_${dlng.toFixed(4)}` });
          }
        }
      }

      if (!points.length) { runningRef.current = false; return; }

      // 4. Deduplicate by unique key (coords-based, so multi-dest points are kept)
      const uniquePoints = points.filter(
        (p, i, arr) => arr.findIndex((q) => q.key === p.key) === i,
      );

      // 5. Classify each point as near or far
      const currentlyNear = new Set<string>();
      const nearPoints: CheckPoint[] = [];
      const departedPoints: CheckPoint[] = [];

      for (const p of uniquePoints) {
        const dist = haversineDistance(myLat, myLng, p.lat, p.lng);

        if (dist <= PROXIMITY_THRESHOLD_KM) {
          currentlyNear.add(p.key);
          nearPoints.push(p);
        } else if (dist > DEPARTURE_THRESHOLD_KM && wasNearRef.current.has(p.key)) {
          // Driver was near but now moved away
          departedPoints.push(p);
        }
      }

      // 6. Handle approach alerts
      for (const point of nearPoints) {
        if (isInCooldown(point.orderCode, point.type, 'approach')) continue;

        const { data: checkinResult } = await getDriverCheckins(user.id, driverType, point.orderCode);
        const checkins: any[] = (checkinResult as any)?.data || checkinResult || [];

        const relevantCheckins = Array.isArray(checkins)
          ? checkins.filter((c: any) => {
              const matchesOrder =
                c.order_number === point.orderCode ||
                c.transport_orders?.order_number === point.orderCode;
              return matchesOrder;
            })
          : [];

        let hasEvidence = false;
        if (point.type === 'pickup') {
          hasEvidence = relevantCheckins.some((c: any) => c.checkin_type === 'pickup');
        } else {
          hasEvidence = relevantCheckins.some(
            (c: any) => c.checkin_type === 'delivery' || c.checkin_type === 'delivery_confirmed',
          );
        }

        if (!hasEvidence) {
          await sendProximityNotification(user.id, point.orderCode, point.type, 'approach');
          setCooldown(point.orderCode, point.type, 'approach');
        }
      }

      // 7. Handle departure alerts
      for (const point of departedPoints) {
        if (isInCooldown(point.orderCode, point.type, 'departure')) continue;

        const { data: checkinResult } = await getDriverCheckins(user.id, driverType, point.orderCode);
        const checkins: any[] = (checkinResult as any)?.data || checkinResult || [];

        const relevantCheckins = Array.isArray(checkins)
          ? checkins.filter((c: any) => {
              const matchesOrder =
                c.order_number === point.orderCode ||
                c.transport_orders?.order_number === point.orderCode;
              return matchesOrder;
            })
          : [];

        let hasEvidence = false;
        if (point.type === 'pickup') {
          hasEvidence = relevantCheckins.some((c: any) => c.checkin_type === 'pickup');
        } else {
          hasEvidence = relevantCheckins.some(
            (c: any) => c.checkin_type === 'delivery' || c.checkin_type === 'delivery_confirmed',
          );
        }

        if (!hasEvidence) {
          await sendProximityNotification(user.id, point.orderCode, point.type, 'departure');
          setCooldown(point.orderCode, point.type, 'departure');
        }
      }

      // 8. Update wasNear tracking (persist to localStorage)
      wasNearRef.current = currentlyNear;
      saveWasNear(currentlyNear);

    } catch (err) {
      console.warn('[ProximityAlert] Check failed:', err);
    } finally {
      runningRef.current = false;
    }
  }, [user, getDriverType]);

  useEffect(() => {
    if (!user?.id) return;
    if (!('geolocation' in navigator)) return;

    // Run once immediately, then on interval
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, check]);
}
