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
  
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isEdgeSwipe = useRef(false);
  const isMouseDown = useRef(false);
  
  const edgeThreshold = 50;
  const swipeThreshold = 80;
  const maxSwipeDistance = 200;

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (location.pathname === '/' || location.pathname === '') return;
    
    if (clientX <= edgeThreshold) {
      startX.current = clientX;
      startY.current = clientY;
      isEdgeSwipe.current = true;
    } else {
      isEdgeSwipe.current = false;
    }
  }, [location.pathname]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isEdgeSwipe.current || startX.current === null || startY.current === null) return;
    
    const deltaX = clientX - startX.current;
    const deltaY = Math.abs(clientY - startY.current);
    
    // Only track horizontal swipes
    if (deltaX > 0 && deltaX > deltaY) {
      const progress = Math.min(deltaX / maxSwipeDistance, 1);
      setSwipeProgress(progress);
    }
  }, []);

  const handleEnd = useCallback((clientX: number, clientY: number) => {
    if (!isEdgeSwipe.current || startX.current === null || startY.current === null) {
      setSwipeProgress(0);
      return;
    }

    const deltaX = clientX - startX.current;
    const deltaY = Math.abs(clientY - startY.current);

    if (deltaX > swipeThreshold && deltaX > deltaY * 1.5) {
      // Animate out then navigate
      setIsAnimating(true);
      setSwipeProgress(1);
      
      setTimeout(() => {
        navigate(-1);
        setSwipeProgress(0);
        setIsAnimating(false);
      }, 200);
    } else {
      // Reset with animation
      setSwipeProgress(0);
    }

    startX.current = null;
    startY.current = null;
    isEdgeSwipe.current = false;
  }, [navigate, swipeThreshold]);

  useEffect(() => {
    if (!enabled) return;

    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      handleEnd(touch.clientX, touch.clientY);
    };

    // Mouse events for desktop testing
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isMouseDown.current) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isMouseDown.current) {
        handleEnd(e.clientX, e.clientY);
        isMouseDown.current = false;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, handleStart, handleMove, handleEnd]);

  const showOverlay = swipeProgress > 0;
  const translateX = swipeProgress * 100;
  const overlayOpacity = swipeProgress * 0.3;

  return (
    <>
      {/* Dark overlay that appears during swipe */}
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
      
      {/* Back arrow indicator */}
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
      
      {/* Main content with slide effect */}
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
