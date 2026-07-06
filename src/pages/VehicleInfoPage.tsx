import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Edit2, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { usePresignedImageUrl, usePresignedImageUrls } from '@/hooks/usePresignedImageUrl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { locations } from '@/data/locations';
import { getTranslatedVehicleType } from '@/utils/vehicleTypeTranslation';
import { getTranslatedFuelType } from '@/utils/fuelTypeTranslation';
import { compressImage } from '@/utils/imageCompression';

interface VehicleData {
  id: string;
  plate_number: string;
  plate_province: string;
  vehicle_brand: string;
  vehicle_color: string;
  vin: string;
  fuel_type: string;
  load_capacity: number;
  vehicle_type: string;
  width?: number;
  length?: number;
  height?: number;
  has_trailer: boolean;
  trailer_plate_number?: string;
  trailer_plate_province?: string;
  container_types: string[];
}

interface VehiclePhoto {
  id: string;
  photo_type: string;
  photo_url: string;
}

const vehicleBrands = ['Isuzu', 'Hino', 'Mitsubishi', 'Nissan', 'Mercedes-Benz', 'Volvo', 'Scania'];

type VehicleApiRecord = Record<string, unknown>;

const REGISTRATION_URL_KEYS = [
  'registration_document_url',
  'document_url',
  'registration_photo_url',
  'vehicle_registration_url',
  'registration_image_url',
  'book_image_url',
];

const REGISTRATION_ARRAY_KEYS = ['registration_photos', 'registration_photo_urls', 'registration_document_urls'];
const VEHICLE_SOURCE_KEYS = ['vehicle', 'truck', 'factory_truck', 'factory_trucks', 'logistics_truck', 'logistics_trucks', 'logistics_trailer', 'logistics_trailers'];

const asRecord = (value: unknown): VehicleApiRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as VehicleApiRecord;
};

const getVehicleApiSources = (user: unknown): VehicleApiRecord[] => {
  const root = asRecord(user);
  if (!root) return [];

  const sources = [root];
  VEHICLE_SOURCE_KEYS.forEach((key) => {
    const value = root[key];
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      const record = asRecord(item);
      if (record) sources.push(record);
    });
  });

  return sources;
};

const getFirstApiUrl = (sources: VehicleApiRecord[], keys: string[]) => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return null;
};

const collectApiUrls = (sources: VehicleApiRecord[], keys: string[]) => {
  const urls: string[] = [];
  sources.forEach((source) => {
    keys.forEach((key) => {
      const value = source[key];
      const values = Array.isArray(value) ? value : [value];
      values.forEach((item) => {
        if (typeof item === 'string' && item.trim() && !urls.includes(item)) urls.push(item);
      });
    });
  });
  return urls;
};

export default function VehicleInfoPage() {
  const navigate = useNavigate();
  const { user, userType, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('data');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistrationDrawerOpen, setIsRegistrationDrawerOpen] = useState(false);
  const [registrationPhoto, setRegistrationPhoto] = useState<string | null>(null);
  const [registrationPhotos, setRegistrationPhotos] = useState<string[]>([]);
  const [isVehiclePhotoDrawerOpen, setIsVehiclePhotoDrawerOpen] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<string>('');
  const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Only freelance drivers can edit vehicle info
  const canEditVehicle = userType === 'freelance_driver';

  const photoUrls = useMemo(() => photos.map((p) => p.photo_url), [photos]);
  const { urls: presignedPhotoUrls, isLoading: isPhotosPresigning } = usePresignedImageUrls(photoUrls);
  const { url: presignedRegistrationPhoto, isLoading: isRegistrationPresigning } = usePresignedImageUrl(registrationPhoto);
  const { urls: presignedRegistrationPhotos, isLoading: isRegistrationPhotosPresigning } = usePresignedImageUrls(registrationPhotos);

  const getPresignedPhotoUrl = (photo: VehiclePhoto | undefined) => {
    if (!photo) return null;
    const idx = photos.findIndex((p) => p.id === photo.id);
    const url = idx >= 0 ? presignedPhotoUrls[idx] : null;
    return url || photo.photo_url || null;
  };

  const containerTypeOptions = [
    { value: '20', label: t('editVehicle.container20ft') },
    { value: '40', label: t('editVehicle.container40ft') },
    { value: '40_hc', label: t('editVehicle.container40ftHC') },
    { value: 'reefer', label: t('editVehicle.containerReefer') },
    // Support type20, type40 format from internal_driver API
    { value: 'type20', label: t('editVehicle.container20ft') },
    { value: 'type40', label: t('editVehicle.container40ft') },
    // Support reefer20, reefer40, dry20, dry40 format from external API
    { value: 'reefer20', label: `${t('editVehicle.containerReefer')} 20'` },
    { value: 'reefer40', label: `${t('editVehicle.containerReefer')} 40'` },
    { value: 'dry20', label: `${t('editVehicle.containerDry')} 20'` },
    { value: 'dry40', label: `${t('editVehicle.containerDry')} 40'` },
  ];

  const provinces = Array.from(new Set(locations.map(loc => loc.province))).sort();

  useEffect(() => {
    if (user) {
      loadVehicleData();
      loadVehiclePhotos();
    }
  }, [user]);

  const loadVehicleData = async () => {
    if (!user) return;

    try {
      // Resolve vehicle data from root user fields OR nested logistics_truck(s)/truck/vehicle
      const apiSources = getVehicleApiSources(user);
      const pick = (...keys: string[]) => getFirstApiUrl(apiSources, keys);
      const pickAny = (...keys: string[]): unknown => {
        for (const source of apiSources) {
          for (const key of keys) {
            const v = source[key];
            if (v !== undefined && v !== null && v !== '') return v;
          }
        }
        return undefined;
      };

      const plateNumber = (pick('plate_number', 'license_plate') || '') as string;
      const plateProvince = (pick('plate_province', 'province', 'license_plate_province') || '') as string;

      // First try to get from user object (from external API via AuthContext)
      if (plateNumber || user.plate_number) {
        const containerTypesRaw = pickAny('container_types');
        const vehicleFromUser: VehicleData = {
          id: user.id,
          plate_number: plateNumber || user.plate_number || '',
          plate_province: plateProvince || user.plate_province || '',
          vehicle_brand: (pick('vehicle_brand', 'brand', 'car_brand') || '') as string,
          vehicle_color: (pick('vehicle_color', 'color') || '') as string,
          vin: (pick('vin') || '') as string,
          fuel_type: (pick('fuel_type') || '') as string,
          load_capacity: Number(pickAny('load_capacity', 'weight_capacity') || 0) || 0,
          vehicle_type: (pick('vehicle_type') || '') as string,
          width: pickAny('width', 'dimensions_width') as number | undefined,
          length: pickAny('length', 'dimensions_length') as number | undefined,
          height: pickAny('height', 'dimensions_height') as number | undefined,
          has_trailer: Boolean(pickAny('has_trailer')),
          trailer_plate_number: pickAny('trailer_plate_number', 'trailer_license_plate') as string | undefined,
          trailer_plate_province: pickAny('trailer_plate_province', 'trailer_province') as string | undefined,
          container_types: Array.isArray(containerTypesRaw) ? (containerTypesRaw as string[]) : [],
        };
        setVehicleData(vehicleFromUser);
        
        // Also set registration photos from user/API vehicle objects
        const registrationUrls = collectApiUrls(apiSources, REGISTRATION_ARRAY_KEYS);
        const fallbackUrl = getFirstApiUrl(apiSources, REGISTRATION_URL_KEYS);
        const resolvedRegistrationPhotos = registrationUrls.length > 0 ? registrationUrls : fallbackUrl ? [fallbackUrl] : [];
        if (resolvedRegistrationPhotos.length > 0) {
          setRegistrationPhotos(resolvedRegistrationPhotos);
          setRegistrationPhoto(resolvedRegistrationPhotos[0]);
        }
        setLoading(false);
        return;
      }

      // Fallback to Supabase vehicles table
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setVehicleData(data);
      }
    } catch (error) {
      console.error('Error loading vehicle data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVehiclePhotos = async () => {
    if (!user) return;

    try {
      const apiSources = getVehicleApiSources(user);
      const registrationUrls = collectApiUrls(apiSources, REGISTRATION_ARRAY_KEYS);
      const fallbackRegistrationUrl = getFirstApiUrl(apiSources, REGISTRATION_URL_KEYS);
      
      // If user has photos from external API, use those
      const hasExternalPhotos = getFirstApiUrl(apiSources, ['front_photo_url', 'front_image_url', 'front_url', 'photo_front_url']) ||
        getFirstApiUrl(apiSources, ['side_photo_url', 'side_image_url', 'left_photo_url', 'left_image_url', 'photo_side_url']) ||
        getFirstApiUrl(apiSources, ['back_photo_url', 'rear_image_url', 'back_image_url', 'rear_photo_url', 'photo_back_url']) ||
        getFirstApiUrl(apiSources, ['plate_photo_url', 'license_plate_image_url', 'license_plate_photo_url', 'plate_image_url', 'other_image_url']) ||
        getFirstApiUrl(apiSources, ['trailer_plate_photo_url', 'trailer_license_plate_image_url']) ||
        registrationUrls.length > 0 ||
        fallbackRegistrationUrl;
      
      if (hasExternalPhotos) {
        const externalPhotos: VehiclePhoto[] = [];
        const frontPhotoUrl = getFirstApiUrl(apiSources, ['front_photo_url', 'front_image_url', 'front_url', 'photo_front_url']);
        const sidePhotoUrl = getFirstApiUrl(apiSources, ['side_photo_url', 'side_image_url', 'left_photo_url', 'left_image_url', 'photo_side_url']);
        const backPhotoUrl = getFirstApiUrl(apiSources, ['back_photo_url', 'rear_image_url', 'back_image_url', 'rear_photo_url', 'photo_back_url']);
        const platePhotoUrl = getFirstApiUrl(apiSources, ['plate_photo_url', 'license_plate_image_url', 'license_plate_photo_url', 'plate_image_url', 'other_image_url']);
        const trailerPlatePhotoUrl = getFirstApiUrl(apiSources, ['trailer_plate_photo_url', 'trailer_license_plate_image_url']);

        if (frontPhotoUrl) externalPhotos.push({ id: 'front', photo_type: 'front', photo_url: frontPhotoUrl });
        if (sidePhotoUrl) externalPhotos.push({ id: 'side', photo_type: 'side', photo_url: sidePhotoUrl });
        if (backPhotoUrl) externalPhotos.push({ id: 'back', photo_type: 'back', photo_url: backPhotoUrl });
        if (platePhotoUrl) externalPhotos.push({ id: 'plate', photo_type: 'plate', photo_url: platePhotoUrl });
        if (trailerPlatePhotoUrl) externalPhotos.push({ id: 'trailer_plate', photo_type: 'trailer_plate', photo_url: trailerPlatePhotoUrl });
        
        // Support registration_photos array from API
        if (registrationUrls.length > 0) {
          registrationUrls.forEach((url: string, index: number) => {
            externalPhotos.push({ id: `registration_${index}`, photo_type: 'registration', photo_url: url });
          });
          setRegistrationPhotos(registrationUrls);
          setRegistrationPhoto(registrationUrls[0]);
        } else if (fallbackRegistrationUrl) {
          externalPhotos.push({ id: 'registration', photo_type: 'registration', photo_url: fallbackRegistrationUrl });
          setRegistrationPhoto(fallbackRegistrationUrl);
          setRegistrationPhotos([fallbackRegistrationUrl]);
        }
        setPhotos(externalPhotos);
        return;
      }

      // Fallback to Supabase
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id')
        .eq('driver_id', user.id)
        .maybeSingle();

      if (!vehicleData) {
        console.log('No vehicle data found');
        return;
      }

      console.log('Vehicle ID:', vehicleData.id);

      const { data, error } = await supabase
        .from('vehicle_photos')
        .select('*')
        .eq('vehicle_id', vehicleData.id);

      if (error) {
        console.error('Error loading photos:', error);
        throw error;
      }
      
      console.log('Loaded photos:', data);
      setPhotos(data || []);
      
      // Load registration photo
      const registrationPhotoData = data?.find(p => p.photo_type === 'registration');
      if (registrationPhotoData) {
        console.log('Registration photo:', registrationPhotoData.photo_url);
        setRegistrationPhoto(registrationPhotoData.photo_url);
      }
    } catch (error) {
      console.error('Error loading vehicle photos:', error);
    }
  };


  const handlePhotoUpload = async (photoType: string, file: File) => {
    if (!user) return;

    console.log('Starting photo upload for type:', photoType);
    setIsUploading(true);

    // All driver types (freelance/internal/external) use the same update API
    const isExternalOrInternalDriver = true;

    try {
      // Upload to S3 via edge function
      const formData = new FormData();
      formData.append('file', await compressImage(file));
      formData.append('folder', 'vehicle-photos');
      formData.append('fileName', `${user.id}_${photoType}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`);

      const uploadRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-to-s3`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson?.url) {
        throw new Error(uploadJson?.error || t('vehicle.uploadError'));
      }

      const publicUrl: string = uploadJson.url;
      console.log('S3 upload success:', publicUrl);

      // Internal/External driver flow: update driver record via API
      if (isExternalOrInternalDriver) {
        // Map photoType to driver field name
        const photoFieldMap: Record<string, string> = {
          front: 'front_photo_url',
          side: 'side_photo_url',
          back: 'back_photo_url',
          plate: 'plate_photo_url',
          trailer_plate: 'trailer_plate_photo_url',
        };

        const fieldName = photoFieldMap[photoType];
        if (!fieldName) {
          throw new Error(`Unknown photo type: ${photoType}`);
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-freelance-driver`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              driver_id: user.id,
              driver_type: getDriverTypeFromUserType(userType),
              [fieldName]: publicUrl,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || data?.error || t('vehicle.uploadError'));
        }

        // Update local photos state
        setPhotos((prev) => {
          const existingIndex = prev.findIndex((p) => p.photo_type === photoType);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], photo_url: publicUrl };
            return updated;
          }
          return [...prev, { id: photoType, photo_type: photoType, photo_url: publicUrl }];
        });

        setPhotoTimestamp(Date.now());
        setIsVehiclePhotoDrawerOpen(false);
        await refreshUser();

        toast({
          title: t('vehicle.uploadSuccess'),
          description: t('vehicle.uploadSuccessDesc'),
        });
        return;
      }

      // Fallback: Supabase vehicles table - save S3 URL to vehicle_photos
      if (!vehicleData) return;

      // Check if photo already exists
      const existingPhoto = photos.find((p) => p.photo_type === photoType);
      console.log('Existing photo:', existingPhoto);

      if (existingPhoto) {
        const { error: updateError } = await supabase
          .from('vehicle_photos')
          .update({ photo_url: publicUrl })
          .eq('id', existingPhoto.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
        console.log('Updated existing photo');
      } else {
        const { error: insertError } = await supabase.from('vehicle_photos').insert({
          vehicle_id: vehicleData.id,
          photo_type: photoType,
          photo_url: publicUrl,
        });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
        console.log('Inserted new photo');
      }

      // Reload photos with a slight delay to ensure DB is updated
      console.log('Reloading photos...');
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadVehiclePhotos();

      // Force refresh by updating timestamp
      setPhotoTimestamp(Date.now());
      console.log('Photos reloaded, new photos:', photos);

      setIsVehiclePhotoDrawerOpen(false);
      toast({
        title: t('vehicle.uploadSuccess'),
        description: t('vehicle.uploadSuccessDesc'),
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: t('vehicle.errorLoad'),
        description: error instanceof Error ? error.message : t('vehicle.uploadError'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getPhotoByType = (type: string) => {
    const existingPhoto = photos.find(p => p.photo_type === type);
    if (existingPhoto) return existingPhoto;

    const apiSources = getVehicleApiSources(user);
    const photoKeysByType: Record<string, string[]> = {
      front: ['front_photo_url', 'front_image_url', 'front_url', 'photo_front_url'],
      side: ['side_photo_url', 'side_image_url', 'left_photo_url', 'left_image_url', 'photo_side_url'],
      back: ['back_photo_url', 'rear_image_url', 'back_image_url', 'rear_photo_url', 'photo_back_url'],
      plate: ['plate_photo_url', 'license_plate_image_url', 'license_plate_photo_url', 'plate_image_url', 'other_image_url'],
      trailer_plate: ['trailer_plate_photo_url', 'trailer_license_plate_image_url'],
    };
    const fallbackUrl = getFirstApiUrl(apiSources, photoKeysByType[type] || []);
    return fallbackUrl ? { id: type, photo_type: type, photo_url: fallbackUrl } : undefined;
  };

  const handleRegistrationPhotoUpload = async (file: File) => {
    if (!user) return;

    setIsUploading(true);

    // All driver types (freelance/internal/external) use the same update API
    const isExternalOrInternalDriver = true;

    try {
      // Upload to S3 via edge function
      const formData = new FormData();
      formData.append('file', await compressImage(file));
      formData.append('folder', 'driver-documents');
      formData.append('fileName', `${user.id}_registration_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`);

      const uploadRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-to-s3`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson?.url) {
        throw new Error(uploadJson?.error || t('vehicle.uploadError'));
      }

      const publicUrl: string = uploadJson.url;
      console.log('S3 registration upload success:', publicUrl);

      // Internal/External driver flow: update driver record via API
      if (isExternalOrInternalDriver) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-freelance-driver`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              driver_id: user.id,
              driver_type: getDriverTypeFromUserType(userType),
              registration_photo_url: publicUrl,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || data?.error || t('vehicle.uploadError'));
        }

        setRegistrationPhoto(publicUrl);
        setPhotoTimestamp(Date.now());
        setIsRegistrationDrawerOpen(false);
        await refreshUser();

        toast({
          title: t('vehicle.uploadSuccess'),
          description: t('vehicle.registrationSuccessDesc'),
        });
        return;
      }

      // Fallback: Supabase vehicles table - save S3 URL to vehicle_photos
      if (!vehicleData) return;

      // Check if registration photo already exists
      const existingPhoto = photos.find((p) => p.photo_type === 'registration');

      if (existingPhoto) {
        const { error: updateError } = await supabase
          .from('vehicle_photos')
          .update({ photo_url: publicUrl })
          .eq('id', existingPhoto.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('vehicle_photos').insert({
          vehicle_id: vehicleData.id,
          photo_type: 'registration',
          photo_url: publicUrl,
        });

        if (insertError) throw insertError;
      }

      setRegistrationPhoto(publicUrl);
      await loadVehiclePhotos();

      // Force refresh by updating timestamp
      setPhotoTimestamp(Date.now());

      setIsRegistrationDrawerOpen(false);
      toast({
        title: t('vehicle.uploadSuccess'),
        description: t('vehicle.registrationSuccessDesc'),
      });
    } catch (error) {
      console.error('Error uploading registration photo:', error);
      toast({
        title: t('vehicle.errorLoad'),
        description: error instanceof Error ? error.message : t('vehicle.uploadError'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">{t('vehicle.loading')}</div>
      </div>
    );
  }

  // If no vehicle data, create placeholder with dashes so user can edit
  const displayVehicleData: VehicleData = vehicleData || {
    id: user?.id || '',
    plate_number: '---',
    plate_province: '---',
    vehicle_brand: '---',
    vehicle_color: '---',
    vin: '---',
    fuel_type: '---',
    load_capacity: 0,
    vehicle_type: '---',
    width: null,
    length: null,
    height: null,
    has_trailer: false,
    trailer_plate_number: null,
    trailer_plate_province: null,
    container_types: [],
  };

  return (
    <div className="min-h-screen bg-background pb-6 relative">
      {/* Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm font-medium">{t('vehicle.uploading') || 'กำลังอัปโหลด...'}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-header text-header-foreground page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/settings')} className="absolute left-0">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('vehicle.title')}</h1>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
          <TabsTrigger value="data" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
            {t('vehicle.dataTab')}
          </TabsTrigger>
          <TabsTrigger value="photos" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
            {t('vehicle.photosTab')}
          </TabsTrigger>
        </TabsList>

        {/* Vehicle Data Tab */}
        <TabsContent value="data" className="p-4 space-y-4">
          {/* Registration Document */}
          <div className="mb-2">
            <h3 className="text-sm font-medium text-foreground">
              {t('vehicle.registrationDoc')}
              {registrationPhotos.length > 1 && (
                <span className="text-muted-foreground ml-2">({registrationPhotos.length} {t('vehicle.photos') || 'รูป'})</span>
              )}
            </h3>
          </div>
          
          {/* Registration Photos Gallery */}
          {registrationPhotos.length > 0 ? (
            <div className={`grid gap-3 ${registrationPhotos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {registrationPhotos.map((_, index) => {
                const displayUrl = presignedRegistrationPhotos[index] || registrationPhotos[index];
                return (
                  <div 
                    key={`registration-${index}-${photoTimestamp}`}
                    className="relative bg-muted rounded-lg overflow-hidden aspect-video"
                  >
                    {displayUrl ? (
                      <img 
                        src={displayUrl}
                        alt={`${t('alt.vehicleRegistration')} ${index + 1}`} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          {isRegistrationPhotosPresigning ? (t('vehicle.loading') || 'กำลังโหลด...') : t('vehicle.clickToView')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative bg-muted rounded-lg p-4 aspect-video flex items-center justify-center overflow-hidden">
              <span className="text-muted-foreground">{t('vehicle.noPhotos') || 'ยังไม่มีรูปภาพ'}</span>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                  onClick={() => setIsRegistrationDrawerOpen(true)}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          )}

          {/* Vehicle Info Fields */}
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.plateNumber')}</Label>
                <p className="text-base font-medium mt-1">{displayVehicleData.plate_number}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=plate_number')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.plateProvince')}</Label>
                <p className="text-base font-medium mt-1">{displayVehicleData.plate_province}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=plate_province')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.brand')}</Label>
                <p className="text-base font-medium mt-1">{displayVehicleData.vehicle_brand}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=vehicle_brand')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.color')}</Label>
                <p className="text-base font-medium mt-1">{displayVehicleData.vehicle_color}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=vehicle_color')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.vin')}</Label>
                <p className="text-base font-medium mt-1">{displayVehicleData.vin}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=vin')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.type')}</Label>
                <p className="text-base font-medium mt-1">{getTranslatedVehicleType(displayVehicleData.vehicle_type, t)}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=vehicle_type')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.fuelType')}</Label>
                <p className="text-base font-medium mt-1">{getTranslatedFuelType(displayVehicleData.fuel_type, t)}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=fuel_type')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.loadCapacity')}</Label>
                <p className="text-base font-medium mt-1">{displayVehicleData.load_capacity}</p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=load_capacity')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.dimensions')}</Label>
                <p className="text-base font-medium mt-1">
                  {displayVehicleData.width && displayVehicleData.length && displayVehicleData.height
                    ? `${t('vehicle.width')} ${displayVehicleData.width} ${t('vehicle.length')} ${displayVehicleData.length} ${t('vehicle.height')} ${displayVehicleData.height} ${t('vehicle.meter')}`
                    : t('vehicle.notSpecified')}
                </p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=dimensions')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.containerTypes')}</Label>
                <p className="text-base font-medium mt-1">
                  {displayVehicleData.container_types && displayVehicleData.container_types.length > 0
                    ? displayVehicleData.container_types
                        .map((type) => containerTypeOptions.find((opt) => opt.value === type)?.label || type)
                        .join(', ')
                    : t('vehicle.notSpecified')}
                </p>
              </div>
              {canEditVehicle && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => navigate('/edit-vehicle-field?field=container_types')}
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Vehicle Photos Tab */}
        <TabsContent value="photos" className="p-4 space-y-6">
          {['front', 'side', 'back', 'plate'].map((photoType) => {
            const photo = getPhotoByType(photoType);
            const photoUrl = getPresignedPhotoUrl(photo);
            const labels: Record<string, string> = {
              front: t('vehicle.frontPhoto'),
              side: t('vehicle.leftPhoto'),
              back: t('vehicle.backPhoto'),
              plate: t('vehicle.platePhoto'),
            };

            return (
              <div key={photoType}>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-medium">{labels[photoType]}</Label>
                  {canEditVehicle && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setCurrentPhotoType(photoType);
                        setIsVehiclePhotoDrawerOpen(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="relative bg-muted rounded-2xl aspect-video overflow-hidden">
                  {photo ? (
                    photoUrl ? (
                      <>
                        <img 
                          src={photoUrl} 
                          alt={labels[photoType]} 
                          className="w-full h-full object-cover"
                          key={`${photoType}-${photoTimestamp}`}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoUrl(photoUrl)}
                          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                          aria-label={labels[photoType]}
                        >
                          <span className="text-white text-lg font-medium drop-shadow-lg">{t('vehicle.clickToView')}</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground text-lg">
                          {isPhotosPresigning ? (t('vehicle.loading') || 'กำลังโหลด...') : t('vehicle.clickToView')}
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground text-lg">{t('vehicle.clickToView')}</span>
                    </div>
                  )}
                  {canEditVehicle && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg"
                      onClick={() => {
                        setCurrentPhotoType(photoType);
                        setIsVehiclePhotoDrawerOpen(true);
                      }}
                    >
                      <Camera className="w-5 h-5 text-gray-700" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Registration Photo Upload Drawer */}
      <Drawer open={isRegistrationDrawerOpen} onOpenChange={setIsRegistrationDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('vehicle.selectPhoto')}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3">
            <label className="block">
              <Button 
                variant="outline" 
                className="w-full h-14 justify-start gap-3"
                asChild
              >
                <div>
                  <Camera className="w-5 h-5" />
                  <span>{t('vehicle.takePhoto')}</span>
                  <input
                    type="file"
                    accept={ACCEPT_IMAGE_DOC}
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleRegistrationPhotoUpload(file);
                    }}
                  />
                </div>
              </Button>
            </label>
            
            <label className="block">
              <Button 
                variant="outline" 
                className="w-full h-14 justify-start gap-3"
                asChild
              >
                <div>
                  <Image className="w-5 h-5" />
                  <span>{t('vehicle.chooseFromGallery')}</span>
                  <input
                    type="file"
                    accept={ACCEPT_IMAGE_DOC}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleRegistrationPhotoUpload(file);
                    }}
                  />
                </div>
              </Button>
            </label>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Vehicle Photo Upload Drawer */}
      <Drawer open={isVehiclePhotoDrawerOpen} onOpenChange={setIsVehiclePhotoDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('vehicle.selectPhoto')}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3">
            <label className="block">
              <Button 
                variant="outline" 
                className="w-full h-14 justify-start gap-3"
                asChild
              >
                <div>
                  <Camera className="w-5 h-5" />
                  <span>{t('vehicle.takePhoto')}</span>
                  <input
                    type="file"
                    accept={ACCEPT_IMAGE_DOC}
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && currentPhotoType) handlePhotoUpload(currentPhotoType, file);
                    }}
                  />
                </div>
              </Button>
            </label>
            
            <label className="block">
              <Button 
                variant="outline" 
                className="w-full h-14 justify-start gap-3"
                asChild
              >
                <div>
                  <Image className="w-5 h-5" />
                  <span>{t('vehicle.chooseFromGallery')}</span>
                  <input
                    type="file"
                    accept={ACCEPT_IMAGE_DOC}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && currentPhotoType) handlePhotoUpload(currentPhotoType, file);
                    }}
                  />
                </div>
              </Button>
            </label>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
          {previewPhotoUrl && (
            <img
              src={previewPhotoUrl}
              alt="Preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
