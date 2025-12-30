import { ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className = "" }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show back button on root pages
  const rootPaths = ['/', '/home', '/dashboard', '/chat', '/settings'];
  if (rootPaths.includes(location.pathname)) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate(-1)}
      className={`fixed top-0 left-0 z-[60] w-10 h-10 rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white ${className}`}
      style={{ 
        top: 'calc(env(safe-area-inset-top) + 52px)',
        left: '8px'
      }}
    >
      <ChevronLeft className="w-6 h-6 text-foreground" />
    </Button>
  );
}
