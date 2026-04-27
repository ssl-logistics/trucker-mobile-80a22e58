import { useState, useEffect, useRef } from "react";
import { Camera, Image } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RegistrationData } from "@/pages/Register";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { toast } from "@/hooks/use-toast";
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
  const { t } = useLanguage();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();
  const formRef = useRef<HTMLDivElement>(null);
  const [hasTrailer, setHasTrailer] = useState(data.hasTrailer || false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<keyof typeof photoFiles | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  
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

  const handleNativePhoto = async (type: keyof typeof photoFiles, source: 'camera' | 'gallery') => {
    try {
      const file = source === 'camera' ? await takePhoto() : await selectFromGallery();
      if (file) {
        setPhotoFiles(prev => ({ ...prev, [type]: file }));
        setPhotos(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
        setDrawerOpen(false);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
    }
  };

  const openPhotoDrawer = (type: keyof typeof photoFiles) => {
    setCurrentPhotoType(type);
    setDrawerOpen(true);
  };

  // Check if all required photos are uploaded
  const isFormValid = () => {
    const requiredPhotos = photoFiles.front && photoFiles.side && photoFiles.back && photoFiles.plate;
    if (hasTrailer) {
      return requiredPhotos && photoFiles.trailerPlate;
    }
    return requiredPhotos;
  };

  // Check if a specific photo has error
  const hasError = (type: keyof typeof photoFiles, required: boolean = true) => {
    if (!showErrors || !required) return false;
    return !photoFiles[type];
  };

  // Auto-scroll to first error
  useEffect(() => {
    if (showErrors && !isFormValid()) {
      const firstErrorElement = formRef.current?.querySelector('.border-destructive');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [showErrors, photoFiles, hasTrailer]);

  const handleSubmit = () => {
    setShowErrors(true);
    if (!isFormValid()) {
      // Scroll will happen via useEffect
      return;
    }
    
    // Scroll to top before moving to next step
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
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
  }) => {
    const isError = hasError(type, required);
    
    return (
      <div className="space-y-2">
        <Label className={isError ? "text-destructive" : ""}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <button 
          type="button"
          onClick={() => openPhotoDrawer(type)}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-32 cursor-pointer transition-colors w-full ${
            isError 
              ? "border-destructive bg-destructive/5" 
              : "border-input hover:border-primary"
          }`}
        >
          {photos[type] ? (
            <img src={photos[type]} alt={label} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <div className="text-center">
              <Camera className={`w-8 h-8 mx-auto mb-2 ${isError ? "text-destructive" : "text-muted-foreground"}`} />
              <p className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}>
                {t('vehiclePhotosStep.clickToTake')}
              </p>
            </div>
          )}
        </button>
        {isError && (
          <p className="text-sm text-destructive">{t('vehiclePhotosStep.photoRequired')}</p>
        )}
        {/* Hidden inputs for camera and gallery */}
        <input
          id={`photo-camera-${type}`}
          type="file"
          accept={ACCEPT_IMAGE_DOC}
          capture="environment"
          className="hidden"
          onChange={(e) => handlePhotoChange(type, e)}
        />
        <input
          id={`photo-gallery-${type}`}
          type="file"
          accept={ACCEPT_IMAGE_DOC}
          className="hidden"
          onChange={(e) => handlePhotoChange(type, e)}
        />
      </div>
    );
  };

  return (
    <>
      <div ref={formRef} className="space-y-6">
        <PhotoUploadBox type="front" label={t('vehiclePhotosStep.frontPhoto')} />
        <PhotoUploadBox type="side" label={t('vehiclePhotosStep.sidePhoto')} />
        <PhotoUploadBox type="back" label={t('vehiclePhotosStep.backPhoto')} />
        <PhotoUploadBox type="plate" label={t('vehiclePhotosStep.platePhoto')} />

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
            {t('vehiclePhotosStep.hasTrailer')}
          </Label>
        </div>

        {hasTrailer && (
          <PhotoUploadBox type="trailerPlate" label={t('vehiclePhotosStep.trailerPlatePhoto')} />
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              onBack();
            }}
            className="flex-1 rounded-xl h-12 text-base font-medium border-2"
          >
            {t('vehiclePhotosStep.back')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
          >
            {t('vehiclePhotosStep.next')}
          </Button>
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('vehiclePhotosStep.addPhoto')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => {
                if (currentPhotoType) {
                  if (isNative) {
                    handleNativePhoto(currentPhotoType, 'camera');
                  } else {
                    document.getElementById(`photo-camera-${currentPhotoType}`)?.click();
                  }
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-base">{t('vehiclePhotosStep.takePhoto')}</span>
            </button>
            <button
              onClick={() => {
                if (currentPhotoType) {
                  if (isNative) {
                    handleNativePhoto(currentPhotoType, 'gallery');
                  } else {
                    document.getElementById(`photo-gallery-${currentPhotoType}`)?.click();
                  }
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Image className="w-6 h-6" />
              <span className="text-base">{t('vehiclePhotosStep.selectFromGallery')}</span>
            </button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full rounded-xl h-12">
                {t('vehiclePhotosStep.cancel')}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default VehiclePhotosStep;
