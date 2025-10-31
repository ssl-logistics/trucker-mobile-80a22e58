import { useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, MessageCircle, Settings, Bell, TrendingUp, Truck, Users, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import financeBg from '@/assets/finance-bg.png';
import shippingBg from '@/assets/shipping-bg.png';
import customerBg from '@/assets/customer-bg.png';
import productBg from '@/assets/product-bg.png';

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src="" />
              <AvatarFallback className="bg-blue-500 text-white">👤</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm text-orange-500">👋 สวัสดีครับคุณ</div>
              <div className="text-sm font-semibold text-gray-800">ทรงธรรม์ กดี สวัสดีอยู่</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Bell className="w-6 h-6 text-red-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Grid */}
      <div className="px-4 py-6 space-y-4">
        {dashboardItems.map((item) => (
          <Card
            key={item.id}
            className="overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(item.path)}
          >
            <div 
              className="p-6 relative min-h-[200px]"
              style={{ 
                backgroundImage: `url(${item.imageSrc})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
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
            </div>
          </Card>
        ))}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 text-white shadow-lg z-20">
        <div className="flex items-center justify-around py-3">
          <button 
            onClick={() => navigate('/home')}
            className="flex flex-col items-center gap-1 px-4 py-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">หน้าแรก</span>
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex flex-col items-center gap-1 px-4 py-1 bg-teal-500 rounded-lg"
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-xs">แผงควบคุม</span>
          </button>
          <button 
            onClick={() => navigate('/search')}
            className="flex flex-col items-center gap-1 px-4 py-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs">แชท</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-4 py-1 hover:bg-white/10 rounded-lg transition-colors">
            <Settings className="w-6 h-6" />
            <span className="text-xs">ตั้งค่า</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
