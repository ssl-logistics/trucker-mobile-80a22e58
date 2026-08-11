import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { format, isSameDay, isSameMonth, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { th, enUS, ko, zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';

interface Notification {
  id: string;
  user_id: string | null;
  title_th: string;
  title_en: string | null;
  title_ko: string | null;
  title_zh: string | null;
  description_th: string | null;
  description_en: string | null;
  description_ko: string | null;
  description_zh: string | null;
  notification_type: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  image_url: string | null;
  created_at: string;
}

type ViewMode = 'daily' | 'monthly';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const driverId = user?.id;

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!driverId) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data: response, error } = await supabase.functions.invoke('get-notifications', {
          body: { action: 'list', user_id: driverId },
        });
        if (error) {
          console.error('Error fetching notifications:', error);
          setNotifications([]);
          return;
        }
        setNotifications(response?.data || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Mark all notifications as read when page opens
    const markAllRead = async () => {
      try {
        await supabase.functions.invoke('get-notifications', {
          body: { action: 'mark_all_read', user_id: driverId },
        });
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (error) {
        console.error('Failed to mark all as read:', error);
      }
    };
    markAllRead();

    let channel: any;
    if (driverId) {
      channel = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${driverId}`,
        }, (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        })
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [driverId]);

  // Filter notifications based on view mode
  const filteredNotifications = notifications.filter(n => {
    const notifDate = parseISO(n.created_at);
    if (viewMode === 'daily') {
      return isSameDay(notifDate, selectedDate);
    }
    return isSameMonth(notifDate, selectedDate);
  });

  // Reset to first page when filter changes
  useEffect(() => { setCurrentPage(1); }, [viewMode, selectedDate, notifications.length]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedNotifications = filteredNotifications.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getLocalizedTitle = (notification: Notification) => {
    switch (language) {
      case 'en': return notification.title_en || notification.title_th;
      case 'ko': return notification.title_ko || notification.title_th;
      case 'zh': return notification.title_zh || notification.title_th;
      default: return notification.title_th;
    }
  };

  const getLocalizedDescription = (notification: Notification) => {
    switch (language) {
      case 'en': return notification.description_en || notification.description_th;
      case 'ko': return notification.description_ko || notification.description_th;
      case 'zh': return notification.description_zh || notification.description_th;
      default: return notification.description_th;
    }
  };

  const getLocale = () => {
    switch (language) {
      case 'th': return th;
      case 'ko': return ko;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  const formatDisplayDate = () => {
    if (viewMode === 'monthly') {
      return format(selectedDate, 'MMMM yyyy', { locale: getLocale() });
    }
    return format(selectedDate, 'd MMMM yyyy', { locale: getLocale() });
  };

  const formatNotificationDateTime = (dateString: string) => {
    const date = parseISO(dateString);
    return {
      date: format(date, 'd MMM yyyy', { locale: getLocale() }),
      time: format(date, 'HH:mm'),
    };
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'monthly') {
      setSelectedDate(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    } else {
      setSelectedDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
        return d;
      });
    }
  };

  const isLocationNotification = (notification: Notification) => {
    if (notification.notification_type === 'proximity_alert' || 
        notification.notification_type === 'location_alert' ||
        notification.notification_type === 'checkin_proximity') return true;
    // Checkin notifications stored as job_status — detect by title
    const title = notification.title_th || '';
    return title.includes('เช็คอิน') || title.includes('📍');
  };

  // Extract order code from description text (e.g. "งาน OR20260305033: ...")
  const extractOrderCodeFromDescription = (notification: Notification): string | null => {
    const desc = notification.description_th || notification.description_en || '';
    const match = desc.match(/OR\d{10,}/);
    return match ? match[0] : null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (isLocationNotification(notification)) return;

    if (!notification.is_read) {
      try {
        await supabase.functions.invoke('get-notifications', {
          body: { action: 'mark_read', user_id: driverId, notification_id: notification.id },
        });
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Try reference_id first, then extract from description
    const orderCode = notification.reference_id || extractOrderCodeFromDescription(notification);

    if (notification.reference_type === 'job' && orderCode) {
      if (notification.notification_type === 'new_job') {
        navigate('/home', { state: { openJobOrderCode: orderCode } });
        return;
      }
      navigate(`/job/${encodeURIComponent(orderCode)}`);
      return;
    }

    // Fallback: if we found an order code anywhere, navigate to job
    if (orderCode) {
      navigate(`/job/${encodeURIComponent(orderCode)}`);
      return;
    }

    navigate(`/notifications/${notification.id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('notifications.title')}</h1>
        </div>
      </header>

      {/* View Mode Toggle */}
      <div className="flex items-center bg-white border-b px-4 py-2 gap-2">
        <Button
          variant={viewMode === 'daily' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('daily')}
          className="flex-1"
        >
          {language === 'th' ? 'รายวัน' : language === 'ko' ? '일별' : language === 'zh' ? '每日' : 'Daily'}
        </Button>
        <Button
          variant={viewMode === 'monthly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('monthly')}
          className="flex-1"
        >
          {language === 'th' ? 'รายเดือน' : language === 'ko' ? '월별' : language === 'zh' ? '每月' : 'Monthly'}
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <button onClick={() => navigateDate('prev')} className="p-1.5 rounded-full hover:bg-muted">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>

        {viewMode === 'daily' ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="gap-2 font-medium">
                <CalendarIcon className="h-4 w-4" />
                {formatDisplayDate()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={getLocale()}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span className="font-medium text-sm">{formatDisplayDate()}</span>
        )}

        <button onClick={() => navigateDate('next')} className="p-1.5 rounded-full hover:bg-muted">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Notifications List */}
      <PullToRefresh onRefresh={async () => {
        if (!driverId) return;
        const { data: response } = await supabase.functions.invoke('get-notifications', {
          body: { action: 'list', user_id: driverId },
        });
        setNotifications(response?.data || []);
      }}>
      <div className="bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm mt-3">{t('common.loading') || 'กำลังโหลด...'}</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{t('notifications.noNotifications') || 'ไม่มีการแจ้งเตือน'}</p>
          </div>
        ) : (
          pagedNotifications.map((notification) => {
            const { date, time } = formatNotificationDateTime(notification.created_at);
            const orderCode = notification.reference_id || extractOrderCodeFromDescription(notification);
            const isNonClickable = isLocationNotification(notification) || !orderCode;
            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "w-full px-4 py-4 border-b text-left transition-colors",
                  isNonClickable ? "cursor-default" : "hover:bg-muted/50"
                )}
                disabled={isNonClickable}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    notification.is_read ? "bg-muted-foreground/40" : "bg-destructive"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      {date} | {time}
                    </div>
                    <h3 className="font-semibold text-sm mb-1">
                      {getLocalizedTitle(notification)}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {getLocalizedDescription(notification)}
                    </p>
                  </div>
                  {!isNonClickable && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </div>
              </button>
            );
          })
        )}
        {!loading && filteredNotifications.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('common.previous') || 'ก่อนหน้า'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              {t('common.next') || 'ถัดไป'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
      </PullToRefresh>
    </div>
  );
}