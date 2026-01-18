import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type OCRExtractionType = 'container_seal' | 'expense_amount' | 'general';

interface ContainerSealData {
  container_number?: string | null;
  seal_number?: string | null;
  container_number_2?: string | null;
  seal_number_2?: string | null;
}

interface ExpenseData {
  amount?: number | null;
  raw_text?: string;
}

interface OCRResult {
  success: boolean;
  data?: ContainerSealData & ExpenseData & { raw_text?: string };
  error?: string;
}

interface UseOCRReturn {
  extracting: boolean;
  extractFromImage: (imageFile: File, extractionType: OCRExtractionType) => Promise<OCRResult>;
  extractFromBase64: (base64: string, extractionType: OCRExtractionType) => Promise<OCRResult>;
}

export function useOCR(): UseOCRReturn {
  const [extracting, setExtracting] = useState(false);

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const extractFromBase64 = useCallback(async (
    base64: string, 
    extractionType: OCRExtractionType
  ): Promise<OCRResult> => {
    setExtracting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ocr-extract', {
        body: {
          image_base64: base64,
          extraction_type: extractionType,
        },
      });

      if (error) {
        console.error('OCR function error:', error);
        return { success: false, error: error.message };
      }

      return data as OCRResult;
    } catch (err) {
      console.error('OCR extraction error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'OCR extraction failed' 
      };
    } finally {
      setExtracting(false);
    }
  }, []);

  const extractFromImage = useCallback(async (
    imageFile: File, 
    extractionType: OCRExtractionType
  ): Promise<OCRResult> => {
    try {
      const base64 = await fileToBase64(imageFile);
      return extractFromBase64(base64, extractionType);
    } catch (err) {
      console.error('Error converting file to base64:', err);
      return { 
        success: false, 
        error: 'Failed to read image file' 
      };
    }
  }, [fileToBase64, extractFromBase64]);

  return {
    extracting,
    extractFromImage,
    extractFromBase64,
  };
}
