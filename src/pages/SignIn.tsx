import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Globe } from "lucide-react";
import { App } from "@capacitor/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import loginBackground from "@/assets/login-background.png";
import flagTh from "@/assets/flag-th.png";
import flagEn from "@/assets/flag-en.png";
import flagKo from "@/assets/flag-ko.png";
import flagCn from "@/assets/flag-cn.png";
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
  label: 'ZH',
  flag: flagCn
}];
const SignIn = () => {
  const navigate = useNavigate();
  const {
    t,
    language,
    setLanguage
  } = useLanguage();
  const {
    toast
  } = useToast();
  const loginSchema = z.object({
    email: z.string().min(1, {
      message: t('validation.usernameRequired')
    }),
    password: z.string().min(8, {
      message: t('validation.passwordMin')
    }),
    remember: z.boolean().optional()
  });
  type LoginFormData = z.infer<typeof loginSchema>;
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string>("");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");

  // Get app version from native app - immediate fallback for web
  useEffect(() => {
    // Set fallback immediately so version is always visible
    setAppVersion("1.0.0");

    // Then try to get native version
    const getAppVersion = async () => {
      try {
        const info = await App.getInfo();
        if (info?.version) {
          setAppVersion(`${info.version}${info.build ? ` (${info.build})` : ''}`);
        }
      } catch {
        // Keep fallback version
      }
    };

    // Delay for iOS Capacitor initialization
    const timer = setTimeout(getAppVersion, 300);
    return () => clearTimeout(timer);
  }, []);
  const currentLang = languageOptions.find(l => l.code === language) || languageOptions[0];
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
      
      // POST to external login API
      const response = await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Zmt3ZXd0ZXhueXNrYmtnc3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NDA0OTAsImV4cCI6MjA1MjQxNjQ5MH0.SIbpKbPzGVHPpNDmEMOVLNB7p-Yz4AaZLQ9HsJe7i2U',
        },
        body: JSON.stringify({
          username: data.email,
          password: data.password
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Map error messages to translations
        const errorMessage = result.error || result.message || 'Login failed';
        
        if (errorMessage.includes("Invalid") || errorMessage.includes("credentials")) {
          setServerError(t('signIn.invalidCredentials'));
        } else {
          setServerError(errorMessage);
        }
        
        // Clear saved credentials on login failure
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        localStorage.removeItem("rememberedUser");
        return;
      }

      // If API returns session data, set it in Supabase client
      if (result.session) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.auth.setSession(result.session);
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
      navigate("/home");
    } catch (error) {
      console.error("Login error:", error);
      setServerError(t('signIn.error'));
    }
  };
  return <div className="h-screen bg-background flex flex-col overflow-hidden" style={{
    paddingTop: "env(safe-area-inset-top, 0px)"
  }}>
      {/* Hero Section with Truck Image */}
      <div className="relative h-[40vh] flex-shrink-0">
        <img alt="The Truckers" className="absolute inset-0 w-full h-full object-fill " src="/lovable-uploads/e621f1f8-6b0a-4d89-bbc1-5a883f8f9ecb.png" />
      </div>

      {/* Login Form */}
      <div className="flex-1 rounded-t-[3rem] -mt-8 px-6 pt-14 pb-2 bg-white overflow-y-auto">
        <h1 className="text-xl font-bold text-center mb-5 text-foreground">{t('signIn.title')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md mx-auto">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              {t('signIn.username')} <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="text" placeholder={t('signIn.usernamePlaceholder') || "ชื่อผู้ใช้"} {...register("email")} className={errors.email ? "border-destructive" : ""} />
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
          <div className="space-y-2">
            <Button type="submit" className="w-full text-white h-10 rounded-xl text-sm font-medium bg-primary">
              {t('signIn.signInButton')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/register")} className="w-full h-10 rounded-xl text-sm font-medium border-2 hover:bg-[#235A99] hover:text-white">
              {t('signIn.registerButton')}
            </Button>
          </div>

          {/* Language Switcher */}
          <div className="flex justify-center">
            <div className="relative">
              <button type="button" onClick={() => setShowLanguageMenu(!showLanguageMenu)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <img src={currentLang.flag} alt={currentLang.label} className="w-5 h-4 object-cover rounded-sm" />
                {currentLang.label}
              </button>
              
              {showLanguageMenu && <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white rounded-xl shadow-lg border overflow-hidden min-w-[120px]">
                  {languageOptions.map(lang => <button type="button" key={lang.code} onClick={() => {
                setLanguage(lang.code);
                setShowLanguageMenu(false);
              }} className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-muted transition-colors ${language === lang.code ? 'bg-muted' : ''}`}>
                      <img src={lang.flag} alt={lang.label} className="w-6 h-6 rounded-full object-cover aspect-square" />
                      <span className="text-sm">{lang.label}</span>
                    </button>)}
                </div>}
            </div>
          </div>
        </form>
      </div>
      
      {/* App Version */}
      <div className="absolute bottom-2 right-4 text-xs text-muted-foreground/60">
        v{appVersion}
      </div>
    </div>;
};
export default SignIn;