import { useState } from 'react';
import { Camera, Image as ImageIcon, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOCR } from '@/hooks/useOCR';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface ContainerSealVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCode: string;
  jobId: string;
  userId: string;
  onSuccess: () => void;
}

interface OCRResult {
  container_number?: string | null;
  seal_number?: string | null;
  container_number_2?: string | null;
  seal_number_2?: string | null;
}

interface VerificationResult {
  success: boolean;
  matched: boolean;
  container_matched: boolean;
  seal_matched: boolean;
  container_no?: string;
  seal_no?: string;
  booking_no?: string;
  container_index?: number;
  message?: string;
  has_containers_in_db?: boolean;
  error?: string;
}

export default function ContainerSealVerificationDialog({
  open,
  onOpenChange,
  orderCode,
  jobId,
  userId,
  onSuccess,
}: ContainerSealVerificationDialogProps) {
  const { t } = useLanguage();
  const { extractFromImage, extracting } = useOCR();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // OCR extracted values
  const [containerNumber, setContainerNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [containerNumber2, setContainerNumber2] = useState('');
  const [sealNumber2, setSealNumber2] = useState('');
  const [ocrContainerNumber, setOcrContainerNumber] = useState<string | null>(null);
  const [ocrSealNumber, setOcrSealNumber] = useState<string | null>(null);
  const [ocrContainerNumber2, setOcrContainerNumber2] = useState<string | null>(null);
  const [ocrSealNumber2, setScrSealNumber2] = useState<string | null>(null);

  // Verification state
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const resetState = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setContainerNumber('');
    setSealNumber('');
    setContainerNumber2('');
    setSealNumber2('');
    setOcrContainerNumber(null);
    setOcrSealNumber(null);
    setOcrContainerNumber2(null);
    setScrSealNumber2(null);
    setVerificationResult(null);
  };

  // Verify container with API
  const verifyContainer = async (containerNo: string, sealNo?: string): Promise<VerificationResult | null> => {
    try {
      setVerifying(true);
      console.log('Verifying container:', { orderCode, containerNo, sealNo });

      const { data, error } = await supabase.functions.invoke('verify-container', {
        body: {
          order_number: orderCode,
          container_no: containerNo,
          seal_no: sealNo || null,
        },
      });

      if (error) {
        console.error('Verify container error:', error);
        return null;
      }

      console.log('Verification result:', data);
      return data as VerificationResult;
    } catch (err) {
      console.error('Verification error:', err);
      return null;
    } finally {
      setVerifying(false);
    }
  };

  const processImage = async (file: File) => {
    setPhotoFile(file);
    setVerificationResult(null);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Run OCR extraction
    const result = await extractFromImage(file, 'container_seal');
    
    if (result.success && result.data) {
      const data = result.data as OCRResult;
      let extractedContainer = '';
      let extractedSeal = '';

      if (data.container_number) {
        setOcrContainerNumber(data.container_number);
        setContainerNumber(data.container_number);
        extractedContainer = data.container_number;
      }
      if (data.seal_number) {
        setOcrSealNumber(data.seal_number);
        setSealNumber(data.seal_number);
        extractedSeal = data.seal_number;
      }
      if (data.container_number_2) {
        setOcrContainerNumber2(data.container_number_2);
        setContainerNumber2(data.container_number_2);
      }
      if (data.seal_number_2) {
        setScrSealNumber2(data.seal_number_2);
        setSealNumber2(data.seal_number_2);
      }
      
      toast({
        title: t('containerSealVerification.ocrSuccess') || 'OCR สำเร็จ',
        description: t('containerSealVerification.ocrSuccessDesc') || 'ตรวจสอบและยืนยันข้อมูลที่อ่านได้',
      });

      // Auto-verify if container number was extracted
      if (extractedContainer) {
        const verifyResult = await verifyContainer(extractedContainer, extractedSeal);
        if (verifyResult) {
          setVerificationResult(verifyResult);
          
          if (verifyResult.matched) {
            toast({
              title: t('containerSealVerification.verified') || 'ยืนยันสำเร็จ',
              description: verifyResult.message || 'เลขตู้และซีลตรงกับระบบ',
            });
          } else {
            toast({
              title: t('containerSealVerification.notMatched') || 'ไม่ตรงกับระบบ',
              description: verifyResult.has_containers_in_db 
                ? (t('containerSealVerification.containerMismatch') || 'เลขตู้/ซีลไม่ตรงกับที่ลงทะเบียนในระบบ')
                : (t('containerSealVerification.noContainerInDB') || 'ยังไม่มีเลขตู้ลงทะเบียนในระบบ'),
              variant: 'destructive',
            });
          }
        }
      }
    } else if (result.error) {
      toast({
        title: t('containerSealVerification.ocrError') || 'OCR ล้มเหลว',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleManualVerify = async () => {
    if (!containerNumber) {
      toast({
        title: t('containerSealVerification.requiredFields') || 'กรุณากรอกข้อมูล',
        description: t('containerSealVerification.containerRequired') || 'กรุณากรอกเลขตู้',
        variant: 'destructive',
      });
      return;
    }

    const result = await verifyContainer(containerNumber, sealNumber);
    if (result) {
      setVerificationResult(result);
      
      if (result.matched) {
        toast({
          title: t('containerSealVerification.verified') || 'ยืนยันสำเร็จ',
          description: result.message || 'เลขตู้และซีลตรงกับระบบ',
        });
      } else {
        toast({
          title: t('containerSealVerification.notMatched') || 'ไม่ตรงกับระบบ',
          description: result.has_containers_in_db 
            ? (t('containerSealVerification.containerMismatch') || 'เลขตู้/ซีลไม่ตรงกับที่ลงทะเบียนในระบบ')
            : (t('containerSealVerification.noContainerInDB') || 'ยังไม่มีเลขตู้ลงทะเบียนในระบบ'),
          variant: 'destructive',
        });
      }
    }
  };

  const handleTakePhoto = async () => {
    setShowPhotoDrawer(false);
    
    if (isNative) {
      const file = await takePhoto();
      if (file) {
        await processImage(file);
      }
    } else {
      // Web fallback
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          await processImage(file);
        }
      };
      
      input.click();
    }
  };

  const handleSelectFromGallery = async () => {
    setShowPhotoDrawer(false);
    
    if (isNative) {
      const file = await selectFromGallery();
      if (file) {
        await processImage(file);
      }
    } else {
      // Web fallback
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          await processImage(file);
        }
      };
      
      input.click();
    }
  };

  const handleSubmit = async () => {
    if (!containerNumber || !sealNumber) {
      toast({
        title: t('containerSealVerification.requiredFields') || 'กรุณากรอกข้อมูล',
        description: t('containerSealVerification.requiredFieldsDesc') || 'กรุณากรอกเลขตู้และเลขซีล',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload photo if exists
      let photoUrl = '';
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${userId}/${orderCode}/container_seal_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('driver-photos')
          .upload(fileName, photoFile);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('driver-photos')
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      // Send verification data to API
      const response = await supabase.functions.invoke('submit-container-verification', {
        body: {
          order_number: orderCode,
          job_id: jobId,
          driver_id: userId,
          container_number: containerNumber,
          seal_number: sealNumber,
          container_number_2: containerNumber2 || null,
          seal_number_2: sealNumber2 || null,
          photo_url: photoUrl || null,
          verification_result: verificationResult,
          ocr_data: {
            container_number: ocrContainerNumber,
            seal_number: ocrSealNumber,
            container_number_2: ocrContainerNumber2,
            seal_number_2: ocrSealNumber2,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: t('containerSealVerification.submitSuccess') || 'ส่งข้อมูลสำเร็จ',
        description: t('containerSealVerification.submitSuccessDesc') || 'รอการยืนยันจากผู้ดูแล',
      });

      resetState();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: t('containerSealVerification.submitError') || 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'ไม่สามารถส่งข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = containerNumber && sealNumber && photoFile;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              {t('containerSealVerification.title') || 'ยืนยันเลขตู้/เลขซีล'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t('containerSealVerification.description') || 'ถ่ายรูปเลขตู้และเลขซีลเพื่อยืนยันข้อมูล'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo Section */}
            <Card className="p-4 border-dashed border-2 border-gray-300">
              {photoPreview ? (
                <div className="space-y-3">
                  <img
                    src={photoPreview}
                    alt="Container/Seal"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowPhotoDrawer(true)}
                    disabled={extracting}
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('containerSealVerification.processing') || 'กำลังอ่านข้อมูล...'}
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        {t('containerSealVerification.retakePhoto') || 'ถ่ายรูปใหม่'}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-32 flex flex-col items-center justify-center gap-2"
                  onClick={() => setShowPhotoDrawer(true)}
                  disabled={extracting}
                >
                  <Camera className="w-10 h-10 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {t('containerSealVerification.takePhoto') || 'ถ่ายรูปเลขตู้/เลขซีล'}
                  </span>
                </Button>
              )}
            </Card>

            {/* Container 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                  1
                </div>
                <Label className="font-semibold">
                  {t('containerSealVerification.container1') || 'ตู้ที่ 1'}
                </Label>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {t('containerSealVerification.containerNumber') || 'เลขตู้'} *
                  </Label>
                  <div className="relative">
                    <Input
                      value={containerNumber}
                      onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
                      placeholder="ABCD1234567"
                      className={ocrContainerNumber ? 'pr-8 border-green-500' : ''}
                    />
                    {ocrContainerNumber && (
                      <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {t('containerSealVerification.sealNumber') || 'เลขซีล'} *
                  </Label>
                  <div className="relative">
                    <Input
                      value={sealNumber}
                      onChange={(e) => setSealNumber(e.target.value.toUpperCase())}
                      placeholder="SEAL123456"
                      className={ocrSealNumber ? 'pr-8 border-green-500' : ''}
                    />
                    {ocrSealNumber && (
                      <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Container 2 (Optional) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-semibold">
                  2
                </div>
                <Label className="font-semibold text-muted-foreground">
                  {t('containerSealVerification.container2') || 'ตู้ที่ 2'} ({t('containerSealVerification.optional') || 'ถ้ามี'})
                </Label>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">
                    {t('containerSealVerification.containerNumber') || 'เลขตู้'}
                  </Label>
                  <div className="relative">
                    <Input
                      value={containerNumber2}
                      onChange={(e) => setContainerNumber2(e.target.value.toUpperCase())}
                      placeholder="ABCD1234567"
                      className={ocrContainerNumber2 ? 'pr-8 border-green-500' : ''}
                    />
                    {ocrContainerNumber2 && (
                      <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">
                    {t('containerSealVerification.sealNumber') || 'เลขซีล'}
                  </Label>
                  <div className="relative">
                    <Input
                      value={sealNumber2}
                      onChange={(e) => setSealNumber2(e.target.value.toUpperCase())}
                      placeholder="SEAL123456"
                      className={ocrSealNumber2 ? 'pr-8 border-green-500' : ''}
                    />
                    {ocrSealNumber2 && (
                      <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Result Display */}
            {verificationResult && (
              <Card className={`p-4 ${verificationResult.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-3">
                  {verificationResult.matched ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold ${verificationResult.matched ? 'text-green-800' : 'text-red-800'}`}>
                      {verificationResult.matched 
                        ? (t('containerSealVerification.verified') || 'ยืนยันสำเร็จ - ข้อมูลตรงกับระบบ')
                        : (t('containerSealVerification.notMatched') || 'ไม่ตรงกับระบบ')
                      }
                    </p>
                    <p className={`text-sm mt-1 ${verificationResult.matched ? 'text-green-700' : 'text-red-700'}`}>
                      {verificationResult.message || (
                        verificationResult.matched 
                          ? 'เลขตู้และซีลตรงกับที่ลงทะเบียนในระบบ'
                          : verificationResult.has_containers_in_db
                            ? 'เลขตู้/ซีลไม่ตรงกับที่ลงทะเบียนในระบบ กรุณาตรวจสอบอีกครั้ง'
                            : 'ยังไม่มีเลขตู้ลงทะเบียนในระบบสำหรับงานนี้'
                      )}
                    </p>
                    {verificationResult.matched && verificationResult.booking_no && (
                      <p className="text-xs text-green-600 mt-2">
                        Booking: {verificationResult.booking_no}
                      </p>
                    )}
                    {/* Show detailed match status */}
                    {verificationResult.matched && (
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          {t('containerSealVerification.containerNumber') || 'เลขตู้'}
                        </span>
                        {verificationResult.seal_matched && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            {t('containerSealVerification.sealNumber') || 'เลขซีล'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Manual Verify Button */}
            {containerNumber && !verificationResult && !verifying && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManualVerify}
                disabled={verifying || extracting}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                {t('containerSealVerification.verifyManual') || 'ตรวจสอบเลขตู้กับระบบ'}
              </Button>
            )}

            {verifying && (
              <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('containerSealVerification.verifying') || 'กำลังตรวจสอบ...'}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
            >
              {t('common.cancel') || 'ยกเลิก'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || submitting || extracting || verifying}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('containerSealVerification.submitting') || 'กำลังส่ง...'}
                </>
              ) : (
                t('containerSealVerification.submit') || 'ส่งยืนยัน'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Source Drawer */}
      <Drawer open={showPhotoDrawer} onOpenChange={setShowPhotoDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {t('containerSealVerification.selectSource') || 'เลือกแหล่งที่มาของรูป'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3">
            <Button
              variant="outline"
              className="w-full h-14 justify-start gap-3"
              onClick={handleTakePhoto}
            >
              <Camera className="w-6 h-6" />
              <span>{t('containerSealVerification.camera') || 'ถ่ายรูป'}</span>
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 justify-start gap-3"
              onClick={handleSelectFromGallery}
            >
              <ImageIcon className="w-6 h-6" />
              <span>{t('containerSealVerification.gallery') || 'เลือกจากอัลบั้ม'}</span>
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{t('common.cancel') || 'ยกเลิก'}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
