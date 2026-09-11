import { useLocation } from 'react-router-dom';

/**
 * Central helper to detect "opened from job history" (read-only) mode.
 * Reads both the `?from=history` query param and the navigation state,
 * so the flag survives multi-level navigation.
 */
export function isHistoryContext(search: string, state: any): boolean {
  try {
    if (new URLSearchParams(search).get('from') === 'history') return true;
  } catch {
    // ignore malformed search strings
  }
  const s = state as any;
  if (!s) return false;
  return s.fromHistory === true || s.from === 'history';
}

export function useHistoryMode(): boolean {
  const location = useLocation();
  return isHistoryContext(location.search, location.state);
}
