import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, X } from "lucide-react";
import { RegistrationData } from "@/pages/Register";

interface ReviewStepProps {
  data: RegistrationData;
  onBack: () => void;
  onSubmit: () => void;
  onEditStep: (step: number) => void;
}

const ReviewStep = ({ data, onBack, onSubmit, onEditStep }: ReviewStepProps) => {
  const { t } = useLanguage();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">{t('reviewStep.general')}</TabsTrigger>
          <TabsTrigger value="photos">{t('reviewStep.photos')}</TabsTrigger>
          <TabsTrigger value="vehicle">{t('reviewStep.vehicle')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">{t('reviewStep.general')}</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
              <Pencil className="w-4 h-4 mr-1" />
              {t('reviewStep.edit')}
            </Button>
          </div>

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {data.profilePhoto ? (
                <img src={URL.createObjectURL(data.profilePhoto)} alt="รูปโปรไฟล์" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">{t('reviewStep.personalInfo')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.firstName')}</span>
                  <span>{data.firstName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.lastName')}</span>
                  <span>{data.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.phone')}</span>
                  <span>{data.phone}</span>
                </div>
                {data.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('reviewStep.email')}</span>
                    <span>{data.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">{t('reviewStep.userInfo')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.username')}</span>
                  <span>{data.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.password')}</span>
                  <span>••••••••</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">{t('reviewStep.workArea')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.workAreaDesc')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.location && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs">
                      {data.location}
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reviewStep.priceRange')}</span>
                  <span>{data.priceRangeMin} - {data.priceRangeMax}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">{t('reviewStep.uploadPhotos')}</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
              <Pencil className="w-4 h-4 mr-1" />
              {t('reviewStep.edit')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('reviewStep.frontPhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.frontPhoto ? (
                  <img src={URL.createObjectURL(data.frontPhoto)} alt={t('reviewStep.frontPhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('reviewStep.sidePhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.sidePhoto ? (
                  <img src={URL.createObjectURL(data.sidePhoto)} alt={t('reviewStep.sidePhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('reviewStep.backPhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.backPhoto ? (
                  <img src={URL.createObjectURL(data.backPhoto)} alt={t('reviewStep.backPhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('reviewStep.platePhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.platePhoto ? (
                  <img src={URL.createObjectURL(data.platePhoto)} alt={t('reviewStep.platePhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
          </div>

          {data.hasTrailer && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('reviewStep.trailerPlatePhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.trailerPlatePhoto ? (
                  <img src={URL.createObjectURL(data.trailerPlatePhoto)} alt={t('reviewStep.trailerPlatePhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vehicle" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">{t('reviewStep.vehicleInfo')}</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
              <Pencil className="w-4 h-4 mr-1" />
              {t('reviewStep.edit')}
            </Button>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.plateNumber')}</span>
              <span>{data.plateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.plateProvince')}</span>
              <span>{data.plateProvince}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.vehicleBrand')}</span>
              <span>{data.vehicleBrand}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.vehicleColor')}</span>
              <span>{data.vehicleColor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.vin')}</span>
              <span>{data.vin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.vehicleType')}</span>
              <span>{data.vehicleType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.fuelType')}</span>
              <span>{data.fuelType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.loadCapacity')}</span>
              <span>{data.loadCapacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.dimensions')}</span>
              <span>{data.dimensions.width} x {data.dimensions.length} x {data.dimensions.height}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.containerTypes')}</span>
              <span>{data.containerTypes.join(", ")}</span>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('reviewStep.registrationDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.registrationPhoto ? (
                  <img src={URL.createObjectURL(data.registrationPhoto)} alt={t('reviewStep.registrationDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('reviewStep.noPhoto')}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reviewStep.insuranceValue')}</span>
              <span>{data.insuranceValue} {t('reviewStep.baht')}</span>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('reviewStep.insuranceDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.insurancePhoto ? (
                  <img src={URL.createObjectURL(data.insurancePhoto)} alt={t('reviewStep.insuranceDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('reviewStep.noPhoto')}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('reviewStep.license')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.licensePhoto ? (
                  <img src={URL.createObjectURL(data.licensePhoto)} alt={t('reviewStep.license')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('reviewStep.noPhoto')}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('reviewStep.idCard')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.idCardPhoto ? (
                  <img src={URL.createObjectURL(data.idCardPhoto)} alt={t('reviewStep.idCard')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('reviewStep.noPhoto')}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('reviewStep.compulsoryInsurance')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.compulsoryInsurancePhoto ? (
                  <img src={URL.createObjectURL(data.compulsoryInsurancePhoto)} alt={t('reviewStep.compulsoryInsurance')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('reviewStep.noPhoto')}</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCancelDialog(true)}
          className="flex-1 rounded-xl h-12 text-base font-medium border-2"
        >
          {t('reviewStep.cancel')}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
        >
          {t('reviewStep.createAccount')}
        </Button>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">{t('reviewStep.registrationFailed')}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t('reviewStep.registrationFailedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-0 sm:flex-col gap-2">
            <AlertDialogCancel className="m-0">{t('reviewStep.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="m-0 bg-primary">{t('reviewStep.tryAgain')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReviewStep;
