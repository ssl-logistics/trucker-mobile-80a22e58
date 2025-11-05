import { Bell, Power } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import coverHeader from '@/assets/cover-header.png';

interface AppHeaderProps {
  userName?: string;
  profilePhoto?: string;
  onSignOut?: () => void;
  showQuickMenu?: boolean;
}

export function AppHeader({ userName, profilePhoto, onSignOut, showQuickMenu = false }: AppHeaderProps) {
  const navigate = useNavigate();
  
  const getDayName = () => {
    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    return days[new Date().getDay()];
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-b-3xl shadow-lg overflow-hidden">
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${coverHeader})` }}
        />
        <div className="relative z-10 px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-white/20">
            <AvatarImage src={profilePhoto} alt={userName} />
            <AvatarFallback className="bg-white/20 text-white text-lg">
              {userName?.charAt(0) || '👤'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm opacity-90">👋 {getDayName()}</div>
            <div className="font-semibold">
              {userName || 'คุณผู้ใช้งาน'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/notifications')}
            className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button
            onClick={onSignOut}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Power className="w-5 h-5" />
          </button>
        </div>
        </div>
      </div>
      </div>

      {showQuickMenu && (
        <div className="px-4 pb-2">
        <div className="grid grid-cols-4 gap-3">{/* Quick menu section with its own padding */}
          {[
            { icon: '🚛', label: 'งานปัจจุบัน', color: 'bg-blue-400', path: '/current-jobs' },
            { icon: '💰', label: 'เสนอราคา', color: 'bg-teal-400', path: '/bidding' },
            { icon: '💼', label: 'รายได้', color: 'bg-yellow-400', path: '/income' },
            { icon: '📋', label: 'ประวัติงาน', color: 'bg-purple-400', path: '/job-history' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              className="flex flex-col items-center gap-2 text-white"
            >
              <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center shadow-md text-2xl`}>
                {item.icon}
              </div>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
        </div>
      )}
    </header>
  );
}
