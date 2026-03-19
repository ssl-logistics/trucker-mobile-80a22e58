/**
 * Full-screen Call Page — navigated to when a call is active
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/components/call/CallProvider';
import { VoiceCallOverlay } from '@/components/call/VoiceCallOverlay';

export default function CallPage() {
  const navigate = useNavigate();
  const { callState, callInfo, isMuted, callDuration, acceptCall, rejectCall, endCall, toggleMute } = useCall();

  // If call is idle (no active call), go back
  useEffect(() => {
    if (callState === 'idle') {
      navigate(-1);
    }
  }, [callState, navigate]);

  if (callState === 'idle') return null;

  return (
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
  );
}
