/**
 * ZegoCloud Voice Call Hook (Polling-based signaling)
 * 
 * Polls GET /call-signal for incoming calls, fetches ZegoCloud token
 * from GET /zegocloud-token, and responds via PATCH /call-signal.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { callExternalApi } from '@/lib/externalApi';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallSignal {
  signal_id: string;
  room_id: string;
  caller_id: string;
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

  // Keep ref in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Fetch ZegoCloud token from external API
  const fetchToken = useCallback(async (userId: string): Promise<{ token: string; appId: number } | null> => {
    try {
      const { data, error } = await callExternalApi<{ token: string; appId: number }>('zegocloud-token', {
        method: 'GET',
        params: { driver_id: userId },
      });
      if (error || !data) {
        console.error('[Zego] Token fetch error:', error);
        return null;
      }
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

  // Send signal response via PATCH
  const sendSignalResponse = useCallback(async (signalId: string, responseType: 'accepted' | 'rejected' | 'ended') => {
    try {
      const { error } = await callExternalApi('call-signal', {
        method: 'PATCH',
        body: { signal_id: signalId, response_type: responseType },
      });
      if (error) {
        console.error('[Zego] Signal response error:', error);
      }
    } catch (e) {
      console.error('[Zego] Signal response exception:', e);
    }
  }, []);

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

    // Join the ZegoCloud room
    const roomId = `call_${[currentUserId, callInfo.peerId].sort().map(id => id.replace(/-/g, '').substring(0, 8)).join('_')}`;
    const joined = await joinRoom(roomId);
    if (!joined) {
      console.error('[Zego] Failed to join room on accept');
      cleanup();
      return;
    }

    setCallState('connected');

    // Start duration timer
    const start = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, [currentUserId, callInfo, joinRoom, cleanup, sendSignalResponse]);

  // End call
  const endCall = useCallback(() => {
    console.log('[Zego] Ending call');

    if (callInfo?.signalId) {
      sendSignalResponse(callInfo.signalId, 'ended');
    }

    setCallState('ended');
    setTimeout(() => cleanup(), 2000);
  }, [callInfo, cleanup, sendSignalResponse]);

  // Reject call
  const rejectCall = useCallback(() => {
    console.log('[Zego] Rejecting call');

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

  // Poll for incoming call signals every 2.5 seconds
  useEffect(() => {
    if (!currentUserId) return;

    const pollCallSignal = async () => {
      // Only poll when idle
      if (callStateRef.current !== 'idle') return;

      try {
        // Use silent fetch to avoid spamming console with polling errors
        const baseUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
        const params = new URLSearchParams({ driver_id: currentUserId, driver_type: driverType });
        const res = await fetch(`${baseUrl}/call-signal?${params}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
        });

        if (!res.ok) return;

        const data = await res.json() as CallSignal;
        if (!data?.signal_id) return;

        console.log('[Zego] Incoming call signal:', data);

        setCallInfo({
          peerId: data.caller_id,
          peerName: data.caller_name || 'Unknown',
          peerAvatar: data.caller_avatar,
          conversationId: data.conversation_id,
          signalId: data.signal_id,
        });
        setCallState('ringing');
      } catch {
        // Silently ignore polling errors
      }
    };

    // Poll immediately then every 2.5 seconds
    pollCallSignal();
    pollingIntervalRef.current = setInterval(pollCallSignal, 2500);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentUserId, driverType]);

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
