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
  };
  description: {
    th: string;
    en: string;
    ko: string;
  };
  isRead: boolean;
  imageUrl?: string;
  fullContent?: {
    th: string;
    en: string;
    ko: string;
  };
}

// Mock data with multi-language support
const mockNotificationsData: Notification[] = [
  {
    id: '1',
    date: '01 ธ.ค. 2568',
    time: '12:28',
    title: {
      th: 'ปิดสถานีแนวโน้ม "ราคาน้ำมันด้อนตัว"',
      en: 'Station Closure: "Oil Price Stagnation" Trend',
      ko: '주유소 폐쇄: "유가 정체" 동향'
    },
    description: {
      th: 'การถอนเหรียญของคุณได้รับการอนุมัติและจะถูกโอนเข้าบัญชีของคุณภายใน 24 ชั่วโมง',
      en: 'Your coin withdrawal has been approved and will be transferred to your account within 24 hours',
      ko: '코인 출금이 승인되었으며 24시간 이내에 계정으로 이체됩니다'
    },
    isRead: false,
    imageUrl: '/placeholder.svg',
    fullContent: {
      th: `ราคาน้ำมันดิดต่อเนื่องในปี 2568-2569
เพราะเปรียนเทพผังงานกรมปี์บ สบิขสนุมทรสำรวจ

มุดเจาะและผลค้น้ำมันของประเทศ รวมคิงการผ่อนสำมองเทคโนยี
ระเบียบ การสำรวจและมุดเจาอะน้ำนันในประเทศ
กำไร้ราคาน้ำมันบันตัดตังคลองานด์มาไม่แสลางจังมี

หมิงงงาน้างนพผังงานด้าง คาอา่ราคาน้ำมันในปี 2568
จะอ้อนตัวงงงายคที่แล้ว อยู่ที่ 70-80 ตอลลาร์ต่อบาร์เริล
ด้อนตัวงงในรังพสงงงด์จาทคสาทคายบัิจิลิ ในปปี 2568
บรริน บมทน. จำกัด (มหาชม) คาอา่ราคาน้ำมันดันตรู้ม
อยู่ในระตับ 70-80 ดอลลาร์ต่อบาร์เรล ในปี 2568`,
      en: `Oil prices are expected to remain stable in 2568-2569
Due to changes in government exploration policies.

Drilling and oil exploration in the country, including technological improvements
and regulations for exploration and drilling in domestic areas.
Oil prices are expected to remain stable and not fluctuate significantly.

According to industry analysts, oil prices in 2568
will likely remain at the same level as last year, around 70-80 dollars per barrel.
Stable throughout the year due to various factors.
Companies estimate oil prices
will remain at 70-80 dollars per barrel in 2568.`,
      ko: `2568-2569년 유가는 안정적으로 유지될 것으로 예상됩니다
정부 탐사 정책 변화로 인해.

국내 석유 시추 및 탐사, 기술 개선
그리고 국내 지역의 탐사 및 시추 규정 포함.
유가는 안정적으로 유지되고 크게 변동하지 않을 것으로 예상됩니다.

업계 분석가에 따르면, 2568년 유가는
작년과 같은 수준인 배럴당 70-80달러를 유지할 것으로 보입니다.
다양한 요인으로 인해 연중 안정적입니다.
기업들은 유가가
2568년에 배럴당 70-80달러를 유지할 것으로 추정합니다.`
    }
  },
  {
    id: '2',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: {
      th: 'คอมเหรียญได้รับการอนุมัติ',
      en: 'Coin Commission Approved',
      ko: '코인 수수료 승인됨'
    },
    description: {
      th: 'การถอนเหรียญของคุณได้รับการอนุมัติและจะถูกโอนเข้าบัญชีของคุณภายใน 24 ชั่วโมง',
      en: 'Your coin withdrawal has been approved and will be transferred to your account within 24 hours',
      ko: '코인 출금이 승인되었으며 24시간 이내에 계정으로 이체됩니다'
    },
    isRead: true
  },
  {
    id: '3',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: {
      th: 'เงื่อไขและข้อกำหนด',
      en: 'Terms and Conditions',
      ko: '이용약관'
    },
    description: {
      th: 'Truckers ขอเรียนแจ้งการเปลี่ยนแปลงข้อกำหนดและเงื่อนไขการใช้บริการของระบบ ดังรายละเอียดในแนบนึงท็อไกการใช้บริการและผนโยบาย',
      en: 'Truckers would like to inform you of changes to the terms and conditions of service. Please refer to the attached service agreement and policy for details.',
      ko: 'Truckers는 서비스 이용약관 변경 사항을 알려드립니다. 자세한 내용은 첨부된 서비스 계약 및 정책을 참조하시기 바랍니다.'
    },
    isRead: false
  }
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [notifications] = useState<Notification[]>(mockNotificationsData);
  const [activeTab, setActiveTab] = useState('all');

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const displayNotifications = activeTab === 'all' ? notifications : unreadNotifications;
  
  // Get localized content
  const getLocalizedContent = (content: { th: string; en: string; ko: string }) => {
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
      <header className="bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center justify-center relative">
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
