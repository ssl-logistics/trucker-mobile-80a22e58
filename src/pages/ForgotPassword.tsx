import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { checkDriverPhone } from "@/lib/externalApi";
import loginBackground from "@/assets/login-background.png";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  const phoneSchema = z.object({
    phone: z.string().regex(/^[0-9]{10}$/, {
      message: t('forgotPassword.phoneFormat')
    })
  });
  
  type PhoneFormData = z.infer<typeof phoneSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema)
  });

  const onSubmit = async (data: PhoneFormData) => {
    try {
      setServerError("");
      setIsLoading(true);

      // Check if phone exists via external API
      const result = await checkDriverPhone(data.phone);
      
      if (result.error) {
        setServerError(result.error);
        setIsLoading(false);
        return;
      }

      const responseData = result.data as any;
      if (!responseData?.found) {
        setServerError(t('forgotPassword.phoneNotFound'));
        setIsLoading(false);
        return;
      }

      // รองรับ response ได้หลายรูปแบบ โดยเฉพาะรูปแบบใหม่: { results: [{ driver_type, driver: { id } }] }
      const firstResult = Array.isArray(responseData?.results) ? responseData.results[0] : null;
      const nestedDriver = firstResult?.driver;
      const legacyDriver = responseData?.data?.driver || responseData?.data;
      const driverId = firstResult?.driver_id || nestedDriver?.id || legacyDriver?.driver_id || legacyDriver?.id || '';
      const driverType = firstResult?.driver_type || nestedDriver?.driver_type || legacyDriver?.driver_type || 'freelance';

      if (!driverId) {
        console.error('[ForgotPassword] Missing driverId from check-driver-phone response:', responseData);
        setServerError(t('forgotPassword.error'));
        setIsLoading(false);
        return;
      }

      toast({
        title: t('forgotPassword.phoneVerified'),
        description: t('forgotPassword.phoneVerifiedDesc')
      });
      
      navigate("/create-new-password", {
        state: {
          phone: data.phone,
          driverId,
          driverType,
        }
      });
    } catch (error) {
      console.error("Error:", error);
      setServerError(t('forgotPassword.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="relative h-[40vh]">
        <img src={loginBackground} alt="The Truckers" className="absolute inset-0 w-full h-full object-fill" />
      </div>

      {/* Form Section */}
      <div className="flex-1 rounded-t-[3rem] -mt-12 px-6 pt-8 pb-6 bg-white">
        <div className="max-w-md mx-auto mt-6">
          {/* Back Button */}
          <button onClick={() => navigate("/")} className="mb-6 flex items-center text-foreground/60 hover:text-foreground">
            <ChevronLeft className="w-5 h-5 mr-2" />
            <span>{t('forgotPassword.backButton')}</span>
          </button>

          <h1 className="text-2xl font-bold text-center mb-2 text-foreground">
            {t('forgotPassword.title')}
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            {t('forgotPassword.subtitle')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Phone Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground">
                {t('forgotPassword.phone')} <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="phone" 
                type="tel" 
                inputMode="numeric"
                maxLength={10}
                placeholder={t('forgotPassword.phonePlaceholder')} 
                {...register("phone")}
                onKeyDown={(e) => {
                  if (e.key === ' ') e.preventDefault();
                }}
                onChange={(e) => {
                  const filtered = e.target.value.replace(/\D/g, '').slice(0, 10);
                  e.target.value = filtered;
                  register("phone").onChange(e);
                }}
                className={errors.phone || serverError ? "border-destructive" : ""} 
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>

            {/* Submit Button */}
            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 rounded-xl text-base font-medium"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('forgotPassword.confirmButton')}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/")} 
                className="w-full h-12 rounded-xl text-base font-medium border-2"
              >
                {t('forgotPassword.signInButton')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
