/**
 * WebRTC Voice Call Hook
 * 
 * Uses Supabase Realtime channels for signaling and browser WebRTC APIs for audio.
 * Channel name: webrtc-call-{recipientUserId}
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallInfo {
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  conversationId?: string;
}

interface UseWebRTCCallReturn {
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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTCCall(currentUserId: string | null): UseWebRTCCallReturn {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const incomingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Create or get remote audio element
  const getRemoteAudio = useCallback(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }
    return remoteAudioRef.current;
  }, []);

  // Cleanup resources
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up...');
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setCallDuration(0);
    setIsMuted(false);
  }, []);

  // Setup peer connection
  const createPeerConnection = useCallback((signalingChannel: ReturnType<typeof supabase.channel>) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        signalingChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate.toJSON(), from: currentUserId },
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');
      const audio = getRemoteAudio();
      audio.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        // Start duration timer
        const start = Date.now();
        durationIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - start) / 1000));
        }, 1000);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setCallState('ended');
        setTimeout(() => {
          cleanup();
          setCallState('idle');
          setCallInfo(null);
        }, 2000);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [currentUserId, getRemoteAudio, cleanup]);

  // Get local audio stream
  const getLocalStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  // Subscribe to a signaling channel for a call
  const subscribeSignaling = useCallback((channelName: string, onSignal: (event: string, payload: any) => void) => {
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'offer' }, ({ payload }) => onSignal('offer', payload))
      .on('broadcast', { event: 'answer' }, ({ payload }) => onSignal('answer', payload))
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => onSignal('ice-candidate', payload))
      .on('broadcast', { event: 'call-end' }, ({ payload }) => onSignal('call-end', payload))
      .on('broadcast', { event: 'call-reject' }, ({ payload }) => onSignal('call-reject', payload))
      .subscribe();

    signalingChannelRef.current = channel;
    return channel;
  }, []);

  // Process pending ICE candidates
  const processPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add buffered candidate:', e);
      }
    }
    pendingCandidatesRef.current = [];
  }, []);

  // === Start outgoing call ===
  const startCall = useCallback(async (peerId: string, peerName: string, peerAvatar?: string | null, conversationId?: string) => {
    if (!currentUserId) return;
    console.log('[WebRTC] Starting call to', peerId);

    setCallInfo({ peerId, peerName, peerAvatar, conversationId });
    setCallState('calling');

    // Use a deterministic channel name so both peers join the same channel
    const callId = [currentUserId, peerId].sort().join('-');
    const channelName = `webrtc-call-${callId}`;

    const channel = subscribeSignaling(channelName, async (event, payload) => {
      if (payload.from === currentUserId) return;

      if (event === 'answer') {
        console.log('[WebRTC] Received answer');
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await processPendingCandidates();
        }
      } else if (event === 'ice-candidate') {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('[WebRTC] ICE candidate error:', e);
          }
        } else {
          pendingCandidatesRef.current.push(payload.candidate);
        }
      } else if (event === 'call-end' || event === 'call-reject') {
        console.log('[WebRTC] Call ended/rejected by peer');
        setCallState('ended');
        setTimeout(() => {
          cleanup();
          setCallState('idle');
          setCallInfo(null);
        }, 2000);
      }
    });

    // Get audio and create offer
    const stream = await getLocalStream();
    const pc = createPeerConnection(channel);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer via signaling channel
    channel.send({
      type: 'broadcast',
      event: 'offer',
      payload: {
        sdp: offer,
        from: currentUserId,
        callerName: peerName, // we'll pass the caller's name separately via push
      },
    });

    // Send push notification to wake recipient app
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: peerId,
          title: '📞 สายเรียกเข้า',
          body: `${peerName} กำลังโทรหาคุณ`,
          url: `/chat/${conversationId || ''}`,
          tag: `call-${callId}`,
          data: {
            type: 'incoming_call',
            callId,
            callerId: currentUserId,
            callerName: peerName,
          },
        },
      });
    } catch (e) {
      console.warn('[WebRTC] Push notification failed (non-blocking):', e);
    }
  }, [currentUserId, subscribeSignaling, getLocalStream, createPeerConnection, cleanup, processPendingCandidates]);

  // === Accept incoming call ===
  const acceptCall = useCallback(async () => {
    if (!currentUserId || !callInfo) return;
    console.log('[WebRTC] Accepting call from', callInfo.peerId);

    setCallState('connected');

    const callId = [currentUserId, callInfo.peerId].sort().join('-');
    const channelName = `webrtc-call-${callId}`;
    const channel = signalingChannelRef.current;

    if (!channel) {
      console.error('[WebRTC] No signaling channel to accept call');
      return;
    }

    const stream = await getLocalStream();
    const pc = peerConnectionRef.current;

    if (!pc) {
      console.error('[WebRTC] No peer connection');
      return;
    }

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channel.send({
      type: 'broadcast',
      event: 'answer',
      payload: { sdp: answer, from: currentUserId },
    });

    await processPendingCandidates();
  }, [currentUserId, callInfo, getLocalStream, processPendingCandidates]);

  // === End call ===
  const endCall = useCallback(() => {
    console.log('[WebRTC] Ending call');
    const channel = signalingChannelRef.current;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { from: currentUserId },
      });
    }
    setCallState('ended');
    setTimeout(() => {
      cleanup();
      setCallState('idle');
      setCallInfo(null);
    }, 2000);
  }, [currentUserId, cleanup]);

  // === Reject call ===
  const rejectCall = useCallback(() => {
    console.log('[WebRTC] Rejecting call');
    const channel = signalingChannelRef.current;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call-reject',
        payload: { from: currentUserId },
      });
    }
    cleanup();
    setCallState('idle');
    setCallInfo(null);
  }, [currentUserId, cleanup]);

  // === Toggle mute ===
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // === Listen for incoming calls ===
  useEffect(() => {
    if (!currentUserId) return;

    // Subscribe to all channels that could target this user
    // We listen on a personal incoming-call channel
    const incomingChannel = supabase.channel(`incoming-call-${currentUserId}`, {
      config: { broadcast: { self: false } },
    });

    incomingChannel
      .on('broadcast', { event: 'ring' }, async ({ payload }) => {
        console.log('[WebRTC] Incoming call from', payload.callerId);

        if (callState !== 'idle') {
          console.log('[WebRTC] Already in a call, ignoring');
          return;
        }

        const callId = payload.callId;
        const channelName = `webrtc-call-${callId}`;

        setCallInfo({
          peerId: payload.callerId,
          peerName: payload.callerName || 'Unknown',
          peerAvatar: payload.callerAvatar,
          conversationId: payload.conversationId,
        });
        setCallState('ringing');

        // Join the signaling channel and wait for the offer
        const sigChannel = subscribeSignaling(channelName, async (event, sigPayload) => {
          if (sigPayload.from === currentUserId) return;

          if (event === 'offer') {
            console.log('[WebRTC] Received offer');
            const pc = createPeerConnection(sigChannel);
            await pc.setRemoteDescription(new RTCSessionDescription(sigPayload.sdp));
            await processPendingCandidates();
            // Don't create answer yet — wait for user to accept
          } else if (event === 'ice-candidate') {
            const pc = peerConnectionRef.current;
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(sigPayload.candidate));
              } catch (e) {
                console.warn('[WebRTC] ICE candidate error:', e);
              }
            } else {
              pendingCandidatesRef.current.push(sigPayload.candidate);
            }
          } else if (event === 'call-end') {
            setCallState('ended');
            setTimeout(() => {
              cleanup();
              setCallState('idle');
              setCallInfo(null);
            }, 2000);
          }
        });
      })
      .subscribe();

    incomingChannelRef.current = incomingChannel;

    return () => {
      if (incomingChannelRef.current) {
        supabase.removeChannel(incomingChannelRef.current);
        incomingChannelRef.current = null;
      }
    };
  }, [currentUserId, callState, subscribeSignaling, createPeerConnection, cleanup, processPendingCandidates]);

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
