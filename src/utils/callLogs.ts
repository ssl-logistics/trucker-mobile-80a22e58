/**
 * Call log utilities
 * Records who called, duration, and type
 */

export interface CallLogEntry {
  id: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  callType: 'incoming' | 'outgoing';
  callResult: 'answered' | 'rejected' | 'missed' | 'ended';
  durationSeconds: number;
  conversationId?: string;
  timestamp: string; // ISO string
}

const CALL_LOGS_KEY_PREFIX = 'call_logs';
const LEGACY_CALL_LOGS_KEY = 'call_logs';
const MAX_LOGS = 100;
const MAX_AGE_DAYS = 30;

/** Get current logged-in user id (driver id) to scope logs per user */
function getCurrentUserId(): string {
  try {
    return (
      localStorage.getItem('auth_driver_id') ||
      localStorage.getItem('auth_user_id') ||
      'guest'
    );
  } catch {
    return 'guest';
  }
}

function getCallLogsKey(): string {
  return `${CALL_LOGS_KEY_PREFIX}:${getCurrentUserId()}`;
}

/** One-time cleanup: delete legacy shared key so it doesn't leak across users */
function clearLegacySharedLogs(): void {
  try {
    if (localStorage.getItem(LEGACY_CALL_LOGS_KEY)) {
      localStorage.removeItem(LEGACY_CALL_LOGS_KEY);
    }
  } catch {
    // ignore
  }
}

/** Remove logs older than 30 days */
function pruneOldLogs(logs: CallLogEntry[]): CallLogEntry[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter(l => new Date(l.timestamp).getTime() >= cutoff);
}

export function saveCallLog(entry: Omit<CallLogEntry, 'id' | 'timestamp'>): void {
  try {
    clearLegacySharedLogs();
    let logs = getCallLogs();
    const newEntry: CallLogEntry = {
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    logs = pruneOldLogs(logs);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    localStorage.setItem(getCallLogsKey(), JSON.stringify(logs));
  } catch (e) {
    console.warn('[CallLog] Failed to save:', e);
  }
}

export function getCallLogs(): CallLogEntry[] {
  try {
    clearLegacySharedLogs();
    const raw = localStorage.getItem(getCallLogsKey());
    if (!raw) return [];
    const logs = JSON.parse(raw) as CallLogEntry[];
    return pruneOldLogs(logs);
  } catch {
    return [];
  }
}

/** Clear current user's call logs (e.g. on logout) */
export function clearCallLogs(): void {
  try {
    localStorage.removeItem(getCallLogsKey());
    clearLegacySharedLogs();
  } catch {
    // ignore
  }
}

export function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} วินาที`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} นาที`;
  return `${m} นาที ${s} วินาที`;
}

export function formatCallTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function formatCallDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}
