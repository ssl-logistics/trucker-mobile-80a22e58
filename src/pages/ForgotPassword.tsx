import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import loginBackground from "@/assets/login-background.png";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string>("");
  
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

      // Skip OTP verification temporarily - go directly to password reset
      toast({
        title: t('forgotPassword.phoneVerified'),
        description: t('forgotPassword.phoneVerifiedDesc')
      });
      
      navigate("/create-new-password", {
        state: {
          phone: data.phone
        }
      });
    } catch (error) {
      console.error("Error:", error);
      setServerError(t('forgotPassword.error'));
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
                placeholder={t('forgotPassword.phonePlaceholder')} 
                {...register("phone")} 
                className={errors.phone || serverError ? "border-destructive" : ""} 
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>

            {/* Submit Button */}
            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 rounded-xl text-base font-medium"
              >
                {t('forgotPassword.confirmButton')}
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
