import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { CameraPermissionState, CameraPermissionType } from '@capacitor/camera';
import { toast } from '@/hooks/use-toast';

interface UseNativeCameraOptions {
  quality?: number;
}

interface UseNativeCameraResult {
  takePhoto: () => Promise<File | null>;
  selectFromGallery: () => Promise<File | null>;
  isNative: boolean;
}

/**
 * Hook to handle camera functionality for both web and native platforms
 * On native (iOS/Android), uses Capacitor Camera plugin
 * On web, falls back to standard file input
 */
export const useNativeCamera = (options: UseNativeCameraOptions = {}): UseNativeCameraResult => {
  const { quality = 90 } = options;
  const isNative = Capacitor.isNativePlatform();

  const isPermissionGranted = (state: CameraPermissionState) => state === 'granted' || state === 'limited';

  const ensurePermissions = useCallback(async (permissions: CameraPermissionType[]): Promise<boolean> => {
    if (!isNative) return true;

    const current = await Camera.checkPermissions();
    const needsRequest = permissions.some((permission) => !isPermissionGranted(current[permission]));
    const finalStatus = needsRequest
      ? await Camera.requestPermissions({ permissions })
      : current;

    const granted = permissions.every((permission) => isPermissionGranted(finalStatus[permission]));
    if (!granted) {
      toast({
        title: 'ยังไม่ได้รับอนุญาต',
        description: permissions.includes('camera')
          ? 'กรุณาอนุญาตกล้องและรูปภาพในการตั้งค่าของเครื่อง แล้วลองอีกครั้ง'
          : 'กรุณาอนุญาตเข้าถึงรูปภาพในการตั้งค่าของเครื่อง แล้วลองอีกครั้ง',
        variant: 'destructive',
      });
    }
    return granted;
  }, [isNative]);

  const dataURLtoFile = useCallback(async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  }, []);

  const takePhoto = useCallback(async (): Promise<File | null> => {
    if (!isNative) {
      return null; // Let web handle via file input
    }

    try {
      const hasPermission = await ensurePermissions(['camera']);
      if (!hasPermission) return null;

      const image = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
        correctOrientation: true,
      });

      if (image.dataUrl) {
        const filename = `photo_${Date.now()}.jpg`;
        return await dataURLtoFile(image.dataUrl, filename);
      }
      return null;
    } catch (error: any) {
      console.error('Error taking photo:', error);
      const msg = String(error?.message || error || '');
      if (/cancel/i.test(msg)) return null;
      toast({
        title: 'เปิดกล้องไม่สำเร็จ',
        description: msg || 'กรุณาตรวจสอบสิทธิ์กล้องของแอป แล้วลองอีกครั้ง',
        variant: 'destructive',
      });
      return null;
    }
  }, [isNative, quality, dataURLtoFile, ensurePermissions]);

  const selectFromGallery = useCallback(async (): Promise<File | null> => {
    if (!isNative) {
      return null; // Let web handle via file input
    }

    try {
      const hasPermission = await ensurePermissions(['photos']);
      if (!hasPermission) return null;

      const image = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        correctOrientation: true,
      });

      if (image.dataUrl) {
        const filename = `photo_${Date.now()}.jpg`;
        return await dataURLtoFile(image.dataUrl, filename);
      }
      return null;
    } catch (error: any) {
      console.error('Error selecting from gallery:', error);
      const msg = String(error?.message || error || '');
      if (/cancel/i.test(msg)) return null;
      toast({
        title: 'เปิดรูปภาพไม่สำเร็จ',
        description: msg || 'กรุณาตรวจสอบสิทธิ์รูปภาพของแอป แล้วลองอีกครั้ง',
        variant: 'destructive',
      });
      return null;
    }
  }, [isNative, quality, dataURLtoFile, ensurePermissions]);

  return {
    takePhoto,
    selectFromGallery,
    isNative,
  };
};
