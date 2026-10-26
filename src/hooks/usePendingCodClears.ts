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

  const reload = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    setLoading(true);
    try {
      const s = await fetchCodSummaries(driverId, driverType);
      setAll(s);
      setItems(s.filter((x) => x.canClear).map((x) => x.record));
    } catch { /* keep cache */ }
    setLoading(false);
  }, [driverId, driverType]);

  useEffect(() => { reload(); }, [reload]);

  return { all, items, loading, reload, driverId, driverType };
}
