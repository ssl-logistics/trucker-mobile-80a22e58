import { Loader2 } from 'lucide-react';
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
import { useLanguage } from '@/contexts/LanguageContext';
import confirmCheckIcon from '@/assets/confirm-check-icon.png';

interface ConfirmJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  job: {
    order_code: string;
    employer_name: string;
    destination_company_name: string | null;
  } | null;
  isLoading?: boolean;
}

export const ConfirmJobDialog = ({ open, onOpenChange, onConfirm, job, isLoading = false }: ConfirmJobDialogProps) => {
  const { t } = useLanguage();
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[320px] rounded-2xl p-6">
        <AlertDialogHeader className="items-center space-y-3">
          <img src={confirmCheckIcon} alt="Confirm" className="w-14 h-14" />
          <AlertDialogTitle className="text-center text-lg font-semibold text-foreground">
            {t('confirm.title')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-center space-y-1 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{t('confirm.order_code')} :</span>{' '}
                <span className="text-green-600 font-semibold">{job?.order_code}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">{t('confirm.employer')} :</span>{' '}
                {job?.destination_company_name || job?.employer_name}
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                {t('confirm.message')}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-4 mt-4 sm:justify-center">
          <AlertDialogCancel 
            className="flex-1 m-0 border-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            disabled={isLoading}
          >
            {t('confirm.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            className="flex-1 m-0 bg-transparent text-green-600 hover:bg-transparent hover:text-green-700 font-semibold disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังดำเนินการ...
              </>
            ) : (
              t('confirm.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
