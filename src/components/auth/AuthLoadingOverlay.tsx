import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthLoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function AuthLoadingOverlay({ isVisible, message = 'กำลังโหลด...' }: AuthLoadingOverlayProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Wait for fade out animation to complete
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className={`flex flex-col items-center gap-4 transition-all duration-300 ${
        isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <Loader2 className="h-12 w-12 animate-spin text-white" />
        <p className="text-lg font-medium text-white">{message}</p>
      </div>
    </div>
  );
}
