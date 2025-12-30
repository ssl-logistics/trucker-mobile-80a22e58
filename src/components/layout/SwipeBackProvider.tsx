import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SwipeBackProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export function SwipeBackProvider({ children, enabled = true }: SwipeBackProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const startX = useRef<number>(0);
  const startY = useRef<number>(0);
  const isTracking = useRef(false);
  const hasMoved = useRef(false);
  
  // ขยาย edge zone สำหรับ iOS
  const edgeThreshold = 35;
  const swipeThreshold = 100;
  const maxSwipeDistance = 250;

  // Reset state when location changes
  useEffect(() => {
    setSwipeProgress(0);
    setIsAnimating(false);
    isTracking.current = false;
    hasMoved.current = false;
  }, [location.pathname]);

  const handleSwipeEnd = useCallback((deltaX: number, deltaY: number) => {
    if (deltaX > swipeThreshold && Math.abs(deltaY) < deltaX * 0.7) {
      setIsAnimating(true);
      setSwipeProgress(1);
      
      setTimeout(() => {
        navigate(-1);
        setSwipeProgress(0);
        setIsAnimating(false);
      }, 250);
    } else {
      setIsAnimating(true);
      setSwipeProgress(0);
      setTimeout(() => setIsAnimating(false), 200);
    }
    
    isTracking.current = false;
    hasMoved.current = false;
  }, [navigate]);

  useEffect(() => {
    if (!enabled) return;

    // Pages ที่ไม่ต้อง swipe back
    const noSwipePages = ['/', '', '/sign-in', '/register'];
    if (noSwipePages.includes(location.pathname)) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      
      if (touch.clientX <= edgeThreshold) {
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        isTracking.current = true;
        hasMoved.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking.current) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      
      // First move - check if horizontal
      if (!hasMoved.current) {
        hasMoved.current = true;
        if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
          // Vertical scroll, cancel swipe
          isTracking.current = false;
          setSwipeProgress(0);
          return;
        }
      }
      
      if (deltaX > 0) {
        const progress = Math.min(deltaX / maxSwipeDistance, 1);
        setSwipeProgress(progress);
        
        // Prevent scroll when swiping
        if (progress > 0.1) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking.current) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      
      handleSwipeEnd(deltaX, deltaY);
    };

    const handleTouchCancel = () => {
      setSwipeProgress(0);
      isTracking.current = false;
      hasMoved.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, location.pathname, handleSwipeEnd]);

  const showOverlay = swipeProgress > 0;
  const translateX = swipeProgress * 100;
  const overlayOpacity = swipeProgress * 0.4;
  const isComplete = swipeProgress > 0.4;

  return (
    <>
      {/* Dark overlay */}
      {showOverlay && (
        <div 
          className="fixed inset-0 bg-black pointer-events-none z-[100]"
          style={{ 
            opacity: overlayOpacity,
            transition: isAnimating ? 'opacity 0.25s ease-out' : 'none'
          }}
        />
      )}
      
      {/* Edge indicator line */}
      {showOverlay && (
        <div 
          className="fixed left-0 top-0 bottom-0 w-1 bg-primary z-[101] pointer-events-none rounded-r-full"
          style={{ 
            opacity: Math.min(swipeProgress * 2, 1),
            transform: `scaleX(${1 + swipeProgress * 2})`,
            transformOrigin: 'left',
            transition: isAnimating ? 'all 0.25s ease-out' : 'none'
          }}
        />
      )}
      
      {/* Back arrow circle - iOS style */}
      {swipeProgress > 0.15 && (
        <div 
          className="fixed z-[102] pointer-events-none"
          style={{ 
            left: `${16 + swipeProgress * 40}px`,
            top: '50%',
            opacity: Math.min((swipeProgress - 0.15) * 3, 1),
            transform: `translateY(-50%) scale(${0.8 + swipeProgress * 0.3})`,
            transition: isAnimating ? 'all 0.25s ease-out' : 'none'
          }}
        >
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-colors duration-150 ${
              isComplete ? 'bg-primary' : 'bg-white'
            }`}
          >
            <ChevronLeft 
              className={`w-6 h-6 transition-colors duration-150 ${
                isComplete ? 'text-white' : 'text-primary'
              }`}
            />
          </div>
        </div>
      )}
      
      {/* Main content with slide effect */}
      <div 
        className="min-h-screen"
        style={{ 
          transform: `translateX(${translateX * 0.4}px)`,
          transition: isAnimating ? 'transform 0.25s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </>
  );
}
