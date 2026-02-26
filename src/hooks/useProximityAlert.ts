import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import {
  getDriverAssignedJobs,
  getFreelanceAcceptedJobs,
  getFactoryAssignedJobs,
  getDriverCheckins,
} from '@/lib/externalApi';

const CHECK_INTERVAL_MS = 30_000; // 30 seconds
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const PROXIMITY_THRESHOLD_KM = 1;

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
function getCooldownKey(orderCode: string, type: 'pickup' | 'delivery') {
  return `proximity_alert_${orderCode}_${type}`;
}

function isInCooldown(orderCode: string, type: 'pickup' | 'delivery'): boolean {
  try {
    const ts = localStorage.getItem(getCooldownKey(orderCode, type));
    if (!ts) return false;
    return Date.now() - Number(ts) < COOLDOWN_MS;
  } catch { return false; }
}

function setCooldown(orderCode: string, type: 'pickup' | 'delivery') {
  try {
    localStorage.setItem(getCooldownKey(orderCode, type), String(Date.now()));
  } catch { /* noop */ }
}

// ── Point interface ────────────────────────────────────────
interface CheckPoint {
  orderCode: string;
  type: 'pickup' | 'delivery';
  lat: number;
  lng: number;
}

// ── Send notification ──────────────────────────────────────
async function sendProximityNotification(
  userId: string,
  orderCode: string,
  type: 'pickup' | 'delivery',
) {
  const isPickup = type === 'pickup';
  const title_th = isPickup
    ? `ใกล้จุดรับสินค้า - ${orderCode}`
    : `ใกล้จุดส่งสินค้า - ${orderCode}`;
  const title_en = isPickup
    ? `Near pickup point - ${orderCode}`
    : `Near delivery point - ${orderCode}`;
  const description_th = isPickup
    ? `คุณอยู่ใกล้จุดรับสินค้า งาน ${orderCode} แล้ว กรุณาอัพโหลดหลักฐาน`
    : `คุณอยู่ใกล้จุดส่งสินค้า งาน ${orderCode} แล้ว กรุณาอัพโหลดหลักฐาน`;
  const description_en = isPickup
    ? `You are near the pickup point for job ${orderCode}. Please upload evidence.`
    : `You are near the delivery point for job ${orderCode}. Please upload evidence.`;

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
        status: `proximity_${type}`,
      },
    });
    console.log(`[ProximityAlert] Notification sent: ${type} for ${orderCode}`);
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

      // 3. Build check-points from jobs
      const points: CheckPoint[] = [];

      for (const job of jobs) {
        const orderCode = job.order_number || job.order_code || '';
        if (!orderCode) continue;

        // Pickup point
        const sLat = Number(job.sender_latitude ?? job.origin_latitude);
        const sLng = Number(job.sender_longitude ?? job.origin_longitude);
        if (sLat && sLng) {
          points.push({ orderCode, type: 'pickup', lat: sLat, lng: sLng });
        }

        // Delivery point(s)
        const dLat = Number(job.destination_latitude);
        const dLng = Number(job.destination_longitude);
        if (dLat && dLng) {
          points.push({ orderCode, type: 'delivery', lat: dLat, lng: dLng });
        }

        // Multi-destination
        const dests: any[] = job.destinations || [];
        for (const d of dests) {
          const dlat = Number(d.latitude ?? d.destination_latitude);
          const dlng = Number(d.longitude ?? d.destination_longitude);
          if (dlat && dlng) {
            points.push({ orderCode, type: 'delivery', lat: dlat, lng: dlng });
          }
        }
      }

      if (!points.length) { runningRef.current = false; return; }

      // 4. Filter to nearby points (within threshold)
      const nearby = points.filter(
        (p) => haversineDistance(myLat, myLng, p.lat, p.lng) <= PROXIMITY_THRESHOLD_KM,
      );

      if (!nearby.length) { runningRef.current = false; return; }

      // 5. Deduplicate by orderCode+type
      const uniqueNearby = nearby.filter(
        (p, i, arr) => arr.findIndex((q) => q.orderCode === p.orderCode && q.type === p.type) === i,
      );

      // 6. For each nearby point, check checkin status and send alert if needed
      for (const point of uniqueNearby) {
        if (isInCooldown(point.orderCode, point.type)) continue;

        // Fetch checkin status for this order
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
          await sendProximityNotification(user.id, point.orderCode, point.type);
          setCooldown(point.orderCode, point.type);
        }
      }
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
