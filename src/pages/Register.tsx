import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import TermsStep from "@/components/register/TermsStep";
import GeneralInfoStep from "@/components/register/GeneralInfoStep";
import VehiclePhotosStep from "@/components/register/VehiclePhotosStep";
import VehicleInfoStep from "@/components/register/VehicleInfoStep";
import ReviewStep from "@/components/register/ReviewStep";
import flagTh from "@/assets/flag-th.png";
import flagEn from "@/assets/flag-en.png";
import flagKo from "@/assets/flag-ko.png";
import flagCn from "@/assets/flag-cn.png";
import { compressImage } from '@/utils/imageCompression';
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
  location: string;
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
  const {
    t,
    language,
    setLanguage
  } = useLanguage();
  const {
    toast
  } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    location: "",
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
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const languageOptions = [{
    code: 'en' as const,
    label: 'EN',
    flag: flagEn
  }, {
    code: 'th' as const,
    label: 'TH',
    flag: flagTh
  }, {
    code: 'ko' as const,
    label: 'KO',
    flag: flagKo
  }, {
    code: 'zh' as const,
    label: 'CN',
    flag: flagCn
  }];
  const currentLang = languageOptions.find(l => l.code === language) || languageOptions[0];
  const steps = [{
    component: TermsStep,
    title: t('register.steps.terms')
  }, {
    component: GeneralInfoStep,
    title: t('register.steps.generalInfo')
  }, {
    component: VehiclePhotosStep,
    title: t('register.steps.vehiclePhotos')
  }, {
    component: VehicleInfoStep,
    title: t('register.steps.vehicleInfo')
  }, {
    component: ReviewStep,
    title: t('register.steps.review')
  }];
  const CurrentStepComponent = steps[currentStep].component;
  const handleNext = (data: Partial<RegistrationData>) => {
    setRegistrationData(prev => ({
      ...prev,
      ...data
    }));
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
  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    console.log(`[Upload] Starting upload to S3: folder=${bucket}, path=${path}, file=${file.name}, size=${file.size}`);
    try {
      // Create FormData for the file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', bucket); // Use bucket as folder name in S3
      formData.append('fileName', `${path.replace(/\//g, '-')}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`);

      // Call edge function to upload file to S3
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/upload-to-s3`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[Upload] Error uploading to S3:`, data.error);
        return null;
      }
      
      console.log(`[Upload] S3 Success: ${data.url}`);
      return data.url;
    } catch (error) {
      console.error('[Upload] Exception:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      console.log("[Register] Already submitting, skipping...");
      return;
    }
    setIsSubmitting(true);
    console.log("========================================");
    console.log("[Register] Starting registration submission");
    console.log("[Register] Registration data:", JSON.stringify(registrationData, (key, value) => {
      if (value instanceof File) {
        return `[File: ${value.name}, ${value.size} bytes]`;
      }
      return value;
    }, 2));
    console.log("========================================");
    
    try {
      // Generate a temporary ID for file paths
      const tempId = `temp-${Date.now()}`;
      console.log(`[Register] Temp ID: ${tempId}`);
      
      // Count files to upload
      const filesToUpload = [
        registrationData.profilePhoto,
        registrationData.frontPhoto,
        registrationData.sidePhoto,
        registrationData.backPhoto,
        registrationData.platePhoto,
        registrationData.trailerPlatePhoto,
        registrationData.registrationPhoto,
        registrationData.insurancePhoto,
        registrationData.licensePhoto,
        registrationData.idCardPhoto,
        registrationData.compulsoryInsurancePhoto
      ].filter(Boolean);
      console.log(`[Register] Files to upload: ${filesToUpload.length}`);
      
      // Upload all files and get URLs
      console.log("[Register] Starting file uploads...");
      const uploadStartTime = Date.now();
      
      const [
        profilePhotoUrl,
        frontPhotoUrl,
        sidePhotoUrl,
        backPhotoUrl,
        platePhotoUrl,
        trailerPlatePhotoUrl,
        registrationPhotoUrl,
        insurancePhotoUrl,
        licensePhotoUrl,
        idCardPhotoUrl,
        compulsoryInsurancePhotoUrl
      ] = await Promise.all([
        registrationData.profilePhoto ? uploadFile(registrationData.profilePhoto, 'avatars', `${tempId}/profile`) : Promise.resolve(null),
        registrationData.frontPhoto ? uploadFile(registrationData.frontPhoto, 'vehicle-photos', `${tempId}/front`) : Promise.resolve(null),
        registrationData.sidePhoto ? uploadFile(registrationData.sidePhoto, 'vehicle-photos', `${tempId}/side`) : Promise.resolve(null),
        registrationData.backPhoto ? uploadFile(registrationData.backPhoto, 'vehicle-photos', `${tempId}/back`) : Promise.resolve(null),
        registrationData.platePhoto ? uploadFile(registrationData.platePhoto, 'vehicle-photos', `${tempId}/plate`) : Promise.resolve(null),
        registrationData.trailerPlatePhoto ? uploadFile(registrationData.trailerPlatePhoto, 'vehicle-photos', `${tempId}/trailer-plate`) : Promise.resolve(null),
        registrationData.registrationPhoto ? uploadFile(registrationData.registrationPhoto, 'driver-documents', `${tempId}/registration`) : Promise.resolve(null),
        registrationData.insurancePhoto ? uploadFile(registrationData.insurancePhoto, 'driver-documents', `${tempId}/insurance`) : Promise.resolve(null),
        registrationData.licensePhoto ? uploadFile(registrationData.licensePhoto, 'driver-documents', `${tempId}/license`) : Promise.resolve(null),
        registrationData.idCardPhoto ? uploadFile(registrationData.idCardPhoto, 'driver-documents', `${tempId}/id-card`) : Promise.resolve(null),
        registrationData.compulsoryInsurancePhoto ? uploadFile(registrationData.compulsoryInsurancePhoto, 'driver-documents', `${tempId}/compulsory-insurance`) : Promise.resolve(null),
      ]);
      
      console.log(`[Register] File uploads completed in ${Date.now() - uploadStartTime}ms`);
      console.log("[Register] Upload results:", {
        profilePhotoUrl,
        frontPhotoUrl,
        sidePhotoUrl,
        backPhotoUrl,
        platePhotoUrl,
        trailerPlatePhotoUrl,
        registrationPhotoUrl,
        insurancePhotoUrl,
        licensePhotoUrl,
        idCardPhotoUrl,
        compulsoryInsurancePhotoUrl
      });

      // Build request body for external API
      const requestBody = {
        // General Info
        profilePhoto: profilePhotoUrl || undefined,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        phone: registrationData.phone,
        email: registrationData.email,
        username: registrationData.username,
        password: registrationData.password,
        confirmPassword: registrationData.confirmPassword,
        location: registrationData.location || undefined,
        priceRangeMin: registrationData.priceRangeMin ? parseFloat(registrationData.priceRangeMin) : undefined,
        priceRangeMax: registrationData.priceRangeMax ? parseFloat(registrationData.priceRangeMax) : undefined,

        // Vehicle Photos
        frontPhoto: frontPhotoUrl || undefined,
        sidePhoto: sidePhotoUrl || undefined,
        backPhoto: backPhotoUrl || undefined,
        platePhoto: platePhotoUrl || undefined,
        hasTrailer: registrationData.hasTrailer,
        trailerPlatePhoto: trailerPlatePhotoUrl || undefined,

        // Vehicle Info
        plateNumber: registrationData.plateNumber,
        plateProvince: registrationData.plateProvince || undefined,
        trailerPlateNumber: registrationData.trailerPlateNumber || undefined,
        trailerPlateProvince: registrationData.trailerPlateProvince || undefined,
        vehicleBrand: registrationData.vehicleBrand || undefined,
        vehicleColor: registrationData.vehicleColor || undefined,
        vin: registrationData.vin || undefined,
        vehicleType: registrationData.vehicleType || undefined,
        fuelType: registrationData.fuelType || undefined,
        loadCapacity: registrationData.loadCapacity ? parseFloat(registrationData.loadCapacity) : undefined,
        dimensions: {
          width: registrationData.dimensions.width ? parseFloat(registrationData.dimensions.width) : undefined,
          length: registrationData.dimensions.length ? parseFloat(registrationData.dimensions.length) : undefined,
          height: registrationData.dimensions.height ? parseFloat(registrationData.dimensions.height) : undefined,
        },
        containerTypes: registrationData.containerTypes.length > 0 ? registrationData.containerTypes : undefined,

        // Documents
        registrationPhoto: registrationPhotoUrl || undefined,
        insurancePhoto: insurancePhotoUrl || undefined,
        licensePhoto: licensePhotoUrl || undefined,
        idCardPhoto: idCardPhotoUrl || undefined,
        compulsoryInsurancePhoto: compulsoryInsurancePhotoUrl || undefined,
        insuranceValue: registrationData.insuranceValue ? parseFloat(registrationData.insuranceValue) : undefined,
      };

      // Remove undefined values
      const cleanBody = JSON.parse(JSON.stringify(requestBody));
      
      console.log("========================================");
      console.log("[Register] Final request body:", JSON.stringify(cleanBody, null, 2));
      console.log("========================================");

      // Call the edge function
      console.log("[Register] Calling register-driver edge function...");
      const apiStartTime = Date.now();
      
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('register-driver', {
        body: cleanBody
      });
      
      console.log(`[Register] API call completed in ${Date.now() - apiStartTime}ms`);

      if (error) {
        console.error("[Register] API Error:", error);
        console.error("[Register] Error details:", JSON.stringify(error, null, 2));
        
        // Parse error message and translate
        let errorMessage = t('register.createAccountFailed');
        try {
          // Try multiple parsing patterns for edge function errors
          let errorData: { error?: string; field?: string } | null = null;
          
          // Pattern 1: "Edge function returned 400: Error, {...}"
          const jsonMatch = error.message?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            errorData = JSON.parse(jsonMatch[0]);
          }
          
          if (errorData?.error) {
            // Map API error messages to translation keys
            const errorMap: Record<string, string> = {
              'Email already registered': 'register.error.emailAlreadyRegistered',
              'Username already registered': 'register.error.usernameAlreadyRegistered',
              'Phone already registered': 'register.error.phoneAlreadyRegistered',
              'Invalid email format': 'register.error.invalidEmail',
              'Invalid phone number': 'register.error.invalidPhone',
              'Password mismatch': 'register.error.passwordMismatch',
              'Weak password': 'register.error.weakPassword',
              'Missing required fields': 'register.error.missingRequired',
              'Registration failed': 'register.error.registrationFailed',
            };
            
            // Map field names for displaying which field is duplicated
            const fieldMap: Record<string, string> = {
              'email': 'register.error.fieldEmail',
              'username': 'register.error.fieldUsername',
              'phone': 'register.error.fieldPhone',
            };
            
            const translationKey = errorMap[errorData.error] || 'register.error.unknownError';
            errorMessage = t(translationKey);
            
            // If there's a field specified, show which field is duplicated
            if (errorData.field && fieldMap[errorData.field]) {
              const fieldName = t(fieldMap[errorData.field]);
              // Format: "อีเมล: อีเมลนี้ถูกใช้งานแล้ว" or "Email: This email is already registered"
              errorMessage = `${fieldName}: ${errorMessage}`;
            }
            
            console.log("[Register] Translated error:", translationKey, "->", errorMessage);
          }
        } catch (parseError) {
          console.error("[Register] Error parsing:", parseError);
          // If parsing fails, use default translated message
          errorMessage = t('register.createAccountFailed');
        }
        
        toast({
          variant: "destructive",
          title: t('register.error'),
          description: errorMessage
        });
        return;
      }

      console.log("[Register] API Success! Response:", JSON.stringify(data, null, 2));

      toast({
        title: t('register.success'),
        description: t('register.successDesc')
      });
      
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: t('register.error'),
        description: t('register.errorDesc')
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="text-primary-foreground p-4 flex items-center justify-between bg-[#153860]">
        <div className="flex items-center">
          <button onClick={handleBack} className="mr-4">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{steps[currentStep].title}</h1>
        </div>
        
        {/* Language Switcher */}
        <div className="relative">
          <button onClick={() => setShowLanguageMenu(!showLanguageMenu)} className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors">
            <img src={currentLang.flag} alt={currentLang.label} className="w-5 h-5 rounded-full object-cover" />
            <span className="text-sm font-medium">{currentLang.label}</span>
          </button>
          
          {showLanguageMenu && <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border overflow-hidden min-w-[120px] z-50">
              {languageOptions.map(lang => <button key={lang.code} onClick={() => {
            setLanguage(lang.code);
            setShowLanguageMenu(false);
          }} className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-muted transition-colors text-foreground ${language === lang.code ? 'bg-muted' : ''}`}>
                  <img src={lang.flag} alt={lang.label} className="w-5 h-5 rounded-full object-cover" />
                  <span className="text-sm">{lang.label}</span>
                </button>)}
            </div>}
        </div>
      </div>

      {/* Progress Indicator */}
      {currentStep > 0 && <div className="flex gap-2 px-6 py-4">
          {steps.slice(1).map((_, index) => <div key={index} className={`flex-1 h-1 rounded-full ${index < currentStep ? "bg-primary" : "bg-primary/20"}`} />)}
        </div>}

      {/* Content */}
      <div className="p-6">
        <CurrentStepComponent data={registrationData} onNext={handleNext} onBack={handleBack} onSubmit={handleSubmit} onEditStep={(step: number) => setCurrentStep(step)} isSubmitting={isSubmitting} />
      </div>
    </div>;
};
export default Register;