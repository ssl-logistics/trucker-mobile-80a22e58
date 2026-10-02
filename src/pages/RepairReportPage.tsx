import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, X, Wrench, Loader2, Video } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getDriverTypeFromUserType } from "@/utils/driverTypeMapping";
import { fetchDriverProfileData } from "@/lib/driverProfileData";
import { resolvePlateFromUser } from "@/lib/vehicleSources";
import { ACCEPT_IMAGE_DOC } from "@/utils/uploadAccept";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const pickMessage = (body: any): string | null => {
  const raw = body?.error ?? body?.message ?? body?.msg ?? body?.detail ?? body?.data?.error ?? body?.data?.message;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object") {
    const nested = raw.message ?? raw.error;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
};

// Pull the real failure reason out of the edge function response when available
const extractErrorReason = async (err: any): Promise<string | null> => {
  const sources = [err?.context?.response, err?.context, err?.error];
  for (const src of sources) {
    if (!src) continue;
    if (typeof src === "string") {
      if (src.trim() && !/^error$/i.test(src.trim())) return src.trim();
      continue;
    }
    if (typeof src.json === "function") {
      try {
        const body = await src.json();
        const msg = pickMessage(body);
        if (msg) return msg;
      } catch {
        /* body is not json */
      }
      continue;
    }
    const msg = pickMessage(src);
    if (msg) return msg;
  }
  const fallback = typeof err?.message === "string" ? err.message.trim() : "";
  if (fallback && !/^error$/i.test(fallback)) return fallback;
  return null;
};

interface AttachedMedia {
  file: File;
  previewUrl?: string;
  isVideo: boolean;
}

export default function RepairReportPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, userType } = useAuth();
  const { toast } = useToast();

  // Prefill license plate (same sources as Vehicle Info page, then stored driver, then cached truck plate)
  const prefillPlate = () => {
    const fromUser = resolvePlateFromUser(user);
    if (fromUser) return fromUser;
    try {
      const stored = JSON.parse(localStorage.getItem("auth_driver") || "null");
      const fromStored = resolvePlateFromUser(stored);
      if (fromStored) return fromStored;
    } catch { /* ignore */ }
    return localStorage.getItem("auth_truck_plate") || "";
  };

  const [licensePlate, setLicensePlate] = useState(prefillPlate);
  useEffect(() => {
    const p = prefillPlate();
    if (p) setLicensePlate((prev) => (prev.trim() ? prev : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const [plateLoading, setPlateLoading] = useState(true);
  const showPlateInput = !plateLoading && !licensePlate.trim();
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<AttachedMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Capture GPS once on page open (optional — pass silently if denied)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  const resolveUserId = (): string | null => {
    if (user?.id) return user.id;
    const storedId = localStorage.getItem("auth_driver_id");
    if (storedId) return storedId;
    try {
      const stored = JSON.parse(localStorage.getItem("auth_driver") || "{}");
      return stored?.id || stored?.driver_id || null;
    } catch {
      return null;
    }
  };

  // Fetch the plate from the driver vehicle profile (same source as the Vehicle Info page)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDriverProfileData(resolveUserId());
        const vehicle = data?.vehicle;
        if (!cancelled && vehicle?.plate_number) {
          const plate = [vehicle.plate_number, vehicle.plate_province].filter(Boolean).join(" ");
          setLicensePlate((prev) => (prev.trim() ? prev : plate));
        }
      } finally {
        if (!cancelled) setPlateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const driverName = user
    ? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.full_name || user.name || "")
    : "";

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const incoming = Array.from(e.target.files);
    const remaining = MAX_FILES - media.length;
    const accepted: AttachedMedia[] = [];

    for (const file of incoming.slice(0, remaining)) {
      if (file.size > MAX_FILE_BYTES) {
        toast({
          title: t("repairReport.tooLargeTitle"),
          description: `${file.name}: ${t("repairReport.tooLarge")}`,
          variant: "destructive",
        });
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const previewUrl = isVideo ? undefined : URL.createObjectURL(file);
      if (previewUrl) objectUrlsRef.current.push(previewUrl);
      accepted.push({ file, previewUrl, isVideo });
    }

    if (accepted.length > 0) {
      setMedia((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
    }
    // allow re-selecting the same file later
    e.target.value = "";
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

  const resetForm = () => {
    objectUrlsRef.current.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    objectUrlsRef.current = [];
    setMedia([]);
    setNote("");
  };

  const handleSubmit = async () => {
    const plate = licensePlate.trim();
    const noteText = note.trim();
    const driverId = resolveUserId();

    if (!noteText) {
      toast({ title: t("repairReport.error"), description: t("repairReport.noteRequired"), variant: "destructive" });
      return;
    }
    if (!plate) {
      toast({ title: t("repairReport.error"), description: t("repairReport.plateMissing"), variant: "destructive" });
      return;
    }
    if (!driverId) {
      toast({ title: t("repairReport.error"), description: t("repairReport.submitFailed"), variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const photosBase64: { data: string; content_type: string; file_name: string }[] = [];
      for (const m of media) {
        const data = await readAsDataUrl(m.file);
        photosBase64.push({ data, content_type: m.file.type || "application/octet-stream", file_name: m.file.name });
      }

      const { error } = await supabase.functions.invoke("report-vehicle-maintenance", {
        body: {
          license_plate: plate,
          driver_id: driverId,
          driver_type: getDriverTypeFromUserType(userType ?? ""),
          driver_name: driverName || null,
          note: noteText || null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          photos_base64: photosBase64.length > 0 ? photosBase64 : null,
        },
      });

      if (error) throw error;

      toast({
        title: t("repairReport.success"),
        description: t("repairReport.successDesc"),
      });
      resetForm();
    } catch (error: any) {
      console.error("Error submitting repair report:", error);
      const reason = await extractErrorReason(error);
      toast({
        title: t("repairReport.error"),
        description: reason || t("repairReport.submitFailed"),
        variant: "destructive",
      });
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="bg-header text-header-foreground" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center px-4 py-3">
          <button onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t("repairReport.title")}</h1>
        </div>
      </header>

      <div className="p-4 space-y-5">
        {/* License plate — only shown when it cannot be prefilled from the profile */}
        {showPlateInput && (
          <div>
            <Label className="text-base font-medium">
              {t("repairReport.plateLabel")} <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder={t("repairReport.platePlaceholder")}
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              className="mt-2"
              disabled={isSubmitting}
              maxLength={50}
            />
          </div>
        )}

        {/* Note */}
        <div>
          <Label className="text-base font-medium">
            {t("repairReport.noteLabel")} <span className="text-red-500">*</span>
          </Label>
          <Textarea
            placeholder={t("repairReport.notePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 min-h-[120px]"
            disabled={isSubmitting}
            maxLength={2000}
          />
        </div>

        {/* Photos / videos */}
        <div>
          <Label className="text-base font-medium">
            {t("repairReport.mediaLabel")} ({t("appProblem.optional")})
          </Label>
          <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
            <input
              type="file"
              accept={`${ACCEPT_IMAGE_DOC},video/*`}
              multiple
              onChange={handleMediaChange}
              className="hidden"
              id="repair-report-media"
              disabled={isSubmitting || media.length >= MAX_FILES}
            />
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {media.map((m, index) => (
                  <div key={index} className="relative">
                    {m.previewUrl ? (
                      <img src={m.previewUrl} alt={`media-${index + 1}`} className="h-24 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="h-24 w-full rounded-lg bg-muted flex flex-col items-center justify-center gap-1 px-1">
                        <Video className="w-6 h-6 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">{m.file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                      disabled={isSubmitting}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {media.length < MAX_FILES && (
              <label htmlFor="repair-report-media" className="cursor-pointer block">
                <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("repairReport.clickToUpload")}</p>
              </label>
            )}
            {media.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {media.length}/{MAX_FILES} · {t("repairReport.maxFile")}
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("appProblem.submitting")}
            </>
          ) : (
            <>
              <Wrench className="mr-2 h-4 w-4" />
              {t("repairReport.submit")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
