import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Mock data - should match NotificationsPage
const mockNotificationsData = [
  {
    id: '1',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: {
      th: 'ปิดสถานีแนวโน้ม "ราคาน้ำมันด้อนตัว"',
      en: 'Station Closure: "Oil Price Stagnation" Trend',
      ko: '주유소 폐쇄: "유가 정체" 동향',
      zh: '加油站关闭："油价停滞"趋势'
    },
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
2568년에 배럴당 70-80달러를 유지할 것으로 추정합니다.`,
      zh: `预计2568-2569年油价将保持稳定
由于政府勘探政策的变化。

国内石油钻探和勘探，包括技术改进
以及国内地区勘探和钻探的法规。
预计油价将保持稳定，不会大幅波动。

根据行业分析师的说法，2568年的油价
可能会保持在与去年相同的水平，约每桶70-80美元。
由于各种因素，全年保持稳定。
各公司估计油价
将在2568年保持在每桶70-80美元。`
    }
  },
  {
    id: '2',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: {
      th: 'คอมเหรียญได้รับการอนุมัติ',
      en: 'Coin Commission Approved',
      ko: '코인 수수료 승인됨',
      zh: '代币佣金已批准'
    },
    fullContent: {
      th: 'การถอนเหรียญของคุณได้รับการอนุมัติและจะถูกโอนเข้าบัญชีของคุณภายใน 24 ชั่วโมง',
      en: 'Your coin withdrawal has been approved and will be transferred to your account within 24 hours',
      ko: '코인 출금이 승인되었으며 24시간 이내에 계정으로 이체됩니다',
      zh: '您的代币提取已获批准，将在24小时内转入您的账户'
    }
  },
  {
    id: '3',
    date: '16 ธ.ค. 2567',
    time: '12:28',
    title: {
      th: 'เงื่อไขและข้อกำหนด',
      en: 'Terms and Conditions',
      ko: '이용약관',
      zh: '条款和条件'
    },
    fullContent: {
      th: 'Truckers ขอเรียนแจ้งการเปลี่ยนแปลงข้อกำหนดและเงื่อนไขการใช้บริการของระบบ ดังรายละเอียดในแนบนึงท็อไกการใช้บริการและผนโยบาย',
      en: 'Truckers would like to inform you of changes to the terms and conditions of service. Please refer to the attached service agreement and policy for details.',
      ko: 'Truckers는 서비스 이용약관 변경 사항을 알려드립니다. 자세한 내용은 첨부된 서비스 계약 및 정책을 참조하시기 바랍니다.',
      zh: 'Truckers谨此通知您服务条款和条件的变更。详情请参阅附加的服务协议和政策。'
    }
  }
];

export default function NotificationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, language } = useLanguage();
  
  const notification = mockNotificationsData.find(n => n.id === id);
  
  // Get localized content
  const getLocalizedContent = (content: { th: string; en: string; ko: string; zh: string }) => {
    return content[language as keyof typeof content] || content.th;
  };

  if (!notification) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('notifications.noNotifications')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate(-1)} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('notifications.title')}</h1>
        </div>
      </header>

      {/* Content */}
      <div className="bg-white">
        <div className="p-4">
          <h2 className="text-base font-semibold mb-3">
            {getLocalizedContent(notification.title)}
          </h2>
          
          {notification.imageUrl && (
            <img 
              src={notification.imageUrl} 
              alt={getLocalizedContent(notification.title)}
              className="w-full rounded-lg mb-4"
            />
          )}
          
          <div className="text-xs text-muted-foreground mb-4">
            {notification.date} | {notification.time}
          </div>
          
          <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {getLocalizedContent(notification.fullContent)}
          </div>
        </div>
      </div>
    </div>
  );
}
