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
  const handleSubmit = async () => {
    try {
      console.log("Registration data:", registrationData);
      const {
        supabase
      } = await import("@/integrations/supabase/client");
      const redirectUrl = `${window.location.origin}/`;

      // Create auth user
      const {
        data: authData,
        error: authError
      } = await supabase.auth.signUp({
        email: registrationData.email,
        password: registrationData.password,
        phone: registrationData.phone,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            phone: registrationData.phone,
            username: registrationData.username,
            full_name: `${registrationData.firstName} ${registrationData.lastName}`
          }
        }
      });
      if (authError) {
        console.error("Error creating user:", authError);
        toast({
          variant: "destructive",
          title: t('register.error'),
          description: authError.message || t('register.createAccountFailed')
        });
        return;
      }
      if (!authData.user) {
        toast({
          variant: "destructive",
          title: t('register.error'),
          description: t('register.createAccountError')
        });
        return;
      }
      const userId = authData.user.id;

      // Upload profile photo
      let avatarUrl = null;
      if (registrationData.profilePhoto) {
        const fileExt = registrationData.profilePhoto.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const {
          error: uploadError
        } = await supabase.storage.from('avatars').upload(fileName, registrationData.profilePhoto);
        if (!uploadError) {
          const {
            data: {
              publicUrl
            }
          } = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // Update profile with avatar URL
      await supabase.from('profiles').update({
        avatar_url: avatarUrl,
        full_name: `${registrationData.firstName} ${registrationData.lastName}`
      }).eq('id', userId);

      // Save work preferences
      await supabase.from('driver_work_preferences').insert({
        driver_id: userId,
        work_areas: registrationData.location ? [registrationData.location] : [],
        price_range_min: registrationData.priceRangeMin ? parseFloat(registrationData.priceRangeMin) : null,
        price_range_max: registrationData.priceRangeMax ? parseFloat(registrationData.priceRangeMax) : null
      });

      // Save vehicle information
      const {
        data: vehicleData,
        error: vehicleError
      } = await supabase.from('vehicles').insert({
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
        toast({
          variant: "destructive",
          title: t('register.error'),
          description: t('register.vehicleSaveFailed')
        });
        return;
      }

      // Upload vehicle photos
      const vehiclePhotos = [{
        type: 'front',
        file: registrationData.frontPhoto
      }, {
        type: 'side',
        file: registrationData.sidePhoto
      }, {
        type: 'back',
        file: registrationData.backPhoto
      }, {
        type: 'plate',
        file: registrationData.platePhoto
      }, {
        type: 'trailer_plate',
        file: registrationData.trailerPlatePhoto
      }];
      for (const photo of vehiclePhotos) {
        if (photo.file) {
          const fileExt = photo.file.name.split('.').pop();
          const fileName = `${userId}/${vehicleData.id}-${photo.type}-${Date.now()}.${fileExt}`;
          const {
            error: uploadError
          } = await supabase.storage.from('vehicle-photos').upload(fileName, photo.file);
          if (!uploadError) {
            const {
              data: {
                publicUrl
              }
            } = supabase.storage.from('vehicle-photos').getPublicUrl(fileName);
            await supabase.from('vehicle_photos').insert({
              vehicle_id: vehicleData.id,
              photo_type: photo.type,
              photo_url: publicUrl
            });
          }
        }
      }

      // Upload driver documents
      const documents = [{
        type: 'registration',
        file: registrationData.registrationPhoto
      }, {
        type: 'insurance',
        file: registrationData.insurancePhoto
      }, {
        type: 'license',
        file: registrationData.licensePhoto
      }, {
        type: 'id_card',
        file: registrationData.idCardPhoto
      }, {
        type: 'compulsory_insurance',
        file: registrationData.compulsoryInsurancePhoto
      }];
      for (const doc of documents) {
        if (doc.file) {
          const fileExt = doc.file.name.split('.').pop();
          const fileName = `${userId}/${doc.type}-${Date.now()}.${fileExt}`;
          const {
            error: uploadError
          } = await supabase.storage.from('driver-documents').upload(fileName, doc.file);
          if (!uploadError) {
            const {
              data: {
                publicUrl
              }
            } = supabase.storage.from('driver-documents').getPublicUrl(fileName);
            await supabase.from('driver_documents').insert({
              driver_id: userId,
              document_type: doc.type,
              document_url: publicUrl,
              insurance_value: doc.type === 'insurance' && registrationData.insuranceValue ? parseFloat(registrationData.insuranceValue) : null
            });
          }
        }
      }
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
        <CurrentStepComponent data={registrationData} onNext={handleNext} onBack={handleBack} onSubmit={handleSubmit} onEditStep={(step: number) => setCurrentStep(step)} />
      </div>
    </div>;
};
export default Register;