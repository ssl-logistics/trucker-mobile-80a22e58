import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchPendingCodClears, readPendingCache, type CodClearRecord, type DriverType } from '@/lib/codClear';

export function usePendingCodClears() {
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const driverId = user?.id ? String(user.id) : '';
  const driverType: DriverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
  const [items, setItems] = useState<CodClearRecord[]>(() => (driverId ? readPendingCache(driverId) || [] : []));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    setLoading(true);
    try { setItems(await fetchPendingCodClears(driverId, driverType)); } catch { /* keep cache */ }
    setLoading(false);
  }, [driverId, driverType]);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload, driverId, driverType };
}
