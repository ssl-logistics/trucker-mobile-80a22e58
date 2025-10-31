import { useNavigate } from 'react-router-dom';
import { TrendingUp, Truck, Users, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import financeBg from '@/assets/finance-bg.png';
import shippingBg from '@/assets/shipping-bg.png';
import customerBg from '@/assets/customer-bg.png';
import productBg from '@/assets/product-bg.png';
import financeIllustration from '@/assets/finance-illustration.png';

export default function DashboardPage() {
  const navigate = useNavigate();

  const dashboardItems = [
    {
      id: 'finance',
      title: 'การเงิน (ค่าใช้จ่าย)',
      description: 'ติดตามรายรับ, รายจ่าย ได้ง่าย',
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      path: '/dashboard/finance',
      imageSrc: financeBg
    },
    {
      id: 'shipping',
      title: 'การจัดส่ง',
      description: 'ตรวจสอบการจัดส่งของคุณ',
      icon: Truck,
      color: 'from-teal-500 to-teal-600',
      bgColor: 'bg-teal-50',
      path: '/dashboard/shipping',
      imageSrc: shippingBg
    },
    {
      id: 'customer',
      title: 'ลูกค้า',
      description: 'ดูข้อมูลลูกค้าของคุณ',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      path: '/dashboard/customer',
      imageSrc: customerBg
    },
    {
      id: 'product',
      title: 'สินค้า',
      description: 'ดูข้อมูลประเภทสินค้า',
      icon: Package,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      path: '/dashboard/product',
      imageSrc: productBg
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      <AppHeader />

      {/* Dashboard Grid */}
      <div className="px-4 py-6 space-y-4">
        {dashboardItems.map((item) => (
          <Card
            key={item.id}
            className="overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(item.path)}
          >
            <div 
              className={`p-6 relative min-h-[280px] ${item.id === 'finance' ? 'bg-gradient-to-br from-cyan-100 via-cyan-50 to-blue-50' : ''}`}
              style={item.id !== 'finance' ? { 
                backgroundImage: `url(${item.imageSrc})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              } : undefined}
            >
              {item.id === 'finance' ? (
                <div className="flex items-center justify-between relative z-10 h-full">
                  <div className="flex-1 pr-4">
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">{item.title}</h3>
                    <p className="text-base text-teal-700 mb-6">{item.description}</p>
                    <button
                      className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-8 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
                    >
                      ดู{item.title.split(' ')[0]}
                    </button>
                  </div>
                  <div className="flex-shrink-0 w-[55%] h-full flex items-center justify-end">
                    <img 
                      src={financeIllustration} 
                      alt="Finance illustration" 
                      className="w-full h-auto object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                    <button
                      className={`bg-gradient-to-r ${item.color} text-white px-6 py-2.5 rounded-full font-medium shadow-md hover:shadow-lg transition-all`}
                    >
                      ดู{item.title.split(' ')[0]}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <BottomNavigation />
    </div>
  );
}
