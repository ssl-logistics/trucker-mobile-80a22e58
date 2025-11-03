import { useState } from "react";
import { useForm } from "react-hook-form";
import { Camera, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RegistrationData } from "@/pages/Register";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface VehiclePhotosStepProps {
  data: RegistrationData;
  onNext: (data: Partial<RegistrationData>) => void;
  onBack: () => void;
}

const VehiclePhotosStep = ({ data, onNext, onBack }: VehiclePhotosStepProps) => {
  const [hasTrailer, setHasTrailer] = useState(data.hasTrailer || false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<keyof typeof photoFiles | null>(null);
  
  // Store actual File objects
  const [photoFiles, setPhotoFiles] = useState<{
    front: File | null;
    side: File | null;
    back: File | null;
    plate: File | null;
    trailerPlate: File | null;
  }>({
    front: data.frontPhoto || null,
    side: data.sidePhoto || null,
    back: data.backPhoto || null,
    plate: data.platePhoto || null,
    trailerPlate: data.trailerPlatePhoto || null,
  });
  
  // Store preview URLs for display
  const [photos, setPhotos] = useState({
    front: data.frontPhoto ? URL.createObjectURL(data.frontPhoto) : "",
    side: data.sidePhoto ? URL.createObjectURL(data.sidePhoto) : "",
    back: data.backPhoto ? URL.createObjectURL(data.backPhoto) : "",
    plate: data.platePhoto ? URL.createObjectURL(data.platePhoto) : "",
    trailerPlate: data.trailerPlatePhoto ? URL.createObjectURL(data.trailerPlatePhoto) : "",
  });

  const handlePhotoChange = (type: keyof typeof photoFiles, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFiles(prev => ({ ...prev, [type]: file }));
      setPhotos(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
      setDrawerOpen(false);
    }
  };

  const openPhotoDrawer = (type: keyof typeof photoFiles) => {
    setCurrentPhotoType(type);
    setDrawerOpen(true);
  };

  const handleSubmit = () => {
    onNext({ 
      hasTrailer,
      frontPhoto: photoFiles.front || undefined,
      sidePhoto: photoFiles.side || undefined,
      backPhoto: photoFiles.back || undefined,
      platePhoto: photoFiles.plate || undefined,
      trailerPlatePhoto: photoFiles.trailerPlate || undefined,
    });
  };

  const PhotoUploadBox = ({ 
    type, 
    label, 
    required = true 
  }: { 
    type: keyof typeof photoFiles; 
    label: string; 
    required?: boolean;
  }) => (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <button 
        type="button"
        onClick={() => openPhotoDrawer(type)}
        className="flex flex-col items-center justify-center border-2 border-dashed border-input rounded-lg h-32 cursor-pointer hover:border-primary transition-colors w-full"
      >
        {photos[type] ? (
          <img src={photos[type]} alt={label} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="text-center">
            <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">กดเพื่อถ่ายรูปหรือเลือกรูป</p>
          </div>
        )}
      </button>
      {/* Hidden inputs for camera and gallery */}
      <input
        id={`photo-camera-${type}`}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhotoChange(type, e)}
      />
      <input
        id={`photo-gallery-${type}`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePhotoChange(type, e)}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <PhotoUploadBox type="front" label="รูปหน้ารถ" />
        <PhotoUploadBox type="side" label="รูปข้างรถ" />
        <PhotoUploadBox type="back" label="รูปหลังรถ" />
        <PhotoUploadBox type="plate" label="รูปป้ายทะเบียน" />

        <div className="flex items-center space-x-2 py-4">
          <Checkbox 
            id="hasTrailer" 
            checked={hasTrailer}
            onCheckedChange={(checked) => setHasTrailer(checked as boolean)}
          />
          <Label 
            htmlFor="hasTrailer" 
            className="text-sm font-normal cursor-pointer"
          >
            มีส่วนของหางลาก
          </Label>
        </div>

        {hasTrailer && (
          <PhotoUploadBox type="trailerPlate" label="รูปภาพป้ายทะเบียนหางลาก" />
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 rounded-xl h-12 text-base font-medium border-2"
          >
            ย้อนกลับ
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
          >
            ต่อไป →
          </Button>
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">เพิ่มรูปภาพ</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => {
                if (currentPhotoType) {
                  document.getElementById(`photo-camera-${currentPhotoType}`)?.click();
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-base">ถ่ายภาพ</span>
            </button>
            <button
              onClick={() => {
                if (currentPhotoType) {
                  document.getElementById(`photo-gallery-${currentPhotoType}`)?.click();
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Image className="w-6 h-6" />
              <span className="text-base">เลือกรูปจากแกลลอรี่</span>
            </button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full rounded-xl h-12">
                ยกเลิก
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default VehiclePhotosStep;
