import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Global cache for vehicle photo to prevent flickering during navigation
let cachedVehiclePhoto: string | null = null;
let cachedVehicleUserId: string | null = null;

// Export function to clear vehicle photo cache (called on logout)
export const clearVehiclePhotoCache = () => {
  cachedVehiclePhoto = null;
  cachedVehicleUserId = null;
};

export const useVehiclePhoto = () => {
  const { user } = useAuth();
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(cachedVehiclePhoto);
  const [loading, setLoading] = useState(cachedVehiclePhoto === null && !!user);

  useEffect(() => {
    const fetchVehiclePhoto = async () => {
      if (!user) {
        clearVehiclePhotoCache();
        setVehiclePhoto(null);
        setLoading(false);
        return;
      }

      // If user changed, clear cache
      if (cachedVehicleUserId && cachedVehicleUserId !== user.id) {
        clearVehiclePhotoCache();
      }

      // Skip fetch if we already have the cached photo for this user
      if (cachedVehiclePhoto !== null && cachedVehicleUserId === user.id) {
        setVehiclePhoto(cachedVehiclePhoto);
        setLoading(false);
        return;
      }

      try {
        // Load vehicle photo (front photo as driver photo)
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('id')
          .eq('driver_id', user.id)
          .maybeSingle();

        if (vehicleData) {
          const { data: photoData } = await supabase
            .from('vehicle_photos')
            .select('photo_url')
            .eq('vehicle_id', vehicleData.id)
            .eq('photo_type', 'front')
            .maybeSingle();

          cachedVehiclePhoto = photoData?.photo_url || null;
          cachedVehicleUserId = user.id;
          setVehiclePhoto(cachedVehiclePhoto);
        } else {
          cachedVehiclePhoto = null;
          cachedVehicleUserId = user.id;
          setVehiclePhoto(null);
        }
      } catch (error) {
        console.error('Error fetching vehicle photo:', error);
        setVehiclePhoto(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVehiclePhoto();
  }, [user]);

  return { vehiclePhoto, loading };
};
