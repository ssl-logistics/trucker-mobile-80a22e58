import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { th, enUS, ko, zhCN } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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


export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch notifications from database and filter out past job notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        
        // RLS filters by user_id automatically - fetch all for current user
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching notifications:', error);
          setNotifications([]);
          return;
        }

        setNotifications(data || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Get current user id for realtime filter
    const getCurrentUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id;
    };

    let channel: any;
    getCurrentUserId().then((userId) => {
      if (!userId) return;
      channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
        async (payload) => {
          console.log('New notification received:', payload);
          const newNotif = payload.new as Notification;
          
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const unreadNotifications = notifications.filter(n => !n.is_read);
  
  // Filter by tab and selected date
  const filteredNotifications = (activeTab === 'all' ? notifications : unreadNotifications)
    .filter(n => {
      const notifDate = parseISO(n.created_at);
      return isSameDay(notifDate, selectedDate);
    });
  
  // Get localized content
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

  // Get locale for date-fns
  const getLocale = () => {
    switch (language) {
      case 'th': return th;
      case 'ko': return ko;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  // Format selected date for display
  const formatSelectedDate = () => {
    return format(selectedDate, 'd MMMM yyyy', { locale: getLocale() });
  };

  // Format notification date/time
  const formatNotificationDateTime = (dateString: string) => {
    const date = parseISO(dateString);
    return {
      date: format(date, 'd MMM yyyy', { locale: getLocale() }),
      time: format(date, 'HH:mm'),
    };
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );
    }

    // Navigate based on notification type
    if (notification.reference_type === 'job' && notification.reference_id) {
      // reference_id is the order_number directly (e.g., "OR20260124001")
      const orderCode = notification.reference_id;

      if (notification.notification_type === 'new_job') {
        // New job notification - go to Home to show job detail modal
        navigate('/home', { state: { openJobOrderCode: orderCode } });
        return;
      }

      // Default job flow: open job detail page (accepted jobs)
      navigate(`/job/${orderCode}`);
      return;
    }

    // For non-job notifications, go to notification detail
    navigate(`/notifications/${notification.id}`);

  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('notifications.title')}</h1>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full rounded-none border-b bg-white h-12">
          <TabsTrigger value="all" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            {t('notifications.all')}
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            {t('notifications.unread')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {/* Date Picker */}
          <div className="flex items-center justify-center px-4 py-3 bg-white">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-center text-left font-normal gap-2",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {formatSelectedDate()}
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
          </div>

          {/* Notifications List */}
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
              filteredNotifications.map((notification) => {
                const { date, time } = formatNotificationDateTime(notification.created_at);
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full px-4 py-4 border-b hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        notification.is_read ? 'bg-gray-400' : 'bg-red-500'
                      }`} />
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
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
