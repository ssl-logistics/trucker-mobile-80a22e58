import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App, URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { getAuthItem, setAuthItem } from "@/utils/authStorage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { autoRegisterOAuthUser } from "@/utils/oauthAutoRegister";

const LINE_REDIRECT_URI = "https://mobile.the-trucker.com/auth/line/callback";
const APPLE_HANDLED_KEY = "apple_auth_handled";

// Only redirect to /home when the user is on the sign-in / auth landing routes.
// If they are already inside the app, don't yank them back.
const shouldRedirectToHomeAfterAuth = () => {
  const hash = window.location.hash || "";
  const path = hash.startsWith("#") ? hash.slice(1).split("?")[0] : window.location.pathname;
  return path === "/" || path === "" || path.startsWith("/auth/");
};

// Only redirect to "/" on auth failure if there is no valid stored driver.
// Prevents a stale/reused deep-link from logging out a working session.
const shouldRedirectToSignInOnError = async () => {
  try {
    const driverData = await getAuthItem("auth_driver");
    if (!driverData || driverData === "null") return true;
    const parsed = JSON.parse(driverData);
    return !(parsed && typeof parsed.id === "string" && parsed.id.length > 0);
  } catch {
    return true;
  }
};

const setDebugValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore debug persistence failures
  }
};

const clearDebugValue = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore debug persistence failures
  }
};

const normalizeDeepLinkPath = (url: URL) => {
  const combined = `${url.host}${url.pathname}`;
  return combined.replace(/^\/+|\/+$/g, "");
};

const persistDeepLinkDebug = (rawUrl: string, source: string) => {
  setDebugValue("line_last_deep_link_url", rawUrl);
  setDebugValue("line_last_deep_link_source", source);
  setDebugValue("line_last_deep_link_at", new Date().toISOString());
  clearDebugValue("line_last_deep_link_error");
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
};

const extractLineCallbackParams = (url: URL, path: string) => {
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const queryCode = url.searchParams.get("code");
  const queryState = url.searchParams.get("state");

  if (queryCode || queryState) {
    return {
      params: queryParams,
      code: queryCode,
      state: queryState,
      source: "query",
    };
  }

  const payloadPrefix = "line-callback/payload/";
  if (path.startsWith(payloadPrefix)) {
    const encodedPayload = path.slice(payloadPrefix.length);
    if (encodedPayload) {
      try {
        const payload = JSON.parse(decodeBase64Url(encodedPayload));
        return {
          params: payload,
          code: payload?.code ?? null,
          state: payload?.state ?? null,
          source: "path-payload",
        };
      } catch (error) {
        console.error("[DeepLink] Failed to decode LINE payload from path:", error);
      }
    }
  }

  return {
    params: queryParams,
    code: null,
    state: null,
    source: "empty",
  };
};

interface LineUserData {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export const useDeepLinkHandler = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const persistDriverSession = async (driver: Record<string, any>, loginType: string) => {
    await Promise.all([
      setAuthItem("auth_driver", JSON.stringify(driver)),
      setAuthItem("auth_driver_id", driver.id),
      setAuthItem("auth_login_type", loginType),
      setAuthItem("auth_user_type", "freelance_driver"),
      setAuthItem("user_role", "freelance"),
    ]);
    window.dispatchEvent(new Event("auth_driver_updated"));
  };

  useEffect(() => {
    let lastHandledUrl: string | null = null;
    // Prevents double-processing if both appUrlOpen and browserFinished fire
    // for the same auth attempt within a short window.
    let lineCodeProcessed = false;

    // ── Shared LINE code-exchange helper ──────────────────────────────────────
    const processLineCode = async (code: string): Promise<void> => {
      if (lineCodeProcessed) {
        console.log("[DeepLink] ⏭️ LINE code already processed, skipping duplicate");
        return;
      }
      lineCodeProcessed = true;
      // Allow a retry after 30 s in case the first attempt fails hard.
      const resetTimer = window.setTimeout(() => {
        lineCodeProcessed = false;
      }, 30_000);

      try {
        console.log("[DeepLink] 📡 Exchanging LINE code for token...");

        const redirectUri = LINE_REDIRECT_URI;
        const { data, error: fnError } = await supabase.functions.invoke("line-auth", {
          body: { code, redirectUri },
        });

        if (fnError || data?.error) {
          console.error("[DeepLink] ❌ LINE auth error:", fnError || data?.error);
          toast({
            variant: "destructive",
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถเข้าสู่ระบบ LINE ได้",
          });
          navigate("/", { replace: true });
          return;
        }

        console.log("[DeepLink] ✅ LINE user data received:", data.user.displayName);

        // Auto-create account in database
        let driverUserId = data.user.lineUserId;
        try {
          const { data: accountData, error: accountError } = await supabase.functions.invoke("create-account", {
            body: {
              authProvider: "line",
              lineUserId: data.user.lineUserId,
              firstName: data.user.displayName?.split(" ")[0] || "LINE",
              lastName: data.user.displayName?.split(" ").slice(1).join(" ") || "User",
              phone: "0000000000",
              email: "",
              avatarUrl: data.user.pictureUrl || "",
            },
          });
          if (!accountError && accountData?.userId) {
            driverUserId = accountData.userId;
            console.log("[DeepLink] ✅ Account created/found:", driverUserId);
          }
        } catch (e) {
          console.warn("[DeepLink] ⚠️ Account creation failed (non-blocking):", e);
        }

        // Register driver in external TMS
        let registeredPhone = "";
        let registeredEmail = "";
        let registeredFirstName = "";
        let registeredLastName = "";
        try {
          const registerBody: Record<string, string> = {
            authProvider: "line",
            authUserId: driverUserId,
          };
          if (data.user.displayName) {
            const nameParts = data.user.displayName.split(" ");
            registerBody.firstName = nameParts[0] || "LINE";
            registerBody.lastName = nameParts.slice(1).join(" ") || "User";
          }
          const { data: regData, error: regError } = await supabase.functions.invoke("register-driver", {
            body: registerBody,
          });
          if (regError) {
            console.warn("[DeepLink] ⚠️ External registration warning:", regError.message);
          } else {
            console.log("[DeepLink] ✅ External TMS registration:", regData);
          }
          const regDriverData = regData?.data || regData;
          registeredPhone = regDriverData?.phone || "";
          registeredEmail = regDriverData?.email || "";
          registeredFirstName = regDriverData?.firstName || "";
          registeredLastName = regDriverData?.lastName || "";
        } catch (regErr) {
          console.warn("[DeepLink] ⚠️ External registration failed (non-blocking):", regErr);
        }

        await setAuthItem("line_user", JSON.stringify(data.user));
        await setAuthItem("auth_login_type", "line");

        const lineDriver: Record<string, any> = {
          id: driverUserId,
          full_name: data.user.displayName,
          first_name: registeredFirstName || data.user.displayName?.split(" ")[0] || "",
          last_name: registeredLastName || data.user.displayName?.split(" ").slice(1).join(" ") || "",
          phone: registeredPhone,
          phone_number: registeredPhone,
          email: registeredEmail || "",
          avatar_url: data.user.pictureUrl || null,
          loginType: "line",
          lineUser: data.user,
        };
        console.log("[DeepLink] ✅ Auth data saved, driverId:", driverUserId);

        await persistDriverSession(lineDriver, "line");

        // Clear saved state after successful auth
        localStorage.removeItem("line_oauth_state");
        sessionStorage.removeItem("line_oauth_state");

        toast({
          title: "เข้าสู่ระบบสำเร็จ",
          description: `ยินดีต้อนรับ ${data.user.displayName}`,
        });

        navigate("/home", { replace: true });
      } catch (err) {
        console.error("[DeepLink] ❌ processLineCode error:", err);
        lineCodeProcessed = false;
        clearTimeout(resetTimer);
      }
    };
    // ─────────────────────────────────────────────────────────────────────────

    // ── Supabase bridge helper ────────────────────────────────────────────────
    // Retrieves and consumes the pending code stored by the callback page.
    const fetchAndProcessBridgeCode = async (): Promise<boolean> => {
      const savedState = localStorage.getItem("line_oauth_state") || sessionStorage.getItem("line_oauth_state");

      if (!savedState?.startsWith("thetroob_")) return false;

      console.log("[DeepLink] 🔄 Checking Supabase bridge for state:", savedState);
      try {
        // Use `as any` because the generated types don't include the new
        // line_pending_auth table until the migration is applied to Supabase.
        const { data: rows, error: rowsError } = await (supabase as any)
          .from("line_pending_auth")
          .select("code")
          .eq("state", savedState)
          .limit(1);

        if (rowsError) {
          console.warn("[DeepLink] ⚠️ Bridge query error:", rowsError.message);
          return false;
        }

        const bridgeCode = (rows as Array<{ code: string }> | null)?.[0]?.code;
        if (!bridgeCode) {
          console.log("[DeepLink] 🔍 Bridge: no pending code found");
          return false;
        }

        console.log("[DeepLink] ✅ Bridge code retrieved, processing...");
        // Delete the bridge record (non-blocking cleanup)
        (supabase as any)
          .from("line_pending_auth")
          .delete()
          .eq("state", savedState)
          .then(
            () => console.log("[DeepLink] 🗑️ Bridge record deleted"),
            (e: unknown) => console.warn("[DeepLink] ⚠️ Bridge delete warning:", e),
          );

        await processLineCode(bridgeCode);
        return true;
      } catch (err) {
        console.warn("[DeepLink] ⚠️ Bridge retrieval error:", err);
        return false;
      }
    };
    // ─────────────────────────────────────────────────────────────────────────

    const handleDeepLink = async (event: URLOpenListenerEvent, source = "appUrlOpen") => {
      console.log("[DeepLink] 📱 Received deep link:", event.url, "| source:", source);
      persistDeepLinkDebug(event.url, source);
      lastHandledUrl = event.url;

      try {
        const url = new URL(event.url);
        const path = normalizeDeepLinkPath(url);

        console.log("[DeepLink] Path:", path);
        console.log("[DeepLink] Host:", url.host);
        console.log("[DeepLink] Pathname:", url.pathname);
        console.log("[DeepLink] Search params:", url.search);

        // Close the in-app browser if it's open, but don't block deep-link processing on it.
        Browser.close()
          .then(() => {
            console.log("[DeepLink] 📱 In-app browser closed");
          })
          .catch((e) => {
            console.log("[DeepLink] Browser.close not needed or failed:", e);
          });

        // Handle LINE callback with code/state (from LINE app redirect)
        // thetroob://line-callback?code=xxx&state=yyy
        if (path === "line-callback" || path.startsWith("line-callback/payload/")) {
          console.log("[DeepLink] 🔐 LINE callback detected");
          const { params, code, state, source: callbackParamSource } = extractLineCallbackParams(url, path);
          setDebugValue("line_last_callback_url", event.url);
          setDebugValue("line_last_callback_params", JSON.stringify(params));

          console.log("[DeepLink] LINE callback params:", {
            hasCode: !!code,
            state,
            source: callbackParamSource,
          });

          if (code) {
            await processLineCode(code);
            return;
          }

          // No code in URL/payload — the Android Chrome Custom Tab likely
          // stripped the deep-link path.  Try the Supabase bridge that the
          // callback page wrote to before firing this signal.
          console.log("[DeepLink] ⚠️ No code in URL, trying Supabase bridge...");
          const bridgeHandled = await fetchAndProcessBridgeCode();
          if (bridgeHandled) return;

          setDebugValue(
            "line_last_deep_link_error",
            "LINE callback reached app without code/state. Callback page is likely stale or query params were stripped before app launch.",
          );
        }

        // Handle Apple auth callback (from Safari redirect with tokens)
        // thetroob://apple-auth-callback?access_token=xxx&refresh_token=xxx
        if (path === "apple-auth-callback") {
          // Guard against re-processing on every appStateChange / launch URL replay.
          // iOS keeps returning the same callback URL until the app process is killed,
          // and tokens are single-use → replays fail and force-navigate away.
          if (sessionStorage.getItem(APPLE_HANDLED_KEY) === "1") {
            console.log("[DeepLink] 🍎 Apple auth callback already handled — skipping replay");
            try { await Browser.close(); } catch { /* ignore */ }
            return;
          }
          console.log("[DeepLink] 🍎 Apple auth callback detected");
          const code = url.searchParams.get("code");
          const accessToken = url.searchParams.get("access_token");
          const refreshToken = url.searchParams.get("refresh_token");


          if (code) {
            try {
              console.log("[DeepLink] 📡 Exchanging Apple auth code for session...");
              const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

              if (exchangeError) {
                console.error("[DeepLink] ❌ Code exchange error:", exchangeError);
                toast({
                  variant: "destructive",
                  title: "เกิดข้อผิดพลาด",
                  description: "ไม่สามารถยืนยันตัวตน Apple ได้: " + exchangeError.message,
                });
                if (await shouldRedirectToSignInOnError()) navigate("/", { replace: true });
                return;
              }

              const user = exchangeData?.user;
              if (!user) {
                toast({
                  variant: "destructive",
                  title: "เกิดข้อผิดพลาด",
                  description: "ไม่พบข้อมูลผู้ใช้จาก Apple",
                });
                if (await shouldRedirectToSignInOnError()) navigate("/", { replace: true });
                return;
              }

              const appleDriver = {
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email || "Apple User",
                avatar_url: user.user_metadata?.avatar_url || null,
                loginType: "apple",
                email: user.email,
              };

              // Auto-register in DB + external TMS (non-blocking)
              autoRegisterOAuthUser({
                authProvider: "apple",
                authUserId: user.id,
                firstName: user.user_metadata?.full_name?.split(" ")[0],
                lastName: user.user_metadata?.full_name?.split(" ").slice(1).join(" "),
              });

              await Promise.all([
                setAuthItem("auth_driver", JSON.stringify(appleDriver)),
                setAuthItem("auth_driver_id", user.id),
                setAuthItem("auth_login_type", "apple"),
                setAuthItem("auth_user_type", "freelance_driver"),
                setAuthItem("user_role", "freelance"),
              ]);

              try { sessionStorage.setItem(APPLE_HANDLED_KEY, "1"); } catch { /* ignore */ }
              window.dispatchEvent(new Event("auth_driver_updated"));
              toast({
                title: "เข้าสู่ระบบสำเร็จ",
                description: `ยินดีต้อนรับ ${appleDriver.full_name}`,
              });
              if (shouldRedirectToHomeAfterAuth()) navigate("/home", { replace: true });
              return;
            } catch (err) {
              console.error("[DeepLink] ❌ Apple code flow error:", err);
              toast({
                variant: "destructive",
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเข้าสู่ระบบ Apple ได้",
              });
              if (await shouldRedirectToSignInOnError()) navigate("/", { replace: true });
              return;
            }
          }

          if (accessToken) {
            try {
              // Close the browser FIRST to return to the app
              try {
                await Browser.close();
                console.log("[DeepLink] 📱 Browser closed after Apple auth");
              } catch (e) {
                console.log("[DeepLink] Browser close skipped:", e);
              }

              let user = null;

              if (refreshToken) {
                console.log("[DeepLink] 📡 Setting Supabase session...");
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

                if (sessionError) {
                  console.error("[DeepLink] ❌ Session error:", sessionError);
                  toast({
                    variant: "destructive",
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่สามารถเข้าสู่ระบบ Apple ได้: " + sessionError.message,
                  });
                  navigate("/", { replace: true });
                  return;
                }

                user = sessionData?.user ?? null;
              } else {
                // Some providers/flows may return only access_token without refresh_token.
                // In that case, fetch profile from access token and proceed with app-level auth.
                console.log("[DeepLink] ℹ️ Missing refresh token, resolving user from access token");
                const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

                if (userError || !userData?.user) {
                  console.error("[DeepLink] ❌ getUser error:", userError);
                  toast({
                    variant: "destructive",
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่สามารถยืนยันตัวตน Apple ได้",
                  });
                  navigate("/", { replace: true });
                  return;
                }

                user = userData.user;
              }

              if (!user?.id) {
                toast({
                  variant: "destructive",
                  title: "เกิดข้อผิดพลาด",
                  description: "ไม่พบข้อมูลผู้ใช้จาก Apple",
                });
                navigate("/", { replace: true });
                return;
              }

              console.log("[DeepLink] ✅ Apple auth success, user:", user?.email);

              // Store auth data
              const appleDriver = {
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email || "Apple User",
                avatar_url: user.user_metadata?.avatar_url || null,
                loginType: "apple",
                email: user.email,
              };

              // Auto-register in DB + external TMS (non-blocking)
              autoRegisterOAuthUser({
                authProvider: "apple",
                authUserId: user.id,
                firstName: user.user_metadata?.full_name?.split(" ")[0],
                lastName: user.user_metadata?.full_name?.split(" ").slice(1).join(" "),
              });

              await Promise.all([
                setAuthItem("auth_driver", JSON.stringify(appleDriver)),
                setAuthItem("auth_driver_id", user.id),
                setAuthItem("auth_login_type", "apple"),
                setAuthItem("auth_user_type", "freelance_driver"),
                setAuthItem("user_role", "freelance"),
              ]);

              // Dispatch auth event
              window.dispatchEvent(new Event("auth_driver_updated"));

              toast({
                title: "เข้าสู่ระบบสำเร็จ",
                description: `ยินดีต้อนรับ ${appleDriver.full_name}`,
              });

              navigate("/home", { replace: true });
              return;
            } catch (err) {
              console.error("[DeepLink] ❌ Apple auth error:", err);
              toast({
                variant: "destructive",
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเข้าสู่ระบบ Apple ได้",
              });
              navigate("/", { replace: true });
              return;
            }
          } else {
            console.error("[DeepLink] ❌ Missing tokens in Apple callback");
            toast({
              variant: "destructive",
              title: "เกิดข้อผิดพลาด",
              description: "ไม่ได้รับ code หรือ token จาก Apple",
            });
            navigate("/", { replace: true });
            return;
          }
        }

        // Handle LINE auth success callback (from Safari redirect with encoded data)
        if (path === "line-auth-success") {
          const encodedData = url.searchParams.get("data");

          if (encodedData) {
            console.log("[DeepLink] 🔐 Processing LINE auth data (encoded)");

            // Decode and parse user data
            const userData: LineUserData = JSON.parse(atob(decodeURIComponent(encodedData)));
            console.log("[DeepLink] ✅ User data decoded:", userData.displayName);

            // Store LINE user data
            await setAuthItem("line_user", JSON.stringify(userData));
            await setAuthItem("auth_login_type", "line");

            // Create driver record
            const lineDriver = {
              id: userData.lineUserId,
              full_name: userData.displayName,
              avatar_url: userData.pictureUrl || null,
              loginType: "line",
              lineUser: userData,
            };
            console.log("[DeepLink] ✅ Auth data saved");

            await persistDriverSession(lineDriver, "line");

            toast({
              title: "เข้าสู่ระบบสำเร็จ",
              description: `ยินดีต้อนรับ ${userData.displayName}`,
            });

            navigate("/home", { replace: true });
            return;
          }
        }

        // Handle other deep links (notifications, etc.)
        // Example: thetroob://job/123 -> navigate to /job/123
        if (path.startsWith("job/")) {
          const jobId = path.replace("job/", "");
          navigate(`/job/${encodeURIComponent(jobId)}`, { replace: true });
          return;
        }

        if (path.startsWith("notifications/")) {
          const notificationId = path.replace("notifications/", "");
          navigate(`/notifications/${notificationId}`, { replace: true });
          return;
        }

        // Default: navigate to home
        console.log("[DeepLink] No specific handler, navigating to home");
      } catch (error) {
        setDebugValue("line_last_deep_link_error", error instanceof Error ? error.message : "Unknown deep link error");
        console.error("[DeepLink] ❌ Error handling deep link:", error);
        toast({
          variant: "destructive",
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถประมวลผลลิงก์ได้",
        });
      }
    };

    const handleUrlOnce = async (url: string, source: string) => {
      if (!url) return;
      if (lastHandledUrl === url) {
        console.log("[DeepLink] Skipping duplicate URL:", url, "| source:", source);
        return;
      }

      await handleDeepLink({ url }, source);
    };

    const checkLaunchUrl = async (source: string) => {
      try {
        const result = await App.getLaunchUrl();
        if (result?.url) {
          console.log("[DeepLink] 🚀 Launch URL found:", result.url, "| source:", source);
          await handleUrlOnce(result.url, source);
        } else {
          console.log("[DeepLink] No launch URL available | source:", source);
        }
      } catch {
        // Not running in Capacitor
      }
    };

    const urlOpenListener = App.addListener("appUrlOpen", (event) => {
      void handleDeepLink(event, "appUrlOpen");
    });

    const appStateListener = App.addListener("appStateChange", (state) => {
      console.log("[DeepLink] App state changed:", state.isActive);
      if (state.isActive) {
        window.setTimeout(() => {
          void checkLaunchUrl("appStateChange");
        }, 250);
      }
    });

    // Fallback: when the in-app browser closes, try the Supabase bridge in case
    // appUrlOpen never fired (or fired without a code because the Android Chrome
    // Custom Tab stripped the deep-link path).
    const browserFinishedListener = Browser.addListener("browserFinished", async () => {
      console.log("[DeepLink] 🌐 browserFinished — checking Supabase bridge...");
      // Give the callback page a moment to write to Supabase before we query.
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      await fetchAndProcessBridgeCode();
    });

    void checkLaunchUrl("initial-launch");

    return () => {
      urlOpenListener.then((l) => l.remove());
      appStateListener.then((l) => l.remove());
      browserFinishedListener.then((l) => l.remove());
    };
  }, [navigate, toast]);
};
