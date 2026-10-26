import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchCodSummaries, readPendingCache, removeFromCodCache, splitCodSummaries, markCleared, type CodClearRecord, type CodSummary, type DriverType } from '@/lib/codClear';

export function usePendingCodClears() {
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const driverId = user?.id ? String(user.id) : '';
  const driverType: DriverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
  const [list, setList] = useState<CodSummary[]>([]);
  const [items, setItems] = useState<CodClearRecord[]>(() => (driverId ? readPendingCache(driverId) || [] : []));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const busy = useRef(false);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const first = !loadedRef.current;
    try {
      const s = await fetchCodSummaries(driverId, driverType, (partial) => { if (first) setList(partial); });
      setList(s);
      setItems(s.filter((x) => x.canClear).map((x) => x.record));
      setFailed(false);
    } catch { setFailed(true); }
    loadedRef.current = true;
    busy.current = false;
    setLoaded(true);
    setLoading(false);
  }, [driverId, driverType]);

  const markOrderCleared = useCallback((orderNumber: string, amount: number, proofUrls: string[]) => {
    setList((a) => a.map((s) => (s.record.order_number === orderNumber ? markCleared(s, amount, proofUrls) : s)));
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

  const { pending, cleared } = splitCodSummaries(list);
  return { all: pending, cleared, items, loading, loaded, failed, reload, markOrderCleared, driverId, driverType };
}
