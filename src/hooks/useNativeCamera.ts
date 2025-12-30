import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

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
      const image = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      if (image.dataUrl) {
        const filename = `photo_${Date.now()}.jpg`;
        return await dataURLtoFile(image.dataUrl, filename);
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  }, [isNative, quality, dataURLtoFile]);

  const selectFromGallery = useCallback(async (): Promise<File | null> => {
    if (!isNative) {
      return null; // Let web handle via file input
    }

    try {
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
    } catch (error) {
      console.error('Error selecting from gallery:', error);
      return null;
    }
  }, [isNative, quality, dataURLtoFile]);

  return {
    takePhoto,
    selectFromGallery,
    isNative,
  };
};
