/**
 * CallProvider
 * 
 * Global provider using ZegoCloud for voice calls.
 * Signaling via polling external API /call-signal.
 */
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useZegoCall } from '@/hooks/useZegoCall';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
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
  const { user, userType } = useAuth();

  const userId = useMemo(() => {
    if (!user) return null;
    try {
      const parsed = typeof user === 'string' ? JSON.parse(user) : user;
      const id = parsed?.driver_id || parsed?.id || null;
      console.log('[CallProvider] Resolved userId:', id);
      return id;
    } catch (e) {
      console.error('[CallProvider] Error parsing user:', e);
      return null;
    }
  }, [user]);

  const driverType = useMemo(() => getDriverTypeFromUserType(userType), [userType]);

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
  } = useZegoCall(userId, driverType);

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
