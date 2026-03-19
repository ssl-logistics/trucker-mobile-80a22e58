/**
 * ZegoCloud Voice Call Hook
 * 
 * Uses ZegoCloud Express Engine for audio and Supabase Realtime for call signaling.
 * Channel: zego-call-{userId}
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallInfo {
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  conversationId?: string;
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

function generateRoomId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  const a = sorted[0].replace(/-/g, '').substring(0, 8);
  const b = sorted[1].replace(/-/g, '').substring(0, 8);
  return `call_${a}_${b}`;
}

export function useZegoCall(currentUserId: string | null): UseZegoCallReturn {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const zegoEngineRef = useRef<ZegoExpressEngine | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const incomingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  // Fetch token from edge function
  const fetchToken = useCallback(async (userId: string): Promise<{ token: string; appId: number } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('zegocloud-token', {
        body: { userId, effectiveTimeInSeconds: 3600 },
      });
      if (error) {
        console.error('[Zego] Token fetch error:', error);
        return null;
      }
      return data as { token: string; appId: number };
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

    const { appId } = tokenData;

    try {
      const zg = new ZegoExpressEngine(appId, 'wss://webliveroom-api.zego.im/ws');
      zegoEngineRef.current = zg;

      zg.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
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

      zg.on('roomStateChanged', (roomID, reason, errorCode) => {
        console.log('[Zego] Room state changed:', roomID, reason, errorCode);
        if (reason === 'LOGOUT' || reason === 'KICK_OUT' || reason === 'RECONNECT_FAILED') {
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
      const result = await zg.loginRoom(roomId, tokenData.token, {
        userID: currentUserId,
        userName: currentUserId,
      });
      console.log('[Zego] Joined room:', roomId, result);
      currentRoomIdRef.current = roomId;

      // Publish local audio stream
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

    // Destroy engine instance
    if (zegoEngineRef.current) {
      try {
        // ZegoExpressEngine doesn't have a static destroyEngine in web SDK
        // Just nullify the reference
      } catch (e) {
        console.warn('[Zego] Destroy engine error:', e);
      }
      zegoEngineRef.current = null;
    }

    setCallDuration(0);
    setIsMuted(false);
    setCallState('idle');
    setCallInfo(null);
  }, [currentUserId]);

  // Start outgoing call
  const startCall = useCallback(async (
    peerId: string,
    peerName: string,
    peerAvatar?: string | null,
    conversationId?: string
  ) => {
    if (!currentUserId) return;
    console.log('[Zego] Starting call to', peerId);

    setCallInfo({ peerId, peerName, peerAvatar, conversationId });
    setCallState('calling');

    const roomId = generateRoomId(currentUserId, peerId);

    // Join room immediately
    const joined = await joinRoom(roomId);
    if (!joined) {
      console.error('[Zego] Failed to join room');
      cleanup();
      return;
    }

    // Send ring signal via Supabase Realtime
    let callerName = 'Unknown';
    let callerAvatar: string | null = null;
    try {
      // Get caller info from localStorage
      const authData = localStorage.getItem('auth_driver');
      if (authData) {
        const parsed = JSON.parse(authData);
        callerName = parsed?.full_name || parsed?.name || parsed?.firstName || 'Unknown';
        callerAvatar = parsed?.avatar_url || parsed?.profileImage || null;
      }
    } catch { /* ignore */ }

    const ringChannel = supabase.channel(`zego-call-${peerId}`, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve) => {
      ringChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ringChannel.send({
            type: 'broadcast',
            event: 'ring',
            payload: {
              roomId,
              callerId: currentUserId,
              callerName,
              callerAvatar,
              conversationId,
            },
          });
          setTimeout(() => {
            supabase.removeChannel(ringChannel);
            resolve();
          }, 500);
        }
      });
    });

    // Send push notification
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: peerId,
          title: '📞 สายเรียกเข้า',
          body: `${callerName} กำลังโทรหาคุณ`,
          url: `/chat/${conversationId || ''}`,
          tag: `call-${roomId}`,
          data: {
            type: 'incoming_call',
            roomId,
            callerId: currentUserId,
            callerName,
          },
        },
      });
    } catch (e) {
      console.warn('[Zego] Push notification failed:', e);
    }
  }, [currentUserId, joinRoom, cleanup]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!currentUserId || !callInfo) return;
    console.log('[Zego] Accepting call from', callInfo.peerId);

    const roomId = generateRoomId(currentUserId, callInfo.peerId);

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

    // Notify caller that we accepted
    const acceptChannel = supabase.channel(`zego-call-${callInfo.peerId}`, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve) => {
      acceptChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          acceptChannel.send({
            type: 'broadcast',
            event: 'call-accepted',
            payload: { from: currentUserId },
          });
          setTimeout(() => {
            supabase.removeChannel(acceptChannel);
            resolve();
          }, 500);
        }
      });
    });
  }, [currentUserId, callInfo, joinRoom, cleanup]);

  // End call
  const endCall = useCallback(() => {
    console.log('[Zego] Ending call');

    if (callInfo) {
      const endChannel = supabase.channel(`zego-call-${callInfo.peerId}`, {
        config: { broadcast: { self: false } },
      });

      endChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          endChannel.send({
            type: 'broadcast',
            event: 'call-end',
            payload: { from: currentUserId },
          });
          setTimeout(() => supabase.removeChannel(endChannel), 500);
        }
      });
    }

    setCallState('ended');
    setTimeout(() => cleanup(), 2000);
  }, [currentUserId, callInfo, cleanup]);

  // Reject call
  const rejectCall = useCallback(() => {
    console.log('[Zego] Rejecting call');

    if (callInfo) {
      const rejectChannel = supabase.channel(`zego-call-${callInfo.peerId}`, {
        config: { broadcast: { self: false } },
      });

      rejectChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          rejectChannel.send({
            type: 'broadcast',
            event: 'call-reject',
            payload: { from: currentUserId },
          });
          setTimeout(() => supabase.removeChannel(rejectChannel), 500);
        }
      });
    }

    cleanup();
  }, [currentUserId, callInfo, cleanup]);

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

  // Listen for incoming calls
  useEffect(() => {
    if (!currentUserId) return;

    const incomingChannel = supabase.channel(`zego-call-${currentUserId}`, {
      config: { broadcast: { self: false } },
    });

    incomingChannel
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        console.log('[Zego] Incoming call from', payload.callerId);
        if (callState !== 'idle') {
          console.log('[Zego] Already in a call, ignoring');
          return;
        }

        setCallInfo({
          peerId: payload.callerId,
          peerName: payload.callerName || 'Unknown',
          peerAvatar: payload.callerAvatar,
          conversationId: payload.conversationId,
        });
        setCallState('ringing');
      })
      .on('broadcast', { event: 'call-accepted' }, ({ payload }) => {
        console.log('[Zego] Call accepted by peer');
        if (callState === 'calling') {
          setCallState('connected');
          const start = Date.now();
          durationIntervalRef.current = setInterval(() => {
            setCallDuration(Math.floor((Date.now() - start) / 1000));
          }, 1000);
        }
      })
      .on('broadcast', { event: 'call-end' }, () => {
        console.log('[Zego] Call ended by peer');
        setCallState('ended');
        setTimeout(() => cleanup(), 2000);
      })
      .on('broadcast', { event: 'call-reject' }, () => {
        console.log('[Zego] Call rejected by peer');
        setCallState('ended');
        setTimeout(() => cleanup(), 2000);
      })
      .subscribe();

    incomingChannelRef.current = incomingChannel;

    return () => {
      if (incomingChannelRef.current) {
        supabase.removeChannel(incomingChannelRef.current);
        incomingChannelRef.current = null;
      }
    };
  }, [currentUserId, callState, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
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
