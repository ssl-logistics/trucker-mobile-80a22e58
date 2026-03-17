import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Eye, EyeOff, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { RegistrationData } from "@/pages/Register";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { supabase } from "@/integrations/supabase/client";

interface GeneralInfoStepProps {
  data: RegistrationData;
  onNext: (data: Partial<RegistrationData>) => void;
}

const GeneralInfoStep = ({ data, onNext }: GeneralInfoStepProps) => {
  const { t } = useLanguage();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();
  
  const generalInfoSchema = z.object({
    firstName: z.string().min(1, t('generalInfo.validation.firstNameRequired')),
    lastName: z.string().min(1, t('generalInfo.validation.lastNameRequired')),
    phone: z.string().regex(/^[0-9]{10}$/, t('generalInfo.validation.phoneRequired')),
    email: z.string().email(t('generalInfo.validation.emailFormat')).optional().or(z.literal("")),
    username: z.string().min(1, t('generalInfo.validation.usernameRequired')),
    password: z.string().min(8, t('generalInfo.validation.passwordMin')),
    confirmPassword: z.string().min(8, t('generalInfo.validation.confirmPasswordMin')),
    priceRangeMin: z.string().min(1, t('generalInfo.validation.priceMinRequired')).regex(/^\d+$/, t('generalInfo.validation.priceNumericOnly')),
    priceRangeMax: z.string().min(1, t('generalInfo.validation.priceMaxRequired')).regex(/^\d+$/, t('generalInfo.validation.priceNumericOnly')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('generalInfo.validation.passwordMismatch'),
    path: ["confirmPassword"],
  }).refine((data) => {
    const min = parseInt(data.priceRangeMin, 10);
    const max = parseInt(data.priceRangeMax, 10);
    if (isNaN(min) || isNaN(max)) return true;
    return min < max;
  }, {
    message: t('generalInfo.validation.priceMinExceedsMax'),
    path: ["priceRangeMin"],
  });

  type GeneralInfoFormData = z.infer<typeof generalInfoSchema>;
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(data.profilePhoto || null);
  const [profilePreview, setProfilePreview] = useState<string>(
    data.profilePhoto ? URL.createObjectURL(data.profilePhoto) : ""
  );
  const [selectedLocation, setSelectedLocation] = useState<string>(data.location || "");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showPhotoError, setShowPhotoError] = useState(false);
  const [usernameError, setUsernameError] = useState<string>("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const normalizeNumericString = (value: string | undefined) => {
    if (!value) return "";
    return value.replace(/\D/g, "").replace(/^0+/, "");
  };

  const formatNumericDisplay = (value: string | undefined) => {
    const normalized = normalizeNumericString(value);
    return normalized ? Number(normalized).toLocaleString() : "";
  };

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<GeneralInfoFormData>({
    resolver: zodResolver(generalInfoSchema),
    defaultValues: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      password: data.password,
      confirmPassword: data.confirmPassword,
      priceRangeMin: normalizeNumericString(data.priceRangeMin),
      priceRangeMax: normalizeNumericString(data.priceRangeMax),
    }
  });

  // Auto-scroll to first error
  useEffect(() => {
    if (Object.keys(errors).length > 0 || (showPhotoError && !profilePhotoFile)) {
      // Find first error element
      const firstErrorElement = formRef.current?.querySelector('.border-destructive, .ring-destructive');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (showPhotoError && !profilePhotoFile) {
        // Scroll to photo section
        formRef.current?.querySelector('.text-center')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [errors, showPhotoError, profilePhotoFile]);

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);
      setProfilePreview(URL.createObjectURL(file));
      setIsDrawerOpen(false);
    }
  };

  const handleNativePhoto = async (source: 'camera' | 'gallery') => {
    try {
      const file = source === 'camera' ? await takePhoto() : await selectFromGallery();
      if (file) {
        setProfilePhotoFile(file);
        setProfilePreview(URL.createObjectURL(file));
        setIsDrawerOpen(false);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
    }
  };

  const checkUsernameExists = async (username: string): Promise<boolean> => {
    if (!username) return false;
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase.rpc('check_username_exists', {
        check_username: username
      });
      return data === true;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const onSubmit = async (formData: GeneralInfoFormData) => {
    setShowPhotoError(true);
    setUsernameError("");
    
    if (!profilePhotoFile) {
      return;
    }
    
    // Check if username already exists
    const usernameExists = await checkUsernameExists(formData.username);
    if (usernameExists) {
      setUsernameError(t('generalInfo.validation.usernameExists'));
      return;
    }
    
    // Scroll to top before moving to next step
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    onNext({
      ...formData,
      location: selectedLocation,
      profilePhoto: profilePhotoFile || undefined,
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit, () => setShowPhotoError(true))} className="space-y-6">
      {/* Profile Photo */}
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-4">
          {t('generalInfo.profilePhoto')} <span className="text-destructive">*</span>
        </h3>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>
            <div className={`relative inline-block cursor-pointer rounded-full ${showPhotoError && !profilePhotoFile ? "ring-2 ring-destructive ring-offset-2" : ""}`}>
              <Avatar className="w-24 h-24 mx-auto">
                {profilePreview ? (
                  <AvatarImage src={profilePreview} />
                ) : (
                  <AvatarFallback className="bg-primary/10">
                    <Camera className="w-8 h-8 text-primary" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute bottom-0 right-0 bg-primary rounded-full p-2">
                <Camera className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-center">{t('generalInfo.selectPhoto')}</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-3 pb-8">
              {isNative ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleNativePhoto('camera')}
                    className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Camera className="w-6 h-6 text-primary" />
                    <div className="text-left flex-1">
                      <p className="font-medium">{t('generalInfo.takePhoto')}</p>
                      <p className="text-sm text-muted-foreground">{t('generalInfo.takePhotoDesc')}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNativePhoto('gallery')}
                    className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Image className="w-6 h-6 text-primary" />
                    <div className="text-left flex-1">
                      <p className="font-medium">{t('generalInfo.selectFromGallery')}</p>
                      <p className="text-sm text-muted-foreground">{t('generalInfo.selectFromGalleryDesc')}</p>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <label htmlFor="camera-capture" className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                    <Camera className="w-6 h-6 text-primary" />
                    <div className="text-left flex-1">
                      <p className="font-medium">{t('generalInfo.takePhoto')}</p>
                      <p className="text-sm text-muted-foreground">{t('generalInfo.takePhotoDesc')}</p>
                    </div>
                  </label>
                  <input
                    id="camera-capture"
                    type="file"
                    accept="image/*"
                    capture
                    className="hidden"
                    onChange={handleProfilePhotoChange}
                  />
                  
                  <label htmlFor="gallery-select" className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                    <Image className="w-6 h-6 text-primary" />
                    <div className="text-left flex-1">
                      <p className="font-medium">{t('generalInfo.selectFromGallery')}</p>
                      <p className="text-sm text-muted-foreground">{t('generalInfo.selectFromGalleryDesc')}</p>
                    </div>
                  </label>
                  <input
                    id="gallery-select"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePhotoChange}
                  />
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>
        <p className="text-sm text-muted-foreground mt-2">{t('generalInfo.photoPrompt')}</p>
        {showPhotoError && !profilePhotoFile && (
          <p className="text-sm text-destructive mt-1">{t('validation.profilePhotoRequired')}</p>
        )}
      </div>

      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">{t('generalInfo.personalInfo')}</h3>
        
        <div className="space-y-2">
          <Label htmlFor="firstName">
            {t('generalInfo.firstName')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            {...register("firstName")}
            className={errors.firstName ? "border-destructive" : ""}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">
            {t('generalInfo.lastName')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            {...register("lastName")}
            className={errors.lastName ? "border-destructive" : ""}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            {t('generalInfo.phone')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            {...register("phone")}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
              e.target.value = value;
              setValue("phone", value);
            }}
            className={errors.phone ? "border-destructive" : ""}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('generalInfo.email')}</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Login Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">{t('generalInfo.userInfo')}</h3>
        
        <div className="space-y-2">
          <Label htmlFor="username">
            {t('generalInfo.username')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="username"
              {...register("username")}
              className={errors.username || usernameError ? "border-destructive pr-10" : "pr-10"}
              onChange={(e) => {
                register("username").onChange(e);
                setUsernameError("");
              }}
            />
            {checkingUsername && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {errors.username && (
            <p className="text-sm text-destructive">{errors.username.message}</p>
          )}
          {usernameError && (
            <p className="text-sm text-destructive">{usernameError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {t('generalInfo.password')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...register("password")}
              className={errors.password ? "border-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            {t('generalInfo.confirmPassword')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              {...register("confirmPassword")}
              className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      {/* Work Area */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">{t('generalInfo.workArea')}</h3>
        
        <LocationAutocomplete
          value={selectedLocation}
          onChange={setSelectedLocation}
          label={t('generalInfo.workAreaLabel')}
          placeholder={t('generalInfo.workAreaPlaceholder')}
        />

        <div className="space-y-2">
          <Label>{t('generalInfo.priceRange')} <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('generalInfo.priceMin')}
              inputMode="numeric"
              {...register("priceRangeMin")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                e.target.value = raw ? Number(raw).toLocaleString() : '';
                setValue("priceRangeMin", raw);
              }}
              value={(() => {
                const v = watch("priceRangeMin");
                return v ? Number(v).toLocaleString() : '';
              })()}
              className={cn("text-right", errors.priceRangeMin ? "border-destructive" : "")}
            />
            <span className="text-muted-foreground">—</span>
            <Input
              placeholder={t('generalInfo.priceMax')}
              inputMode="numeric"
              {...register("priceRangeMax")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                e.target.value = raw ? Number(raw).toLocaleString() : '';
                setValue("priceRangeMax", raw);
              }}
              value={(() => {
                const v = watch("priceRangeMax");
                return v ? Number(v).toLocaleString() : '';
              })()}
              className={cn("text-right", errors.priceRangeMax ? "border-destructive" : "")}
            />
          </div>
          {(errors.priceRangeMin || errors.priceRangeMax) && (
            <p className="text-sm text-destructive">
              {errors.priceRangeMin?.message || errors.priceRangeMax?.message || t('generalInfo.validation.priceRange')}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
      >
        {t('generalInfo.next')}
      </Button>
    </form>
  );
};

export default GeneralInfoStep;
