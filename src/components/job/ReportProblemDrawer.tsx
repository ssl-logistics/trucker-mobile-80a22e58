import { useState } from "react";
import { Camera, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
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
}

type ProblemType = "partial-delivery" | "pause-work" | "report-issue";

export default function ReportProblemDrawer({
  open,
  onOpenChange,
  jobId,
}: ReportProblemDrawerProps) {
  const { t } = useLanguage();
  const [selectedType, setSelectedType] = useState<ProblemType | "">("");
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const handleSubmit = () => {
    if (!selectedType || !reason) {
      alert(t('reportProblem.fillAllFields'));
      return;
    }

    // TODO: Submit to backend
    console.log({ selectedType, reason, photo, jobId });
    
    // Reset and close
    setSelectedType("");
    setReason("");
    setPhoto(null);
    onOpenChange(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-semibold">{t('reportProblem.title')}</DrawerTitle>
            <DrawerClose className="text-2xl text-gray-500">×</DrawerClose>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-base font-medium mb-3">{t('reportProblem.problemAccident')}</h3>
            
            <RadioGroup value={selectedType} onValueChange={(value) => setSelectedType(value as ProblemType)}>
              {/* ส่งมอบสินค้าบางส่วน */}
              <div className="border rounded-lg p-4 mb-3">
                <div className="flex items-center space-x-3 mb-3">
                  <RadioGroupItem value="partial-delivery" id="partial-delivery" />
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
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm">
                        {t('reportProblem.uploadPhoto')} <span className="text-red-500">*</span>
                      </Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                          id="photo-upload"
                        />
                        <label htmlFor="photo-upload" className="cursor-pointer">
                          <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500" dangerouslySetInnerHTML={{ __html: `${t('reportProblem.clickToTake')}<br />${t('reportProblem.productPhoto')}` }} />
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
                  <RadioGroupItem value="pause-work" id="pause-work" />
                  <Label htmlFor="pause-work" className="text-base font-normal cursor-pointer">
                    {t('reportProblem.pauseWork')}
                  </Label>
                </div>
                
                {selectedType === "pause-work" && (
                  <div className="ml-7">
                    <Label className="text-sm">
                      {t('reportProblem.specifyReason')} <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder={t('reportProblem.reasonPlaceholder')}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-1 min-h-[120px]"
                    />
                  </div>
                )}
              </div>

              {/* แจ้งปัญหา */}
              <div className="border rounded-lg p-4 mb-3">
                <div className="flex items-center space-x-3 mb-3">
                  <RadioGroupItem value="report-issue" id="report-issue" />
                  <Label htmlFor="report-issue" className="text-base font-normal cursor-pointer">
                    {t('reportProblem.reportIssue')}
                  </Label>
                </div>
                
                {selectedType === "report-issue" && (
                  <div className="ml-7">
                    <Label className="text-sm">
                      {t('reportProblem.specifyReason')} <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder={t('reportProblem.reasonPlaceholder')}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-1 min-h-[120px]"
                    />
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          <Button
            variant="outline"
            className="w-full border-2 border-primary text-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('reportProblem.downloadVehicleChange')}
          </Button>
        </div>

        <div className="p-4 border-t">
          <Button
            className="w-full bg-primary text-white"
            onClick={handleSubmit}
          >
            {t('reportProblem.confirm')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
