import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';

export interface CheckinRecord {
  order_number: string;
  checkin_type: 'pickup' | 'delivery' | 'container';
  driver_id: string;
  checked_in_at: string;
  latitude?: number;
  longitude?: number;
}

export const useCheckinStatus = (orderNumber: string | undefined, driverId: string | undefined) => {
  const [pickupCheckedIn, setPickupCheckedIn] = useState(false);
  const [deliveryCheckedIn, setDeliveryCheckedIn] = useState(false);
  const [containerCheckedIn, setContainerCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const { user } = useAuth();

  // Determine driver type for API calls
  const getDriverType = useCallback((): string => {
    if (isInternalDriver) return 'internal';
    if (isExternalDriver) return 'external';
    return 'freelance';
  }, [isInternalDriver, isExternalDriver]);

  // Fetch check-in status from API
  const fetchCheckinStatus = useCallback(async () => {
    if (!orderNumber || !driverId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const driverType = getDriverType();
      
      // Build query params
      const params = new URLSearchParams();
      params.set('driver_id', driverId);
      params.set('driver_type', driverType);
      params.set('order_number', orderNumber);
      
      console.log('[useCheckinStatus] Fetching check-in status from API:', {
        driverId,
        driverType,
        orderNumber
      });

      const { data, error } = await supabase.functions.invoke('get-driver-checkins-proxy', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: null,
      });

      // Use fetch directly for GET with query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      
      console.log('[useCheckinStatus] API response:', result);

      if (result.success && Array.isArray(result.data)) {
        // Filter checkins for this specific order and driver
        const checkins = result.data.filter((checkin: any) => {
          // Match by order_number and driver_id
          const matchesOrder = checkin.order_number === orderNumber;
          
          // Match driver ID based on driver type
          let matchesDriver = false;
          if (isInternalDriver) {
            matchesDriver = checkin.internal_driver_id === driverId;
          } else if (isExternalDriver) {
            matchesDriver = checkin.external_driver_id === driverId;
          } else {
            matchesDriver = checkin.freelance_driver_id === driverId;
          }
          
          return matchesOrder && matchesDriver;
        });

        console.log('[useCheckinStatus] Filtered checkins:', checkins);

        // Set states based on checkin types found
        const hasPickup = checkins.some((c: any) => c.checkin_type === 'pickup');
        const hasDelivery = checkins.some((c: any) => c.checkin_type === 'delivery');
        const hasContainer = checkins.some((c: any) => c.checkin_type === 'container');

        console.log('[useCheckinStatus] Status from API:', {
          pickup: hasPickup,
          delivery: hasDelivery,
          container: hasContainer
        });

        setPickupCheckedIn(hasPickup);
        setDeliveryCheckedIn(hasDelivery);
        setContainerCheckedIn(hasContainer);
      } else {
        console.log('[useCheckinStatus] No checkins found from API');
        setPickupCheckedIn(false);
        setDeliveryCheckedIn(false);
        setContainerCheckedIn(false);
      }
    } catch (error) {
      console.error('[useCheckinStatus] Error fetching check-in status:', error);
      // On error, reset states
      setPickupCheckedIn(false);
      setDeliveryCheckedIn(false);
      setContainerCheckedIn(false);
    } finally {
      setLoading(false);
    }
  }, [orderNumber, driverId, getDriverType, isInternalDriver, isExternalDriver]);

  // Save a checkin (for optimistic update after successful POST)
  const saveCheckin = useCallback((checkin: CheckinRecord) => {
    console.log('[useCheckinStatus] Optimistic update for checkin:', checkin);
    
    // Update state immediately for optimistic UI
    if (checkin.checkin_type === 'pickup') setPickupCheckedIn(true);
    if (checkin.checkin_type === 'delivery') setDeliveryCheckedIn(true);
    if (checkin.checkin_type === 'container') setContainerCheckedIn(true);

    return true;
  }, []);

  // Check if a specific checkin exists
  const hasCheckedIn = useCallback((checkinType: 'pickup' | 'delivery' | 'container'): boolean => {
    if (checkinType === 'pickup') return pickupCheckedIn;
    if (checkinType === 'delivery') return deliveryCheckedIn;
    if (checkinType === 'container') return containerCheckedIn;
    return false;
  }, [pickupCheckedIn, deliveryCheckedIn, containerCheckedIn]);

  // Get checkin record (simplified - returns null since we don't store full records)
  const getCheckinRecord = useCallback((checkinType: 'pickup' | 'delivery' | 'container'): CheckinRecord | null => {
    return null;
  }, []);

  // Refetch function to manually refresh status
  const refetch = useCallback(() => {
    fetchCheckinStatus();
  }, [fetchCheckinStatus]);

  // Load checkin status on mount and when dependencies change
  useEffect(() => {
    fetchCheckinStatus();
  }, [fetchCheckinStatus]);

  return {
    pickupCheckedIn,
    deliveryCheckedIn,
    containerCheckedIn,
    loading,
    saveCheckin,
    hasCheckedIn,
    getCheckinRecord,
    refetch,
  };
};
