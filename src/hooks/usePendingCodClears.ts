import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchCodSummaries, readPendingCache, removeFromCodCache, splitCodSummaries, markCleared, type CodClearRecord, type CodSummary, type DriverType } from '@/lib/codClear';

const LIST_KEY = 'cod_summary_list_v1';
let mem: { driverId: string; list: CodSummary[]; at: number } | null = null;
function readList(driverId: string): CodSummary[] {
  if (mem?.driverId === driverId) return mem.list;
  try { const c = JSON.parse(localStorage.getItem(LIST_KEY) || 'null'); if (c?.driverId === driverId) { mem = { driverId, list: c.list, at: 0 }; return c.list; } } catch { /* noop */ }
  return [];
}
function saveList(driverId: string, list: CodSummary[], fresh = true) {
  mem = { driverId, list, at: fresh ? Date.now() : (mem?.at || 0) };
  try { localStorage.setItem(LIST_KEY, JSON.stringify({ driverId, list })); } catch { /* noop */ }
}

export function usePendingCodClears(opts: { alwaysFresh?: boolean } = {}) {
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const driverId = user?.id ? String(user.id) : '';
  const driverType: DriverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
  const [list, setList] = useState<CodSummary[]>(() => (driverId ? readList(driverId) : []));
  const [items, setItems] = useState<CodClearRecord[]>(() => (driverId ? readPendingCache(driverId) || [] : []));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const busy = useRef(false);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    if (busy.current) return;
    if (!opts.alwaysFresh && mem?.driverId === driverId && Date.now() - mem.at < 60000) {
      setList(mem.list); setLoaded(true); setLoading(false); return;
    }
    busy.current = true;
    setLoading(true);
    const first = !loadedRef.current;
    try {
      const s = await fetchCodSummaries(driverId, driverType, (partial) => { if (first && !readList(driverId).length) setList(partial); });
      setList(s); saveList(driverId, s);
      setItems(s.filter((x) => x.canClear).map((x) => x.record));
      setFailed(false);
    } catch { setFailed(true); }
    loadedRef.current = true;
    busy.current = false;
    setLoaded(true);
    setLoading(false);
  }, [driverId, driverType, opts.alwaysFresh]);

  const markOrderCleared = useCallback((orderNumber: string, amount: number, proofUrls: string[]) => {
    setList((a) => { const n = a.map((s) => (s.record.order_number === orderNumber ? markCleared(s, amount, proofUrls) : s)); if (driverId) saveList(driverId, n, false); return n; });
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
