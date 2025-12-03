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
          <TabsTrigger value="general">{t('review.generalInfo')}</TabsTrigger>
          <TabsTrigger value="photos">{t('review.vehiclePhotos')}</TabsTrigger>
          <TabsTrigger value="vehicle">{t('review.vehicleInfo')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">{t('review.generalInfo')}</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
              <Pencil className="w-4 h-4 mr-1" />
              {t('review.edit')}
            </Button>
          </div>

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {data.profilePhoto ? (
                <img src={URL.createObjectURL(data.profilePhoto)} alt={t('alt.profilePhoto')} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">{t('review.personalInfo')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.firstName')}</span>
                  <span>{data.firstName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.lastName')}</span>
                  <span>{data.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.phone')}</span>
                  <span>{data.phone}</span>
                </div>
                {data.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('review.email')}</span>
                    <span>{data.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">{t('review.userInfo')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.username')}</span>
                  <span>{data.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.password')}</span>
                  <span>••••••••</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">{t('review.workArea')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.workAreaLabel')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.location && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs">
                      {data.location}
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('review.priceRange')}</span>
                  <span>{data.priceRangeMin} - {data.priceRangeMax}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">{t('review.vehiclePhotos')}</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
              <Pencil className="w-4 h-4 mr-1" />
              {t('review.edit')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('vehiclePhotosStep.frontPhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.frontPhoto ? (
                  <img src={URL.createObjectURL(data.frontPhoto)} alt={t('vehiclePhotosStep.frontPhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('vehiclePhotosStep.sidePhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.sidePhoto ? (
                  <img src={URL.createObjectURL(data.sidePhoto)} alt={t('vehiclePhotosStep.sidePhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('vehiclePhotosStep.backPhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.backPhoto ? (
                  <img src={URL.createObjectURL(data.backPhoto)} alt={t('vehiclePhotosStep.backPhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('vehiclePhotosStep.platePhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.platePhoto ? (
                  <img src={URL.createObjectURL(data.platePhoto)} alt={t('vehiclePhotosStep.platePhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
          </div>

          {data.hasTrailer && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('vehiclePhotosStep.trailerPlatePhoto')}</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.trailerPlatePhoto ? (
                  <img src={URL.createObjectURL(data.trailerPlatePhoto)} alt={t('vehiclePhotosStep.trailerPlatePhoto')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vehicle" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">{t('review.vehicleInfo')}</h3>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
              <Pencil className="w-4 h-4 mr-1" />
              {t('review.edit')}
            </Button>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.plateNumber')}</span>
              <span>{data.plateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.plateProvince')}</span>
              <span>{data.plateProvince}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.vehicleBrand')}</span>
              <span>{data.vehicleBrand}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.vehicleColor')}</span>
              <span>{data.vehicleColor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.vin')}</span>
              <span>{data.vin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.vehicleType')}</span>
              <span>{data.vehicleType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.fuelType')}</span>
              <span>{data.fuelType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.loadCapacity')}</span>
              <span>{data.loadCapacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.dimensions')}</span>
              <span>{data.dimensions.width} x {data.dimensions.length} x {data.dimensions.height}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.containerTypes')}</span>
              <span>{data.containerTypes.join(", ")}</span>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('review.registrationDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.registrationPhoto ? (
                  <img src={URL.createObjectURL(data.registrationPhoto)} alt={t('review.registrationDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('review.noImage')}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('review.insuranceValue')}</span>
              <span>{data.insuranceValue} {t('review.baht')}</span>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('review.insuranceDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.insurancePhoto ? (
                  <img src={URL.createObjectURL(data.insurancePhoto)} alt={t('review.insuranceDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('review.noImage')}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('review.licenseDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.licensePhoto ? (
                  <img src={URL.createObjectURL(data.licensePhoto)} alt={t('review.licenseDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('review.noImage')}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('review.idCardDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.idCardPhoto ? (
                  <img src={URL.createObjectURL(data.idCardPhoto)} alt={t('review.idCardDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('review.noImage')}</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">{t('review.compulsoryInsuranceDoc')}</p>
              <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.compulsoryInsurancePhoto ? (
                  <img src={URL.createObjectURL(data.compulsoryInsurancePhoto)} alt={t('review.compulsoryInsuranceDoc')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{t('review.noImage')}</span>
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
          {t('review.cancel')}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
        >
          {t('review.createAccount')}
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
            <AlertDialogTitle className="text-center">{t('review.failedTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t('review.failedMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-0 sm:flex-col gap-2">
            <AlertDialogCancel className="m-0">{t('review.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="m-0 bg-primary">{t('review.tryAgain')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReviewStep;
