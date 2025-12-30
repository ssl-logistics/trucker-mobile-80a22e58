import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface SwipeBackOptions {
  edgeThreshold?: number; // How close to left edge to start (in pixels)
  swipeThreshold?: number; // Minimum swipe distance to trigger back
  enabled?: boolean;
}

export function useSwipeBack(options: SwipeBackOptions = {}) {
  const { 
    edgeThreshold = 30, 
    swipeThreshold = 80,
    enabled = true 
  } = options;
  
  const navigate = useNavigate();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isEdgeSwipe = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Only activate if touch starts near left edge
      if (touch.clientX <= edgeThreshold) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
        isEdgeSwipe.current = true;
      } else {
        isEdgeSwipe.current = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe.current || touchStartX.current === null || touchStartY.current === null) {
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // Check if horizontal swipe is dominant and exceeds threshold
      if (deltaX > swipeThreshold && deltaX > deltaY * 1.5) {
        navigate(-1);
      }

      // Reset
      touchStartX.current = null;
      touchStartY.current = null;
      isEdgeSwipe.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, edgeThreshold, swipeThreshold, navigate]);
}
