import { useState } from "react";
import { useForm } from "react-hook-form";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RegistrationData } from "@/pages/Register";

interface VehiclePhotosStepProps {
  data: RegistrationData;
  onNext: (data: Partial<RegistrationData>) => void;
  onBack: () => void;
}

const VehiclePhotosStep = ({ data, onNext, onBack }: VehiclePhotosStepProps) => {
  const [hasTrailer, setHasTrailer] = useState(data.hasTrailer || false);
  const [photos, setPhotos] = useState({
    front: data.frontPhoto ? URL.createObjectURL(data.frontPhoto) : "",
    side: data.sidePhoto ? URL.createObjectURL(data.sidePhoto) : "",
    back: data.backPhoto ? URL.createObjectURL(data.backPhoto) : "",
    plate: data.platePhoto ? URL.createObjectURL(data.platePhoto) : "",
    trailerPlate: data.trailerPlatePhoto ? URL.createObjectURL(data.trailerPlatePhoto) : "",
  });

  const handlePhotoChange = (type: keyof typeof photos, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotos(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
    }
  };

  const handleSubmit = () => {
    onNext({ hasTrailer });
  };

  const PhotoUploadBox = ({ 
    type, 
    label, 
    required = true 
  }: { 
    type: keyof typeof photos; 
    label: string; 
    required?: boolean;
  }) => (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <label 
        htmlFor={`photo-${type}`}
        className="flex flex-col items-center justify-center border-2 border-dashed border-input rounded-lg h-32 cursor-pointer hover:border-primary transition-colors"
      >
        {photos[type] ? (
          <img src={photos[type]} alt={label} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="text-center">
            <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">กดเพื่อถ่ายรูปหรือเลือกรูป</p>
          </div>
        )}
      </label>
      <input
        id={`photo-${type}`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePhotoChange(type, e)}
      />
    </div>
  );

  return (
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
  );
};

export default VehiclePhotosStep;
