import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchCodSummaries, mergeCodSummaries, readSummaryCache, readPendingCache, removeFromCodCache, type CodClearRecord, type CodSummary, type DriverType } from '@/lib/codClear';

export function usePendingCodClears() {
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const driverId = user?.id ? String(user.id) : '';
  const driverType: DriverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
  const [all, setAll] = useState<CodSummary[]>(() => (driverId ? readSummaryCache(driverId) || [] : []));
  const [items, setItems] = useState<CodClearRecord[]>(() => (driverId ? readPendingCache(driverId) || [] : []));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(() => !!(driverId && readSummaryCache(driverId)));
  const busy = useRef(false);

  const reload = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const cached = readSummaryCache(driverId) || [];
    try {
      const s = await fetchCodSummaries(driverId, driverType, (partial, checked) => setAll(mergeCodSummaries(cached, partial, checked)));
      setAll(s);
      setItems(s.filter((x) => x.canClear).map((x) => x.record));
      setFailed(false);
    } catch { setFailed(true); setAll(cached); }
    busy.current = false;
    setLoaded(true);
    setLoading(false);
  }, [driverId, driverType]);

  const removeOrder = useCallback((orderNumber: string) => {
    setAll((a) => a.filter((s) => s.record.order_number !== orderNumber));
    setItems((a) => a.filter((r) => r.order_number !== orderNumber));
    if (driverId) removeFromCodCache(driverId, orderNumber);
  }, [driverId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  }, [reload]);

  return { all, items, loading, loaded, failed, reload, removeOrder, driverId, driverType };
}
