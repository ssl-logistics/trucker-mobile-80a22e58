import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SwipeBackOptions {
  edgeThreshold?: number;
  swipeThreshold?: number;
  enabled?: boolean;
}

export function useSwipeBack(options: SwipeBackOptions = {}) {
  const { 
    edgeThreshold = 50, // Increased for easier detection
    swipeThreshold = 60, // Reduced for easier triggering
    enabled = true 
  } = options;
  
  const navigate = useNavigate();
  const location = useLocation();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isEdgeSwipe = useRef(false);
  const isMouseDown = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Don't enable on root/home page
    if (location.pathname === '/' || location.pathname === '') {
      return;
    }

    const handleStart = (clientX: number, clientY: number) => {
      console.log('[SwipeBack] Start at X:', clientX, 'Edge threshold:', edgeThreshold);
      if (clientX <= edgeThreshold) {
        startX.current = clientX;
        startY.current = clientY;
        isEdgeSwipe.current = true;
        console.log('[SwipeBack] Edge swipe started');
      } else {
        isEdgeSwipe.current = false;
      }
    };

    const handleEnd = (clientX: number, clientY: number) => {
      if (!isEdgeSwipe.current || startX.current === null || startY.current === null) {
        return;
      }

      const deltaX = clientX - startX.current;
      const deltaY = Math.abs(clientY - startY.current);
      
      console.log('[SwipeBack] Swipe - deltaX:', deltaX, 'deltaY:', deltaY, 'threshold:', swipeThreshold);

      if (deltaX > swipeThreshold && deltaX > deltaY * 1.5) {
        console.log('[SwipeBack] Navigating back!');
        navigate(-1);
      }

      startX.current = null;
      startY.current = null;
      isEdgeSwipe.current = false;
    };

    // Touch events for mobile
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
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

    const handleMouseUp = (e: MouseEvent) => {
      if (isMouseDown.current) {
        handleEnd(e.clientX, e.clientY);
        isMouseDown.current = false;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, edgeThreshold, swipeThreshold, navigate, location.pathname]);
}
