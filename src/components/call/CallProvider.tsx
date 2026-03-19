/**
 * CallProvider
 *
 * Global provider using ZegoCloud for voice calls.
 * Navigates to /call page when a call is active.
 */
import { createContext, useContext, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useZegoCall } from '@/hooks/useZegoCall';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import type { CallState } from '@/hooks/useZegoCall';

interface CallContextType {
  startCall: (peerId: string, peerName: string, peerAvatar?: string | null, conversationId?: string) => Promise<void>;
  callState: string;
  callInfo: { peerId: string; peerName: string; peerAvatar?: string | null; conversationId?: string; signalId?: string } | null;
  isMuted: boolean;
  callDuration: number;
  acceptCall: () => Promise<void>;
  endCall: () => void;
  rejectCall: () => void;
  toggleMute: () => void;
}

const CallContext = createContext<CallContextType>({
  startCall: async () => {},
  callState: 'idle',
  callInfo: null,
  isMuted: false,
  callDuration: 0,
  acceptCall: async () => {},
  endCall: () => {},
  rejectCall: () => {},
  toggleMute: () => {},
});

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, userType } = useAuth();
  const navigate = useNavigate();
  const prevCallStateRef = useRef<CallState>('idle');

  const userId = useMemo(() => {
    if (!user) return null;
    try {
      const parsed = typeof user === 'string' ? JSON.parse(user) : user;
      const id = parsed?.id || parsed?.driver_id || null;
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

  // Navigate to /call page when call becomes active
  useEffect(() => {
    const prev = prevCallStateRef.current;
    prevCallStateRef.current = callState;

    if (prev === 'idle' && callState !== 'idle') {
      navigate('/call');
    }
  }, [callState, navigate]);

  const contextValue = useMemo(() => ({
    startCall,
    callState,
    callInfo,
    isMuted,
    callDuration,
    acceptCall,
    endCall,
    rejectCall,
    toggleMute,
  }), [startCall, callState, callInfo, isMuted, callDuration, acceptCall, endCall, rejectCall, toggleMute]);

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
}
