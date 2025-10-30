import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import TermsStep from "@/components/register/TermsStep";
import GeneralInfoStep from "@/components/register/GeneralInfoStep";
import VehiclePhotosStep from "@/components/register/VehiclePhotosStep";
import VehicleInfoStep from "@/components/register/VehicleInfoStep";
import ReviewStep from "@/components/register/ReviewStep";
import OTPVerificationStep from "@/components/register/OTPVerificationStep";

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

  const allSteps = [...steps, { title: "ยืนยันตัวตน" }];
  const CurrentStepComponent = currentStep < steps.length ? steps[currentStep].component : null;

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
      navigate("/signin");
    }
  };

  const handleSubmit = async () => {
    // TODO: Implement actual registration logic - send OTP
    console.log("Sending OTP to:", registrationData.phone);
    // Move to OTP verification step
    setCurrentStep(steps.length);
  };

  const handleOTPVerified = () => {
    // TODO: Complete registration
    console.log("Registration completed:", registrationData);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">{allSteps[currentStep].title}</h1>
      </div>

      {/* Progress Indicator */}
      {currentStep > 0 && (
        <div className="flex gap-2 px-6 py-4">
          {allSteps.slice(1).map((_, index) => (
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
        {currentStep === steps.length ? (
          <OTPVerificationStep
            phoneNumber={registrationData.phone}
            onVerified={handleOTPVerified}
            onBack={handleBack}
          />
        ) : CurrentStepComponent ? (
          <CurrentStepComponent
            data={registrationData}
            onNext={handleNext}
            onBack={handleBack}
            onSubmit={handleSubmit}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Register;
