import { useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, ImageIcon, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { toast } from '@/hooks/use-toast';
import { compressImage } from '@/utils/imageCompression';
import { ACCEPT_DOC_ALLOWED } from '@/utils/uploadAccept';
import { uploadDriverDocument } from '@/lib/externalApi';

interface JobDocumentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber?: string;
  jobData?: any;
}

interface UploadedDoc {
  name: string;
  uploadedAt: Date;
}

interface PendingFile {
  file: File;
  isPdf: boolean;
}

// ตรวจทั้ง MIME และนามสกุล (Safari/HEIC มักรายงาน MIME ว่าง)
const ALLOWED_DOC_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];
const ALLOWED_DOC_EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
const isAllowedDocFile = (file: File) =>
  ALLOWED_DOC_MIME.includes(file.type.toLowerCase()) || ALLOWED_DOC_EXT.test(file.name);

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function JobDocumentsSheet({ open, onOpenChange, orderNumber }: JobDocumentsSheetProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  // Reset the dialog to a clean state (empty fields, no pending/attached files)
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPendingFiles([]);
    setUploaded([]);
    setShowPicker(false);
    setUploading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  // Strip destination suffix (e.g. OR20260929003/01 -> OR20260929003)
  const baseOrderNumber = (orderNumber || '').split('/')[0];

  const driverName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.full_name || user?.name || user?.username || '';

  // API driver-documents รับเฉพาะรูป JPG/PNG/WEBP/HEIC หรือ PDF — ไฟล์อื่นแจ้งเตือนและไม่เพิ่มเข้าลิสต์
  const addPendingFiles = (files: PendingFile[]) => {
    if (files.length === 0) return;
    const allowed = files.filter(({ file }) => isAllowedDocFile(file));
    const rejected = files.filter(({ file }) => !isAllowedDocFile(file));
    if (rejected.length > 0) {
      toast({
        title: t('docs.unsupportedFile'),
        description: rejected.map(({ file }) => file.name).join(', '),
        variant: 'destructive',
      });
    }
    if (allowed.length === 0) {
      setShowPicker(false);
      return;
    }
    if (pendingFiles.length + allowed.length > MAX_DOC_FILES) {
      toast({ title: t('docs.maxFiles'), variant: 'destructive' });
    }
    setPendingFiles((prev) => [...prev, ...allowed].slice(0, MAX_DOC_FILES));
    setShowPicker(false);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!baseOrderNumber || pendingFiles.length === 0) return;
    if (!title.trim()) {
      toast({ title: t('docs.titleRequired'), variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const filesBase64: Array<string | { file_name: string; data: string }> = [];
      for (const { file, isPdf } of pendingFiles) {
        if (isPdf) {
          const data = await readFileAsDataUrl(file);
          filesBase64.push({ file_name: file.name, data });
        } else {
          const compressed = await compressImage(file);
          const data = await readFileAsDataUrl(compressed);
          filesBase64.push(data);
        }
      }

      const { data, error } = await uploadDriverDocument({
        order_number: baseOrderNumber,
        title: title.trim(),
        description: description.trim() || undefined,
        driver_name: driverName,
        files_base64: filesBase64,
      });

      if (error || !data?.success) {
        console.error('Document upload response:', { error, data });
        throw new Error('Upload failed');
      }

      toast({ title: t('docs.uploadSuccess') });
      resetForm();
    } catch (err) {
      console.error('Document upload error:', err);
      toast({ title: t('docs.uploadFailed'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (isNative) {
      const file = await takePhoto();
      if (file) addPendingFiles([{ file, isPdf: false }]);
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
      if (file) addPendingFiles([{ file, isPdf: false }]);
      else setShowPicker(false);
    } else {
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
        galleryInputRef.current.click();
      }
    }
  };

  const handleAttachFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).map((file) => ({
      file,
      isPdf: file.type === 'application/pdf' || /\.pdf$/i.test(file.name),
    }));
    addPendingFiles(files);
    if (e.target) e.target.value = '';
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="h-[80vh] flex flex-col rounded-t-2xl p-0 max-w-[560px] mx-auto">
          <SheetHeader className="px-4 py-3 border-b space-y-0 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5" />
              {t('docs.title')}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('docs.docTitlePlaceholder')}
                disabled={uploading}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('docs.descriptionPlaceholder')}
                rows={2}
                disabled={uploading}
              />
            </div>

            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => setShowPicker(true)}
              disabled={uploading || !baseOrderNumber}
            >
              <Paperclip className="w-5 h-5 mr-2" />
              {t('docs.attach')}
            </Button>

            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('docs.pendingFiles')}
                </p>
                <ul className="space-y-2">
                  {pendingFiles.map((pending, index) => (
                    <li
                      key={`${pending.file.name}-${index}`}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    >
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium truncate flex-1 min-w-0">
                        {pending.file.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => removePendingFile(index)}
                        disabled={uploading}
                        aria-label={t('docs.removeFile')}
                        className="shrink-0 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full h-12"
                  onClick={handleUpload}
                  disabled={uploading || !title.trim()}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 mr-2" />
                  )}
                  {uploading ? t('docs.uploading') : t('docs.upload')}
                </Button>
              </div>
            )}

            {uploaded.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm">{t('docs.emptyUploaded')}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {uploaded.map((doc, index) => (
                  <li
                    key={`${doc.name}-${index}`}
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
            <Button variant="outline" className="w-full h-12" onClick={handleAttachFile} disabled={uploading}>
              <Paperclip className="w-5 h-5 mr-2" />
              {t('docs.attachFile')}
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
        accept={ACCEPT_DOC_ALLOWED}
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT_DOC_ALLOWED}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_DOC_ALLOWED}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
