/**
 * Call log utilities — DB-backed (Lovable Cloud)
 * Stored in `call_logs` table, scoped per driver_id.
 */
import { supabase } from '@/integrations/supabase/client';

export interface CallLogEntry {
  id: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  callType: 'incoming' | 'outgoing';
  callResult: 'answered' | 'rejected' | 'missed' | 'ended';
  durationSeconds: number;
  conversationId?: string;
  timestamp: string; // ISO string (created_at)
}

const MAX_LOGS = 200;

/** Get current logged-in user id (driver id) to scope logs per user */
function getCurrentUserId(): string | null {
  try {
    return (
      localStorage.getItem('auth_driver_id') ||
      localStorage.getItem('auth_user_id') ||
      null
    );
  } catch {
    return null;
  }
}

interface CallLogRow {
  id: string;
  driver_id: string;
  peer_id: string;
  peer_name: string;
  peer_avatar: string | null;
  call_type: 'incoming' | 'outgoing';
  call_result: 'answered' | 'rejected' | 'missed' | 'ended';
  duration_seconds: number;
  conversation_id: string | null;
  created_at: string;
}

function rowToEntry(row: CallLogRow): CallLogEntry {
  return {
    id: row.id,
    peerId: row.peer_id,
    peerName: row.peer_name,
    peerAvatar: row.peer_avatar,
    callType: row.call_type,
    callResult: row.call_result,
    durationSeconds: row.duration_seconds,
    conversationId: row.conversation_id || undefined,
    timestamp: row.created_at,
  };
}

/** Save a call log entry to DB (fire-and-forget) */
export async function saveCallLog(entry: Omit<CallLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const driverId = getCurrentUserId();
  if (!driverId) {
    console.warn('[CallLog] No driver_id — skipping save');
    return;
  }
  try {
    const { error } = await (supabase as any)
      .from('call_logs')
      .insert({
        driver_id: driverId,
        peer_id: entry.peerId,
        peer_name: entry.peerName,
        peer_avatar: entry.peerAvatar ?? null,
        call_type: entry.callType,
        call_result: entry.callResult,
        duration_seconds: entry.durationSeconds,
        conversation_id: entry.conversationId ?? null,
      });
    if (error) console.warn('[CallLog] Failed to save:', error);
  } catch (e) {
    console.warn('[CallLog] Save exception:', e);
  }
}

/** Fetch call logs for the current driver (most recent first) */
export async function getCallLogs(): Promise<CallLogEntry[]> {
  const driverId = getCurrentUserId();
  if (!driverId) return [];
  try {
    const { data, error } = await (supabase as any)
      .from('call_logs')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(MAX_LOGS);
    if (error) {
      console.warn('[CallLog] Failed to load:', error);
      return [];
    }
    return (data as CallLogRow[] | null)?.map(rowToEntry) ?? [];
  } catch (e) {
    console.warn('[CallLog] Load exception:', e);
    return [];
  }
}

/** Clear current driver's call logs (e.g. on logout) */
export async function clearCallLogs(): Promise<void> {
  const driverId = getCurrentUserId();
  if (!driverId) return;
  try {
    await (supabase as any).from('call_logs').delete().eq('driver_id', driverId);
  } catch (e) {
    console.warn('[CallLog] Clear exception:', e);
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
