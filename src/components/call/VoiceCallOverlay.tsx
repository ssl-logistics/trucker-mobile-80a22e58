/**
 * Voice Call Overlay — Native-style full-screen call UI
 */
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CallState } from '@/hooks/useZegoCall';

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

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between"
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 48px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)',
        paddingLeft: '24px',
        paddingRight: '24px',
      }}
    >
      {/* Top: Status text */}
      <div className="flex flex-col items-center gap-1 pt-4">
        <p className="text-white/50 text-sm font-medium tracking-wide uppercase">
          {callState === 'ringing' ? 'สายเรียกเข้า' : callState === 'calling' ? 'กำลังโทรออก' : ''}
        </p>
      </div>

      {/* Center: Caller info */}
      <div className="flex flex-col items-center gap-6 -mt-8">
        {/* Avatar */}
        <div className="relative">
          {/* Pulse rings for ringing/calling */}
          {(callState === 'ringing' || callState === 'calling') && (
            <>
              <div className="absolute inset-[-16px] rounded-full border-2 border-white/10 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-[-8px] rounded-full border border-white/20 animate-pulse" style={{ animationDuration: '1.5s' }} />
            </>
          )}
          
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl relative z-10">
            {peerAvatar ? (
              <img src={peerAvatar} alt={peerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600">
                <span className="text-white text-4xl font-bold">{getInitials(peerName)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <h2 className="text-white text-2xl font-bold text-center">{peerName}</h2>

        {/* Status / Duration */}
        <p className="text-white/60 text-lg">
          {callState === 'connected' 
            ? formatDuration(callDuration) 
            : callState === 'ended' 
              ? getStatusText(callState)
              : getStatusText(callState)
          }
        </p>

        {/* Connected indicator */}
        {callState === 'connected' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm">เชื่อมต่อแล้ว</span>
          </div>
        )}
      </div>

      {/* Bottom: Action buttons */}
      <div className="flex items-center justify-center gap-10 pb-8">
        {/* Incoming call: Accept / Reject */}
        {callState === 'ringing' && (
          <>
            <div className="flex flex-col items-center gap-2">
              <button
                className="w-18 h-18 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{ 
                  width: '72px', height: '72px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
                }}
                onClick={onReject}
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <span className="text-white/60 text-xs">ปฏิเสธ</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                className="w-18 h-18 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform animate-bounce"
                style={{ 
                  width: '72px', height: '72px',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
                  animationDuration: '1.5s',
                }}
                onClick={onAccept}
              >
                <Phone className="w-8 h-8 text-white" />
              </button>
              <span className="text-white/60 text-xs">รับสาย</span>
            </div>
          </>
        )}

        {/* Active call: Mute + End */}
        {(callState === 'calling' || callState === 'connected') && (
          <>
            <div className="flex flex-col items-center gap-2">
              <button
                className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  width: '56px', height: '56px',
                  background: isMuted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.15)',
                }}
                onClick={onToggleMute}
              >
                {isMuted ? <MicOff className="w-6 h-6 text-red-300" /> : <Mic className="w-6 h-6 text-white" />}
              </button>
              <span className="text-white/60 text-xs">{isMuted ? 'เปิดไมค์' : 'ปิดไมค์'}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                className="rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{
                  width: '72px', height: '72px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
                }}
                onClick={onEnd}
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <span className="text-white/60 text-xs">วางสาย</span>
            </div>
          </>
        )}

        {/* Ended: Close */}
        {callState === 'ended' && (
          <div className="flex flex-col items-center gap-2">
            <button
              className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{
                width: '56px', height: '56px',
                background: 'rgba(255,255,255,0.15)',
              }}
              onClick={onEnd}
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <span className="text-white/60 text-xs">ปิด</span>
          </div>
        )}
      </div>
    </div>
  );
}
