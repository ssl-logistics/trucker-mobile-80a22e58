import { useState, useRef } from 'react';
import { Camera, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { toast } from '@/hooks/use-toast';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

interface EditablePhotoProps {
  src: string;
  alt: string;
  className?: string;
  /** S3 folder for upload */
  folder?: string;
  /** Filename prefix */
  filenamePrefix?: string;
  /** Completion timestamp - used to check 3-day window */
  completedAt?: string | null;
  /** Whether viewing from history */
  fromHistory?: boolean;
  /** Called after successful upload with new S3 URL */
  onPhotoReplaced?: (newUrl: string) => void;
}

// Module-level cache to persist uploaded URLs across re-renders
const uploadedUrlCache = new Map<string, string>();

export function EditablePhoto({
  src,
  alt,
  className = 'w-full h-full object-cover',
  folder = 'sop-photos',
  filenamePrefix = 'edit',
  completedAt,
  fromHistory = false,
  onPhotoReplaced,
}: EditablePhotoProps) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Use module-level cache to persist uploaded URL across re-renders/remounts
  const cachedUrl = uploadedUrlCache.get(src);
  const [displayUrl, setDisplayUrl] = useState(cachedUrl || src);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  // Check if editing is allowed: from history + within 3 days
  const canEdit = (() => {
    if (!fromHistory || !completedAt) return false;
    const completedDate = new Date(completedAt);
    const now = new Date();
    const diffMs = now.getTime() - completedDate.getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return diffMs <= threeDaysMs;
  })();

  // Extract S3 key from original URL to overwrite the same file
  const getS3KeyFromUrl = (url: string): string | null => {
    try {
      // Match URLs like https://ssl-thetroob.s3.ap-southeast-1.amazonaws.com/mobile/...
      const match = url.match(/amazonaws\.com\/(.+)$/);
      if (match) return match[1];
      // Also try without domain prefix
      const match2 = url.match(/\/mobile\/(.+)$/);
      if (match2) return `mobile/${match2[1]}`;
      return null;
    } catch {
      return null;
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Try to extract the original S3 key so we overwrite the same file
      const originalKey = getS3KeyFromUrl(src);
      if (originalKey) {
        // Send the full S3 key to overwrite
        formData.append('overwriteKey', originalKey);
      } else {
        formData.append('folder', folder);
        formData.append('filename', `${filenamePrefix}-${Date.now()}`);
      }

      const { data, error } = await supabase.functions.invoke('upload-to-s3', {
        body: formData,
      });

      if (error || !data?.url) {
        throw new Error('Upload failed');
      }

      const blobUrl = URL.createObjectURL(file);
      uploadedUrlCache.set(src, blobUrl);
      setDisplayUrl(blobUrl);
      onPhotoReplaced?.(data.url);

      toast({
        title: 'อัปโหลดสำเร็จ',
        description: 'เปลี่ยนรูปเรียบร้อยแล้ว',
      });
    } catch (err) {
      console.error('Photo upload error:', err);
      toast({
        title: 'อัปโหลดไม่สำเร็จ',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setShowDrawer(false);
    }
  };

  const handleTakePhoto = async () => {
    if (isNative) {
      const file = await takePhoto();
      if (file) await uploadFile(file);
      else setShowDrawer(false);
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.setAttribute('capture', 'environment');
        fileInputRef.current.click();
      }
    }
  };

  const handleSelectFromGallery = async () => {
    if (isNative) {
      const file = await selectFromGallery();
      if (file) await uploadFile(file);
      else setShowDrawer(false);
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.removeAttribute('capture');
        fileInputRef.current.click();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative">
      <img src={displayUrl} alt={alt} className={className} />

      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDrawer(true);
          }}
          disabled={uploading}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Pencil className="w-4 h-4" />
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>เปลี่ยนรูปภาพ</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-3">
            <Button className="w-full h-12" onClick={handleTakePhoto} disabled={uploading}>
              <Camera className="w-5 h-5 mr-2" />
              ถ่ายรูปใหม่
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={handleSelectFromGallery} disabled={uploading}>
              เลือกจากแกลเลอรี
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost">ยกเลิก</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
