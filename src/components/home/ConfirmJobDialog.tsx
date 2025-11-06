import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConfirmJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  job: {
    order_code: string;
    employer_name: string;
  } | null;
}

export const ConfirmJobDialog = ({ open, onOpenChange, onConfirm, job }: ConfirmJobDialogProps) => {
  const { t } = useLanguage();
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="items-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <AlertDialogTitle className="text-center">
            {t('confirm.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-1">
            <div>
              <strong>{t('confirm.order_code')} :</strong> {job?.order_code}
            </div>
            <div>
              <strong>{t('confirm.employer')} :</strong> {job?.employer_name}
            </div>
            <div className="pt-2 text-xs">
              {t('confirm.message')}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="flex-1 m-0">{t('confirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="flex-1 m-0">
            {t('confirm.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
