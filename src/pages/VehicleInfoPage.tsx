import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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

const containerTypeOptions = [
  { value: '20ft', label: '20 ฟุต' },
  { value: '40ft', label: '40 ฟุต' },
  { value: '40ft_hc', label: '40 ฟุต High Cube' },
  { value: 'reefer', label: 'ตู้เย็น (Reefer)' },
];

const vehicleBrands = ['Isuzu', 'Hino', 'Mitsubishi', 'Nissan', 'Mercedes-Benz', 'Volvo', 'Scania'];
const fuelTypes = ['ดีเซล', 'เบนซิน', 'ไฟฟ้า', 'ไฮบริด'];
const vehicleTypes = ['รถหัวลาก', 'รถกระบะ', 'รถบรรทุก 6 ล้อ', 'รถบรรทุก 10 ล้อ'];

export default function VehicleInfoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('data');
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

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
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลรถได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVehiclePhotos = async () => {
    if (!user) return;

    try {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id')
        .eq('driver_id', user.id)
        .single();

      if (!vehicleData) return;

      const { data, error } = await supabase
        .from('vehicle_photos')
        .select('*')
        .eq('vehicle_id', vehicleData.id);

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error loading vehicle photos:', error);
    }
  };

  const handleSave = async () => {
    if (!user || !vehicleData) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          plate_number: vehicleData.plate_number,
          plate_province: vehicleData.plate_province,
          vehicle_brand: vehicleData.vehicle_brand,
          vehicle_color: vehicleData.vehicle_color,
          vin: vehicleData.vin,
          fuel_type: vehicleData.fuel_type,
          load_capacity: vehicleData.load_capacity,
          vehicle_type: vehicleData.vehicle_type,
          width: vehicleData.width,
          length: vehicleData.length,
          height: vehicleData.height,
          has_trailer: vehicleData.has_trailer,
          trailer_plate_number: vehicleData.trailer_plate_number,
          trailer_plate_province: vehicleData.trailer_plate_province,
          container_types: vehicleData.container_types,
        })
        .eq('id', vehicleData.id);

      if (error) throw error;

      toast({
        title: 'บันทึกสำเร็จ',
        description: 'ข้อมูลรถถูกบันทึกเรียบร้อยแล้ว',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving vehicle data:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกข้อมูลได้',
        variant: 'destructive',
      });
    }
  };

  const handlePhotoUpload = async (photoType: string, file: File) => {
    if (!user || !vehicleData) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${vehicleData.id}-${photoType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName);

      // Check if photo already exists
      const existingPhoto = photos.find(p => p.photo_type === photoType);

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
            photo_type: photoType,
            photo_url: publicUrl,
          });

        if (insertError) throw insertError;
      }

      await loadVehiclePhotos();
      toast({
        title: 'อัพโหลดสำเร็จ',
        description: 'รูปภาพถูกบันทึกเรียบร้อยแล้ว',
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถอัพโหลดรูปภาพได้',
        variant: 'destructive',
      });
    }
  };

  const getPhotoByType = (type: string) => {
    return photos.find(p => p.photo_type === type);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">กำลังโหลด...</div>
      </div>
    );
  }

  if (!vehicleData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">ไม่พบข้อมูลรถ</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold">ข้อมูลรถ</h1>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
          <TabsTrigger value="data" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
            ข้อมูลรถ
          </TabsTrigger>
          <TabsTrigger value="photos" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
            รูปรถ
          </TabsTrigger>
        </TabsList>

        {/* Vehicle Data Tab */}
        <TabsContent value="data" className="p-4 space-y-4">
          <div className="flex justify-end mb-4">
            {isEditing ? (
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
                  ยกเลิก
                </Button>
                <Button onClick={handleSave} size="sm">
                  บันทึก
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                <Edit2 className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            )}
          </div>

          {/* Registration Document */}
          <div className="bg-muted rounded-lg p-4 aspect-video flex items-center justify-center">
            <span className="text-muted-foreground">ทะเบียนรถ</span>
          </div>

          {/* Vehicle Info Fields */}
          <div className="space-y-4">
            <div>
              <Label>หมายเลขทะเบียนรถ</Label>
              <Input
                value={vehicleData.plate_number}
                onChange={(e) => setVehicleData({ ...vehicleData, plate_number: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label>จังหวัดจดทะเบียนรถ</Label>
              <Select
                value={vehicleData.plate_province}
                onValueChange={(value) => setVehicleData({ ...vehicleData, plate_province: value })}
                disabled={!isEditing}
              >
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
            </div>

            <div>
              <Label>ยี่ห้อรถยนต์</Label>
              <Select
                value={vehicleData.vehicle_brand}
                onValueChange={(value) => setVehicleData({ ...vehicleData, vehicle_brand: value })}
                disabled={!isEditing}
              >
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
            </div>

            <div>
              <Label>สีรถยนต์</Label>
              <Input
                value={vehicleData.vehicle_color}
                onChange={(e) => setVehicleData({ ...vehicleData, vehicle_color: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label>VIN</Label>
              <Input
                value={vehicleData.vin}
                onChange={(e) => setVehicleData({ ...vehicleData, vin: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label>ประเภทรถยนต์</Label>
              <Select
                value={vehicleData.vehicle_type}
                onValueChange={(value) => setVehicleData({ ...vehicleData, vehicle_type: value })}
                disabled={!isEditing}
              >
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
            </div>

            <div>
              <Label>ประเภทเชื้อเพลิง</Label>
              <Select
                value={vehicleData.fuel_type}
                onValueChange={(value) => setVehicleData({ ...vehicleData, fuel_type: value })}
                disabled={!isEditing}
              >
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
            </div>

            <div>
              <Label>น้ำหนักบรรทุก (ตัน)</Label>
              <Input
                type="number"
                value={vehicleData.load_capacity}
                onChange={(e) => setVehicleData({ ...vehicleData, load_capacity: parseFloat(e.target.value) })}
                disabled={!isEditing}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>กว้าง (ม.)</Label>
                <Input
                  type="number"
                  value={vehicleData.width || ''}
                  onChange={(e) => setVehicleData({ ...vehicleData, width: parseFloat(e.target.value) || undefined })}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label>ยาว (ม.)</Label>
                <Input
                  type="number"
                  value={vehicleData.length || ''}
                  onChange={(e) => setVehicleData({ ...vehicleData, length: parseFloat(e.target.value) || undefined })}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label>สูง (ม.)</Label>
                <Input
                  type="number"
                  value={vehicleData.height || ''}
                  onChange={(e) => setVehicleData({ ...vehicleData, height: parseFloat(e.target.value) || undefined })}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <Label className="mb-3 block">ประเภทตู้คอนเทนเนอร์ที่รองรับ</Label>
              <div className="space-y-3">
                {containerTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.value}
                      checked={vehicleData.container_types?.includes(option.value)}
                      onCheckedChange={(checked) => {
                        const newTypes = checked
                          ? [...(vehicleData.container_types || []), option.value]
                          : vehicleData.container_types?.filter((t) => t !== option.value) || [];
                        setVehicleData({ ...vehicleData, container_types: newTypes });
                      }}
                      disabled={!isEditing}
                    />
                    <Label htmlFor={option.value} className="font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Vehicle Photos Tab */}
        <TabsContent value="photos" className="p-4 space-y-4">
          {['front', 'side', 'back'].map((photoType) => {
            const photo = getPhotoByType(photoType);
            const labels: Record<string, string> = {
              front: 'รูปหน้ารถ',
              side: 'รูปข้างรถ',
              back: 'รูปหลังรถ',
            };

            return (
              <div key={photoType}>
                <Label className="mb-2 block">{labels[photoType]}</Label>
                <div className="relative bg-muted rounded-lg aspect-video overflow-hidden">
                  {photo ? (
                    <img src={photo.photo_url} alt={labels[photoType]} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      ยังไม่มีรูปภาพ
                    </div>
                  )}
                  <label className="absolute bottom-2 right-2">
                    <div className="bg-white rounded-full p-2 cursor-pointer shadow-lg">
                      <Camera className="w-5 h-5 text-foreground" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(photoType, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
