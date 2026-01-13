import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { th, enUS, ko, zhCN } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  date: string;
  time: string;
  title: {
    th: string;
    en: string;
    ko: string;
    zh: string;
  };
  description: {
    th: string;
    en: string;
    ko: string;
    zh: string;
  };
  isRead: boolean;
  imageUrl?: string;
  fullContent?: {
    th: string;
    en: string;
    ko: string;
    zh: string;
  };
}

// Empty notifications - no demo data
const mockNotificationsData: Notification[] = [];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [notifications] = useState<Notification[]>(mockNotificationsData);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const displayNotifications = activeTab === 'all' ? notifications : unreadNotifications;
  
  // Get localized content
  const getLocalizedContent = (content: { th: string; en: string; ko: string; zh: string }) => {
    return content[language as keyof typeof content] || content.th;
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
          <div className="flex items-center justify-center px-4 py-3 bg-white border-b">
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
            {displayNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">{t('notifications.noNotifications') || 'ไม่มีการแจ้งเตือน'}</p>
              </div>
            ) : (
              displayNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => navigate(`/notifications/${notification.id}`)}
                  className="w-full px-4 py-4 border-b hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      notification.isRead ? 'bg-gray-400' : 'bg-red-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">
                        {notification.date} | {notification.time}
                      </div>
                      <h3 className="font-semibold text-sm mb-1">
                        {getLocalizedContent(notification.title)}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {getLocalizedContent(notification.description)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
