import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExpenseItem {
  id: string;
  type: string | undefined;
  customType: string;
  amount: string;
  receiptPhoto: File | null;
  receiptPreview: string | null;
}

const AddExpensePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const returnPath = location.state?.returnPath || `/job/${jobId}/route-expenses`;
  
  const expenseTypes = [
    { value: "toll", label: t('expense.tollFee') },
    { value: "port", label: t('expense.portFee') },
    { value: "parking", label: t('expense.parkingFee') },
    { value: "other", label: t('expense.other') },
  ];
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: "1", type: undefined, customType: "", amount: "", receiptPhoto: null, receiptPreview: null },
  ]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddExpense = () => {
    const newExpense: ExpenseItem = {
      id: String(Date.now()),
      type: undefined,
      customType: "",
      amount: "",
      receiptPhoto: null,
      receiptPreview: null,
    };
    setExpenses([...expenses, newExpense]);
  };

  const handleRemoveExpense = (id: string) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter(exp => exp.id !== id));
    }
  };

  const handleExpenseChange = (id: string, field: keyof ExpenseItem, value: any) => {
    setExpenses(prev => prev.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ));
  };

  const handlePhotoSelect = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExpenses(prev => prev.map(exp => 
          exp.id === id 
            ? { ...exp, receiptPhoto: file, receiptPreview: reader.result as string } 
            : exp
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateTotal = () => {
    return expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  };

  const validateForm = () => {
    console.log('Validating expenses:', expenses);
    for (const expense of expenses) {
      console.log('Checking expense:', { 
        id: expense.id, 
        type: expense.type, 
        amount: expense.amount, 
        hasPhoto: !!expense.receiptPhoto 
      });
      if (!expense.type || !expense.amount || !expense.receiptPhoto) {
        console.log('Validation failed - missing:', {
          missingType: !expense.type,
          missingAmount: !expense.amount,
          missingPhoto: !expense.receiptPhoto
        });
        toast({
          title: t('expense.fillAllFields'),
          description: t('expense.fillAllFieldsDesc'),
          variant: "destructive",
        });
        return false;
      }
      // Validate custom type if "other" is selected
      if (expense.type === "other" && !expense.customType.trim()) {
        toast({
          title: t('expense.fillAllFields'),
          description: t('expense.enterCustomType'),
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (!user || !jobId) {
      console.log('Missing user or jobId:', { user, jobId });
      return;
    }
    
    console.log('Starting expense submission...');
    setIsSubmitting(true);
    
    try {
      // Upload receipt photos and save expenses
      for (const expense of expenses) {
        if (!expense.receiptPhoto) continue;
        
        console.log('Processing expense:', expense.id, expense.type);
        
        // Upload photo to storage
        const fileExt = expense.receiptPhoto.name.split('.').pop();
        const fileName = `${user.id}/${jobId}_${expense.id}_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(fileName, expense.receiptPhoto);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`${t('expense.uploadError')}: ${uploadError.message}`);
        }
        
        console.log('Upload success:', uploadData);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(fileName);
        
        console.log('Public URL:', publicUrl);
        
        // Save expense to database
        // Use custom type if "other" is selected
        const expenseType = expense.type === "other" ? expense.customType : expense.type;
        
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            job_id: jobId,
            driver_id: user.id,
            expense_type: expenseType,
            amount: parseFloat(expense.amount),
            receipt_photo_url: publicUrl
          });
        
        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(`${t('expense.saveError')}: ${insertError.message}`);
        }
        
        console.log('Expense saved successfully');
      }
      
      console.log('All expenses saved successfully');
      
      toast({
        title: t('expense.success'),
        description: `${t('expense.successDesc')} ${calculateTotal()} ${t('expense.baht')}`,
      });
      
      console.log('About to navigate back...');
      
      // Navigate back to the page we came from
      setTimeout(() => {
        navigate(returnPath);
        console.log('Navigate called');
      }, 100);
      
      console.log('Navigate called');
    } catch (error) {
      console.error('Error saving expenses:', error);
      toast({
        title: t('expense.error'),
        description: error instanceof Error ? error.message : t('expense.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log('Submission complete');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(returnPath)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t('expense.title')}</h1>
        </div>
      </header>

      {/* Form */}
      <div className="px-4 py-4 space-y-6">
        {expenses.map((expense, index) => (
          <div key={expense.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{t('expense.expense')} {index + 1}</h3>
              {expenses.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(expense.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  aria-label={t('expense.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Expense Type - Select */}
            <div className="space-y-2">
              <Label>
                {t('expense.type')} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={expense.type}
                onValueChange={(value) => {
                  handleExpenseChange(expense.id, "type", value);
                  if (value !== "other") {
                    handleExpenseChange(expense.id, "customType", "");
                  }
                }}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder={t('expense.selectType')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50" position="popper" sideOffset={4}>
                  {expenseTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Type Input - shown when "other" is selected */}
            {expense.type === "other" && (
              <div className="space-y-2">
                <Label htmlFor={`custom-type-${expense.id}`}>
                  {t('expense.customTypeName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`custom-type-${expense.id}`}
                  type="text"
                  placeholder={t('expense.customTypePlaceholder')}
                  value={expense.customType}
                  onChange={(e) => handleExpenseChange(expense.id, "customType", e.target.value)}
                />
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor={`amount-${expense.id}`}>
                {t('expense.price')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id={`amount-${expense.id}`}
                type="number"
                placeholder="0"
                value={expense.amount}
                onChange={(e) => handleExpenseChange(expense.id, "amount", e.target.value)}
              />
            </div>

            {/* Receipt Photo */}
            <div className="space-y-2">
              <Label>
                {t('expense.uploadReceipt')} <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePhotoSelect(expense.id, e)}
                  className="hidden"
                  id={`photo-${expense.id}`}
                />
                <label
                  htmlFor={`photo-${expense.id}`}
                  className="block cursor-pointer"
                >
                  {expense.receiptPreview ? (
                    <div className="relative rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                      <img
                        src={expense.receiptPreview}
                        alt="Receipt preview"
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-md">
                        <Pencil className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 transition-colors">
                      <Camera className="w-8 h-8 mb-2" />
                      <p className="text-sm">{t('expense.clickToTake')}</p>
                      <p className="text-xs">{t('expense.receiptPhoto')}</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {index < expenses.length - 1 && (
              <div className="border-b border-gray-200 my-6" />
            )}
          </div>
        ))}

        {/* Add More Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAddExpense}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('expense.addMore')}
        </Button>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
        >
          {t('expense.submitButton')}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[280px] rounded-2xl p-6">
          <AlertDialogHeader className="space-y-3">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-[#0A8778] rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <AlertDialogTitle className="text-center text-base font-semibold text-gray-800">
              {t('expense.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-1">
                <p className="text-sm text-gray-600">{t('expense.totalAmount')}</p>
                <p className="text-2xl font-bold text-[#0A8778]">
                  {calculateTotal()} {t('expense.baht')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('expense.checkDetails')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-8 mt-4 sm:justify-center">
            <AlertDialogCancel className="p-0 m-0 h-auto bg-transparent border-0 hover:bg-transparent text-gray-500 font-medium text-sm">
              {t('expense.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="p-0 m-0 h-auto bg-transparent border-0 hover:bg-transparent text-[#153860] font-semibold text-sm underline"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('expense.saving') : t('expense.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddExpensePage;
