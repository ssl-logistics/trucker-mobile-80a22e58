/**
 * CallProvider
 * 
 * Global provider using ZegoCloud for voice calls.
 * Signaling via Supabase Realtime channel zego-call-{userId}.
 */
import { createContext, useContext, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useZegoCall } from '@/hooks/useZegoCall';
import { VoiceCallOverlay } from './VoiceCallOverlay';

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

  const userId = useMemo(() => {
    if (!user) {
      console.log('[CallProvider] No user found');
      return null;
    }
    try {
      const parsed = typeof user === 'string' ? JSON.parse(user) : user;
      const id = parsed?.driver_id || parsed?.id || null;
      console.log('[CallProvider] Resolved userId:', id, 'from user keys:', Object.keys(parsed || {}));
      return id;
    } catch (e) {
      console.error('[CallProvider] Error parsing user:', e);
      return null;
    }
  }, [user]);

  const {
    callState,
    callInfo,
    isMuted,
    callDuration,
    startCall,
    acceptCall,
    endCall,
    rejectCall,
    toggleMute,
  } = useZegoCall(userId);

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
