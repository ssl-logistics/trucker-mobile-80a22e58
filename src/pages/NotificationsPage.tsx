import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';

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

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const displayNotifications = activeTab === 'all' ? notifications : unreadNotifications;
  
  // Get localized content
  const getLocalizedContent = (content: { th: string; en: string; ko: string; zh: string }) => {
    return content[language as keyof typeof content] || content.th;
  };

  const markAllAsRead = () => {
    // TODO: Implement mark all as read functionality
    console.log('Mark all as read');
  };

  const getNotificationDate = () => {
    const today = new Date();
    const monthKey = [
      'notifications.january', 'notifications.february', 'notifications.march',
      'notifications.april', 'notifications.may', 'notifications.june',
      'notifications.july', 'notifications.august', 'notifications.september',
      'notifications.october', 'notifications.november', 'notifications.december'
    ];
    return `${today.getDate()} ${t(monthKey[today.getMonth()])}`;
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
          <TabsTrigger value="all" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">
            {t('notifications.all')}
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">
            {t('notifications.unread')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {/* Date and Mark All Read */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
            <span className="text-sm text-muted-foreground">{getNotificationDate()}</span>
            <button onClick={markAllAsRead} className="text-sm text-blue-600 font-medium">
              {t('notifications.markAllRead')}
            </button>
          </div>

          {/* Notifications List */}
          <div className="bg-white">
            {displayNotifications.map((notification) => (
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
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
