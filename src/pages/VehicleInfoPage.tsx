import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Edit2, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { toast } from '@/hooks/use-toast';
import { locations } from '@/data/locations';

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

export default function VehicleInfoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('data');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegistrationDrawerOpen, setIsRegistrationDrawerOpen] = useState(false);
  const [registrationPhoto, setRegistrationPhoto] = useState<string | null>(null);
  const [isVehiclePhotoDrawerOpen, setIsVehiclePhotoDrawerOpen] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<string>('');
  const [photoTimestamp, setPhotoTimestamp] = useState<number>(Date.now());

  const containerTypeOptions = [
    { value: '20ft', label: t('editVehicle.container20ft') },
    { value: '40ft', label: t('editVehicle.container40ft') },
    { value: '40ft_hc', label: t('editVehicle.container40ftHC') },
    { value: 'reefer', label: t('editVehicle.containerReefer') },
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
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', user.id)
        .single();

      if (error) throw error;
      setVehicleData(data);
    } catch (error) {
      console.error('Error loading vehicle data:', error);
      toast({
        title: t('vehicle.errorLoad'),
        description: t('vehicle.errorLoadDesc'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVehiclePhotos = async () => {
    if (!user) return;

    try {
      console.log('Loading vehicle photos for user:', user.id);
      
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id')
        .eq('driver_id', user.id)
        .single();

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
    if (!user || !vehicleData) return;

    console.log('Starting photo upload for type:', photoType);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${vehicleData.id}-${photoType}-${Date.now()}.${fileExt}`;

      console.log('Uploading to:', fileName);

      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Check if photo already exists
      const existingPhoto = photos.find(p => p.photo_type === photoType);
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
        const { error: insertError } = await supabase
          .from('vehicle_photos')
          .insert({
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
      await new Promise(resolve => setTimeout(resolve, 500));
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
        description: t('vehicle.uploadError'),
        variant: 'destructive',
      });
    }
  };

  const getPhotoByType = (type: string) => {
    return photos.find(p => p.photo_type === type);
  };

  const handleRegistrationPhotoUpload = async (file: File) => {
    if (!user || !vehicleData) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${vehicleData.id}-registration-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName);

      // Check if registration photo already exists
      const existingPhoto = photos.find(p => p.photo_type === 'registration');

      if (existingPhoto) {
        const { error: updateError } = await supabase
          .from('vehicle_photos')
          .update({ photo_url: publicUrl })
          .eq('id', existingPhoto.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('vehicle_photos')
          .insert({
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
        description: t('vehicle.uploadError'),
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">{t('vehicle.loading')}</div>
      </div>
    );
  }

  if (!vehicleData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">{t('vehicle.noData')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
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
            <h3 className="text-sm font-medium text-foreground">{t('vehicle.registrationDoc')}</h3>
          </div>
          <div className="relative bg-muted rounded-lg p-4 aspect-video flex items-center justify-center overflow-hidden">
            {registrationPhoto ? (
              <img 
                src={`${registrationPhoto}?t=${photoTimestamp}`}
                alt={t('alt.vehicleRegistration')} 
                className="w-full h-full object-cover"
                key={`registration-${photoTimestamp}`}
              />
            ) : (
              <span className="text-muted-foreground">{t('vehicle.clickToView')}</span>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 bg-background/80 hover:bg-background"
              onClick={() => setIsRegistrationDrawerOpen(true)}
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Vehicle Info Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.plateNumber')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.plate_number}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=plate_number')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.plateProvince')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.plate_province}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=plate_province')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.brand')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.vehicle_brand}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=vehicle_brand')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.color')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.vehicle_color}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=vehicle_color')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.vin')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.vin}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=vin')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.type')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.vehicle_type}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=vehicle_type')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.fuelType')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.fuel_type}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=fuel_type')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.loadCapacity')}</Label>
                <p className="text-base font-medium mt-1">{vehicleData.load_capacity}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=load_capacity')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.dimensions')}</Label>
                <p className="text-base font-medium mt-1">
                  {vehicleData.width && vehicleData.length && vehicleData.height
                    ? `${t('vehicle.width')} ${vehicleData.width} ${t('vehicle.length')} ${vehicleData.length} ${t('vehicle.height')} ${vehicleData.height} ${t('vehicle.meter')}`
                    : t('vehicle.notSpecified')}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=dimensions')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">{t('vehicle.containerTypes')}</Label>
                <p className="text-base font-medium mt-1">
                  {vehicleData.container_types && vehicleData.container_types.length > 0
                    ? vehicleData.container_types
                        .map((type) => containerTypeOptions.find((opt) => opt.value === type)?.label || type)
                        .join(', ')
                    : t('vehicle.notSpecified')}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={() => navigate('/edit-vehicle-field?field=container_types')}
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Vehicle Photos Tab */}
        <TabsContent value="photos" className="p-4 space-y-6">
          {['front', 'side', 'back'].map((photoType) => {
            const photo = getPhotoByType(photoType);
            const labels: Record<string, string> = {
              front: t('vehicle.frontPhoto'),
              side: t('vehicle.leftPhoto'),
              back: t('vehicle.backPhoto'),
            };

            return (
              <div key={photoType}>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-medium">{labels[photoType]}</Label>
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
                </div>
                <div className="relative bg-muted rounded-2xl aspect-video overflow-hidden">
                  {photo ? (
                    <>
                      <img 
                        src={`${photo.photo_url}?t=${photoTimestamp}`} 
                        alt={labels[photoType]} 
                        className="w-full h-full object-cover"
                        key={`${photoType}-${photoTimestamp}`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="text-white text-lg font-medium drop-shadow-lg">{t('vehicle.clickToView')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground text-lg">{t('vehicle.clickToView')}</span>
                    </div>
                  )}
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
                    accept="image/*"
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
                    accept="image/*"
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
                    accept="image/*"
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
                    accept="image/*"
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
    </div>
  );
}
