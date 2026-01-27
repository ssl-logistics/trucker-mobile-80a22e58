import { useState, useEffect, useCallback } from 'react';

export interface CheckinRecord {
  order_number: string;
  checkin_type: 'pickup' | 'delivery' | 'container';
  driver_id: string;
  checked_in_at: string;
  latitude?: number;
  longitude?: number;
}

const CHECKIN_STORAGE_KEY = 'driver_checkins';

export const useCheckinStatus = (orderNumber: string | undefined, driverId: string | undefined) => {
  const [pickupCheckedIn, setPickupCheckedIn] = useState(false);
  const [deliveryCheckedIn, setDeliveryCheckedIn] = useState(false);
  const [containerCheckedIn, setContainerCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get all checkins from localStorage
  const getStoredCheckins = useCallback((): CheckinRecord[] => {
    try {
      const stored = localStorage.getItem(CHECKIN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Save a checkin to localStorage
  const saveCheckin = useCallback((checkin: CheckinRecord) => {
    try {
      const checkins = getStoredCheckins();
      
      // Check if already exists
      const existingIndex = checkins.findIndex(
        c => c.order_number === checkin.order_number && 
             c.checkin_type === checkin.checkin_type &&
             c.driver_id === checkin.driver_id
      );

      if (existingIndex >= 0) {
        checkins[existingIndex] = checkin;
      } else {
        checkins.push(checkin);
      }

      localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(checkins));
      console.log('[useCheckinStatus] Saved checkin:', checkin);

      // Update state immediately
      if (checkin.checkin_type === 'pickup') setPickupCheckedIn(true);
      if (checkin.checkin_type === 'delivery') setDeliveryCheckedIn(true);
      if (checkin.checkin_type === 'container') setContainerCheckedIn(true);

      return true;
    } catch (error) {
      console.error('[useCheckinStatus] Error saving checkin:', error);
      return false;
    }
  }, [getStoredCheckins]);

  // Check if a specific checkin exists
  const hasCheckedIn = useCallback((checkinType: 'pickup' | 'delivery' | 'container'): boolean => {
    if (!orderNumber || !driverId) return false;
    
    const checkins = getStoredCheckins();
    return checkins.some(
      c => c.order_number === orderNumber && 
           c.checkin_type === checkinType &&
           c.driver_id === driverId
    );
  }, [orderNumber, driverId, getStoredCheckins]);

  // Get checkin record
  const getCheckinRecord = useCallback((checkinType: 'pickup' | 'delivery' | 'container'): CheckinRecord | null => {
    if (!orderNumber || !driverId) return null;
    
    const checkins = getStoredCheckins();
    return checkins.find(
      c => c.order_number === orderNumber && 
           c.checkin_type === checkinType &&
           c.driver_id === driverId
    ) || null;
  }, [orderNumber, driverId, getStoredCheckins]);

  // Load checkin status on mount
  useEffect(() => {
    if (!orderNumber || !driverId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const pickup = hasCheckedIn('pickup');
    const delivery = hasCheckedIn('delivery');
    const container = hasCheckedIn('container');

    console.log('[useCheckinStatus] Loaded status for', orderNumber, {
      pickup,
      delivery,
      container
    });

    setPickupCheckedIn(pickup);
    setDeliveryCheckedIn(delivery);
    setContainerCheckedIn(container);
    setLoading(false);
  }, [orderNumber, driverId, hasCheckedIn]);

  return {
    pickupCheckedIn,
    deliveryCheckedIn,
    containerCheckedIn,
    loading,
    saveCheckin,
    hasCheckedIn,
    getCheckinRecord,
  };
};
