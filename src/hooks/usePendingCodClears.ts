import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchCodSummaries, readSummaryCache, readPendingCache, type CodClearRecord, type CodSummary, type DriverType } from '@/lib/codClear';

export function usePendingCodClears() {
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const driverId = user?.id ? String(user.id) : '';
  const driverType: DriverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
  const [all, setAll] = useState<CodSummary[]>(() => (driverId ? readSummaryCache(driverId) || [] : []));
  const [items, setItems] = useState<CodClearRecord[]>(() => (driverId ? readPendingCache(driverId) || [] : []));
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(() => !!(driverId && readSummaryCache(driverId)));

  const reload = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    setLoading(true);
    const hadCache = !!readSummaryCache(driverId);
    try {
      const s = await fetchCodSummaries(driverId, driverType, (partial) => { if (!hadCache) setAll(partial); });
      setAll(s);
      setItems(s.filter((x) => x.canClear).map((x) => x.record));
    } catch { /* keep cache */ }
    setLoaded(true);
    setLoading(false);
  }, [driverId, driverType]);

  useEffect(() => { reload(); }, [reload]);

  return { all, items, loading, loaded, reload, driverId, driverType };
}
