/**
 * Voice Call Overlay
 * 
 * Full-screen overlay shown during active/incoming/outgoing calls.
 */
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { CallState } from '@/hooks/useWebRTCCall';

interface VoiceCallOverlayProps {
  callState: CallState;
  peerName: string;
  peerAvatar?: string | null;
  isMuted: boolean;
  callDuration: number;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getStatusText(state: CallState): string {
  switch (state) {
    case 'calling': return 'กำลังโทร...';
    case 'ringing': return 'สายเรียกเข้า';
    case 'connected': return 'กำลังสนทนา';
    case 'ended': return 'วางสายแล้ว';
    default: return '';
  }
}

export function VoiceCallOverlay({
  callState,
  peerName,
  peerAvatar,
  isMuted,
  callDuration,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
}: VoiceCallOverlayProps) {
  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-between py-16 px-6">
      {/* Top: Peer info */}
      <div className="flex flex-col items-center gap-4">
        <Avatar className="w-24 h-24 border-4 border-white/20">
          <AvatarImage src={peerAvatar || undefined} />
          <AvatarFallback className="text-3xl bg-primary/30 text-white">
            {peerName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-bold text-white">{peerName}</h2>
        <p className="text-white/60 text-lg">
          {callState === 'connected' ? formatDuration(callDuration) : getStatusText(callState)}
        </p>
      </div>

      {/* Middle: Animation / status */}
      <div className="flex items-center justify-center">
        {(callState === 'calling' || callState === 'ringing') && (
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500/20 animate-ping absolute inset-0" />
            <div className="w-20 h-20 rounded-full bg-green-500/30 flex items-center justify-center relative">
              <Phone className="w-10 h-10 text-green-400" />
            </div>
          </div>
        )}
        {callState === 'connected' && (
          <div className="w-20 h-20 rounded-full bg-green-500/30 flex items-center justify-center">
            <Phone className="w-10 h-10 text-green-400" />
          </div>
        )}
        {callState === 'ended' && (
          <div className="w-20 h-20 rounded-full bg-red-500/30 flex items-center justify-center">
            <PhoneOff className="w-10 h-10 text-red-400" />
          </div>
        )}
      </div>

      {/* Bottom: Controls */}
      <div className="flex items-center justify-center gap-8">
        {callState === 'ringing' && (
          <>
            {/* Reject */}
            <Button
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full p-0"
              onClick={onReject}
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            {/* Accept */}
            <Button
              size="lg"
              className="w-16 h-16 rounded-full p-0 bg-green-500 hover:bg-green-600"
              onClick={onAccept}
            >
              <Phone className="w-7 h-7 text-white" />
            </Button>
          </>
        )}

        {(callState === 'calling' || callState === 'connected') && (
          <>
            {/* Mute */}
            <Button
              variant="outline"
              size="lg"
              className={`w-14 h-14 rounded-full p-0 border-white/20 ${
                isMuted ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white'
              }`}
              onClick={onToggleMute}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            {/* End call */}
            <Button
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full p-0"
              onClick={onEnd}
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
          </>
        )}

        {callState === 'ended' && (
          <Button
            variant="outline"
            size="lg"
            className="w-14 h-14 rounded-full p-0 border-white/20 bg-white/10 text-white"
            onClick={onEnd}
          >
            <X className="w-6 h-6" />
          </Button>
        )}
      </div>
    </div>
  );
}
