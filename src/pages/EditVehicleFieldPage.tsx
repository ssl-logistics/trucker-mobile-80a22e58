import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { locations } from '@/data/locations';

const vehicleBrands = ['Isuzu', 'Hino', 'Mitsubishi', 'Nissan', 'Mercedes-Benz', 'Volvo', 'Scania'];
const vehicleTypes = ['รถหัวลาก', 'รถกระบะ', 'รถบรรทุก 6 ล้อ', 'รถบรรทุก 10 ล้อ'];

export default function EditVehicleFieldPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const field = searchParams.get('field');
  const [value, setValue] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: '', length: '', height: '' });
  const [containerTypes, setContainerTypes] = useState<string[]>([]);

  const getFieldTranslationKey = (fieldName: string | null): string => {
    if (!fieldName) return '';
    const fieldMap: { [key: string]: string } = {
      'หมายเลขทะเบียนรถ': 'editVehicle.fieldPlateNumber',
      'จังหวัดจดทะเบียนรถ': 'editVehicle.fieldPlateProvince',
      'ยี่ห้อรถยนต์': 'editVehicle.fieldVehicleBrand',
      'สีรถยนต์': 'editVehicle.fieldVehicleColor',
      'VIN': 'editVehicle.fieldVIN',
      'ประเภทรถยนต์': 'editVehicle.fieldVehicleType',
      'ประเภทเชื้อเพลิง': 'editVehicle.fieldFuelType',
      'น้ำหนักบรรทุก': 'editVehicle.fieldLoadCapacity',
      'ขนาดรถ': 'editVehicle.fieldVehicleSize',
      'ประเภทตู้คอนเทนเนอร์': 'editVehicle.fieldContainerTypes',
    };
    return fieldMap[fieldName] || '';
  };

  const displayFieldName = getFieldTranslationKey(field) ? t(getFieldTranslationKey(field)) : field;

  const fuelTypes = [t('editVehicle.diesel'), t('editVehicle.gasoline'), t('editVehicle.electric'), t('editVehicle.hybrid')];
  const containerTypeOptions = [
    { value: '20ft', label: t('editVehicle.container20ft') },
    { value: '40ft', label: t('editVehicle.container40ft') },
    { value: '40ft_hc', label: t('editVehicle.container40ftHC') },
    { value: 'reefer', label: t('editVehicle.containerReefer') },
  ];

  const provinces = Array.from(new Set(locations.map(loc => loc.province))).sort();

  useEffect(() => {
    loadCurrentValue();
  }, [user, field]);

  const loadCurrentValue = async () => {
    if (!user || !field) return;

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
        case 'หมายเลขทะเบียนรถ':
          setValue(data.plate_number);
          break;
        case 'จังหวัดจดทะเบียนรถ':
          setValue(data.plate_province);
          break;
        case 'ยี่ห้อรถยนต์':
          setValue(data.vehicle_brand);
          break;
        case 'สีรถยนต์':
          setValue(data.vehicle_color);
          break;
        case 'VIN':
          setValue(data.vin);
          break;
        case 'ประเภทรถยนต์':
          setValue(data.vehicle_type);
          break;
        case 'ประเภทเชื้อเพลิง':
          setValue(data.fuel_type);
          break;
        case 'น้ำหนักบรรทุก':
          setValue(data.load_capacity?.toString() || '');
          break;
        case 'ขนาดรถ':
          setDimensions({
            width: data.width?.toString() || '',
            length: data.length?.toString() || '',
            height: data.height?.toString() || '',
          });
          break;
        case 'ประเภทตู้คอนเทนเนอร์':
          setContainerTypes(data.container_types || []);
          break;
      }
    } catch (error) {
      console.error('Error loading vehicle data:', error);
    }
  };

  const handleSave = async () => {
    if (!user || !vehicleId) return;

    setLoading(true);
    try {
      let updateData: any = {};

      switch (field) {
        case 'หมายเลขทะเบียนรถ':
          updateData = { plate_number: value };
          break;
        case 'จังหวัดจดทะเบียนรถ':
          updateData = { plate_province: value };
          break;
        case 'ยี่ห้อรถยนต์':
          updateData = { vehicle_brand: value };
          break;
        case 'สีรถยนต์':
          updateData = { vehicle_color: value };
          break;
        case 'VIN':
          updateData = { vin: value };
          break;
        case 'ประเภทรถยนต์':
          updateData = { vehicle_type: value };
          break;
        case 'ประเภทเชื้อเพลิง':
          updateData = { fuel_type: value };
          break;
        case 'น้ำหนักบรรทุก':
          updateData = { load_capacity: parseFloat(value) };
          break;
        case 'ขนาดรถ':
          updateData = {
            width: dimensions.width ? parseFloat(dimensions.width) : null,
            length: dimensions.length ? parseFloat(dimensions.length) : null,
            height: dimensions.height ? parseFloat(dimensions.height) : null,
          };
          break;
        case 'ประเภทตู้คอนเทนเนอร์':
          updateData = { container_types: containerTypes };
          break;
      }

      const { error } = await supabase
        .from('vehicles')
        .update(updateData)
        .eq('id', vehicleId);

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
        description: t('editVehicle.saveError'),
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
      case 'จังหวัดจดทะเบียนรถ':
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
      case 'ยี่ห้อรถยนต์':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicleBrands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'ประเภทรถยนต์':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'ประเภทเชื้อเพลิง':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fuelTypes.map((fuel) => (
                <SelectItem key={fuel} value={fuel}>
                  {fuel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'น้ำหนักบรรทุก':
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
      case 'ขนาดรถ':
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
      case 'ประเภทตู้คอนเทนเนอร์':
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
    if (field === 'ขนาดรถ') {
      return dimensions.width || dimensions.length || dimensions.height;
    }
    if (field === 'ประเภทตู้คอนเทนเนอร์') {
      return containerTypes.length > 0;
    }
    return value.trim() !== '';
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 flex items-center justify-center relative">
        <button onClick={() => navigate(-1)} className="absolute left-0">
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
