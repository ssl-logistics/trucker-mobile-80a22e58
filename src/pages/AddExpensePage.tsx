import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/hooks/useAuth";

interface ExpenseItem {
  id: string;
  type: string;
  amount: string;
  receiptPhoto: File | null;
  receiptPreview: string | null;
}

const expenseTypes = [
  { value: "toll", label: "ค่าทางด่วน" },
  { value: "port", label: "ค่าเข้าท่าเรือ" },
  { value: "parking", label: "ค่าที่จอด" },
];

const AddExpensePage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: "1", type: "", amount: "", receiptPhoto: null, receiptPreview: null },
  ]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddExpense = () => {
    const newExpense: ExpenseItem = {
      id: String(expenses.length + 1),
      type: "",
      amount: "",
      receiptPhoto: null,
      receiptPreview: null,
    };
    setExpenses([...expenses, newExpense]);
  };

  const handleExpenseChange = (id: string, field: keyof ExpenseItem, value: any) => {
    setExpenses(expenses.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ));
  };

  const handlePhotoSelect = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExpenses(expenses.map(exp => 
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
    for (const expense of expenses) {
      if (!expense.type || !expense.amount || !expense.receiptPhoto) {
        toast({
          title: "กรุณากรอกข้อมูลให้ครบถ้วน",
          description: "กรุณาเลือกประเภท กรอกราคา และอัพโหลดรูปใบเสร็จ",
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
    if (!user || !jobId) return;
    
    setIsSubmitting(true);
    
    try {
      // Upload receipt photos and save expenses
      for (const expense of expenses) {
        if (!expense.receiptPhoto) continue;
        
        // Upload photo to storage
        const fileExt = expense.receiptPhoto.name.split('.').pop();
        const fileName = `${user.id}/${jobId}_${expense.id}_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(fileName, expense.receiptPhoto);
        
        if (uploadError) {
          throw new Error(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${uploadError.message}`);
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(fileName);
        
        // Save expense to database
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            job_id: jobId,
            driver_id: user.id,
            expense_type: expense.type,
            amount: parseFloat(expense.amount),
            receipt_photo_url: publicUrl
          });
        
        if (insertError) {
          throw new Error(`เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย: ${insertError.message}`);
        }
      }
      
      toast({
        title: "เพิ่มค่าใช้จ่ายสำเร็จ",
        description: `บันทึกค่าใช้จ่ายทั้งหมด ${calculateTotal()} บาท`,
      });
      navigate(`/job/${jobId}/route-expenses`, { replace: true });
    } catch (error) {
      console.error('Error saving expenses:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถบันทึกค่าใช้จ่ายได้",
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
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(`/job/${jobId}/route-expenses`);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">เพิ่มค่าใช้จ่าย</h1>
        </div>
      </header>

      {/* Form */}
      <div className="px-4 py-4 space-y-6">
        {expenses.map((expense, index) => (
          <div key={expense.id} className="space-y-4">
            <h3 className="font-medium">ค่าใช้จ่าย {index + 1}</h3>

            {/* Expense Type */}
            <div className="space-y-2">
              <Label htmlFor={`type-${expense.id}`}>
                ประเภทค่าใช้จ่าย <span className="text-red-500">*</span>
              </Label>
              <Select
                value={expense.type}
                onValueChange={(value) => handleExpenseChange(expense.id, "type", value)}
              >
                <SelectTrigger id={`type-${expense.id}`}>
                  <SelectValue placeholder="ประเภทค่าใช้จ่าย" />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor={`amount-${expense.id}`}>
                ราคา <span className="text-red-500">*</span>
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
                อัพโหลดรูปใบเสร็จ <span className="text-red-500">*</span>
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
                      <p className="text-sm">กดเพื่อถ่ายหรือเลือก</p>
                      <p className="text-xs">รูปภาพใบเสร็จ</p>
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
          เพิ่มค่าใช้จ่าย
        </Button>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
        >
          เพิ่มค่าใช้จ่าย
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <AlertDialogTitle className="text-center">
              ยืนยันการเพิ่มค่าใช้จ่าย
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <div className="space-y-2">
                <p>ค่าใช้จ่ายทั้งหมด</p>
                <p className="text-2xl font-bold text-green-600">
                  {calculateTotal()} บาท
                </p>
                <p className="text-xs text-muted-foreground">
                  กรุณาตรวจสอบรายละเอียดและเอียดก่อนดำเนินการ
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="flex-1 m-0">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 m-0"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddExpensePage;
