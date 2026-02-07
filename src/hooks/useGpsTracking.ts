import { useEffect, useRef, useCallback } from 'react';

const TRACKING_INTERVAL_MS = 1000; // 1 second
// Use our edge function which forwards to external API with proper API key
const UPDATE_POSITION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-truck-position`;

interface TrackingState {
  isTracking: boolean;
  roomCode: string | null;
  orderCode: string | null;
}

// Get tracking state from localStorage
export function getTrackingState(): TrackingState {
  try {
    const state = localStorage.getItem('gps_tracking_state');
    if (state) {
      return JSON.parse(state);
    }
  } catch (e) {
    console.error('[GPS Tracking] Error reading state:', e);
  }
  return { isTracking: false, roomCode: null, orderCode: null };
}

// Save tracking state to localStorage
function saveTrackingState(state: TrackingState): void {
  try {
    localStorage.setItem('gps_tracking_state', JSON.stringify(state));
  } catch (e) {
    console.error('[GPS Tracking] Error saving state:', e);
  }
}

// Start tracking
export function startGpsTracking(roomCode: string, orderCode: string): void {
  console.log('[GPS Tracking] Starting tracking for room:', roomCode, 'order:', orderCode);
  saveTrackingState({ isTracking: true, roomCode, orderCode });
}

// Stop tracking
export function stopGpsTracking(): void {
  console.log('[GPS Tracking] Stopping tracking');
  saveTrackingState({ isTracking: false, roomCode: null, orderCode: null });
}

// Send position update - keep sending regardless of room status
async function sendPositionUpdate(roomCode: string, lat: number, lng: number): Promise<boolean> {
  try {
    const response = await fetch(UPDATE_POSITION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
      },
      body: JSON.stringify({
        room_code: roomCode,
        current_lat: lat,
        current_lng: lng,
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({} as any));
      
      // Log but don't stop - keep sending
      if (data?.success === false) {
        console.log('[GPS Tracking] Position sent (room may be inactive):', { lat, lng, response: data });
      } else {
        console.log('[GPS Tracking] Position sent:', { lat, lng });
      }
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      // Log error but keep sending - don't stop tracking
      console.warn('[GPS Tracking] Position send error (will retry):', response.status, errorData);
      return false;
    }
  } catch (error) {
    console.error('[GPS Tracking] Network error (will retry):', error);
    return false;
  }
}

// Hook to manage GPS tracking
export function useGpsTracking() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const sendCurrentPosition = useCallback(async () => {
    const state = getTrackingState();
    
    if (!state.isTracking || !state.roomCode) {
      return;
    }

    // Get current position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          lastPositionRef.current = { lat, lng };
          
          if (state.roomCode) {
            // Just send - don't stop on errors
            await sendPositionUpdate(state.roomCode, lat, lng);
          }
        },
        async (error) => {
          console.warn('[GPS Tracking] Geolocation error:', error.message);
          // If we have a last known position, send that
          if (lastPositionRef.current && state.roomCode) {
            await sendPositionUpdate(state.roomCode, lastPositionRef.current.lat, lastPositionRef.current.lng);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }
  }, []);

  const startTracking = useCallback((roomCode?: string, orderCode?: string) => {
    // If roomCode is provided, save state first
    if (roomCode && orderCode) {
      console.log('[GPS Tracking] Starting tracking with provided room:', roomCode);
      saveTrackingState({ isTracking: true, roomCode, orderCode });
    }
    
    const state = getTrackingState();
    
    if (!state.isTracking || !state.roomCode) {
      console.log('[GPS Tracking] Not starting - tracking disabled or no room code', state);
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    console.log('[GPS Tracking] Starting interval for room:', state.roomCode);

    // Start sending position updates every 1 second
    intervalRef.current = setInterval(() => {
      sendCurrentPosition();
    }, TRACKING_INTERVAL_MS);

    // Also send immediately
    sendCurrentPosition();
  }, [sendCurrentPosition]);

  const stopTracking = useCallback(() => {
    console.log('[GPS Tracking] Stopping interval');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    stopGpsTracking();
  }, []);

  // Start tracking on mount if tracking is enabled
  useEffect(() => {
    const state = getTrackingState();
    
    if (state.isTracking && state.roomCode) {
      startTracking();
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startTracking]);

  return {
    startTracking,
    stopTracking,
    getTrackingState,
  };
}
