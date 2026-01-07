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
    destination_company_name: string | null;
  } | null;
}

export const ConfirmJobDialog = ({ open, onOpenChange, onConfirm, job }: ConfirmJobDialogProps) => {
  const { t } = useLanguage();
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[320px] rounded-2xl p-6">
        <AlertDialogHeader className="items-center space-y-3">
          <div className="w-14 h-14 rounded-xl bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-white" fill="white" strokeWidth={0} />
          </div>
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
          <AlertDialogCancel className="flex-1 m-0 border-0 text-muted-foreground hover:text-foreground hover:bg-transparent">
            {t('confirm.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            className="flex-1 m-0 bg-transparent text-green-600 hover:bg-transparent hover:text-green-700 font-semibold"
          >
            {t('confirm.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
