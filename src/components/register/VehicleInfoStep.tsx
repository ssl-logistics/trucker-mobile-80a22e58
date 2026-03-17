import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { Camera, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RegistrationData } from "@/pages/Register";
import { ProvinceSelect } from "@/components/ui/province-select";
import { VehicleBrandSelect } from "@/components/ui/vehicle-brand-select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface VehicleInfoStepProps {
  data: RegistrationData;
  onNext: (data: Partial<RegistrationData>) => void;
  onBack: () => void;
}

const VehicleInfoStep = ({ data, onNext, onBack }: VehicleInfoStepProps) => {
  const { t } = useLanguage();

  const vehicleInfoSchema = z.object({
    plateNumber: z.string().min(1, t('validation.plateNumberRequired')),
    plateProvince: z.string().min(1, t('validation.plateProvinceRequired')),
    trailerPlateNumber: data.hasTrailer ? z.string().min(1, t('validation.trailerPlateNumberRequired')) : z.string().optional(),
    trailerPlateProvince: data.hasTrailer ? z.string().min(1, t('validation.trailerPlateProvinceRequired')) : z.string().optional(),
    vehicleBrand: z.string().min(1, t('validation.vehicleBrandRequired')),
    vehicleColor: z.string().min(1, t('validation.vehicleColorRequired')),
    vin: z.string().min(1, t('validation.vinRequired')),
    vehicleType: z.string().min(1, t('validation.vehicleTypeRequired')),
    fuelType: z.string().min(1, t('validation.fuelTypeRequired')),
    loadCapacity: z.string().min(1, t('validation.loadCapacityRequired')),
    width: z.string().min(1, t('validation.widthRequired')),
    length: z.string().min(1, t('validation.lengthRequired')),
    height: z.string().min(1, t('validation.heightRequired')),
    insuranceValue: z.string().min(1, t('validation.insuranceValueRequired')),
  });

  type VehicleInfoFormData = z.infer<typeof vehicleInfoSchema>;
  const [containerTypes, setContainerTypes] = useState<string[]>(data.containerTypes || []);
  const [registrationPhoto, setRegistrationPhoto] = useState<File | null>(data.registrationPhoto || null);
  const [insurancePhoto, setInsurancePhoto] = useState<File | null>(data.insurancePhoto || null);
  const [licensePhoto, setLicensePhoto] = useState<File | null>(data.licensePhoto || null);
  const [idCardPhoto, setIdCardPhoto] = useState<File | null>(data.idCardPhoto || null);
  const [compulsoryInsurancePhoto, setCompulsoryInsurancePhoto] = useState<File | null>(data.compulsoryInsurancePhoto || null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
  const [showPhotoErrors, setShowPhotoErrors] = useState(false);
  
  // Store preview URLs for display
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({
    'registration-doc': data.registrationPhoto ? URL.createObjectURL(data.registrationPhoto) : '',
    'insurance-doc': data.insurancePhoto ? URL.createObjectURL(data.insurancePhoto) : '',
    'license-doc': data.licensePhoto ? URL.createObjectURL(data.licensePhoto) : '',
    'id-card-doc': data.idCardPhoto ? URL.createObjectURL(data.idCardPhoto) : '',
    'compulsory-insurance-doc': data.compulsoryInsurancePhoto ? URL.createObjectURL(data.compulsoryInsurancePhoto) : '',
  });
  
  const { register, handleSubmit, formState: { errors, isSubmitted }, setValue, watch } = useForm<VehicleInfoFormData>({
    resolver: zodResolver(vehicleInfoSchema),
    defaultValues: {
      plateNumber: data.plateNumber,
      plateProvince: data.plateProvince,
      trailerPlateNumber: data.trailerPlateNumber || "",
      trailerPlateProvince: data.trailerPlateProvince || "",
      vehicleBrand: data.vehicleBrand,
      vehicleColor: data.vehicleColor,
      vin: data.vin,
      vehicleType: data.vehicleType,
      fuelType: data.fuelType,
      loadCapacity: data.loadCapacity,
      width: data.dimensions?.width || "",
      length: data.dimensions?.length || "",
      height: data.dimensions?.height || "",
      insuranceValue: data.insuranceValue,
    }
  });

  // Auto-scroll to first error field
  useEffect(() => {
    if (isSubmitted && Object.keys(errors).length > 0) {
      const firstErrorKey = Object.keys(errors)[0];
      const errorElement = document.querySelector(`[name="${firstErrorKey}"]`) || 
                          document.getElementById(`field-${firstErrorKey}`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [errors, isSubmitted]);

  // Auto-scroll to photo/container errors
  useEffect(() => {
    if (showPhotoErrors) {
      const photoErrors = [
        { id: 'container-types', hasError: containerTypes.length === 0 },
        { id: 'registration-doc', hasError: !registrationPhoto },
        { id: 'insurance-doc', hasError: !insurancePhoto },
        { id: 'license-doc', hasError: !licensePhoto },
        { id: 'id-card-doc', hasError: !idCardPhoto },
        { id: 'compulsory-insurance-doc', hasError: !compulsoryInsurancePhoto },
      ];
      
      const firstPhotoError = photoErrors.find(e => e.hasError);
      if (firstPhotoError && Object.keys(errors).length === 0) {
        const errorElement = document.getElementById(`field-${firstPhotoError.id}`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [showPhotoErrors, containerTypes, registrationPhoto, insurancePhoto, licensePhoto, idCardPhoto, compulsoryInsurancePhoto, errors]);

  const onSubmit = (formData: VehicleInfoFormData) => {
    setShowPhotoErrors(true);
    
    // Check if all required photos are uploaded and container types selected
    const hasAllPhotos = registrationPhoto && insurancePhoto && licensePhoto && idCardPhoto && compulsoryInsurancePhoto;
    const hasContainerType = containerTypes.length > 0;
    if (!hasAllPhotos || !hasContainerType) {
      return;
    }
    
    // Scroll to top before moving to next step
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    onNext({
      ...formData,
      dimensions: {
        width: formData.width,
        length: formData.length,
        height: formData.height,
      },
      containerTypes,
      registrationPhoto,
      insurancePhoto,
      licensePhoto,
      idCardPhoto,
      compulsoryInsurancePhoto,
    });
  };

  const handleFileChange = (file: File | null, setter: (file: File | null) => void, photoId: string) => {
    setter(file);
    if (file) {
      setPreviewUrls(prev => ({ ...prev, [photoId]: URL.createObjectURL(file) }));
    }
    setDrawerOpen(false);
  };

  const openPhotoDrawer = (id: string) => {
    setCurrentPhotoId(id);
    setDrawerOpen(true);
  };

  const PhotoUploadBox = ({ 
    label, 
    id, 
    file, 
    onChange,
    showError,
    previewUrl
  }: { 
    label: string; 
    id: string;
    file: File | null;
    onChange: (file: File | null) => void;
    showError?: boolean;
    previewUrl?: string;
  }) => {
    const hasError = showError && !file;
    
    return (
      <div className="space-y-2" id={`field-${id}`}>
        <Label>
          {label} <span className="text-destructive">*</span>
        </Label>
        <button 
          type="button"
          onClick={() => openPhotoDrawer(id)}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-32 cursor-pointer hover:border-primary transition-colors w-full ${
            hasError ? "border-destructive" : "border-input"
          }`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <>
              <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('vehicleInfoStep.clickToTake')}</p>
            </>
          )}
        </button>
        {hasError && (
          <p className="text-sm text-destructive">{t('validation.photoRequired')}</p>
        )}
        {/* Hidden inputs for camera and gallery */}
        <input 
          id={`${id}-camera`}
          type="file" 
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0] || null;
            onChange(selectedFile);
          }}
        />
        <input 
          id={`${id}-gallery`}
          type="file" 
          accept="image/*" 
          className="hidden"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0] || null;
            onChange(selectedFile);
          }}
        />
      </div>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit, () => setShowPhotoErrors(true))} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>
            {t('vehicleInfoStep.plateNumber')} <span className="text-destructive">*</span>
          </Label>
          <Input {...register("plateNumber")} className={errors.plateNumber ? "border-destructive" : ""} />
          {errors.plateNumber && <p className="text-sm text-destructive">{errors.plateNumber.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>
            {t('vehicleInfoStep.plateProvince')} <span className="text-destructive">*</span>
          </Label>
          <ProvinceSelect
            value={watch("plateProvince")}
            onValueChange={(value) => setValue("plateProvince", value)}
            hasError={!!errors.plateProvince}
          />
          {errors.plateProvince && <p className="text-sm text-destructive">{errors.plateProvince.message}</p>}
        </div>

        {data.hasTrailer && (
          <>
            <div className="space-y-2">
              <Label>{t('vehicleInfoStep.trailerPlateNumber')} <span className="text-destructive">*</span></Label>
              <Input 
                {...register("trailerPlateNumber")} 
                className={errors.trailerPlateNumber ? "border-destructive" : ""} 
              />
              {errors.trailerPlateNumber && <p className="text-sm text-destructive">{errors.trailerPlateNumber.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('vehicleInfoStep.trailerPlateProvince')} <span className="text-destructive">*</span></Label>
              <ProvinceSelect
                value={watch("trailerPlateProvince")}
                onValueChange={(value) => setValue("trailerPlateProvince", value)}
                hasError={!!errors.trailerPlateProvince}
              />
              {errors.trailerPlateProvince && <p className="text-sm text-destructive">{errors.trailerPlateProvince.message}</p>}
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.vehicleBrand')} <span className="text-destructive">*</span></Label>
          <VehicleBrandSelect
            value={watch("vehicleBrand")}
            onValueChange={(value) => setValue("vehicleBrand", value)}
            hasError={!!errors.vehicleBrand}
          />
          {errors.vehicleBrand && <p className="text-sm text-destructive">{errors.vehicleBrand.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.vehicleColor')} <span className="text-destructive">*</span></Label>
          <Input 
            {...register("vehicleColor")} 
            placeholder={t('vehicleInfoStep.vehicleColorPlaceholder')}
            className={errors.vehicleColor ? "border-destructive" : ""} 
          />
          {errors.vehicleColor && <p className="text-sm text-destructive">{errors.vehicleColor.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.vin')} <span className="text-destructive">*</span></Label>
          <Input {...register("vin")} className={errors.vin ? "border-destructive" : ""} />
          {errors.vin && <p className="text-sm text-destructive">{errors.vin.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.vehicleType')} <span className="text-destructive">*</span></Label>
          <Select onValueChange={(value) => setValue("vehicleType", value)}>
            <SelectTrigger className={errors.vehicleType ? "border-destructive" : ""}><SelectValue placeholder={t('vehicleInfoStep.selectType')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10-wheel">{t('vehicleType.10wheel')}</SelectItem>
              <SelectItem value="6-wheel">{t('vehicleType.6wheel')}</SelectItem>
            </SelectContent>
          </Select>
          {errors.vehicleType && <p className="text-sm text-destructive">{errors.vehicleType.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.fuelType')} <span className="text-destructive">*</span></Label>
          <Select onValueChange={(value) => setValue("fuelType", value)}>
            <SelectTrigger className={errors.fuelType ? "border-destructive" : ""}><SelectValue placeholder={t('vehicleInfoStep.selectFuel')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diesel">{t('fuelType.diesel')}</SelectItem>
              <SelectItem value="gasoline">{t('fuelType.gasoline')}</SelectItem>
            </SelectContent>
          </Select>
          {errors.fuelType && <p className="text-sm text-destructive">{errors.fuelType.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.loadCapacity')} <span className="text-destructive">*</span></Label>
          <Input {...register("loadCapacity")} className={errors.loadCapacity ? "border-destructive" : ""} />
          {errors.loadCapacity && <p className="text-sm text-destructive">{errors.loadCapacity.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.dimensions')} <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input placeholder={t('vehicleInfoStep.width')} {...register("width")} className={errors.width ? "border-destructive" : ""} />
            <Input placeholder={t('vehicleInfoStep.length')} {...register("length")} className={errors.length ? "border-destructive" : ""} />
            <Input placeholder={t('vehicleInfoStep.height')} {...register("height")} className={errors.height ? "border-destructive" : ""} />
          </div>
          {(errors.width || errors.length || errors.height) && <p className="text-sm text-destructive">{errors.width?.message || errors.length?.message || errors.height?.message}</p>}
        </div>

        <div className="space-y-2" id="field-container-types">
          <Label>{t('vehicleInfoStep.containerTypes')} <span className="text-destructive">*</span></Label>
          <div className={`space-y-2 p-3 rounded-md border ${showPhotoErrors && containerTypes.length === 0 ? "border-destructive" : "border-transparent"}`}>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="container-20"
                checked={containerTypes.includes("20")}
                onCheckedChange={(checked) => {
                  if (checked) setContainerTypes([...containerTypes, "20"]);
                  else setContainerTypes(containerTypes.filter(t => t !== "20"));
                }}
              />
              <Label htmlFor="container-20" className="font-normal cursor-pointer">{t('vehicleInfoStep.container20')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="container-40"
                checked={containerTypes.includes("40")}
                onCheckedChange={(checked) => {
                  if (checked) setContainerTypes([...containerTypes, "40"]);
                  else setContainerTypes(containerTypes.filter(t => t !== "40"));
                }}
              />
              <Label htmlFor="container-40" className="font-normal cursor-pointer">{t('vehicleInfoStep.container40')}</Label>
            </div>
          </div>
          {showPhotoErrors && containerTypes.length === 0 && (
            <p className="text-sm text-destructive">{t('validation.containerTypeRequired')}</p>
          )}
        </div>

        <PhotoUploadBox 
          label={t('vehicleInfoStep.registrationDoc')}
          id="registration-doc"
          file={registrationPhoto}
          onChange={(file) => handleFileChange(file, setRegistrationPhoto, 'registration-doc')}
          showError={showPhotoErrors}
          previewUrl={previewUrls['registration-doc']}
        />

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.insuranceValue')} <span className="text-destructive">*</span></Label>
          <Input
            inputMode="numeric"
            {...register("insuranceValue")}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
              e.target.value = raw ? Number(raw).toLocaleString() : '';
              setValue("insuranceValue", raw);
            }}
            value={(() => {
              const v = watch("insuranceValue");
              return v ? Number(v).toLocaleString() : '';
            })()}
            className={cn("text-right", errors.insuranceValue ? "border-destructive" : "")}
          />
          {errors.insuranceValue && <p className="text-sm text-destructive">{errors.insuranceValue.message}</p>}
        </div>

        <PhotoUploadBox 
          label={t('vehicleInfoStep.insuranceDoc')}
          id="insurance-doc"
          file={insurancePhoto}
          onChange={(file) => handleFileChange(file, setInsurancePhoto, 'insurance-doc')}
          showError={showPhotoErrors}
          previewUrl={previewUrls['insurance-doc']}
        />
        <PhotoUploadBox 
          label={t('vehicleInfoStep.license')}
          id="license-doc"
          file={licensePhoto}
          onChange={(file) => handleFileChange(file, setLicensePhoto, 'license-doc')}
          showError={showPhotoErrors}
          previewUrl={previewUrls['license-doc']}
        />
        <PhotoUploadBox 
          label={t('vehicleInfoStep.idCard')}
          id="id-card-doc"
          file={idCardPhoto}
          onChange={(file) => handleFileChange(file, setIdCardPhoto, 'id-card-doc')}
          showError={showPhotoErrors}
          previewUrl={previewUrls['id-card-doc']}
        />
        <PhotoUploadBox 
          label={t('vehicleInfoStep.compulsoryInsurance')}
          id="compulsory-insurance-doc"
          file={compulsoryInsurancePhoto}
          onChange={(file) => handleFileChange(file, setCompulsoryInsurancePhoto, 'compulsory-insurance-doc')}
          showError={showPhotoErrors}
          previewUrl={previewUrls['compulsory-insurance-doc']}
        />
      </div>

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
          {t('vehicleInfoStep.back')}
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
        >
          {t('vehicleInfoStep.next')}
        </Button>
      </div>
      </form>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('vehicleInfoStep.addPhoto')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <button
              type="button"
              onClick={() => {
                if (currentPhotoId) {
                  document.getElementById(`${currentPhotoId}-camera`)?.click();
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-base">{t('vehicleInfoStep.takePhoto')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentPhotoId) {
                  document.getElementById(`${currentPhotoId}-gallery`)?.click();
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Image className="w-6 h-6" />
              <span className="text-base">{t('vehicleInfoStep.selectFromGallery')}</span>
            </button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full rounded-xl h-12">
                {t('vehicleInfoStep.cancel')}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default VehicleInfoStep;
