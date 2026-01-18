import { useState, useEffect } from 'react';
import { Loader2, Scan, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OCRInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ocrValue?: string | null;
  isExtracting?: boolean;
  onApplyOCR?: () => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export function OCRInputField({
  label,
  value,
  onChange,
  ocrValue,
  isExtracting,
  onApplyOCR,
  placeholder,
  required,
  className,
  id,
}: OCRInputFieldProps) {
  const [showOCRHint, setShowOCRHint] = useState(false);

  useEffect(() => {
    if (ocrValue && ocrValue !== value) {
      setShowOCRHint(true);
    } else {
      setShowOCRHint(false);
    }
  }, [ocrValue, value]);

  const handleApplyOCR = () => {
    if (ocrValue) {
      onChange(ocrValue);
      setShowOCRHint(false);
      onApplyOCR?.();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'pr-12',
            showOCRHint && 'border-blue-400 ring-1 ring-blue-200'
          )}
        />
        
        {isExtracting && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        )}
        
        {!isExtracting && showOCRHint && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={handleApplyOCR}
          >
            <Scan className="w-4 h-4 mr-1" />
            ใช้
          </Button>
        )}
      </div>
      
      {showOCRHint && ocrValue && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <Scan className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700">OCR พบ:</p>
            <p className="text-sm font-medium text-blue-900 truncate">{ocrValue}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-blue-600 hover:bg-blue-100"
            onClick={handleApplyOCR}
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface OCRStatusBadgeProps {
  isExtracting: boolean;
  hasResult: boolean;
  error?: string;
}

export function OCRStatusBadge({ isExtracting, hasResult, error }: OCRStatusBadgeProps) {
  if (isExtracting) {
    return (
      <div className="flex items-center gap-2 text-blue-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">กำลังอ่านข้อมูล...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (hasResult) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <Check className="w-4 h-4" />
        <span className="text-sm">อ่านข้อมูลสำเร็จ</span>
      </div>
    );
  }

  return null;
}

interface OCRAmountDisplayProps {
  amount: number | null | undefined;
  isExtracting: boolean;
  onApply: () => void;
  rawText?: string;
}

export function OCRAmountDisplay({ amount, isExtracting, onApply, rawText }: OCRAmountDisplayProps) {
  if (isExtracting) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm text-blue-700">กำลังอ่านจำนวนเงินจากรูป...</span>
      </div>
    );
  }

  if (amount !== null && amount !== undefined) {
    return (
      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-700 flex items-center gap-1">
              <Scan className="w-3 h-3" />
              OCR พบจำนวนเงิน:
            </p>
            <p className="text-lg font-bold text-green-800">
              ฿{amount.toLocaleString()}
            </p>
            {rawText && (
              <p className="text-xs text-green-600 mt-1">"{rawText}"</p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={onApply}
          >
            <Check className="w-4 h-4 mr-1" />
            ใช้ค่านี้
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
