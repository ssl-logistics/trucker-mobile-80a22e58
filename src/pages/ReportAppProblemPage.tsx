import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ArrowLeft, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type AppProblemType = "crash" | "slow" | "display" | "feature" | "other";

export default function ReportAppProblemPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<AppProblemType | "">("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const problemTypes: { value: AppProblemType; label: string }[] = [
    { value: "crash", label: t("appProblem.typeCrash") },
    { value: "slow", label: t("appProblem.typeSlow") },
    { value: "display", label: t("appProblem.typeDisplay") },
    { value: "feature", label: t("appProblem.typeFeature") },
    { value: "other", label: t("appProblem.typeOther") },
  ];

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const totalFiles = [...photos, ...newFiles].slice(0, 6); // max 6
      setPhotos(totalFiles);

      // Generate previews for new files
      newFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreviews((prev) => [...prev, reader.result as string].slice(0, 6));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedType || !description.trim()) {
      toast({
        title: t("appProblem.error"),
        description: t("appProblem.fillRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload screenshots if provided
      const photoUrls: string[] = [];
      for (const file of photos) {
        const fileExt = file.name.split(".").pop();
        const fileName = `app-problem-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `app-problems/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("expense-receipts")
          .upload(filePath, file);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("expense-receipts")
            .getPublicUrl(filePath);
          photoUrls.push(publicUrl);
        }
      }

      // Get device info
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      };

      // Send report via edge function
      const { error } = await supabase.functions.invoke("report-app-problem", {
        body: {
          user_id: user?.id,
          problem_type: selectedType,
          description: description.trim(),
          screenshot_urls: photoUrls.length > 0 ? photoUrls : null,
          device_info: deviceInfo,
        },
      });

      if (error) throw error;

      toast({
        title: t("appProblem.success"),
        description: t("appProblem.successDesc"),
      });

      navigate(-1);
    } catch (error) {
      console.error("Error submitting app problem:", error);
      toast({
        title: t("appProblem.error"),
        description: t("appProblem.submitFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center px-4 py-3">
          <button onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t("appProblem.title")}</h1>
        </div>
      </header>

      <div className="p-4 space-y-5">
        {/* Problem Type */}
        <div>
          <h3 className="text-base font-medium mb-3">{t("appProblem.selectType")}</h3>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as AppProblemType)} disabled={isSubmitting}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("appProblem.selectType")} />
            </SelectTrigger>
            <SelectContent>
              {problemTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div>
          <Label className="text-base font-medium">
            {t("appProblem.descriptionLabel")} <span className="text-red-500">*</span>
          </Label>
          <Textarea
            placeholder={t("appProblem.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 min-h-[120px]"
            disabled={isSubmitting}
          />
        </div>

        {/* Screenshot */}
        <div>
          <Label className="text-base font-medium">
            {t("appProblem.screenshot")} ({t("appProblem.optional")})
          </Label>
          <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
            <input
              type="file"
              accept={ACCEPT_IMAGE_DOC}
              multiple
              onChange={handlePhotoChange}
              className="hidden"
              id="app-problem-photo"
              disabled={isSubmitting || photos.length >= 6}
            />
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img src={preview} alt={`Screenshot ${index + 1}`} className="h-24 w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                      disabled={isSubmitting}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 6 && (
              <label htmlFor="app-problem-photo" className="cursor-pointer block">
                <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("appProblem.clickToUpload")}</p>
              </label>
            )}
            {photos.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {photos.length}/6
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? t("appProblem.submitting") : t("appProblem.submit")}
        </Button>
      </div>
    </div>
  );
}
