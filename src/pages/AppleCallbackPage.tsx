import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setAuthItem } from "@/utils/authStorage";
import { useToast } from "@/hooks/use-toast";

const AppleCallbackPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusText, setStatusText] = useState("กำลังตรวจสอบการเข้าสู่ระบบ...");

  useEffect(() => {
    let isAlive = true;

    const getHashParams = () => {
      const rawHash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;

      const hashParts = rawHash.split("#");
      const firstPart = hashParts[0] || "";
      const secondPart = hashParts[1] || "";

      const routeQuery = firstPart.includes("?")
        ? firstPart.slice(firstPart.indexOf("?") + 1)
        : "";

      const pureHashParams = !firstPart.startsWith("/") && firstPart.includes("=")
        ? firstPart
        : "";

      const combined = [routeQuery, secondPart, pureHashParams]
        .filter(Boolean)
        .join("&");

      return new URLSearchParams(combined);
    };

    const saveAppAuth = async (user: any) => {
      const appleDriver = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email || "Apple User",
        avatar_url: user.user_metadata?.avatar_url || null,
        loginType: "apple",
        email: user.email,
      };

      await Promise.all([
        setAuthItem("auth_driver", JSON.stringify(appleDriver)),
        setAuthItem("auth_driver_id", user.id),
        setAuthItem("auth_login_type", "apple"),
        setAuthItem("auth_user_type", "freelance_driver"),
        setAuthItem("user_role", "freelance"),
      ]);
    };

    const handleCallback = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = getHashParams();

        const oauthError = searchParams.get("error") || hashParams.get("error");
        const oauthErrorDescription =
          searchParams.get("error_description") ||
          hashParams.get("error_description") ||
          oauthError;

        if (oauthError) {
          throw new Error(oauthErrorDescription || "Apple OAuth failed");
        }

        const code = searchParams.get("code") || hashParams.get("code");
        const accessToken =
          searchParams.get("access_token") || hashParams.get("access_token");
        const refreshToken =
          searchParams.get("refresh_token") || hashParams.get("refresh_token");

        let user = null;

        if (code) {
          setStatusText("กำลังยืนยันตัวตนกับ Apple...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          user = data?.user ?? null;
        } else if (accessToken && refreshToken) {
          setStatusText("กำลังสร้างเซสชัน...");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          user = data?.user ?? null;
        } else {
          setStatusText("กำลังกู้คืนเซสชัน...");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          user = session?.user ?? null;
        }

        if (!user) {
          throw new Error("ไม่พบข้อมูลผู้ใช้จาก Apple");
        }

        await saveAppAuth(user);

        if (!isAlive) return;

        window.dispatchEvent(new Event("auth_driver_updated"));

        const redirectPath = sessionStorage.getItem("auth_redirect_after_login");
        sessionStorage.removeItem("auth_redirect_after_login");

        toast({
          title: "เข้าสู่ระบบสำเร็จ",
          description: `ยินดีต้อนรับ ${user.user_metadata?.full_name || user.email || "ผู้ใช้งาน"}`,
        });

        navigate(
          redirectPath && redirectPath !== "/" && redirectPath !== "/home"
            ? redirectPath
            : "/home",
          { replace: true }
        );
      } catch (error: any) {
        if (!isAlive) return;

        console.error("[Apple Callback] Error:", error);
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: error?.message || "ไม่สามารถเข้าสู่ระบบด้วย Apple ได้",
        });
        navigate("/", { replace: true });
      }
    };

    void handleCallback();

    return () => {
      isAlive = false;
    };
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Apple Sign In</h1>
        <p className="text-sm text-muted-foreground">{statusText}</p>
      </div>
    </div>
  );
};

export default AppleCallbackPage;