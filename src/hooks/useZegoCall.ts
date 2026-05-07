/**
 * ZegoCloud Voice Call Hook (Polling-based signaling)
 * 
 * Polls GET /call-signal for incoming calls, fetches ZegoCloud token
 * from GET /zegocloud-token, and responds via PATCH /call-signal.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { callExternalApi } from '@/lib/externalApi';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { saveCallLog } from '@/utils/callLogs';

const CALL_SIGNAL_BASE_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
const CALL_SIGNAL_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
  apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Zmt3ZXd0ZXhueXNrYmtnc3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NjA0OTQsImV4cCI6MjA1NjEzNjQ5NH0.MOkMINVTOGzXENJn9OKU2kXqqDOzGKAl1el1b8RCzoI',
} as const;

// Module-level kill switch: once the endpoint reports disabled/maintenance,
// stop polling for the rest of the session to avoid spamming 503s and
// triggering the runtime-error overlay repeatedly.
let callSignalDisabled = false;

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallSignal {
  id?: string;
  signal_id?: string;
  room_id: string;
  caller_id?: string;
  caller_user_id?: string;
  caller_name: string;
  caller_avatar?: string | null;
  conversation_id?: string;
}

interface CallInfo {
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  conversationId?: string;
  signalId?: string;
}

interface UseZegoCallReturn {
  callState: CallState;
  callInfo: CallInfo | null;
  isMuted: boolean;
  callDuration: number;
  startCall: (peerId: string, peerName: string, peerAvatar?: string | null, conversationId?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  endCall: () => void;
  rejectCall: () => void;
  toggleMute: () => void;
}

export function useZegoCall(currentUserId: string | null, driverType: string = 'freelance'): UseZegoCallReturn {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const zegoEngineRef = useRef<ZegoExpressEngine | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const handledSignalIdsRef = useRef<Set<string>>(new Set());
  const callTypeRef = useRef<'incoming' | 'outgoing'>('outgoing');
  const callStartTimeRef = useRef<number | null>(null);
  // Cache the ZegoCloud token to avoid double-fetch within the same call session
  const tokenCacheRef = useRef<{ token: string; appId: number; userId: string; fetchedAt: number } | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Fetch ZegoCloud token (cached for 30 minutes per user to avoid duplicate API calls)
  const fetchToken = useCallback(async (userId: string): Promise<{ token: string; appId: number } | null> => {
    const cached = tokenCacheRef.current;
    if (cached && cached.userId === userId && Date.now() - cached.fetchedAt < 30 * 60 * 1000) {
      return { token: cached.token, appId: cached.appId };
    }
    try {
      const { data, error } = await callExternalApi<{ token: string; appId: number }>('zegocloud-token', {
        method: 'GET',
        params: { driver_id: userId },
      });
      if (error || !data) {
        console.error('[Zego] Token fetch error:', error);
        return null;
      }
      tokenCacheRef.current = { token: data.token, appId: data.appId, userId, fetchedAt: Date.now() };
      return data;
    } catch (e) {
      console.error('[Zego] Token fetch exception:', e);
      return null;
    }
  }, []);

  // Initialize ZegoCloud engine
  const initEngine = useCallback(async (): Promise<ZegoExpressEngine | null> => {
    if (zegoEngineRef.current) return zegoEngineRef.current;
    if (!currentUserId) return null;

    const tokenData = await fetchToken(currentUserId);
    if (!tokenData) return null;

    try {
      const zg = new ZegoExpressEngine(tokenData.appId, 'wss://webliveroom-api.zego.im/ws');
      zegoEngineRef.current = zg;

      zg.on('roomStreamUpdate', async (_roomID, updateType, streamList) => {
        if (updateType === 'ADD') {
          for (const stream of streamList) {
            console.log('[Zego] New remote stream:', stream.streamID);
            const remoteStream = await zg.startPlayingStream(stream.streamID);
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            audio.play().catch(console.warn);
          }
        } else if (updateType === 'DELETE') {
          console.log('[Zego] Remote stream removed — peer hung up');
          if (callStateRef.current === 'connected' || callStateRef.current === 'calling') {
            setCallState('ended');
            setTimeout(() => cleanup(), 2000);
          }
        }
      });

      zg.on('roomUserUpdate', (_roomID, updateType, userList) => {
        if (updateType === 'DELETE' && userList.length > 0) {
          console.log('[Zego] Remote user left room:', userList.map(u => u.userID));
          if (callStateRef.current === 'connected' || callStateRef.current === 'calling') {
            setCallState('ended');
            setTimeout(() => cleanup(), 2000);
          }
        }
      });

      zg.on('roomStateChanged', (_roomID, reason) => {
        const failReasons = ['LOGOUT', 'RECONNECT_FAILED', 'KICK_OUT', 'LOGOUT_FAILED'];
        if (failReasons.includes(String(reason))) {
          setCallState('ended');
          setTimeout(() => cleanup(), 2000);
        }
      });

      return zg;
    } catch (e) {
      console.error('[Zego] Engine init error:', e);
      return null;
    }
  }, [currentUserId, fetchToken]);

  // Join ZegoCloud room
  const joinRoom = useCallback(async (roomId: string): Promise<boolean> => {
    if (!currentUserId) return false;

    const zg = await initEngine();
    if (!zg) return false;

    const tokenData = await fetchToken(currentUserId);
    if (!tokenData) return false;

    try {
      await zg.loginRoom(roomId, tokenData.token, {
        userID: currentUserId,
        userName: currentUserId,
      });
      console.log('[Zego] Joined room:', roomId);
      currentRoomIdRef.current = roomId;

      const localStream = await zg.createStream({ camera: { video: false, audio: true } });
      localStreamRef.current = localStream;
      await zg.startPublishingStream(`${currentUserId}_audio`, localStream);
      console.log('[Zego] Publishing audio stream');

      return true;
    } catch (e) {
      console.error('[Zego] Join room error:', e);
      return false;
    }
  }, [currentUserId, initEngine, fetchToken]);

  // Cleanup resources
  const cleanup = useCallback(() => {
    console.log('[Zego] Cleaning up...');

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (zegoEngineRef.current && currentRoomIdRef.current) {
      try {
        if (localStreamRef.current) {
          zegoEngineRef.current.destroyStream(localStreamRef.current);
          localStreamRef.current = null;
        }
        zegoEngineRef.current.stopPublishingStream(`${currentUserId}_audio`);
        zegoEngineRef.current.logoutRoom(currentRoomIdRef.current);
      } catch (e) {
        console.warn('[Zego] Cleanup error:', e);
      }
      currentRoomIdRef.current = null;
    }

    if (zegoEngineRef.current) {
      zegoEngineRef.current = null;
    }

    setCallDuration(0);
    setIsMuted(false);
    setCallState('idle');
    setCallInfo(null);
  }, [currentUserId]);

  // Send signal response via GET with action param
  const sendSignalResponse = useCallback(async (signalId: string, responseType: 'accepted' | 'rejected' | 'ended') => {
    if (!currentUserId) return;

    handledSignalIdsRef.current.add(signalId);
    if (handledSignalIdsRef.current.size > 300) {
      handledSignalIdsRef.current.clear();
      handledSignalIdsRef.current.add(signalId);
    }

    const actionMap: Record<string, string> = { accepted: 'accept', rejected: 'reject', ended: 'end' };
    const action = actionMap[responseType] || responseType;

    try {
      const params = new URLSearchParams({
        driver_id: currentUserId,
        driver_type: driverType,
        action,
        signal_id: signalId,
      });
      const res = await fetch(`${CALL_SIGNAL_BASE_URL}/call-signal?${params}`, {
        headers: CALL_SIGNAL_HEADERS,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Zego] Signal response error:', errText || `HTTP ${res.status}`);
      }
    } catch (e) {
      console.error('[Zego] Signal response exception:', e);
    }
  }, [currentUserId, driverType]);

  // Start outgoing call (still uses signaling for outbound - caller side)
  const startCall = useCallback(async (
    peerId: string,
    peerName: string,
    peerAvatar?: string | null,
    conversationId?: string
  ) => {
    if (!currentUserId) {
      console.error('[Zego] Cannot start call - currentUserId is null');
      return;
    }
    console.log('[Zego] Starting call to', peerId);

    setCallInfo({ peerId, peerName, peerAvatar, conversationId });
    setCallState('calling');
    callTypeRef.current = 'outgoing';

    // For outgoing calls, we still need to signal the peer
    // The external system should handle creating the call-signal for the peer
    // For now, just join the room and wait
    const roomId = `call_${[currentUserId, peerId].sort().map(id => id.replace(/-/g, '').substring(0, 8)).join('_')}`;

    const joined = await joinRoom(roomId);
    if (!joined) {
      console.error('[Zego] Failed to join room');
      cleanup();
      return;
    }
  }, [currentUserId, joinRoom, cleanup]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!currentUserId || !callInfo) return;
    console.log('[Zego] Accepting call from', callInfo.peerId);

    // Send accepted response
    if (callInfo.signalId) {
      await sendSignalResponse(callInfo.signalId, 'accepted');
    }

    // Use room_id from the signal (stored in currentRoomIdRef during polling)
    const roomId = currentRoomIdRef.current || `call_${[currentUserId, callInfo.peerId].sort().map(id => id.replace(/-/g, '').substring(0, 8)).join('_')}`;
    console.log('[Zego] Joining room:', roomId);
    const joined = await joinRoom(roomId);
    if (!joined) {
      console.error('[Zego] Failed to join room on accept');
      cleanup();
      return;
    }

    setCallState('connected');
    callStartTimeRef.current = Date.now();
    // Start duration timer
    const start = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, [currentUserId, callInfo, joinRoom, cleanup, sendSignalResponse]);

  // End call
  const endCall = useCallback(() => {
    console.log('[Zego] Ending call');

    // Save call log
    if (callInfo) {
      const duration = callStartTimeRef.current
        ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
        : 0;
      saveCallLog({
        peerId: callInfo.peerId,
        peerName: callInfo.peerName,
        peerAvatar: callInfo.peerAvatar,
        callType: callTypeRef.current,
        callResult: duration > 0 ? 'answered' : 'ended',
        durationSeconds: duration,
        conversationId: callInfo.conversationId,
      });
      callStartTimeRef.current = null;
    }

    if (callInfo?.signalId) {
      sendSignalResponse(callInfo.signalId, 'ended');
    }

    setCallState('ended');
    setTimeout(() => cleanup(), 2000);
  }, [callInfo, cleanup, sendSignalResponse]);

  // Reject call
  const rejectCall = useCallback(() => {
    console.log('[Zego] Rejecting call');

    // Save rejected call log
    if (callInfo) {
      saveCallLog({
        peerId: callInfo.peerId,
        peerName: callInfo.peerName,
        peerAvatar: callInfo.peerAvatar,
        callType: 'incoming',
        callResult: 'rejected',
        durationSeconds: 0,
        conversationId: callInfo.conversationId,
      });
    }

    if (callInfo?.signalId) {
      sendSignalResponse(callInfo.signalId, 'rejected');
    }

    cleanup();
  }, [callInfo, cleanup, sendSignalResponse]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Poll for call status when in active call (connected/calling/ringing)
  useEffect(() => {
    if (!currentUserId) return;

    const activeSignalId = callInfo?.signalId;
    const state = callState;

    // Only poll status when we have an active call with a signal ID
    if (!activeSignalId || (state !== 'connected' && state !== 'calling' && state !== 'ringing')) return;

    const pollCallStatus = async () => {
      try {
        const params = new URLSearchParams({
          action: 'check_status',
          signal_id: activeSignalId,
          driver_id: currentUserId,
          driver_type: driverType,
        });
        const res = await fetch(`${CALL_SIGNAL_BASE_URL}/call-signal?${params}`, {
          headers: CALL_SIGNAL_HEADERS,
        });
        if (!res.ok) return;

        const result = await res.json() as { signal_id: string; is_ended: boolean; signal_type: string; status: string };
        if (result?.is_ended) {
          console.log('[Zego] Remote ended detected via check_status:', result);
          setCallState('ended');
          setTimeout(() => cleanup(), 2000);
        }
      } catch {
        // Silently ignore
      }
    };

    // Poll quickly so the mobile side hangs up promptly when the web peer ends the call
    pollCallStatus();
    const interval = setInterval(pollCallStatus, 3000);
    return () => clearInterval(interval);
  }, [currentUserId, driverType, callState, callInfo?.signalId, cleanup]);

  // Poll for incoming call signals when idle (fallback until push notifications are reliable)
  // Tuned to be lightweight: 20s base interval, exponential backoff on 503/disabled,
  // skipped when tab hidden, and uses adaptive timeout for handling maintenance windows.
  useEffect(() => {
    if (!currentUserId) return;
    // Only poll when idle — no active call
    if (callState !== 'idle') return;
    // Endpoint already known to be disabled this session — don't even start
    if (callSignalDisabled) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 20000; // start at 20s
    const MIN_INTERVAL = 20000;   // 20s normal
    const MAX_BACKOFF = 300000;   // cap at 5 minutes when endpoint is unhealthy

    const schedule = (ms: number) => {
      if (!active || callSignalDisabled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(pollIncoming, ms);
    };

    const pollIncoming = async () => {
      if (!active || callSignalDisabled) return;
      // Skip when page is hidden — saves DB load + battery
      if (document.visibilityState === 'hidden') {
        schedule(MIN_INTERVAL);
        return;
      }

      try {
        const params = new URLSearchParams({
          driver_id: currentUserId,
          driver_type: driverType,
        });
        const res = await fetch(`${CALL_SIGNAL_BASE_URL}/call-signal?${params}`, {
          headers: CALL_SIGNAL_HEADERS,
        });

        if (!active) return;

        // Endpoint disabled (503) → check body; if explicitly disabled, kill polling for the session
        if (res.status === 503) {
          const body = await res.json().catch(() => null);
          if (body?.disabled) {
            console.warn('[Zego] /call-signal disabled by server — stopping polling for this session');
            callSignalDisabled = true;
            return;
          }
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF);
          schedule(backoffMs);
          return;
        }

        if (res.status === 429) {
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF);
          schedule(backoffMs);
          return;
        }

        if (!res.ok) {
          schedule(MIN_INTERVAL);
          return;
        }

        const data = await res.json().catch(() => null);

        // Server explicitly says it's off — kill polling for the session
        if (data?.disabled) {
          console.warn('[Zego] /call-signal reports disabled — stopping polling for this session');
          callSignalDisabled = true;
          return;
        }

        // Healthy response — reset backoff
        backoffMs = MIN_INTERVAL;

        if (!data?.signal_id || !data?.room_id) {
          schedule(MIN_INTERVAL);
          return;
        }

        // Skip already-handled signals
        if (handledSignalIdsRef.current.has(data.signal_id)) {
          schedule(MIN_INTERVAL);
          return;
        }

        console.log('[Zego] Incoming call signal via poll:', data.signal_id);
        handledSignalIdsRef.current.add(data.signal_id);

        const signal: CallSignal = {
          id: data.signal_id,
          signal_id: data.signal_id,
          room_id: data.room_id,
          caller_id: data.caller_id || data.caller_user_id,
          caller_user_id: data.caller_user_id || data.caller_id,
          caller_name: data.caller_name || 'Unknown',
          caller_avatar: data.caller_avatar,
          conversation_id: data.conversation_id,
        };

        callTypeRef.current = 'incoming';
        setCallInfo({
          peerId: signal.caller_user_id || signal.caller_id || '',
          peerName: signal.caller_name,
          peerAvatar: signal.caller_avatar,
          conversationId: signal.conversation_id,
          signalId: signal.signal_id,
        });
        setCallState('ringing');

        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        // No need to schedule next poll — callState change will tear down this effect
      } catch {
        // Network error — keep normal interval, don't aggressively retry
        schedule(MIN_INTERVAL);
      }
    };

    // First poll after a short delay so we don't stampede on mount
    schedule(2000);

    // Pause/resume on visibility change — only triggers ONE poll on resume
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        // Reset backoff on resume so a returning user gets responsive polling
        backoffMs = MIN_INTERVAL;
        schedule(500);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUserId, driverType, callState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [cleanup]);

  return {
    callState,
    callInfo,
    isMuted,
    callDuration,
    startCall,
    acceptCall,
    endCall,
    rejectCall,
    toggleMute,
  };
}
