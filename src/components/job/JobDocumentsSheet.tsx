import { useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Camera, FileText, ImageIcon, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { toast } from '@/hooks/use-toast';
import { compressImage } from '@/utils/imageCompression';
import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';

interface JobDocumentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber?: string;
  jobData?: any;
}

interface UploadedDoc {
  name: string;
  url: string;
  uploadedAt: Date;
}

export default function JobDocumentsSheet({ open, onOpenChange, orderNumber }: JobDocumentsSheetProps) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  // Strip destination suffix (e.g. OR20260929003/01 -> OR20260929003) for the S3 folder
  const baseOrderNumber = (orderNumber || '').split('/')[0];

  const uploadFile = async (file: File) => {
    if (!baseOrderNumber) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', await compressImage(file));
      formData.append('folder', `documents/${baseOrderNumber}`);

      const { data, error } = await supabase.functions.invoke('upload-to-s3', {
        body: formData,
      });

      if (error || !data?.url) {
        console.error('Document upload response:', { error, data });
        throw new Error('Upload failed');
      }

      setUploaded((prev) => [...prev, { name: file.name, url: data.url, uploadedAt: new Date() }]);
      toast({ title: t('docs.uploadSuccess') });
    } catch (err) {
      console.error('Document upload error:', err);
      toast({ title: t('docs.uploadFailed'), variant: 'destructive' });
    } finally {
      setUploading(false);
      setShowPicker(false);
    }
  };

  const handleTakePhoto = async () => {
    if (isNative) {
      const file = await takePhoto();
      if (file) await uploadFile(file);
      else setShowPicker(false);
    } else {
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
        cameraInputRef.current.click();
      }
    }
  };

  const handleSelectFromGallery = async () => {
    if (isNative) {
      const file = await selectFromGallery();
      if (file) await uploadFile(file);
      else setShowPicker(false);
    } else {
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
        galleryInputRef.current.click();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (e.target) e.target.value = '';
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[80vh] flex flex-col rounded-t-2xl p-0 max-w-[560px] mx-auto">
          <SheetHeader className="px-4 py-3 border-b space-y-0 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5" />
              {t('docs.title')}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <Button
              className="w-full h-12"
              onClick={() => setShowPicker(true)}
              disabled={uploading || !baseOrderNumber}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5 mr-2" />
              )}
              {uploading ? t('docs.uploading') : t('docs.attach')}
            </Button>

            {uploaded.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm">{t('docs.emptyUploaded')}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {uploaded.map((doc, index) => (
                  <li
                    key={`${doc.url}-${index}`}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.uploadedAt.toLocaleTimeString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Drawer open={showPicker} onOpenChange={setShowPicker}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('docs.attach')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-3">
            <Button className="w-full h-12" onClick={handleTakePhoto} disabled={uploading}>
              <Camera className="w-5 h-5 mr-2" />
              {t('docs.takePhoto')}
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={handleSelectFromGallery} disabled={uploading}>
              <ImageIcon className="w-5 h-5 mr-2" />
              {t('docs.chooseFromGallery')}
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost">{t('common.cancel')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT_IMAGE_DOC}
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT_IMAGE_DOC}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
