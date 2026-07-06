import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { login as loginExternal } from "@/lib/externalApi";
import { setAuthItem } from "@/utils/authStorage";
import loginBackground from "@/assets/login-background.png";
import flagTh from "@/assets/flag-th.png";
import flagEn from "@/assets/flag-en.png";
import flagKo from "@/assets/flag-ko.png";
import flagCn from "@/assets/flag-cn.png";
import { LineDebugModal } from "@/components/debug/LineDebugModal";
import { initLiff, liffLogin, getLiffProfile, liff, LIFF_ID } from "@/lib/liff";

const setLineDebugValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore debug-only persistence failures
  }
};
const LINE_CHANNEL_ID = LIFF_ID.split('-')[0] || '2008888039';
const LINE_NATIVE_REDIRECT_URI = 'https://mobile.the-trucker.com/auth/line/callback';

const buildNativeLineOAuthUrl = () => {
  const state = `thetroob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    localStorage.setItem('line_oauth_state', state);
    sessionStorage.setItem('line_oauth_state', state);
  } catch {
    // storage is best-effort for native callback validation/debugging
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CHANNEL_ID,
    redirect_uri: LINE_NATIVE_REDIRECT_URI,
    state,
    scope: 'profile openid',
  });

  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
};
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
  label: 'ZH-CN',
  flag: flagCn
}];

const getFirstRecord = (value: unknown): Record<string, any> | null => {
  if (Array.isArray(value)) return getFirstRecord(value[0]);
  return value && typeof value === 'object' ? value as Record<string, any> : null;
};

const resolveVehicleFromLoginData = (loginData: Record<string, any> | null | undefined) => {
  if (!loginData) return null;

  const driver = getFirstRecord(loginData.driver);
  const candidateKeys = [
    'vehicle',
    'truck',
    'factory_truck',
    'factory_trucks',
    'logistics_truck',
    'logistics_trucks',
    'logistics_trailer',
    'logistics_trailers',
  ];

  for (const key of candidateKeys) {
    const vehicle = getFirstRecord(loginData[key]) || getFirstRecord(driver?.[key]);
    if (vehicle) return vehicle;
  }

  return null;
};

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
  const {
    isAuthenticated,
    userType,
    setAuthTransitioning
  } = useAuth();
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLineDebug, setShowLineDebug] = useState(false);
  const currentPlatform = Capacitor.getPlatform();
  const showAppleSignIn = currentPlatform !== 'android';
  console.log('[Apple Sign In] Platform:', currentPlatform, 'Show:', showAppleSignIn);

  // Auto-resume LIFF login after returning from LINE OAuth (external browser only)
  useEffect(() => {
    const pending = (() => {
      try { return sessionStorage.getItem('liff_pending_login'); } catch { return null; }
    })();
    if (!pending) return;
    (async () => {
      try {
        await initLiff();
        if (!liff.isLoggedIn()) {
          try { sessionStorage.removeItem('liff_pending_login'); } catch {}
          return;
        }
        const btn = document.querySelector<HTMLButtonElement>('button[data-liff-trigger="1"]');
        btn?.click();
      } catch (e) {
        console.warn('[LIFF Resume] error:', e);
        try { sessionStorage.removeItem('liff_pending_login'); } catch {}
      }
    })();
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

  // Load saved email on mount (passwords are NEVER stored client-side for security)
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedRemember = localStorage.getItem("rememberedUser");
    // Clean up any legacy stored password from previous versions
    localStorage.removeItem("rememberedPassword");
    if (savedRemember === "true" && savedEmail) {
      setValue("email", savedEmail);
      setValue("remember", true);
    }
  }, [setValue]);

  // Fallback for OAuth on native/web: if session/auth state already exists, leave Sign In page automatically
  useEffect(() => {
    if (!isAuthenticated) return;

    if (userType === 'company' || userType === 'factory') {
      navigate('/dashboard', { replace: true });
      return;
    }

    navigate('/home', { replace: true });
  }, [isAuthenticated, userType, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    if (isLoggingIn) return; // Prevent double-click
    
    try {
      setServerError("");
      setIsLoggingIn(true);
      
      // POST to login API directly (External API)
      const { data: result, error: apiError } = await loginExternal(data.email, data.password);

      if (apiError || !result?.success) {
        const errorMessage = apiError || result?.error || 'Login failed';
        
        if (errorMessage.includes("Invalid") || errorMessage.includes("credentials")) {
          setServerError(t('signIn.invalidCredentials'));
        } else if (errorMessage.includes("CORS") || errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
          setServerError(t('signIn.connectionError'));
        } else {
          setServerError(t('signIn.error'));
        }
        
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        localStorage.removeItem("rememberedUser");
        setIsLoggingIn(false);
        return;
      }

      // Parse API response
      let driver = result.data?.driver || null;
      const vehicle = resolveVehicleFromLoginData(result.data as Record<string, any> | null | undefined);
      const userType = result.data?.user_type || null;
      const loginApiKey = result.data?.api_key || null;
      
      // company_type อยู่ใน driver object (สำหรับ internal/external driver)
      const employerType = driver?.company_type || null; // 'factory' or 'company'
      
      console.log('[Login Debug] user_type:', userType);
      console.log('[Login Debug] company_type (from driver):', employerType);
      
      // For internal_driver and external_driver, merge vehicle data into driver object
      if (driver && vehicle && (userType === 'internal_driver' || userType === 'external_driver')) {
        driver = {
          ...driver,
          // Map vehicle fields to match freelance driver structure
          plate_number: vehicle.license_plate || driver.license_plate,
          plate_province: vehicle.province || '',
          vehicle_brand: vehicle.brand || driver.car_brand,
          vehicle_color: vehicle.color || '',
          vin: vehicle.vin || '',
          fuel_type: vehicle.fuel_type || '',
          load_capacity: vehicle.weight_capacity || 0,
          vehicle_type: vehicle.vehicle_type || driver.vehicle_type,
          width: vehicle.dimensions_width,
          length: vehicle.dimensions_length,
          height: vehicle.dimensions_height,
          container_types: vehicle.container_types || [],
          has_trailer: false,
          // Vehicle photos
          front_photo_url: vehicle.front_image_url || vehicle.front_photo_url || vehicle.front_url || vehicle.photo_front_url,
          side_photo_url: vehicle.side_image_url || vehicle.side_photo_url || vehicle.left_photo_url || vehicle.left_image_url || vehicle.photo_side_url,
          back_photo_url: vehicle.rear_image_url || vehicle.back_photo_url || vehicle.back_image_url || vehicle.rear_photo_url || vehicle.photo_back_url,
          plate_photo_url: vehicle.license_plate_image_url || vehicle.license_plate_photo_url || vehicle.plate_photo_url || vehicle.plate_image_url || vehicle.other_image_url,
          registration_photo_url: vehicle.registration_document_url || vehicle.document_url || driver.registration_document_url,
          registration_document_url: vehicle.registration_document_url || vehicle.document_url || driver.registration_document_url,
          document_url: vehicle.document_url,
          // Support for array of registration photos
          registration_photos: vehicle.registration_photos || [],
          insurance_document_url: vehicle.insurance_document_url || driver.insurance_document_url,
          other_image_url: vehicle.other_image_url || driver.other_image_url,
          // Keep vehicle reference
          vehicle_id: vehicle.id,
          vehicle,
        };
      }
      
      // Map user_type to app role
      let role = 'freelance';
      if (userType === 'freelance_driver' || userType === 'internal_driver' || userType === 'external_driver') {
        role = 'freelance';
      } else if (userType === 'company') {
        role = 'company';
      } else if (userType === 'factory') {
        role = 'factory';
      }
      
      // Save driver data (persistent across app restarts)
      await Promise.all([
        setAuthItem("auth_driver", JSON.stringify(driver)),
        setAuthItem("auth_user_type", userType || ""),
        setAuthItem("user_role", role),
        setAuthItem("auth_driver_id", driver?.id || ""),
        setAuthItem("auth_login_type", "normal"),
        setAuthItem("auth_api_key", loginApiKey || ""),
        setAuthItem("auth_employer_type", employerType || ""),
      ]);
      window.dispatchEvent(new Event('auth_driver_updated'));

      console.log("Login successful:", { driver, userType, role });

      toast({
        description: t('signIn.loginSuccess') || 'เข้าสู่ระบบสำเร็จ',
      });

      // Save email only (NEVER store passwords client-side)
      if (data.remember) {
        localStorage.setItem("rememberedEmail", data.email);
        localStorage.setItem("rememberedUser", "true");
      } else {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedUser");
      }
      // Always clear any legacy stored password
      localStorage.removeItem("rememberedPassword");
      
      // Check if there's a saved redirect destination (from ProtectedRoute)
      const redirectPath = sessionStorage.getItem('auth_redirect_after_login');
      sessionStorage.removeItem('auth_redirect_after_login');

      // Navigate based on user_type, or to saved redirect path
      if (redirectPath && redirectPath !== '/' && redirectPath !== '/home' && redirectPath !== '/dashboard') {
        navigate(redirectPath, { replace: true });
      } else if (userType === 'company' || userType === 'factory') {
        navigate("/dashboard", { replace: true });
      } else {
        // freelance_driver, internal_driver, external_driver all go to /home
        navigate("/home", { replace: true });
      }
    } catch (error) {
      console.error("Login error:", error);
      setServerError(t('signIn.error'));
      setIsLoggingIn(false);
    }
  };
  return <div className="h-screen bg-background flex flex-col overflow-hidden" style={{
    paddingTop: "env(safe-area-inset-top, 0px)"
  }}>
      {/* Hero Section with Truck Image */}
      <div className="relative h-[40vh] flex-shrink-0">
        <img alt="The Truckers" className="absolute inset-0 w-full h-full object-cover" src="/lovable-uploads/login-background-2.png" />
      </div>

      {/* Login Form */}
      <div className="flex-1 rounded-t-[3rem] -mt-8 px-6 pt-12 pb-2 bg-white overflow-hidden flex flex-col">
        <h1 className="text-lg font-bold text-center mb-2 text-foreground">{t('signIn.title')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5 w-full mx-auto flex-1 flex flex-col overflow-hidden">
          {/* Email Field */}
          <div className="space-y-1">
            <Label htmlFor="email" className="text-foreground">
              {t('signIn.username')} <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="text" placeholder={t('signIn.usernamePlaceholder')} {...register("email")} className={errors.email ? "border-destructive" : ""} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password Field */}
          <div className="space-y-1">
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
          <div className="space-y-1.5">
            <Button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full text-white h-10 rounded-xl text-sm font-medium bg-primary hover:bg-[#235A99]"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('signIn.loggingIn')}
                </>
              ) : (
                t('signIn.signInButton')
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/register")} 
              disabled={isLoggingIn}
              className="w-full h-10 rounded-xl text-sm font-medium border-2 hover:bg-[#235A99] hover:text-white"
            >
              {t('signIn.registerButton')}
            </Button>
          </div>

          {/* LINE Login Button */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">{t('signIn.or')}</span>
            </div>
          </div>
          
          <div className="flex justify-center">
          <button 
            type="button" 
            onClick={async () => {
              console.log('[LIFF Login] 🚀 Button clicked');
              setIsLoggingIn(true);
              try {
                if (Capacitor.isNativePlatform()) {
                  console.log('[LINE Native Login] Opening LINE OAuth in native browser');
                  setAuthTransitioning(true, 'กำลังเข้าสู่ระบบ LINE...');
                  await Browser.open({
                    url: buildNativeLineOAuthUrl(),
                    presentationStyle: 'popover',
                  });
                  return;
                }

                await initLiff();
                console.log('[LIFF Login] init done. isLoggedIn =', liff.isLoggedIn(), 'isInClient =', liff.isInClient());

                // If not logged in, trigger LIFF login.
                // - In LINE in-app browser: silent / auto-consent
                // - In external browser: redirects to LINE OAuth, returns to this same URL
                if (!liff.isLoggedIn()) {
                  // Persist redirect target so we can resume after returning
                  try { sessionStorage.setItem('liff_pending_login', '1'); } catch {}
                  await liffLogin();
                  return; // browser will navigate away
                }

                const accessToken = liff.getAccessToken();
                if (!accessToken) {
                  throw new Error('LIFF access token is empty');
                }

                const profile = await getLiffProfile();
                console.log('[LIFF Login] ✅ Got profile:', profile?.displayName);

                // Send accessToken to line-auth edge function for verification + account creation
                const { data, error: fnError } = await supabase.functions.invoke('line-auth', {
                  body: { accessToken },
                });

                if (fnError) throw new Error(fnError.message);
                if (data?.error) throw new Error(data.error);

                console.log('[LIFF Login] ✅ line-auth returned:', data?.user?.lineUserId);

                // Persist auth data
                await setAuthItem('line_user', JSON.stringify(data.user));
                await setAuthItem('auth_login_type', 'line');

                const lineDriver: Record<string, any> = {
                  id: data.user.lineUserId,
                  full_name: data.user.displayName,
                  first_name: data.user.displayName?.split(' ')[0] || '',
                  last_name: data.user.displayName?.split(' ').slice(1).join(' ') || '',
                  avatar_url: data.user.pictureUrl || null,
                  phone_number: '',
                  email: '',
                  username: '',
                  loginType: 'line',
                  lineUser: data.user,
                };

                await setAuthItem('auth_driver', JSON.stringify(lineDriver));
                await setAuthItem('auth_driver_id', data.user.lineUserId);
                await setAuthItem('auth_user_type', 'freelance_driver');
                await setAuthItem('user_role', 'freelance');

                try { sessionStorage.removeItem('liff_pending_login'); } catch {}

                window.dispatchEvent(new CustomEvent('auth_driver_updated', {
                  detail: { driver: lineDriver, userType: 'freelance_driver', role: 'freelance' },
                }));

                toast({
                  title: 'เข้าสู่ระบบสำเร็จ',
                  description: `ยินดีต้อนรับ ${data.user.displayName}`,
                });

                const redirectPath = sessionStorage.getItem('auth_redirect_after_login');
                sessionStorage.removeItem('auth_redirect_after_login');
                navigate(redirectPath && redirectPath !== '/' ? redirectPath : '/home', { replace: true });

                // Link/create account and hydrate full driver profile in the background.
                void (async () => {
                  let driverUserId = data.user.lineUserId;
                  try {
                    const { data: accountData } = await supabase.functions.invoke('create-account', {
                      body: {
                        authProvider: 'line',
                        lineUserId: data.user.lineUserId,
                        firstName: data.user.displayName?.split(' ')[0] || 'LINE',
                        lastName: data.user.displayName?.split(' ').slice(1).join(' ') || 'User',
                        phone: '0000000000',
                        email: '',
                        avatarUrl: data.user.pictureUrl || '',
                      },
                    });
                    driverUserId = accountData?.userId || driverUserId;
                  } catch (e) {
                    console.warn('[LIFF Login] create-account non-blocking error:', e);
                  }

                  try {
                    const { data: registerData } = await supabase.functions.invoke('register-driver', {
                      body: {
                        authProvider: 'line',
                        authUserId: driverUserId,
                        firstName: data.user.displayName?.split(' ')[0] || 'LINE',
                        lastName: data.user.displayName?.split(' ').slice(1).join(' ') || 'User',
                      },
                    });
                    const tmsData = registerData?.data || registerData;
                    const tmsFullName = tmsData
                      ? `${tmsData.firstName || ''} ${tmsData.lastName || ''}`.trim()
                      : '';
                    const syncedDriver: Record<string, any> = {
                      ...(tmsData && typeof tmsData === 'object' ? tmsData : {}),
                      ...lineDriver,
                      id: tmsData?.id || driverUserId,
                      full_name: tmsFullName || lineDriver.full_name,
                      phone_number: tmsData?.phone || '',
                      email: tmsData?.email || '',
                      username: tmsData?.driverCode || '',
                    };
                    await setAuthItem('auth_driver', JSON.stringify(syncedDriver));
                    await setAuthItem('auth_driver_id', syncedDriver.id);
                    window.dispatchEvent(new Event('auth_driver_updated'));
                  } catch (e) {
                    console.warn('[LIFF Login] register-driver non-blocking error:', e);
                  }
                })();
              } catch (err: any) {
                console.error('[LIFF Login] ❌ Error:', err);
                toast({
                  variant: 'destructive',
                  title: 'เกิดข้อผิดพลาด',
                  description: err?.message || 'ไม่สามารถเข้าสู่ระบบ LINE ได้',
                });
              } finally {
                setIsLoggingIn(false);
                if (!Capacitor.isNativePlatform()) {
                  setAuthTransitioning(false);
                }
              }
            }}
            disabled={isLoggingIn}
            data-liff-trigger="1"
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00B900] hover:bg-[#00A000] text-white font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            {t('signIn.lineLogin')}
          </button>
          </div>

          {/* Apple Sign In - show on iOS and Web only */}
          {showAppleSignIn && (
            <div className="flex justify-center">
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsLoggingIn(true);
                  console.log('[Apple Login] Starting OAuth flow...');

                  const publishedUrl = 'https://thetrucker-mobile.lovable.app';
                  const nativeRedirectUrl = `${publishedUrl}/auth/apple/callback/index.html`;
                  const isPreviewHost = /(^id-preview--)|(\.lovableproject\.com$)/.test(window.location.hostname);

                  let isInIframe = false;
                  try {
                    isInIframe = window.self !== window.top;
                  } catch {
                    isInIframe = true;
                  }

                  if (Capacitor.isNativePlatform()) {
                    // On native iOS, open OAuth in Browser plugin and deep-link back to app
                    const oauthUrl = `${publishedUrl}/~oauth/initiate?provider=apple&redirect_uri=${encodeURIComponent(nativeRedirectUrl)}`;

                    const finishedListener = await Browser.addListener('browserFinished', async () => {
                      console.log('[Apple Login] Browser finished/closed');
                      finishedListener.remove();

                      setTimeout(async () => {
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (session) {
                            console.log('[Apple Login] ✅ Session found after browser close:', session.user?.email);
                            window.dispatchEvent(new Event('auth_driver_updated'));
                          } else {
                            console.log('[Apple Login] No session after browser close');
                          }
                        } catch (e) {
                          console.log('[Apple Login] Session check error:', e);
                        } finally {
                          setIsLoggingIn(false);
                        }
                      }, 1500);
                    });

                    await Browser.open({
                      url: oauthUrl,
                      presentationStyle: 'popover',
                    });
                  } else {
                    // Outside editor preview iframe, use published domain redirect for stable OAuth callback
                    const webRedirectUri = !isInIframe && isPreviewHost ? publishedUrl : window.location.origin;

                    const { error } = await lovable.auth.signInWithOAuth("apple", {
                      redirect_uri: webRedirectUri,
                    });

                    if (error) {
                      console.error('[Apple Login] Error:', error);
                      toast({ title: t('signIn.error'), variant: 'destructive' });
                    }
                  }
                } catch (err) {
                  console.error('[Apple Login] Error:', err);
                  toast({ title: t('signIn.error'), variant: 'destructive' });
                  setIsLoggingIn(false);
                } finally {
                  // Don't reset isLoggingIn here for native - wait for deep link or browserFinished
                  if (!Capacitor.isNativePlatform()) {
                    setIsLoggingIn(false);
                  }
                }
              }}
              disabled={isLoggingIn}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-black hover:bg-black/90 text-white font-medium transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Sign in with Apple
            </button>
            </div>
          )}

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

      <LineDebugModal open={showLineDebug} onClose={() => setShowLineDebug(false)} />
    </div>;
};
export default SignIn;
