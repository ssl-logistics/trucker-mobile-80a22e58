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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="items-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <AlertDialogTitle className="text-center">
            ยืนยันการรับงาน
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-1">
            <div>
              <strong>รหัสออเดอร์ :</strong> {job?.order_code}
            </div>
            <div>
              <strong>ผู้จ้าง :</strong> {job?.employer_name}
            </div>
            <div className="pt-2 text-xs">
              หากคุณต้องการรับรถงานที่ "ยืนยัน"
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="flex-1 m-0">ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="flex-1 m-0">
            ยืนยัน
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
