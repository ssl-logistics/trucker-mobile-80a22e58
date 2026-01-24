import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';

interface RejectFactoryJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  orderCode: string;
  isLoading?: boolean;
}

export function RejectFactoryJobDialog({
  open,
  onOpenChange,
  onConfirm,
  orderCode,
  isLoading = false,
}: RejectFactoryJobDialogProps) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleCancel = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[90%] rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('home.reject_job_title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('home.reject_job_desc')} <strong>{orderCode}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-2">
          <Textarea
            placeholder={t('home.reject_reason_placeholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <AlertDialogFooter className="flex-row gap-2 sm:space-x-0">
          <AlertDialogCancel 
            onClick={handleCancel} 
            disabled={isLoading}
            className="flex-1 mt-0"
          >
            {t('settings.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? t('common.loading') : t('home.confirm_reject')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
