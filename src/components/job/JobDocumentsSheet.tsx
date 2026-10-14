import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, ImageIcon, Loader2, Paperclip, PenLine, Upload, X } from 'lucide-react';
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
  readOnly?: boolean;
}

interface UploadedDoc {
  name: string;
  uploadedAt: Date;
}

interface PendingFile {
  file: File;
  isPdf: boolean;
}

interface DocFile {
  file_name: string;
  content_type?: string;
  kind?: 'image' | 'pdf' | string;
  size?: number;
  signed_url?: string;
}

interface SignatureEntry {
  checkin_type?: 'pickup' | 'delivery' | string;
  destination_sequence_number?: number | null;
  signer_name?: string | null;
  signer_position?: string | null;
  signed_at?: string | null;
  signature_signed_url?: string | null;
  document_signed_urls?: string[];
}

interface DriverDocEntry {
  title?: string;
  description?: string;
  checkin_type?: string | null;
  driver_name?: string;
  license_plate?: string;
  submitted_at?: string;
  files?: DocFile[];
}

interface BlBooking {
  label?: string;
  signed_url?: string | null;
}

interface OrderDocuments {
  signatures: SignatureEntry[];
  driver_documents: DriverDocEntry[];
  bl_booking: BlBooking | null;
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
const MAX_DOC_FILES = 10;
// Document proxy (get-order-documents). Called with a direct fetch + apikey because the app
// uses custom auth: supabase.functions.invoke() can reject before the request goes out.
const DOC_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-order-documents`;
const APP_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const isAllowedDocFile = (file: File) =>
  ALLOWED_DOC_MIME.includes(file.type.toLowerCase()) || ALLOWED_DOC_EXT.test(file.name);

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const isImageFile = (file: DocFile) =>
  file.kind === 'image' || (file.content_type || '').startsWith('image/');

export default function JobDocumentsSheet({ open, onOpenChange, orderNumber, readOnly }: JobDocumentsSheetProps) {
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

  // Attached documents fetched from the order-documents API
  const [documents, setDocuments] = useState<OrderDocuments | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const order = (orderNumber || '').trim();
    if (!order) return;
    setDocsLoading(true);
    setDocsError(false);
    try {
      const response = await fetch(DOC_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: APP_ANON_KEY },
        body: JSON.stringify({ order_number: order }),
      });
      const data = await response.json().catch(() => null);
      // 404 = order not found -> treat as "no documents" rather than a failed load
      if (response.status === 404 || data?.found === false) {
        setDocuments({ signatures: [], driver_documents: [], bl_booking: null });
        return;
      }
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `load failed (${response.status})`);
      }
      setDocuments({
        signatures: Array.isArray(data.signatures) ? data.signatures : [],
        driver_documents: Array.isArray(data.driver_documents) ? data.driver_documents : [],
        bl_booking: data.bl_booking ?? null,
      });
    } catch (err) {
      console.error('Load order documents error:', err);
      setDocsError(true);
      setDocuments(null);
    } finally {
      setDocsLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (open) fetchDocuments();
  }, [open, fetchDocuments]);

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
      fetchDocuments();
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

  const openFile = (file: DocFile) => {
    if (!file.signed_url) return;
    if (isImageFile(file)) {
      setViewerImage(file.signed_url);
    } else {
      window.open(file.signed_url, '_blank', 'noopener,noreferrer');
    }
  };

  const pointLabel = (checkinType?: string | null) =>
    checkinType === 'pickup'
      ? t('docs.pointPickup')
      : checkinType === 'delivery'
        ? t('docs.pointDelivery')
        : null;

  const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  const hasSignatures = (documents?.signatures.length ?? 0) > 0;
  const hasDriverDocs = (documents?.driver_documents.length ?? 0) > 0;
  const hasBlBooking = !!documents?.bl_booking?.signed_url;
  const hasAnyDocuments = hasSignatures || hasDriverDocs || hasBlBooking;

  const renderFileRow = (file: DocFile, key: string) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => openFile(file)}
        className="w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/50"
      >
        {isImageFile(file) ? (
          <ImageIcon className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
        <p className="text-sm font-medium truncate flex-1 min-w-0">{file.file_name}</p>
      </button>
    </li>
  );

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
            {/* Attached documents (from order-documents API) */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{t('docs.attachedList')}</p>

              {docsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm">{t('docs.loading')}</p>
                </div>
              ) : docsError ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <p className="text-sm text-muted-foreground">{t('docs.loadFailed')}</p>
                  <Button variant="outline" size="sm" onClick={fetchDocuments}>
                    {t('docs.retry')}
                  </Button>
                </div>
              ) : !hasAnyDocuments ? (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <p className="text-sm">{t('docs.none')}</p>
                </div>
              ) : (
                <>
                  {hasSignatures && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <PenLine className="w-4 h-4" />
                        {t('docs.groupSignatures')}
                      </p>
                      {documents!.signatures.map((sig, index) => {
                        const point = pointLabel(sig.checkin_type);
                        return (
                          <div key={`sig-${index}`} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {point && (
                                <span className="text-xs font-medium bg-muted rounded-full px-2 py-0.5">
                                  {point}
                                </span>
                              )}
                              {sig.signer_name && (
                                <span className="text-xs text-muted-foreground">
                                  {t('docs.signedBy')}: {sig.signer_name}
                                </span>
                              )}
                              {sig.signed_at && (
                                <span className="text-xs text-muted-foreground">{formatTime(sig.signed_at)}</span>
                              )}
                            </div>
                            <ul className="space-y-2">
                              {sig.signature_signed_url &&
                                renderFileRow(
                                  { file_name: `signature-${sig.checkin_type || index}.png`, kind: 'image', signed_url: sig.signature_signed_url },
                                  `sig-img-${index}`,
                                )}
                              {(sig.document_signed_urls || []).map((url, i) =>
                                renderFileRow(
                                  { file_name: `proof-${i + 1}.jpg`, kind: 'image', signed_url: url },
                                  `sig-doc-${index}-${i}`,
                                ),
                              )}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {hasDriverDocs && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        {t('docs.groupDriverDocs')}
                      </p>
                      {documents!.driver_documents.map((doc, index) => {
                        const point = pointLabel(doc.checkin_type);
                        return (
                          <div key={`doc-${index}`} className="rounded-lg border p-3 space-y-2">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">{doc.title || '-'}</p>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground">{doc.description}</p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                {point && (
                                  <span className="text-xs font-medium bg-muted rounded-full px-2 py-0.5">
                                    {point}
                                  </span>
                                )}
                                {doc.driver_name && (
                                  <span className="text-xs text-muted-foreground">{doc.driver_name}</span>
                                )}
                                {doc.license_plate && (
                                  <span className="text-xs text-muted-foreground">{doc.license_plate}</span>
                                )}
                                {doc.submitted_at && (
                                  <span className="text-xs text-muted-foreground">{formatTime(doc.submitted_at)}</span>
                                )}
                              </div>
                            </div>
                            <ul className="space-y-2">
                              {(doc.files || []).map((file, i) => renderFileRow(file, `doc-${index}-file-${i}`))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {hasBlBooking && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        {t('docs.groupBlBooking')}
                      </p>
                      <ul className="space-y-2">
                        {renderFileRow(
                          { file_name: documents!.bl_booking!.label || 'B/L', kind: 'pdf', signed_url: documents!.bl_booking!.signed_url! },
                          'bl-booking',
                        )}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {!readOnly && (
              <>
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

                {uploaded.length > 0 && (
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
              </>
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

      <Dialog open={!!viewerImage} onOpenChange={(open) => !open && setViewerImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-2 flex items-center justify-center">
          {viewerImage && (
            <img src={viewerImage} alt="" className="max-w-full max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

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
