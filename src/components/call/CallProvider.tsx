/**
 * CallProvider
 * 
 * Global provider that wraps the app to handle incoming call signals
 * and render the VoiceCallOverlay.
 */
import { createContext, useContext, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';
import { VoiceCallOverlay } from './VoiceCallOverlay';
import { supabase } from '@/integrations/supabase/client';

interface CallContextType {
  startCall: (peerId: string, peerName: string, peerAvatar?: string | null, conversationId?: string) => Promise<void>;
  callState: string;
}

const CallContext = createContext<CallContextType>({
  startCall: async () => {},
  callState: 'idle',
});

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Extract user ID from auth context
  const userId = useMemo(() => {
    if (!user) return null;
    try {
      const parsed = typeof user === 'string' ? JSON.parse(user) : user;
      return parsed?.driver_id || parsed?.id || null;
    } catch {
      return null;
    }
  }, [user]);

  const {
    callState,
    callInfo,
    isMuted,
    callDuration,
    startCall: rawStartCall,
    acceptCall,
    endCall,
    rejectCall,
    toggleMute,
  } = useWebRTCCall(userId);

  // Enhanced startCall that also sends a "ring" signal to the recipient
  const startCall = useCallback(async (peerId: string, peerName: string, peerAvatar?: string | null, conversationId?: string) => {
    if (!userId) return;

    // Get caller's info for the ring signal
    let callerName = 'Unknown';
    let callerAvatar: string | null = null;
    try {
      const parsed = typeof user === 'string' ? JSON.parse(user) : user;
      callerName = parsed?.full_name || parsed?.name || parsed?.firstName || 'Unknown';
      callerAvatar = parsed?.avatar_url || parsed?.profileImage || null;
    } catch { /* ignore */ }

    // Send ring signal to recipient's incoming channel
    const callId = [userId, peerId].sort().join('-');
    const ringChannel = supabase.channel(`incoming-call-${peerId}`, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve) => {
      ringChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ringChannel.send({
            type: 'broadcast',
            event: 'ring',
            payload: {
              callId,
              callerId: userId,
              callerName,
              callerAvatar,
              conversationId,
            },
          });
          // Unsubscribe after sending
          setTimeout(() => {
            supabase.removeChannel(ringChannel);
            resolve();
          }, 500);
        }
      });
    });

    // Start the actual WebRTC call
    await rawStartCall(peerId, peerName, peerAvatar, conversationId);
  }, [userId, user, rawStartCall]);

  const contextValue = useMemo(() => ({
    startCall,
    callState,
  }), [startCall, callState]);

  return (
    <CallContext.Provider value={contextValue}>
      {children}
      <VoiceCallOverlay
        callState={callState as any}
        peerName={callInfo?.peerName || ''}
        peerAvatar={callInfo?.peerAvatar}
        isMuted={isMuted}
        callDuration={callDuration}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
      />
    </CallContext.Provider>
  );
}
