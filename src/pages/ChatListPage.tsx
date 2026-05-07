import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { Button } from '@/components/ui/button';
import { getCallLogs, formatCallDuration, formatCallTime, formatCallDate, type CallLogEntry } from '@/utils/callLogs';

const PAGE_SIZE = 8;

export default function ChatListPage() {
  const { t } = useLanguage();
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [page, setPage] = useState(0);

  const loadLogs = async () => {
    const logs = await getCallLogs();
    setCallLogs(logs);
    setPage(0);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const totalPages = Math.max(1, Math.ceil(callLogs.length / PAGE_SIZE));
  const pagedLogs = callLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
    <div className="h-screen bg-background flex flex-col overflow-hidden overscroll-none">
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
          <>
            <div className="divide-y divide-border">
              {pagedLogs.map((entry) => (
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

                  {/* Date + Time */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{formatCallDate(entry.timestamp)}</span>
                    <span className="text-[11px] text-muted-foreground/70">{formatCallTime(entry.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </PullToRefresh>

      <BottomNavigation />
    </div>
  );
}
