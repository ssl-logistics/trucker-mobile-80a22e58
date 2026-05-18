import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Camera, X, Loader2, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { supabase } from "@/integrations/supabase/client";
import { submitAccidentEvidence } from "@/lib/externalApi";
import {
import { compressImage } from '@/utils/imageCompression';
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface AccidentEvidenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
  orderNumber?: string;
  onSuccess: () => void;
}

const MAX_PHOTOS = 6;

export default function AccidentEvidenceModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: AccidentEvidenceModalProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setPreviews([]);
      setNotes("");
      setIsSubmitting(false);
      setShowSourceDrawer(false);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Could not get location:", err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [open]);

  const addPhoto = useCallback((file: File) => {
    setPhotos((prev) => {
      if (prev.length >= MAX_PHOTOS) return prev;
      return [...prev, file];
    });
    const url = URL.createObjectURL(file);
    setPreviews((prev) => {
      if (prev.length >= MAX_PHOTOS) return prev;
      return [...prev, url];
    });
  }, []);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSourceSelect = async (source: "camera" | "gallery") => {
    setShowSourceDrawer(false);
    try {
      let file: File | null = null;
      if (isNative) {
        file = source === "camera" ? await takePhoto() : await selectFromGallery();
      } else {
        // Web: trigger hidden input
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        if (source === "camera") input.capture = "environment";
        const result = await new Promise<File | null>((resolve) => {
          input.onchange = (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            resolve(f ?? null);
          };
          input.click();
        });
        file = result;
      }
      if (file) addPhoto(file);
    } catch (err) {
      console.error("Photo selection error:", err);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const folder = `accident-evidence/${orderNumber || orderId || "unknown"}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const { data, error } = await supabase.functions.invoke("upload-to-s3", {
        body: formData,
      });

      if (error) {
        console.error("S3 upload error:", error);
        return null;
      }
      if (!data?.url) {
        console.error("S3 upload returned no url:", data);
        return null;
      }
      return data.url as string;
    } catch (err) {
      console.error("Upload exception:", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      toast({
        title: t("accidentEvidence.error"),
        description: t("accidentEvidence.photoRequired"),
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);

    try {
      // Upload all photos in parallel
      const urls = await Promise.all(photos.map((p) => uploadPhoto(p)));
      const validUrls = urls.filter((u): u is string => !!u);

      if (validUrls.length === 0) {
        toast({
          title: t("accidentEvidence.error"),
          description: t("accidentEvidence.uploadFailed"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await submitAccidentEvidence({
        order_id: orderId,
        order_number: orderNumber,
        photo_urls: validUrls,
        notes: notes.trim() || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      if (error || !data?.success) {
        const code = data?.code;
        if (code === "EVIDENCE_NOT_REQUIRED") {
          // Already unlocked — treat as success
          toast({
            title: t("accidentEvidence.alreadyUnlocked"),
          });
          onSuccess();
          onOpenChange(false);
          return;
        }
        toast({
          title: t("accidentEvidence.error"),
          description: data?.message || error || t("accidentEvidence.submitFailed"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      toast({
        title: t("accidentEvidence.success"),
        description: t("accidentEvidence.unlockedDescription"),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Submit accident evidence error:", err);
      toast({
        title: t("accidentEvidence.error"),
        description: t("accidentEvidence.submitFailed"),
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base">{t("accidentEvidence.title")}</DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  {t("accidentEvidence.subtitle")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive">
              {t("accidentEvidence.lockNotice")}
            </div>

            {/* Photo grid */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("accidentEvidence.photosLabel")}{" "}
                <span className="text-muted-foreground">
                  ({photos.length}/{MAX_PHOTOS})
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
                    <img src={src} alt={`evidence-${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
                      aria-label="remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => setShowSourceDrawer(true)}
                    disabled={isSubmitting}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px]">{t("accidentEvidence.addPhoto")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("accidentEvidence.notesLabel")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("accidentEvidence.notesPlaceholder")}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || photos.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("accidentEvidence.submitting")}
                </>
              ) : (
                t("accidentEvidence.submit")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo source picker */}
      <Drawer open={showSourceDrawer} onOpenChange={setShowSourceDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t("sop.selectSource")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-3">
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handleSourceSelect("camera")}
            >
              <Camera className="w-5 h-5" />
              {t("sop.takePhoto")}
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handleSourceSelect("gallery")}
            >
              <ImageIcon className="w-5 h-5" />
              {t("sop.selectFromGallery")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
