import { useNavigate, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, MessageCircle, Settings } from 'lucide-react';

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-slate-900 to-slate-800 text-white px-6 py-3 shadow-lg">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {[
          { icon: Home, label: 'หน้าแรก', path: '/home' },
          { icon: LayoutGrid, label: 'แผงควบคุม', path: '/dashboard' },
          { icon: MessageCircle, label: 'แชท', path: '/search' },
          { icon: Settings, label: 'ตั้งค่า', path: '/settings' },
        ].map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 transition-colors ${
              isActive(item.path) ? 'text-primary' : 'text-white/70'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
