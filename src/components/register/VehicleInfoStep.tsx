import { useState } from "react";
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const vehicleInfoSchema = z.object({
  plateNumber: z.string().min(1, "กรุณากรอกหมายเลขทะเบียน"),
  plateProvince: z.string().min(1, "กรุณาเลือกจังหวัด"),
  vehicleBrand: z.string().min(1, "กรุณาเลือกยี่ห้อรถยนต์"),
  vehicleColor: z.string().min(1, "กรุณาเลือกสีรถยนต์"),
  vin: z.string().min(1, "กรุณากรอก VIN"),
  vehicleType: z.string().min(1, "กรุณาเลือกประเภทรถยนต์"),
  fuelType: z.string().min(1, "กรุณาเลือกประเภทเชื้อเพลิง"),
  loadCapacity: z.string().min(1, "กรุณากรอกความจุที่ได้รับ"),
  width: z.string().min(1, "กรุณากรอกความกว้าง"),
  length: z.string().min(1, "กรุณากรอกความยาว"),
  height: z.string().min(1, "กรุณากรอกความสูง"),
  insuranceValue: z.string().min(1, "กรุณากรอกมูลค่าประกันสินค้า"),
});

type VehicleInfoFormData = z.infer<typeof vehicleInfoSchema>;

interface VehicleInfoStepProps {
  data: RegistrationData;
  onNext: (data: Partial<RegistrationData>) => void;
  onBack: () => void;
}

const VehicleInfoStep = ({ data, onNext, onBack }: VehicleInfoStepProps) => {
  const { t } = useLanguage();
  const [containerTypes, setContainerTypes] = useState<string[]>(data.containerTypes || []);
  const [registrationPhoto, setRegistrationPhoto] = useState<File | null>(data.registrationPhoto || null);
  const [insurancePhoto, setInsurancePhoto] = useState<File | null>(data.insurancePhoto || null);
  const [licensePhoto, setLicensePhoto] = useState<File | null>(data.licensePhoto || null);
  const [idCardPhoto, setIdCardPhoto] = useState<File | null>(data.idCardPhoto || null);
  const [compulsoryInsurancePhoto, setCompulsoryInsurancePhoto] = useState<File | null>(data.compulsoryInsurancePhoto || null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<VehicleInfoFormData>({
    resolver: zodResolver(vehicleInfoSchema),
    defaultValues: {
      plateNumber: data.plateNumber,
      plateProvince: data.plateProvince,
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

  const onSubmit = (formData: VehicleInfoFormData) => {
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

  const handleFileChange = (file: File | null, setter: (file: File | null) => void) => {
    setter(file);
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
    onChange 
  }: { 
    label: string; 
    id: string;
    file: File | null;
    onChange: (file: File | null) => void;
  }) => (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-destructive">*</span>
      </Label>
      <button 
        type="button"
        onClick={() => openPhotoDrawer(id)}
        className="flex flex-col items-center justify-center border-2 border-dashed border-input rounded-lg h-32 cursor-pointer hover:border-primary transition-colors w-full"
      >
        {file ? (
          <div className="text-center">
            <p className="text-sm text-primary font-medium mb-1">{t('vehicleInfoStep.fileSelected')}</p>
            <p className="text-xs text-muted-foreground">{file.name}</p>
          </div>
        ) : (
          <>
            <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('vehicleInfoStep.clickToTake')}</p>
          </>
        )}
      </button>
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

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          <Select onValueChange={(value) => setValue("plateProvince", value)}>
            <SelectTrigger className={errors.plateProvince ? "border-destructive" : ""}>
              <SelectValue placeholder={t('vehicleInfoStep.selectProvince')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bangkok">กรุงเทพมหานคร</SelectItem>
              <SelectItem value="nonthaburi">นนทบุรี</SelectItem>
              <SelectItem value="samutprakan">สมุทรปราการ</SelectItem>
            </SelectContent>
          </Select>
          {errors.plateProvince && <p className="text-sm text-destructive">{errors.plateProvince.message}</p>}
        </div>

        {data.hasTrailer && (
          <>
            <div className="space-y-2">
              <Label>{t('vehicleInfoStep.trailerPlateNumber')} <span className="text-destructive">*</span></Label>
              <Input />
            </div>
            <div className="space-y-2">
              <Label>{t('vehicleInfoStep.trailerPlateProvince')} <span className="text-destructive">*</span></Label>
              <Select>
                <SelectTrigger><SelectValue placeholder={t('vehicleInfoStep.selectProvince')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bangkok">กรุงเทพมหานคร</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.vehicleBrand')} <span className="text-destructive">*</span></Label>
          <Select onValueChange={(value) => setValue("vehicleBrand", value)}>
            <SelectTrigger className={errors.vehicleBrand ? "border-destructive" : ""}>
              <SelectValue placeholder={t('vehicleInfoStep.selectBrand')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="isuzu">Isuzu</SelectItem>
              <SelectItem value="hino">Hino</SelectItem>
              <SelectItem value="mitsubishi">Mitsubishi</SelectItem>
            </SelectContent>
          </Select>
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
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.vehicleType')} <span className="text-destructive">*</span></Label>
          <Select onValueChange={(value) => setValue("vehicleType", value)}>
            <SelectTrigger><SelectValue placeholder={t('vehicleInfoStep.selectType')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10-wheel">10 ล้อ</SelectItem>
              <SelectItem value="6-wheel">6 ล้อ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.fuelType')} <span className="text-destructive">*</span></Label>
          <Select onValueChange={(value) => setValue("fuelType", value)}>
            <SelectTrigger><SelectValue placeholder={t('vehicleInfoStep.selectFuel')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diesel">ดีเซล</SelectItem>
              <SelectItem value="gasoline">เบนซิน</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.loadCapacity')} <span className="text-destructive">*</span></Label>
          <Input {...register("loadCapacity")} />
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.dimensions')} <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input placeholder={t('vehicleInfoStep.width')} {...register("width")} />
            <Input placeholder={t('vehicleInfoStep.length')} {...register("length")} />
            <Input placeholder={t('vehicleInfoStep.height')} {...register("height")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.containerTypes')} <span className="text-destructive">*</span></Label>
          <div className="space-y-2">
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
        </div>

        <PhotoUploadBox 
          label={t('vehicleInfoStep.registrationDoc')}
          id="registration-doc"
          file={registrationPhoto}
          onChange={(file) => handleFileChange(file, setRegistrationPhoto)}
        />

        <div className="space-y-2">
          <Label>{t('vehicleInfoStep.insuranceValue')} <span className="text-destructive">*</span></Label>
          <Input {...register("insuranceValue")} />
        </div>

        <PhotoUploadBox 
          label={t('vehicleInfoStep.insuranceDoc')}
          id="insurance-doc"
          file={insurancePhoto}
          onChange={(file) => handleFileChange(file, setInsurancePhoto)}
        />
        <PhotoUploadBox 
          label={t('vehicleInfoStep.license')}
          id="license-doc"
          file={licensePhoto}
          onChange={(file) => handleFileChange(file, setLicensePhoto)}
        />
        <PhotoUploadBox 
          label={t('vehicleInfoStep.idCard')}
          id="id-card-doc"
          file={idCardPhoto}
          onChange={(file) => handleFileChange(file, setIdCardPhoto)}
        />
        <PhotoUploadBox 
          label={t('vehicleInfoStep.compulsoryInsurance')}
          id="compulsory-insurance-doc"
          file={compulsoryInsurancePhoto}
          onChange={(file) => handleFileChange(file, setCompulsoryInsurancePhoto)}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
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
