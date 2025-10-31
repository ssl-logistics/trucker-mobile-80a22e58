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
      // TODO: Implement actual registration logic (save to database)
      console.log("Registration data:", registrationData);
      
      // Send OTP via ThailBulkSMS
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: otpData, error: otpError } = await supabase.functions.invoke("send-otp", {
        body: { phone: registrationData.phone }
      });

      if (otpError) {
        console.error("Error sending OTP:", otpError);
        alert("ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      if (!otpData?.success) {
        console.error("Failed to send OTP:", otpData);
        alert("ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      console.log("OTP sent successfully, token:", otpData.token);
      navigate("/verify-otp", { 
        state: { 
          phone: registrationData.phone,
          token: otpData.token,
          registrationData: registrationData
        } 
      });
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
        />
      </div>
    </div>
  );
};

export default Register;
