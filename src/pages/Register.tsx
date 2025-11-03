import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import TermsStep from "@/components/register/TermsStep";
import GeneralInfoStep from "@/components/register/GeneralInfoStep";
import VehiclePhotosStep from "@/components/register/VehiclePhotosStep";
import VehicleInfoStep from "@/components/register/VehicleInfoStep";
import ReviewStep from "@/components/register/ReviewStep";

export interface RegistrationData {
  // General Info
  profilePhoto?: File;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  workAreas: string[];
  priceRangeMin: string;
  priceRangeMax: string;
  
  // Vehicle Photos
  frontPhoto?: File;
  sidePhoto?: File;
  backPhoto?: File;
  platePhoto?: File;
  hasTrailer: boolean;
  trailerPlatePhoto?: File;
  
  // Vehicle Info
  plateNumber: string;
  plateProvince: string;
  trailerPlateNumber?: string;
  trailerPlateProvince?: string;
  vehicleBrand: string;
  vehicleColor: string;
  vin: string;
  vehicleType: string;
  fuelType: string;
  loadCapacity: string;
  dimensions: {
    width: string;
    length: string;
    height: string;
  };
  containerTypes: string[];
  registrationPhoto?: File;
  insuranceValue: string;
  insurancePhoto?: File;
  licensePhoto?: File;
  idCardPhoto?: File;
  compulsoryInsurancePhoto?: File;
}

const Register = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    workAreas: [],
    priceRangeMin: "",
    priceRangeMax: "",
    hasTrailer: false,
    plateNumber: "",
    plateProvince: "",
    vehicleBrand: "",
    vehicleColor: "",
    vin: "",
    vehicleType: "",
    fuelType: "",
    loadCapacity: "",
    dimensions: {
      width: "",
      length: "",
      height: ""
    },
    containerTypes: [],
    insuranceValue: ""
  });

  const steps = [
    { component: TermsStep, title: "เงื่อนไขการใช้บริการและนโยบาย" },
    { component: GeneralInfoStep, title: "ข้อมูลทั่วไป" },
    { component: VehiclePhotosStep, title: "อัพโหลดรูปรถ" },
    { component: VehicleInfoStep, title: "ข้อมูลรถ" },
    { component: ReviewStep, title: "ตรวจสอบข้อมูล" }
  ];

  const CurrentStepComponent = steps[currentStep].component;

  const handleNext = (data: Partial<RegistrationData>) => {
    setRegistrationData(prev => ({ ...prev, ...data }));
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigate("/");
    }
  };

  const handleSubmit = async () => {
    try {
      console.log("Registration data:", registrationData);
      
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registrationData.email,
        password: registrationData.password,
        phone: registrationData.phone,
        options: {
          data: {
            phone: registrationData.phone,
            username: registrationData.username,
            full_name: `${registrationData.firstName} ${registrationData.lastName}`
          }
        }
      });

      if (authError) {
        console.error("Error creating user:", authError);
        alert("ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      if (!authData.user) {
        alert("ไม่สามารถสร้างบัญชีได้");
        return;
      }

      const userId = authData.user.id;

      // Upload profile photo
      let avatarUrl = null;
      if (registrationData.profilePhoto) {
        const fileExt = registrationData.profilePhoto.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, registrationData.profilePhoto);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // Update profile with avatar URL
      await supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          full_name: `${registrationData.firstName} ${registrationData.lastName}`
        })
        .eq('id', userId);

      // Save work preferences
      await supabase.from('driver_work_preferences').insert({
        driver_id: userId,
        work_areas: registrationData.workAreas,
        price_range_min: registrationData.priceRangeMin ? parseFloat(registrationData.priceRangeMin) : null,
        price_range_max: registrationData.priceRangeMax ? parseFloat(registrationData.priceRangeMax) : null
      });

      // Save vehicle information
      const { data: vehicleData, error: vehicleError } = await supabase.from('vehicles').insert({
        driver_id: userId,
        plate_number: registrationData.plateNumber,
        plate_province: registrationData.plateProvince,
        vehicle_brand: registrationData.vehicleBrand,
        vehicle_color: registrationData.vehicleColor,
        vin: registrationData.vin,
        vehicle_type: registrationData.vehicleType,
        fuel_type: registrationData.fuelType,
        load_capacity: parseFloat(registrationData.loadCapacity),
        width: registrationData.dimensions.width ? parseFloat(registrationData.dimensions.width) : null,
        length: registrationData.dimensions.length ? parseFloat(registrationData.dimensions.length) : null,
        height: registrationData.dimensions.height ? parseFloat(registrationData.dimensions.height) : null,
        container_types: registrationData.containerTypes,
        has_trailer: registrationData.hasTrailer,
        trailer_plate_number: registrationData.trailerPlateNumber || null,
        trailer_plate_province: registrationData.trailerPlateProvince || null
      }).select().single();

      if (vehicleError) {
        console.error("Error saving vehicle:", vehicleError);
        alert("บันทึกข้อมูลรถไม่สำเร็จ");
        return;
      }

      // Upload vehicle photos
      const vehiclePhotos = [
        { type: 'front', file: registrationData.frontPhoto },
        { type: 'side', file: registrationData.sidePhoto },
        { type: 'back', file: registrationData.backPhoto },
        { type: 'plate', file: registrationData.platePhoto },
        { type: 'trailer_plate', file: registrationData.trailerPlatePhoto }
      ];

      for (const photo of vehiclePhotos) {
        if (photo.file) {
          const fileExt = photo.file.name.split('.').pop();
          const fileName = `${userId}/${vehicleData.id}-${photo.type}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('vehicle-photos')
            .upload(fileName, photo.file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('vehicle-photos')
              .getPublicUrl(fileName);

            await supabase.from('vehicle_photos').insert({
              vehicle_id: vehicleData.id,
              photo_type: photo.type,
              photo_url: publicUrl
            });
          }
        }
      }

      // Upload driver documents
      const documents = [
        { type: 'registration', file: registrationData.registrationPhoto },
        { type: 'insurance', file: registrationData.insurancePhoto },
        { type: 'license', file: registrationData.licensePhoto },
        { type: 'id_card', file: registrationData.idCardPhoto },
        { type: 'compulsory_insurance', file: registrationData.compulsoryInsurancePhoto }
      ];

      for (const doc of documents) {
        if (doc.file) {
          const fileExt = doc.file.name.split('.').pop();
          const fileName = `${userId}/${doc.type}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('driver-documents')
            .upload(fileName, doc.file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('driver-documents')
              .getPublicUrl(fileName);

            await supabase.from('driver_documents').insert({
              driver_id: userId,
              document_type: doc.type,
              document_url: publicUrl,
              insurance_value: doc.type === 'insurance' && registrationData.insuranceValue 
                ? parseFloat(registrationData.insuranceValue) 
                : null
            });
          }
        }
      }

      alert("สมัครสมาชิกสำเร็จ!");
      navigate("/");
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">{steps[currentStep].title}</h1>
      </div>

      {/* Progress Indicator */}
      {currentStep > 0 && (
        <div className="flex gap-2 px-6 py-4">
          {steps.slice(1).map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-1 rounded-full ${
                index < currentStep ? "bg-primary" : "bg-primary/20"
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <CurrentStepComponent
          data={registrationData}
          onNext={handleNext}
          onBack={handleBack}
          onSubmit={handleSubmit}
          onEditStep={(step: number) => setCurrentStep(step)}
        />
      </div>
    </div>
  );
};

export default Register;
