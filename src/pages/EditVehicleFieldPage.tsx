import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverTypeFromUserType } from '@/utils/driverTypeMapping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { locations } from '@/data/locations';
import { saveDriverVehicle, type DriverVehicleData } from '@/lib/driverProfileData';
import { isDriverNotFoundError } from '@/utils/oauthDriverSync';

const vehicleBrands = [
  { value: 'isuzu', label: 'Isuzu' },
  { value: 'hino', label: 'Hino' },
  { value: 'mitsubishi', label: 'Mitsubishi' },
  { value: 'nissan', label: 'Nissan' },
  { value: 'mercedes-benz', label: 'Mercedes-Benz' },
  { value: 'volvo', label: 'Volvo' },
  { value: 'scania', label: 'Scania' },
];

export default function EditVehicleFieldPage() {
  const navigate = useNavigate();
  const { user, userType, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const field = searchParams.get('field');
  const [value, setValue] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: '', length: '', height: '' });
  const [containerTypes, setContainerTypes] = useState<string[]>([]);

  const fieldTranslationMap: { [key: string]: string } = {
    plate_number: 'editVehicle.fieldPlateNumber',
    plate_province: 'editVehicle.fieldPlateProvince',
    vehicle_brand: 'editVehicle.fieldVehicleBrand',
    vehicle_color: 'editVehicle.fieldVehicleColor',
    vin: 'editVehicle.fieldVIN',
    vehicle_type: 'editVehicle.fieldVehicleType',
    fuel_type: 'editVehicle.fieldFuelType',
    load_capacity: 'editVehicle.fieldLoadCapacity',
    dimensions: 'editVehicle.fieldVehicleSize',
    container_types: 'editVehicle.fieldContainerTypes',
  };

  const displayFieldName = field && fieldTranslationMap[field] ? t(fieldTranslationMap[field]) : field || '';

  // Use stable values that match the data stored in the backend
  const fuelTypes = [
    { value: 'diesel', label: t('editVehicle.diesel') },
    { value: 'gasoline', label: t('editVehicle.gasoline') },
    { value: 'electric', label: t('editVehicle.electric') },
    { value: 'hybrid', label: t('editVehicle.hybrid') },
  ];

  const vehicleTypes = [
    { value: 'tractor-head', label: t('editVehicle.tractorHead') },
    { value: 'pickup', label: t('editVehicle.pickup') },
    { value: '6-wheel', label: t('editVehicle.truck6Wheel') },
    { value: '10-wheel', label: t('editVehicle.truck10Wheel') },
  ];

  const containerTypeOptions = [
    { value: '20', label: t('editVehicle.container20ft') },
    { value: '40', label: t('editVehicle.container40ft') },
    { value: '40_hc', label: t('editVehicle.container40ftHC') },
    { value: 'reefer', label: t('editVehicle.containerReefer') },
  ];

  const provinces = Array.from(new Set(locations.map((loc) => loc.province))).sort();

  // Check if user is internal or external driver (not freelance)
  // These drivers have vehicle data stored on the user object from external API
  const isExternalOrInternalDriver = userType === 'internal_driver' || userType === 'external_driver';
  
  // Check if user should use the external API for vehicle updates (all driver types that have data in TMS)
  const shouldUseExternalApi = isExternalOrInternalDriver || userType === 'freelance_driver';

  useEffect(() => {
    loadCurrentValue();
  }, [user, field]);

  const loadCurrentValue = async () => {
    if (!user || !field) return;

    // Driver data stored on the user object (from external API / TMS)
    if (shouldUseExternalApi && user.plate_number) {
      switch (field) {
        case 'plate_number':
          setValue(user.plate_number || '');
          break;
        case 'plate_province':
          setValue(user.plate_province || '');
          break;
        case 'vehicle_brand':
          setValue(user.vehicle_brand || '');
          break;
        case 'vehicle_color':
          setValue(user.vehicle_color || '');
          break;
        case 'vin':
          setValue(user.vin || '');
          break;
        case 'vehicle_type':
          setValue(user.vehicle_type || '');
          break;
        case 'fuel_type':
          setValue(user.fuel_type || '');
          break;
        case 'load_capacity':
          setValue(user.load_capacity?.toString() || '');
          break;
        case 'dimensions':
          setDimensions({
            width: user.width?.toString() || '',
            length: user.length?.toString() || '',
            height: user.height?.toString() || '',
          });
          break;
        case 'container_types':
          setContainerTypes(user.container_types || []);
          break;
      }
      return;
    }

    // Fallback: vehicles table (for non-external users)
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', user.id)
        .single();

      if (error) throw error;
      if (!data) return;

      setVehicleId(data.id);

      switch (field) {
        case 'plate_number':
          setValue(data.plate_number);
          break;
        case 'plate_province':
          setValue(data.plate_province);
          break;
        case 'vehicle_brand':
          setValue(data.vehicle_brand);
          break;
        case 'vehicle_color':
          setValue(data.vehicle_color);
          break;
        case 'vin':
          setValue(data.vin);
          break;
        case 'vehicle_type':
          setValue(data.vehicle_type);
          break;
        case 'fuel_type':
          setValue(data.fuel_type);
          break;
        case 'load_capacity':
          setValue(data.load_capacity?.toString() || '');
          break;
        case 'dimensions':
          setDimensions({
            width: data.width?.toString() || '',
            length: data.length?.toString() || '',
            height: data.height?.toString() || '',
          });
          break;
        case 'container_types':
          setContainerTypes(data.container_types || []);
          break;
      }
    } catch (error) {
      console.error('Error loading vehicle data:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const persistedDriverId = (user as any).cloud_driver_id || (user as any).app_user_id || user.id;

    setLoading(true);
    try {
      // Use external API for all driver types
      if (shouldUseExternalApi) {
        const updatePayload: Record<string, any> = {
          driver_id: user.id,
          driver_type: getDriverTypeFromUserType(userType),
        };

        switch (field) {
          case 'plate_number':
          case 'plate_province':
          case 'vehicle_brand':
          case 'vehicle_color':
          case 'vin':
          case 'vehicle_type':
          case 'fuel_type':
            updatePayload[field] = value;
            break;
          case 'load_capacity':
            updatePayload.load_capacity = parseFloat(value);
            break;
          case 'dimensions':
            updatePayload.width = dimensions.width ? parseFloat(dimensions.width) : null;
            updatePayload.length = dimensions.length ? parseFloat(dimensions.length) : null;
            updatePayload.height = dimensions.height ? parseFloat(dimensions.height) : null;
            break;
          case 'container_types':
            updatePayload.container_types = containerTypes;
            break;
        }

        // 1) Try TMS update (may fail for LINE-only users; that's OK)
        let tmsData: any = null;
        let tmsOk = false;
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-freelance-driver`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify(updatePayload),
            }
          );

          tmsData = await response.json().catch(() => ({}));
          tmsOk = response.ok;

          // If TMS failed for a non-driver-not-found reason, surface the error
          if (!response.ok && !isDriverNotFoundError(tmsData?.error, tmsData)) {
            throw new Error(tmsData?.message || tmsData?.error || t('editVehicle.saveError'));
          }
        } catch (tmsErr: any) {
          // Network / TMS errors are non-fatal — we still persist to our own backend.
          console.warn('[EditVehicle] TMS update failed (non-fatal):', tmsErr?.message);
        }

        // 2) Always persist to our own backend keyed by driver_id
        const vehiclePatch: DriverVehicleData = {};
        switch (field) {
          case 'plate_number':
          case 'plate_province':
          case 'vehicle_brand':
          case 'vehicle_color':
          case 'vin':
          case 'vehicle_type':
          case 'fuel_type':
            (vehiclePatch as any)[field] = value;
            break;
          case 'load_capacity':
            vehiclePatch.load_capacity = value ? parseFloat(value) : null;
            break;
          case 'dimensions':
            vehiclePatch.width = dimensions.width ? parseFloat(dimensions.width) : null;
            vehiclePatch.length = dimensions.length ? parseFloat(dimensions.length) : null;
            vehiclePatch.height = dimensions.height ? parseFloat(dimensions.height) : null;
            break;
          case 'container_types':
            vehiclePatch.container_types = containerTypes;
            break;
        }
        const backendOk = await saveDriverVehicle(persistedDriverId, vehiclePatch);

        if (!tmsOk && !backendOk) {
          throw new Error(t('editVehicle.saveError'));
        }

        toast({
          title: t('editVehicle.saveSuccess'),
          description: t('editVehicle.saveSuccessMessage'),
        });

        if (tmsOk) {
          await refreshUser();
        } else {
          // Merge locally so UI reflects new values without wiping other TMS fields
          const { getAuthItem, setAuthItem } = await import('@/utils/authStorage');
          const stored = await getAuthItem('auth_driver');
          if (stored) {
            try {
              const driverObj = JSON.parse(stored);
              Object.assign(driverObj, vehiclePatch);
              await setAuthItem('auth_driver', JSON.stringify(driverObj));
              window.dispatchEvent(new CustomEvent('auth_driver_updated', {
                detail: { driver: driverObj, userType: userType || 'freelance_driver' },
              }));
            } catch {}
          }
        }
        navigate('/vehicle-info');
        return;
      }

      // Fallback: vehicles table
      if (!vehicleId) return;

      let updateData: any = {};

      switch (field) {
        case 'plate_number':
          updateData = { plate_number: value };
          break;
        case 'plate_province':
          updateData = { plate_province: value };
          break;
        case 'vehicle_brand':
          updateData = { vehicle_brand: value };
          break;
        case 'vehicle_color':
          updateData = { vehicle_color: value };
          break;
        case 'vin':
          updateData = { vin: value };
          break;
        case 'vehicle_type':
          updateData = { vehicle_type: value };
          break;
        case 'fuel_type':
          updateData = { fuel_type: value };
          break;
        case 'load_capacity':
          updateData = { load_capacity: parseFloat(value) };
          break;
        case 'dimensions':
          updateData = {
            width: dimensions.width ? parseFloat(dimensions.width) : null,
            length: dimensions.length ? parseFloat(dimensions.length) : null,
            height: dimensions.height ? parseFloat(dimensions.height) : null,
          };
          break;
        case 'container_types':
          updateData = { container_types: containerTypes };
          break;
      }

      const { error } = await supabase.from('vehicles').update(updateData).eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: t('editVehicle.saveSuccess'),
        description: t('editVehicle.saveSuccessMessage'),
      });
      navigate('/vehicle-info');
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast({
        title: t('editVehicle.error'),
        description: error instanceof Error ? error.message : t('editVehicle.saveError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setValue('');
  };

  const renderInput = () => {
    switch (field) {
      case 'plate_province':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((province) => (
                <SelectItem key={province} value={province}>
                  {province}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'vehicle_brand':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicleBrands.map((brand) => (
                <SelectItem key={brand.value} value={brand.value}>
                  {brand.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'vehicle_type':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'fuel_type':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fuelTypes.map((fuel) => (
                <SelectItem key={fuel.value} value={fuel.value}>
                  {fuel.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'load_capacity':
        return (
          <div className="relative">
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('editVehicle.enterLoadCapacity')}
            />
            {value && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        );
      case 'dimensions':
        return (
          <div className="space-y-4">
            <div>
              <Label>{t('editVehicle.width')}</Label>
              <Input
                type="number"
                value={dimensions.width}
                onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })}
                placeholder={t('editVehicle.enterWidth')}
              />
            </div>
            <div>
              <Label>{t('editVehicle.length')}</Label>
              <Input
                type="number"
                value={dimensions.length}
                onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })}
                placeholder={t('editVehicle.enterLength')}
              />
            </div>
            <div>
              <Label>{t('editVehicle.height')}</Label>
              <Input
                type="number"
                value={dimensions.height}
                onChange={(e) => setDimensions({ ...dimensions, height: e.target.value })}
                placeholder={t('editVehicle.enterHeight')}
              />
            </div>
          </div>
        );
      case 'container_types':
        return (
          <div className="space-y-3">
            {containerTypeOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={option.value}
                  checked={containerTypes.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setContainerTypes([...containerTypes, option.value]);
                    } else {
                      setContainerTypes(containerTypes.filter((t) => t !== option.value));
                    }
                  }}
                />
                <Label htmlFor={option.value} className="font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );
      default:
        return (
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`${t('editVehicle.enter')}${displayFieldName}`}
            />
            {value && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        );
    }
  };

  const isValid = () => {
    if (field === 'dimensions') {
      return dimensions.width || dimensions.length || dimensions.height;
    }
    if (field === 'container_types') {
      return containerTypes.length > 0;
    }
    return value.trim() !== '';
  };

  const handleBack = () => {
    console.log('EditVehicleFieldPage back clicked');
    navigate('/vehicle-info');
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 flex items-center justify-center relative">
        <button onClick={handleBack} className="absolute left-0 p-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold">{displayFieldName}</h1>
      </header>

      <div className="p-4 space-y-6">
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">{displayFieldName}</Label>
          {renderInput()}
        </div>

        <Button
          onClick={handleSave}
          disabled={!isValid() || loading}
          className="w-full"
        >
          {loading ? t('editVehicle.saving') : t('editVehicle.save')}
        </Button>
      </div>
    </div>
  );
}
