import { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAuthItem } from "@/utils/authStorage";
import { reportProblem } from "@/lib/externalApi";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ReportProblemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  orderNumber?: string;
}

type ProblemType = "partial-delivery" | "pause-work" | "report-issue";

export default function ReportProblemDrawer({
  open,
  onOpenChange,
  jobId,
  orderNumber,
}: ReportProblemDrawerProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ProblemType | "">("");
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get current location when drawer opens
  useEffect(() => {
    if (open && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, [open]);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `problem-${Date.now()}.${fileExt}`;
      const filePath = `problem-reports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('expense-receipts')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !reason) {
      toast({
        title: t('reportProblem.error'),
        description: t('reportProblem.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    // For partial-delivery, photo is required
    if (selectedType === 'partial-delivery' && !photo) {
      toast({
        title: t('reportProblem.error'),
        description: t('reportProblem.photoRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!orderNumber) {
      toast({
        title: t('reportProblem.error'),
        description: 'Order number is missing',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get driver info from storage
      const driverId = user?.id || await getAuthItem('auth_driver_id');
      const userType = await getAuthItem('auth_user_type');
      
      // Map user type to driver type
      let driverType = 'freelance';
      if (userType === 'internal_driver') {
        driverType = 'internal';
      } else if (userType === 'external_driver') {
        driverType = 'external';
      }

      // Upload photo if exists
      let photoUrl: string | null = null;
      if (photo) {
        photoUrl = await uploadPhoto(photo);
        if (!photoUrl) {
          toast({
            title: t('reportProblem.error'),
            description: t('reportProblem.uploadFailed'),
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare request body
      const requestBody: Record<string, any> = {
        order_number: orderNumber,
        driver_id: driverId,
        driver_type: driverType,
        problem_type: selectedType,
        reason: reason,
        reported_at: new Date().toISOString(),
      };

      if (photoUrl) {
        requestBody.photo_url = photoUrl;
      }

      if (location) {
        requestBody.latitude = location.latitude;
        requestBody.longitude = location.longitude;
      }

      console.log('Submitting problem report:', requestBody);

      // Call external API directly
      const { data, error } = await reportProblem({
        order_number: orderNumber!,
        driver_id: driverId,
        driver_type: driverType as 'internal' | 'external' | 'freelance',
        problem_type: selectedType,
        reason: reason,
        photo_url: photoUrl,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      console.log('API response:', data, error);

      if (error || (data && (data as any).success === false)) {
        throw new Error(error || (data as any)?.error || 'Failed to submit report');
      }

      toast({
        title: t('reportProblem.success'),
        description: t('reportProblem.submitSuccess'),
      });

      // Reset form and close
      setSelectedType("");
      setReason("");
      setPhoto(null);
      setPhotoPreview(null);
      onOpenChange(false);

    } catch (error) {
      console.error('Error submitting problem report:', error);
      toast({
        title: t('reportProblem.error'),
        description: error instanceof Error ? error.message : t('reportProblem.submitFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedType("");
      setReason("");
      setPhoto(null);
      setPhotoPreview(null);
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-semibold">{t('reportProblem.title')}</DrawerTitle>
            <DrawerClose className="text-2xl text-gray-500" disabled={isSubmitting}>×</DrawerClose>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-base font-medium mb-3">{t('reportProblem.problemAccident')}</h3>
            
            <RadioGroup value={selectedType} onValueChange={(value) => setSelectedType(value as ProblemType)}>
              {/* ส่งมอบสินค้าบางส่วน */}
              <div className="border rounded-lg p-4 mb-3">
                <div className="flex items-center space-x-3 mb-3">
                  <RadioGroupItem value="partial-delivery" id="partial-delivery" disabled={isSubmitting} />
                  <Label htmlFor="partial-delivery" className="text-base font-normal cursor-pointer">
                    {t('reportProblem.partialDelivery')}
                  </Label>
                </div>
                
                {selectedType === "partial-delivery" && (
                  <div className="space-y-3 ml-7">
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.specifyTime')} <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        placeholder={t('reportProblem.reasonPlaceholder')}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 min-h-[80px]"
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.uploadPhoto')} <span className="text-red-500">*</span>
                      </Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept={ACCEPT_IMAGE_DOC}
                          capture="environment"
                          onChange={handlePhotoChange}
                          className="hidden"
                          id="photo-upload"
                          disabled={isSubmitting}
                        />
                        <label htmlFor="photo-upload" className="cursor-pointer block">
                          {photoPreview ? (
                            <img 
                              src={photoPreview} 
                              alt="Preview" 
                              className="max-h-40 mx-auto rounded-lg object-cover"
                            />
                          ) : (
                            <>
                              <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: `${t('reportProblem.clickToTake')}<br />${t('reportProblem.productPhoto')}` }} />
                            </>
                          )}
                        </label>
                        {photo && (
                          <p className="mt-2 text-xs text-green-600">
                            {t('reportProblem.fileSelected')}: {photo.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* หยุดงานชั่วคราว */}
              <div className="border rounded-lg p-4 mb-3">
                <div className="flex items-center space-x-3 mb-3">
                  <RadioGroupItem value="pause-work" id="pause-work" disabled={isSubmitting} />
                  <Label htmlFor="pause-work" className="text-base font-normal cursor-pointer">
                    {t('reportProblem.pauseWork')}
                  </Label>
                </div>
                
              {selectedType === "pause-work" && (
                  <div className="ml-7 space-y-3">
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.specifyReason')} <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        placeholder={t('reportProblem.reasonPlaceholder')}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 min-h-[100px]"
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.uploadPhoto')} ({t('reportProblem.optional')})
                      </Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept={ACCEPT_IMAGE_DOC}
                          capture="environment"
                          onChange={handlePhotoChange}
                          className="hidden"
                          id="photo-upload-pause"
                          disabled={isSubmitting}
                        />
                        <label htmlFor="photo-upload-pause" className="cursor-pointer block">
                          {photoPreview ? (
                            <img 
                              src={photoPreview} 
                              alt="Preview" 
                              className="max-h-40 mx-auto rounded-lg object-cover"
                            />
                          ) : (
                            <>
                              <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-500">{t('reportProblem.clickToTakeOptional')}</p>
                            </>
                          )}
                        </label>
                        {photo && (
                          <p className="mt-2 text-xs text-green-600">
                            {t('reportProblem.fileSelected')}: {photo.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* แจ้งปัญหา */}
              <div className="border rounded-lg p-4 mb-3">
                <div className="flex items-center space-x-3 mb-3">
                  <RadioGroupItem value="report-issue" id="report-issue" disabled={isSubmitting} />
                  <Label htmlFor="report-issue" className="text-base font-normal cursor-pointer">
                    {t('reportProblem.reportIssue')}
                  </Label>
                </div>
                
              {selectedType === "report-issue" && (
                  <div className="ml-7 space-y-3">
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.specifyReason')} <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        placeholder={t('reportProblem.reasonPlaceholder')}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1 min-h-[100px]"
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.uploadPhoto')} ({t('reportProblem.optional')})
                      </Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept={ACCEPT_IMAGE_DOC}
                          capture="environment"
                          onChange={handlePhotoChange}
                          className="hidden"
                          id="photo-upload-issue"
                          disabled={isSubmitting}
                        />
                        <label htmlFor="photo-upload-issue" className="cursor-pointer block">
                          {photoPreview ? (
                            <img 
                              src={photoPreview} 
                              alt="Preview" 
                              className="max-h-40 mx-auto rounded-lg object-cover"
                            />
                          ) : (
                            <>
                              <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-500">{t('reportProblem.clickToTakeOptional')}</p>
                            </>
                          )}
                        </label>
                        {photo && (
                          <p className="mt-2 text-xs text-green-600">
                            {t('reportProblem.fileSelected')}: {photo.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="p-4 border-t">
          <Button
            className="w-full bg-primary text-white"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('reportProblem.submitting') : t('reportProblem.confirm')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
