import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type OCRExtractionType = 'container_seal' | 'expense_amount' | 'expense_detailed' | 'payment_slip' | 'weight_slip' | 'container_return_slip' | 'eir_document' | 'trailer_plate' | 'general';

interface ContainerSealData {
  container_number?: string | null;
  seal_number?: string | null;
  container_number_2?: string | null;
  seal_number_2?: string | null;
  max_gross?: number | null;
  tare_weight?: number | null;
  net_weight?: number | null;
}

interface ExpenseData {
  amount?: number | null;
  raw_text?: string;
}

interface ExpenseLineItem {
  description: string;
  amount: number;
}

interface ExpenseDetailedData {
  grand_total?: number | null;
  subtotal?: number | null;
  vat?: number | null;
  line_items?: ExpenseLineItem[];
  container_number?: string | null;
  receipt_number?: string | null;
  receipt_date?: string | null;
}

interface WeightSlipData {
  weight_in?: number | null;
  weight_out?: number | null;
  net_weight?: number | null;
}

interface PaymentSlipData {
  amount?: number | null;
  account_number?: string | null;
  bank_name?: string | null;
  receiver_name?: string | null;
  amount_matches?: boolean;
  account_matches?: boolean;
}

interface OCRResult {
  success: boolean;
  data?: ContainerSealData & ExpenseData & ExpenseDetailedData & PaymentSlipData & WeightSlipData & { raw_text?: string; yard_name?: string | null; return_date?: string | null; bl_no?: string | null; booking_no?: string | null };
  error?: string;
}

interface OCROptions {
  expected_amount?: number;
  expected_account_number?: string;
}

interface UseOCRReturn {
  extracting: boolean;
  extractFromImage: (imageFile: File, extractionType: OCRExtractionType, options?: OCROptions) => Promise<OCRResult>;
  extractFromBase64: (base64: string, extractionType: OCRExtractionType, options?: OCROptions) => Promise<OCRResult>;
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
    extractionType: OCRExtractionType,
    options?: OCROptions
  ): Promise<OCRResult> => {
    setExtracting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ocr-extract', {
        body: {
          image_base64: base64,
          extraction_type: extractionType,
          expected_amount: options?.expected_amount,
          expected_account_number: options?.expected_account_number,
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
    extractionType: OCRExtractionType,
    options?: OCROptions
  ): Promise<OCRResult> => {
    try {
      const base64 = await fileToBase64(imageFile);
      return extractFromBase64(base64, extractionType, options);
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
