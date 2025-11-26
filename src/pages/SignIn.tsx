import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import loginBackground from "@/assets/login-background.png";
const loginSchema = z.object({
  email: z.string().min(1, {
    message: "กรุณากรอกชื่อผู้ใช้"
  }).email({
    message: "รูปแบบอีเมลไม่ถูกต้อง"
  }),
  password: z.string().min(8, {
    message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
  }),
  remember: z.boolean().optional()
});
type LoginFormData = z.infer<typeof loginSchema>;
const SignIn = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    toast
  } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string>("");
  const {
    register,
    handleSubmit,
    formState: {
      errors
    },
    setValue,
    watch
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false
    }
  });
  const rememberValue = watch("remember");

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedPassword = localStorage.getItem("rememberedPassword");
    const savedRemember = localStorage.getItem("rememberedUser");
    
    if (savedRemember === "true" && savedEmail && savedPassword) {
      setValue("email", savedEmail);
      setValue("password", savedPassword);
      setValue("remember", true);
    }
  }, [setValue]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      setServerError("");
      const { supabase } = await import("@/integrations/supabase/client");

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setServerError(t('signIn.invalidCredentials'));
        } else {
          setServerError(authError.message);
        }
        // Clear saved credentials on login failure
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        localStorage.removeItem("rememberedUser");
        return;
      }

      // Save or clear credentials based on remember checkbox
      if (data.remember) {
        localStorage.setItem("rememberedEmail", data.email);
        localStorage.setItem("rememberedPassword", data.password);
        localStorage.setItem("rememberedUser", "true");
      } else {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        localStorage.removeItem("rememberedUser");
      }

      toast({
        title: t('signIn.success'),
        description: t('signIn.welcomeBack')
      });
      navigate("/home");
    } catch (error) {
      console.error("Login error:", error);
      setServerError(t('signIn.error'));
    }
  };
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section with Truck Image */}
      <div className="relative h-[40vh]">
        <img src={loginBackground} alt="The Truckers" className="absolute inset-0 w-full h-full object-fill " />
      </div>

      {/* Login Form */}
      <div className="flex-1 rounded-t-[3rem] -mt-12 px-6 pt-8 pb-6 bg-white/0">
        <h1 className="text-2xl font-bold text-center mb-8 mt-5 text-foreground">{t('signIn.title')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-md mx-auto">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              {t('signIn.username')} <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="email" placeholder="example@email.com" {...register("email")} className={errors.email ? "border-destructive" : ""} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              {t('signIn.password')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••••" {...register("password")} className={`pr-10 ${errors.password || serverError ? "border-destructive" : ""}`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" checked={rememberValue} onCheckedChange={checked => setValue("remember", checked as boolean)} />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-foreground">
                {t('signIn.rememberMe')}
              </Label>
            </div>
            <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm text-secondary hover:underline">
              {t('signIn.forgotPassword')}
            </button>
          </div>

          {/* Submit Buttons */}
          <div className="space-y-3 pt-4">
            <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 rounded-xl text-base font-medium">
              {t('signIn.signInButton')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/register")} className="w-full h-12 rounded-xl text-base font-medium border-2">
              {t('signIn.registerButton')}
            </Button>
          </div>
        </form>
      </div>
    </div>;
};
export default SignIn;