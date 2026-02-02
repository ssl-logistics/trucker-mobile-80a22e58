import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, Pencil, Plus, Trash2, Scan, Loader2 } from "lucide-react";
import confirmSuccessIcon from "@/assets/confirm-success-icon.png";
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
import { useOCR } from "@/hooks/useOCR";

interface ExpenseLineItem {
  description: string;
  amount: number;
}

interface OCRDetailedResult {
  grand_total?: number | null;
  subtotal?: number | null;
  vat?: number | null;
  line_items?: ExpenseLineItem[];
  container_number?: string | null;
  receipt_number?: string | null;
  receipt_date?: string | null;
}

interface ExpenseItem {
  id: string;
  type: string | undefined;
  customType: string;
  amount: string;
  receiptPhoto: File | null;
  receiptPreview: string | null;
  ocrAmount: number | null;
  ocrRawText: string | null;
  ocrExtracting: boolean;
  ocrDetailed: OCRDetailedResult | null;
  showOCRDetails: boolean;
}

const AddExpensePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { extractFromImage } = useOCR();
  const returnPath = location.state?.returnPath || `/job/${jobId}/route-expenses`;
  
  const expenseTypes = [
    { value: "toll", label: t('expense.tollFee') },
    { value: "port", label: t('expense.portFee') },
    { value: "parking", label: t('expense.parkingFee') },
    { value: "other", label: t('expense.other') },
  ];
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: "1", type: undefined, customType: "", amount: "", receiptPhoto: null, receiptPreview: null, ocrAmount: null, ocrRawText: null, ocrExtracting: false, ocrDetailed: null, showOCRDetails: false },
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
      ocrAmount: null,
      ocrRawText: null,
      ocrExtracting: false,
      ocrDetailed: null,
      showOCRDetails: false,
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

  const handlePhotoSelect = async (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      const receiptPreview = await base64Promise;
      
      // Update current expense with photo and start OCR
      setExpenses(prev => prev.map(exp => 
        exp.id === id 
          ? { ...exp, receiptPhoto: file, receiptPreview, ocrExtracting: true, ocrAmount: null, ocrRawText: null, ocrDetailed: null, showOCRDetails: false } 
          : exp
      ));
      
      // Use expense_detailed for more comprehensive extraction
      const result = await extractFromImage(file, 'expense_detailed');
      
      if (result.success && result.data) {
        const detailedData = result.data as OCRDetailedResult;
        const lineItems = detailedData.line_items || [];
        
        // If OCR found multiple line items, create separate expense fields
        if (lineItems.length > 1) {
          toast({
            title: "OCR สำเร็จ",
            description: `พบ ${lineItems.length} รายการค่าใช้จ่าย`,
          });
          
          setExpenses(prev => {
            const currentIndex = prev.findIndex(exp => exp.id === id);
            if (currentIndex === -1) return prev;
            
            // Create new expenses for each line item (using same receipt)
            const newExpenses: ExpenseItem[] = lineItems.map((item, idx) => ({
              id: idx === 0 ? id : `${id}_${idx}`,
              type: 'port' as string | undefined, // Default to port fee for logistics receipts
              customType: "",
              amount: String(item.amount),
              receiptPhoto: file,
              receiptPreview: receiptPreview,
              ocrAmount: item.amount,
              ocrRawText: item.description,
              ocrExtracting: false,
              ocrDetailed: idx === 0 ? detailedData : null, // Only first item shows full OCR details
              showOCRDetails: idx === 0,
            }));
            
            // Replace current expense with new ones
            return [
              ...prev.slice(0, currentIndex),
              ...newExpenses,
              ...prev.slice(currentIndex + 1)
            ];
          });
        } else {
          // Single item or just total - update normally
          const grandTotal = detailedData.grand_total;
          if (grandTotal) {
            toast({
              title: "OCR สำเร็จ",
              description: `พบยอดรวม: ${grandTotal.toLocaleString()} บาท`,
            });
          }
          
          setExpenses(prev => prev.map(exp => 
            exp.id === id
              ? { 
                  ...exp, 
                  ocrExtracting: false, 
                  ocrAmount: grandTotal || null,
                  ocrDetailed: detailedData,
                  showOCRDetails: true,
                  amount: grandTotal ? String(grandTotal) : exp.amount
                }
              : exp
          ));
        }
      } else {
        // OCR failed - just stop extracting
        setExpenses(prev => prev.map(exp => 
          exp.id === id ? { ...exp, ocrExtracting: false } : exp
        ));
      }
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
    
    console.log('Starting expense submission to external API...');
    setIsSubmitting(true);
    
    try {
      // Get driver type from user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      const driverType = roleData?.role === 'freelance' ? 'external' : 'internal';
      
      for (const expense of expenses) {
        if (!expense.receiptPhoto) continue;
        
        console.log('Processing expense:', expense.id, expense.type);
        
        // Upload photo to storage first to get URL
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
        
        // Use custom type if "other" is selected
        const expenseType = expense.type === "other" ? expense.customType : expense.type;
        
        // Send expense to external API via proxy
        const response = await supabase.functions.invoke('add-expense-proxy', {
          body: {
            order_number: jobId,
            driver_id: user.id,
            driver_type: driverType,
            expense_type: expenseType,
            amount: parseFloat(expense.amount),
            receipt_photo_url: publicUrl,
            notes: ''
          }
        });
        
        if (response.error) {
          console.error('API error:', response.error);
          throw new Error(`${t('expense.saveError')}: ${response.error.message}`);
        }
        
        console.log('Expense sent to external API successfully:', response.data);
      }
      
      console.log('All expenses sent to external API successfully');
      
      toast({
        title: t('expense.success'),
        description: `${t('expense.successDesc')} ${calculateTotal()} ${t('expense.baht')}`,
      });
      
      // Navigate back to the page we came from
      setTimeout(() => {
        navigate(returnPath);
      }, 100);
      
    } catch (error) {
      console.error('Error sending expenses:', error);
      toast({
        title: t('expense.error'),
        description: error instanceof Error ? error.message : t('expense.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
        {expenses.map((expense, index) => {
          // Check if this expense is a child item from OCR split (id contains underscore)
          const isOCRChildItem = expense.id.includes('_');
          
          return (
          <div key={expense.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{t('expense.expense')} {index + 1}</h3>
                {/* Show OCR description if available */}
                {expense.ocrRawText && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    OCR: {expense.ocrRawText}
                  </p>
                )}
              </div>
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

            {/* Receipt Photo - Show smaller for child items */}
            <div className="space-y-2">
              <Label>
                {t('expense.uploadReceipt')} <span className="text-red-500">*</span>
              </Label>
              
              {isOCRChildItem ? (
                // Show smaller thumbnail for child items (from same receipt)
                <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border">
                  {expense.receiptPreview && (
                    <img
                      src={expense.receiptPreview}
                      alt="Receipt"
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground truncate">
                      ใช้ใบเสร็จเดียวกันกับรายการก่อนหน้า
                    </p>
                  </div>
                </div>
              ) : (
                // Normal photo upload for main items
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
              )}
              
              {/* OCR Extracting Status */}
              {expense.ocrExtracting && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-700">กำลังอ่านข้อมูลจากใบเสร็จ...</span>
                </div>
              )}
              
              {/* OCR Detailed Results */}
              {expense.ocrDetailed && expense.showOCRDetails && !expense.ocrExtracting && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-1">
                      <Scan className="w-4 h-4" />
                      ข้อมูลที่ OCR อ่านได้:
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-green-600 hover:text-green-700"
                      onClick={() => handleExpenseChange(expense.id, 'showOCRDetails', false)}
                    >
                      ซ่อน
                    </Button>
                  </div>
                  
                  {/* Receipt Info */}
                  {(expense.ocrDetailed.receipt_number || expense.ocrDetailed.receipt_date) && (
                    <div className="text-xs text-green-700 space-y-0.5">
                      {expense.ocrDetailed.receipt_number && (
                        <p>เลขที่ใบเสร็จ: {expense.ocrDetailed.receipt_number}</p>
                      )}
                      {expense.ocrDetailed.receipt_date && (
                        <p>วันที่: {expense.ocrDetailed.receipt_date}</p>
                      )}
                      {expense.ocrDetailed.container_number && (
                        <p>หมายเลขตู้: {expense.ocrDetailed.container_number}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Line Items */}
                  {expense.ocrDetailed.line_items && expense.ocrDetailed.line_items.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-green-700">รายการ:</p>
                      <div className="space-y-1 bg-white/50 rounded p-2">
                        {expense.ocrDetailed.line_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-green-800 truncate flex-1 mr-2">{item.description}</span>
                            <span className="font-medium text-green-900 whitespace-nowrap">฿{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Subtotal, VAT, Grand Total */}
                  <div className="border-t border-green-200 pt-2 space-y-1">
                    {expense.ocrDetailed.subtotal && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-700">รวมก่อน VAT:</span>
                        <span className="font-medium text-green-800">฿{expense.ocrDetailed.subtotal.toLocaleString()}</span>
                      </div>
                    )}
                    {expense.ocrDetailed.vat && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-700">VAT 7%:</span>
                        <span className="font-medium text-green-800">฿{expense.ocrDetailed.vat.toLocaleString()}</span>
                      </div>
                    )}
                    {expense.ocrDetailed.grand_total && (
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-green-200">
                        <span className="text-green-800">ยอดรวมทั้งสิ้น:</span>
                        <span className="text-green-900">฿{expense.ocrDetailed.grand_total.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Apply Button */}
                  {expense.ocrDetailed.grand_total && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleExpenseChange(expense.id, 'amount', String(expense.ocrDetailed?.grand_total || 0));
                        handleExpenseChange(expense.id, 'showOCRDetails', false);
                      }}
                    >
                      ใช้ยอดรวม ฿{expense.ocrDetailed.grand_total.toLocaleString()}
                    </Button>
                  )}
                </div>
              )}
              
              {/* Show OCR Button when details are hidden */}
              {expense.ocrDetailed && !expense.showOCRDetails && !expense.ocrExtracting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => handleExpenseChange(expense.id, 'showOCRDetails', true)}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  ดูข้อมูล OCR (ยอดรวม: ฿{expense.ocrDetailed.grand_total?.toLocaleString() || '-'})
                </Button>
              )}
            </div>

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
                className={expense.ocrAmount !== null ? "border-green-300 ring-1 ring-green-200" : ""}
              />
            </div>

            {index < expenses.length - 1 && (
              <div className="border-b border-gray-200 my-6" />
            )}
          </div>
        );
        })}

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
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('expense.submitting')}
            </>
          ) : (
            t('expense.submitButton')
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[280px] rounded-2xl p-6">
          <AlertDialogHeader className="space-y-3">
            <div className="flex justify-center">
              <img src={confirmSuccessIcon} alt="Success" className="w-14 h-14" />
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
