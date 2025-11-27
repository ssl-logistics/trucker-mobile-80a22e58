import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';

interface Notification {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  isRead: boolean;
  imageUrl?: string;
  fullContent?: string;
}

// Mock data
const mockNotifications: Notification[] = [
  {
    id: '1',
    date: '01 ธ.ค. 2568',
    time: '12:28',
    title: 'ปิดสถานีแนวโน้ม "ราคาน้ำมันด้อนตัว"',
    description: 'การถอนเหรียญของคุณได้รับการอนุมัติและจะถูกโอนเข้าบัญชีของคุณภายใน 24 ชั่วโมง',
    isRead: false,
    imageUrl: '/placeholder.svg',
    fullContent: `ราคาน้ำมันดิดต่อเนื่องในปี 2568-2569
เพราะเปรียนเทพผังงานกรมปี์บ สบิขสนุมทรสำรวจ

มุดเจาะและผลค้น้ำมันของประเทศ รวมคิงการผ่อนสำมองเทคโนยี
ระเบียบ การสำรวจและมุดเจาอะน้ำนันในประเทศ
กำไร้ราคาน้ำมันบันตัดตังคลองานด์มาไม่แสลางจังมี"

หมิงงงาน้างนพผังงานด้าง คาอา่ราคาน้ำมันในปี 2568
จะอ้อนตัวงงงายคที่แล้ว อยู่ที่ 70-80 ตอลลาร์ต่อบาร์เริล
ด้อนตัวงงในรังพสงงงด์จาทคสาทคายบัิจิลิ ในปปี 2568
บรริน บมทน. จำกัด (มหาชม) คาอา่ราคาน้ำมันดันตรู้ม
อยู่ในระตับ 70-80 ดอลลาร์ต่อบาร์เรล ในปี 2568`
  },
  {
    id: '2',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: 'คอมเหรียญได้รับการอนุมัติ',
    description: 'การถอนเหรียญของคุณได้รับการอนุมัติและจะถูกโอนเข้าบัญชีของคุณภายใน 24 ชั่วโมง',
    isRead: true
  },
  {
    id: '3',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: 'เงื่อไขและข้อกำหนด',
    description: 'Truckers ขอเรียนแจ้งการเปลี่ยนแปลงข้อกำหนดและเงื่อนไขการใช้บริการของระบบ ดังรายละเอียดในแนบนึงท็อไกการใช้บริการและผนโยบาย',
    isRead: false
  }
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [notifications] = useState<Notification[]>(mockNotifications);
  const [activeTab, setActiveTab] = useState('all');

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const displayNotifications = activeTab === 'all' ? notifications : unreadNotifications;

  const markAllAsRead = () => {
    // TODO: Implement mark all as read functionality
    console.log('Mark all as read');
  };

  const getNotificationDate = () => {
    const today = new Date();
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                       'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${today.getDate()} ${monthNames[today.getMonth()]}`;
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
                    <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.description}
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
