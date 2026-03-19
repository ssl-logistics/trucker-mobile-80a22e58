import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { getCallLogs, formatCallDuration, formatCallTime, type CallLogEntry } from '@/utils/callLogs';

export default function ChatListPage() {
  const { t } = useLanguage();
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);

  const loadLogs = () => {
    setCallLogs(getCallLogs());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getCallIcon = (entry: CallLogEntry) => {
    if (entry.callResult === 'rejected' || entry.callResult === 'missed') {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    if (entry.callType === 'incoming') {
      return <PhoneIncoming className="w-4 h-4 text-green-500" />;
    }
    return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
  };

  const getCallLabel = (entry: CallLogEntry) => {
    switch (entry.callResult) {
      case 'answered': return entry.callType === 'incoming' ? 'สายเรียกเข้า' : 'โทรออก';
      case 'rejected': return 'ปฏิเสธสาย';
      case 'missed': return 'สายที่ไม่ได้รับ';
      case 'ended': return entry.callType === 'incoming' ? 'สายเรียกเข้า' : 'โทรออก';
      default: return 'โทร';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 overscroll-none">
      {/* Header */}
      <div
        className="bg-[#DDEDFF] shadow-lg rounded-b-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-center gap-2 px-4 py-3">
          <Phone className="w-5 h-5 text-[#153860]" />
          <h1 className="text-xl font-semibold text-[#153860]">{t('chat.title')}</h1>
        </div>
      </div>

      <PullToRefresh onRefresh={async () => { loadLogs(); }}>
        {callLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Phone className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">ยังไม่มีประวัติการโทร</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {callLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-4"
              >
                {/* Avatar */}
                <Avatar className="w-12 h-12">
                  <AvatarImage src={entry.peerAvatar || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {entry.peerName?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{entry.peerName}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getCallIcon(entry)}
                    <span className="text-xs text-muted-foreground">
                      {getCallLabel(entry)}
                      {entry.durationSeconds > 0 && ` · ${formatCallDuration(entry.durationSeconds)}`}
                    </span>
                  </div>
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatCallTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>

      <BottomNavigation />
    </div>
  );
}
