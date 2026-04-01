import { useState, useEffect, useCallback } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { getDriverCheckins } from '@/lib/externalApi';

export interface CheckinRecord {
  order_number: string;
  checkin_type: 'pickup' | 'delivery' | 'container_pickup' | 'container_return' | 'container_return_confirmed';
  driver_id: string;
  checked_in_at: string;
  latitude?: number;
  longitude?: number;
}

export const useCheckinStatus = (orderNumber: string | undefined, driverId: string | undefined) => {
  const [pickupCheckedIn, setPickupCheckedIn] = useState(false);
  const [deliveryCheckedIn, setDeliveryCheckedIn] = useState(false);
  const [containerPickupCheckedIn, setContainerPickupCheckedIn] = useState(false);
  const [containerReturnCheckedIn, setContainerReturnCheckedIn] = useState(false);
  const [containerReturnConfirmed, setContainerReturnConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const { user } = useAuth();

  // Determine driver type for API calls
  const getDriverType = useCallback((): 'internal' | 'external' | 'freelance' => {
    if (isInternalDriver) return 'internal';
    if (isExternalDriver) return 'external';
    return 'freelance';
  }, [isInternalDriver, isExternalDriver]);

  // Fetch check-in status from API
  const fetchCheckinStatus = useCallback(async () => {
    if (!orderNumber || !driverId) {
      console.log('[useCheckinStatus] Missing orderNumber or driverId, skipping fetch');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const driverType = getDriverType();
      
      console.log('[useCheckinStatus] Fetching check-in status from API:', {
        driverId,
        driverType,
        orderNumber,
      });

      // Use direct external API call
      const { data: result, error } = await getDriverCheckins(driverId, driverType, orderNumber);

      if (error) {
        console.error('[useCheckinStatus] API error:', error);
        setPickupCheckedIn(false);
        setDeliveryCheckedIn(false);
        setContainerPickupCheckedIn(false);
        setContainerReturnCheckedIn(false);
        setContainerReturnConfirmed(false);
        setLoading(false);
        return;
      }

      console.log('[useCheckinStatus] API response:', result);

      // Extract checkins array from API response
      const checkinsData = result?.data || result || [];
      
      if (Array.isArray(checkinsData)) {
        // Filter checkins for this specific order (any driver - supports driver swap scenarios)
        const checkins = checkinsData.filter((checkin: any) => {
          const matchesOrder = 
            checkin.order_number === orderNumber || 
            checkin.transport_orders?.order_number === orderNumber;
          
          return matchesOrder;
        });

        console.log('[useCheckinStatus] Filtered checkins:', checkins);

        // Set states based on checkin types found
        const hasPickup = checkins.some((c: any) => c.checkin_type === 'pickup');
        const hasDelivery = checkins.some((c: any) => c.checkin_type === 'delivery');
        const hasContainerPickup = checkins.some((c: any) => c.checkin_type === 'container_pickup');
        const hasContainerReturn = checkins.some((c: any) => c.checkin_type === 'container_return');
        const hasContainerReturnConfirmed = checkins.some((c: any) => c.checkin_type === 'container_return_confirmed');

        console.log('[useCheckinStatus] Status from API:', {
          pickup: hasPickup,
          delivery: hasDelivery,
          containerPickup: hasContainerPickup,
          containerReturn: hasContainerReturn,
          containerReturnConfirmed: hasContainerReturnConfirmed
        });

        setPickupCheckedIn(hasPickup);
        setDeliveryCheckedIn(hasDelivery);
        setContainerPickupCheckedIn(hasContainerPickup);
        setContainerReturnCheckedIn(hasContainerReturn);
        setContainerReturnConfirmed(hasContainerReturnConfirmed);
      } else {
        console.log('[useCheckinStatus] No checkins found from API');
        setPickupCheckedIn(false);
        setDeliveryCheckedIn(false);
        setContainerPickupCheckedIn(false);
        setContainerReturnCheckedIn(false);
        setContainerReturnConfirmed(false);
      }
    } catch (error) {
      console.error('[useCheckinStatus] Error fetching check-in status:', error);
      // On error, reset states
      setPickupCheckedIn(false);
      setDeliveryCheckedIn(false);
      setContainerPickupCheckedIn(false);
      setContainerReturnCheckedIn(false);
      setContainerReturnConfirmed(false);
    } finally {
      setLoading(false);
    }
  }, [orderNumber, driverId, getDriverType]);

  // Save a checkin (for optimistic update after successful POST)
  const saveCheckin = useCallback((checkin: CheckinRecord) => {
    console.log('[useCheckinStatus] Optimistic update for checkin:', checkin);
    
    // Update state immediately for optimistic UI
    if (checkin.checkin_type === 'pickup') setPickupCheckedIn(true);
    if (checkin.checkin_type === 'delivery') setDeliveryCheckedIn(true);
    if (checkin.checkin_type === 'container_pickup') setContainerPickupCheckedIn(true);
    if (checkin.checkin_type === 'container_return') setContainerReturnCheckedIn(true);
    if (checkin.checkin_type === 'container_return_confirmed') setContainerReturnConfirmed(true);

    return true;
  }, []);

  // Check if a specific checkin exists
  const hasCheckedIn = useCallback((checkinType: 'pickup' | 'delivery' | 'container_pickup' | 'container_return' | 'container_return_confirmed'): boolean => {
    if (checkinType === 'pickup') return pickupCheckedIn;
    if (checkinType === 'delivery') return deliveryCheckedIn;
    if (checkinType === 'container_pickup') return containerPickupCheckedIn;
    if (checkinType === 'container_return') return containerReturnCheckedIn;
    if (checkinType === 'container_return_confirmed') return containerReturnConfirmed;
    return false;
  }, [pickupCheckedIn, deliveryCheckedIn, containerPickupCheckedIn, containerReturnCheckedIn, containerReturnConfirmed]);

  // Get checkin record (simplified - returns null since we don't store full records)
  const getCheckinRecord = useCallback((checkinType: 'pickup' | 'delivery' | 'container_pickup' | 'container_return' | 'container_return_confirmed'): CheckinRecord | null => {
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
    containerPickupCheckedIn,
    containerReturnCheckedIn,
    containerReturnConfirmed,
    loading,
    saveCheckin,
    hasCheckedIn,
    getCheckinRecord,
    refetch,
  };
};
