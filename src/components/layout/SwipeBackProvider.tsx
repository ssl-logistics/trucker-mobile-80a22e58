import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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
  
  const edgeThreshold = 50; // ลดลงเพื่อให้จับง่ายขึ้น
  const swipeThreshold = 80;
  const maxSwipeDistance = 200;

  // Reset state when location changes
  useEffect(() => {
    setSwipeProgress(0);
    setIsAnimating(false);
    isTracking.current = false;
    hasMoved.current = false;
  }, [location.pathname]);

  const handleSwipeEnd = useCallback((deltaX: number, deltaY: number) => {
    console.log('[SwipeBack] End - deltaX:', deltaX, 'deltaY:', deltaY);
    
    if (deltaX > swipeThreshold && Math.abs(deltaY) < deltaX * 0.5) {
      setIsAnimating(true);
      setSwipeProgress(1);
      console.log('[SwipeBack] Navigating back!');
      
      setTimeout(() => {
        navigate(-1);
        setSwipeProgress(0);
        setIsAnimating(false);
      }, 200);
    } else {
      setSwipeProgress(0);
    }
    
    isTracking.current = false;
    hasMoved.current = false;
  }, [navigate]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Don't enable on root/home page
      if (location.pathname === '/' || location.pathname === '') return;
      
      const touch = e.touches[0];
      console.log('[SwipeBack] TouchStart at X:', touch.clientX);
      
      if (touch.clientX <= edgeThreshold) {
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        isTracking.current = true;
        hasMoved.current = false;
        console.log('[SwipeBack] Edge swipe started');
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
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Vertical scroll, cancel swipe
          isTracking.current = false;
          setSwipeProgress(0);
          console.log('[SwipeBack] Cancelled - vertical scroll');
          return;
        }
      }
      
      if (deltaX > 0) {
        const progress = Math.min(deltaX / maxSwipeDistance, 1);
        setSwipeProgress(progress);
        console.log('[SwipeBack] Progress:', progress.toFixed(2));
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
      console.log('[SwipeBack] Touch cancelled');
      setSwipeProgress(0);
      isTracking.current = false;
      hasMoved.current = false;
    };

    // Add listeners with passive: false to allow preventDefault if needed
    const options = { passive: true };
    
    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);
    document.addEventListener('touchcancel', handleTouchCancel, options);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, location.pathname, handleSwipeEnd]);

  const showOverlay = swipeProgress > 0;
  const translateX = swipeProgress * 100;
  const overlayOpacity = swipeProgress * 0.3;

  return (
    <>
      {/* Dark overlay */}
      {showOverlay && (
        <div 
          className="fixed inset-0 bg-black pointer-events-none z-40"
          style={{ 
            opacity: overlayOpacity,
            transition: isAnimating ? 'opacity 0.2s ease-out' : 'none'
          }}
        />
      )}
      
      {/* Edge indicator */}
      {showOverlay && (
        <div 
          className="fixed left-0 top-0 bottom-0 w-1 bg-primary z-50 pointer-events-none"
          style={{ 
            opacity: swipeProgress,
            transform: `scaleX(${1 + swipeProgress * 3})`,
            transformOrigin: 'left',
            transition: isAnimating ? 'all 0.2s ease-out' : 'none'
          }}
        />
      )}
      
      {/* Back arrow */}
      {swipeProgress > 0.2 && (
        <div 
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          style={{ 
            opacity: Math.min((swipeProgress - 0.2) * 2, 1),
            transform: `translateX(${swipeProgress * 20}px) translateY(-50%)`,
            transition: isAnimating ? 'all 0.2s ease-out' : 'none'
          }}
        >
          <div className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
            <svg 
              className="w-5 h-5 text-primary" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 19l-7-7 7-7" 
              />
            </svg>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div 
        style={{ 
          transform: `translateX(${translateX * 0.3}px)`,
          transition: isAnimating || swipeProgress === 0 ? 'transform 0.2s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </>
  );
}
