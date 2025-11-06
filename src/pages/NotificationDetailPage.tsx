import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Mock data - should match NotificationsPage
const mockNotifications = [
  {
    id: '1',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: 'ปิดสถานีแนวโน้ม "ราคาน้ำมันด้อนตัว"',
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
    fullContent: 'การถอนเหรียญของคุณได้รับการอนุมัติและจะถูกโอนเข้าบัญชีของคุณภายใน 24 ชั่วโมง'
  },
  {
    id: '3',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: 'เงื่อไขและข้อกำหนด',
    fullContent: 'Truckers ขอเรียนแจ้งการเปลี่ยนแปลงข้อกำหนดและเงื่อนไขการใช้บริการของระบบ ดังรายละเอียดในแนบนึงท็อไกการใช้บริการและผนโยบาย'
  }
];

export default function NotificationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const notification = mockNotifications.find(n => n.id === id);

  if (!notification) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">ไม่พบการแจ้งเตือน</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center mr-7">แจ้งเตือน</h1>
        </div>
      </header>

      {/* Content */}
      <div className="bg-white">
        <div className="p-4">
          <h2 className="text-base font-semibold mb-3">{notification.title}</h2>
          
          {notification.imageUrl && (
            <img 
              src={notification.imageUrl} 
              alt={notification.title}
              className="w-full rounded-lg mb-4"
            />
          )}
          
          <div className="text-xs text-muted-foreground mb-4">
            {notification.date} | {notification.time}
          </div>
          
          <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {notification.fullContent}
          </div>
        </div>
      </div>
    </div>
  );
}
