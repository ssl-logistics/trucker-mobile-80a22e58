import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, Image, Pencil, Plus, Trash2, Scan, Loader2, X, Check, ChevronDown } from "lucide-react";
import confirmSuccessIcon from "@/assets/confirm-success-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOCR } from "@/hooks/useOCR";
import { addExpense } from "@/lib/externalApi";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface ExpenseLineItem {
  description: string;
  amount: number;
}

interface OCRDetailedResult {
  grand_total?: number | null;
  total?: number | null;
  subtotal?: number | null;
  vat?: number | null;
  line_items?: ExpenseLineItem[];
  container_number?: string | null;
  receipt_number?: string | null;
  receipt_date?: string | null;
}

interface ReceiptPhoto {
  id: string;
  file: File;
  preview: string;
  ocrAmount: number | null;
  ocrDetailed: OCRDetailedResult | null;
  ocrExtracting: boolean;
}

interface ExpenseItem {
  id: string;
  type: string | undefined;
  customType: string;
  amount: string;
  receiptPhotos: ReceiptPhoto[];
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
  
  // English names for API submission
  const expenseTypeEnglishMap: Record<string, string> = {
    fuel: "Fuel",
    fuel_drop: "Fuel Drop",
    transport_fee: "Transport Fee",
    labor: "Labor",
    loading: "Loading",
    drop_empty_container: "Drop Empty Container",
    drop_loaded_container: "Drop Loaded Container",
    pickup_container: "Pickup Container",
    wash_container: "Wash Container",
    return_container: "Return Container",
    repair_container: "Repair Container",
    port_fee: "Port Fee",
    overtime: "Overtime",
    toll: "Toll Fee",
    parking: "Parking Fee",
    misc_no_receipt: "Misc (No Receipt)",
    dive_knock_out: "Diving / Knock-out Fee",
    waste: "Waste Fee",
    other: "Other",
  };

  // Detect job type from location.state (passed by caller) — bl_no => BL, booking_no => Booking
  const stateJob: any = location.state?.jobData || location.state?.job || null;
  const [jobKind, setJobKind] = useState<'bl' | 'booking' | 'other'>(() => {
    if (stateJob?.bl_no) return 'bl';
    if (stateJob?.booking_no || stateJob?.booking_number) return 'booking';
    return 'other';
  });

  // Fallback: fetch job to determine BL/Booking when not provided in state
  useEffect(() => {
    if (jobKind !== 'other' || !user || !jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ getFreelanceAcceptedJobs, getDriverAssignedJobs }, { data: roleData }] = await Promise.all([
          import('@/lib/externalApi'),
          supabase.from('user_roles').select('role').eq('user_id', user.id).single(),
        ]);
        const isFreelance = roleData?.role === 'freelance';
        const driverType = isFreelance ? 'external' : 'internal';
        const { data } = isFreelance
          ? await getFreelanceAcceptedJobs(user.id)
          : await getDriverAssignedJobs(user.id, driverType as 'internal' | 'external');
        const jobs = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];
        const matched = jobs.find((j: any) =>
          j.id === jobId || j.order_number === jobId || j.order_code === jobId
        );
        if (!cancelled && matched) {
          if (matched.bl_no) setJobKind('bl');
          else if (matched.booking_no || matched.booking_number) setJobKind('booking');
        }
      } catch (e) {
        console.warn('Could not detect job kind for expense filter:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, jobId, jobKind]);

  const allExpenseTypes = [
    { value: "fuel", label: t('expense.fuel') },
    { value: "fuel_drop", label: t('expense.fuelDrop') },
    { value: "dive_knock_out", label: t('expense.diveKnockOut') },
    { value: "waste", label: t('expense.waste') },
    { value: "transport_fee", label: t('expense.transportFee') },
    { value: "labor", label: t('expense.labor') },
    { value: "toll", label: t('expense.tollFee') },
    { value: "parking", label: t('expense.parkingFee') },
    { value: "loading", label: t('expense.loading') },
    { value: "drop_empty_container", label: t('expense.dropEmpty') },
    { value: "drop_loaded_container", label: t('expense.dropLoaded') },
    { value: "pickup_container", label: t('expense.pickupContainer') },
    { value: "wash_container", label: t('expense.washContainer') },
    { value: "return_container", label: t('expense.returnContainer') },
    { value: "repair_container", label: t('expense.repairContainer') },
    { value: "port_fee", label: t('expense.portFee') },
    { value: "overtime", label: t('expense.overtime') },
    { value: "misc_no_receipt", label: t('expense.miscNoReceipt') },
    { value: "other", label: t('expense.other') },
  ];

  // Filter dropdown by job kind
  const blAllowed = ["fuel", "dive_knock_out", "return_container", "repair_container", "waste", "port_fee", "misc_no_receipt", "other"];
  const bookingAllowed = ["fuel", "pickup_container", "port_fee", "misc_no_receipt", "other"];
  const orderByList = (list: string[]) =>
    list
      .map(v => allExpenseTypes.find(opt => opt.value === v))
      .filter((o): o is { value: string; label: string } => Boolean(o));
  const expenseTypes = jobKind === 'bl'
    ? orderByList(blAllowed)
    : jobKind === 'booking'
      ? orderByList(bookingAllowed)
      : allExpenseTypes;
  
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: "1", type: undefined, customType: "", amount: "", receiptPhotos: [], showOCRDetails: false },
  ]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOCRFields, setEditingOCRFields] = useState<Set<string>>(new Set());
  const [photoDrawerOpen, setPhotoDrawerOpen] = useState(false);
  const [currentExpenseIdForPhoto, setCurrentExpenseIdForPhoto] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  const handleAddExpense = () => {
    const newExpense: ExpenseItem = {
      id: String(Date.now()),
      type: undefined,
      customType: "",
      amount: "",
      receiptPhotos: [],
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

  const handlePhotoSelect = async (expenseId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processPhotoFile(expenseId, file);
    }
  };

  const processPhotoFile = async (expenseId: string, file: File) => {
    const photoId = String(Date.now());

    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: ReceiptPhoto = {
        id: photoId,
        file,
        preview: reader.result as string,
        ocrAmount: null,
        ocrDetailed: null,
        ocrExtracting: true,
      };

      setExpenses((prev) =>
        prev.map((exp) =>
          exp.id === expenseId
            ? { ...exp, receiptPhotos: [...exp.receiptPhotos, newPhoto] }
            : exp
        )
      );
    };
    reader.readAsDataURL(file);

    // Run OCR extraction
    const result = await extractFromImage(file, 'expense_detailed');

    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.id === expenseId) {
          const updatedPhotos = exp.receiptPhotos.map((photo) => {
            if (photo.id === photoId) {
              if (result.success && result.data) {
                const detailedData = result.data as OCRDetailedResult;
                // Prioritize: grand_total > total > subtotal
                const bestTotal =
                  detailedData.grand_total ??
                  detailedData.total ??
                  detailedData.subtotal ??
                  null;

                if (bestTotal) {
                  toast({
                    title: 'OCR สำเร็จ',
                    description: `พบยอด: ${bestTotal.toLocaleString()} บาท`,
                  });
                }

                return {
                  ...photo,
                  ocrExtracting: false,
                  ocrAmount: bestTotal,
                  ocrDetailed: detailedData,
                };
              }
              return { ...photo, ocrExtracting: false };
            }
            return photo;
          });

          // Auto-calculate total from all OCR amounts
          const totalOCR = updatedPhotos.reduce(
            (sum, p) => sum + (p.ocrAmount || 0),
            0
          );

          return {
            ...exp,
            receiptPhotos: updatedPhotos,
            amount: totalOCR > 0 ? String(totalOCR) : exp.amount,
            showOCRDetails: true,
          };
        }
        return exp;
      })
    );
  };

  const handleRemovePhoto = (expenseId: string, photoId: string) => {
    setExpenses(prev => prev.map(exp => {
      if (exp.id === expenseId) {
        const updatedPhotos = exp.receiptPhotos.filter(p => p.id !== photoId);
        const totalOCR = updatedPhotos.reduce((sum, p) => sum + (p.ocrAmount || 0), 0);
        return { 
          ...exp, 
          receiptPhotos: updatedPhotos,
          amount: totalOCR > 0 ? String(totalOCR) : (updatedPhotos.length === 0 ? "" : exp.amount),
        };
      }
      return exp;
    }));
  };

  const calculateTotal = () => {
    return expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  };

  const getTotalOCRAmount = (expense: ExpenseItem) => {
    return expense.receiptPhotos.reduce((sum, p) => {
      // Prioritize grand_total > total > line_items sum > ocrAmount
      if (p.ocrDetailed?.grand_total) {
        return sum + p.ocrDetailed.grand_total;
      }
      if (p.ocrDetailed?.total) {
        return sum + p.ocrDetailed.total;
      }
      if (p.ocrDetailed?.line_items && p.ocrDetailed.line_items.length > 0) {
        const lineItemsTotal = p.ocrDetailed.line_items.reduce((itemSum, item) => itemSum + (item.amount || 0), 0);
        return sum + lineItemsTotal;
      }
      return sum + (p.ocrAmount || 0);
    }, 0);
  };

  const isAnyPhotoExtracting = (expense: ExpenseItem) => {
    return expense.receiptPhotos.some(p => p.ocrExtracting);
  };

  const validateForm = () => {
    for (const expense of expenses) {
      if (!expense.type || !expense.amount) {
        toast({
          title: t('expense.fillAllFields'),
          description: t('expense.fillAllFieldsDesc'),
          variant: "destructive",
        });
        return false;
      }
      if ((expense.type === "other" || expense.type === "misc_no_receipt") && !expense.customType.trim()) {
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
    if (!user || !jobId) return;
    
    setIsSubmitting(true);
    
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      const driverType = roleData?.role === 'freelance' ? 'external' : 'internal';
      
      // Fetch job to get the correct order_number
      let orderNumber = jobId;
      try {
        const { data: jobData, error: jobError } = await (async () => {
          if (roleData?.role === 'freelance') {
            const { data, error } = await (await import('@/lib/externalApi')).getFreelanceAcceptedJobs(user.id);
            return { data, error };
          } else {
            const { data, error } = await (await import('@/lib/externalApi')).getDriverAssignedJobs(user.id, driverType as 'internal' | 'external');
            return { data, error };
          }
        })();
        
        if (!jobError && jobData?.data) {
          const jobs = Array.isArray(jobData.data) ? jobData.data : [jobData.data];
          const matchedJob = jobs.find((job: any) => 
            job.id === jobId || 
            job.order_number === jobId || 
            job.order_code === jobId
          );
          if (matchedJob?.order_number) {
            orderNumber = matchedJob.order_number;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch job order_number, using jobId as fallback:', err);
      }
      
      for (const expense of expenses) {
        // Upload all photos and collect URLs, and build OCR data
        const photoUrls: string[] = [];
        const ocrReceipts: Array<{
          receipt_number: string | null;
          container_number: string | null;
          total: number;
          line_items: Array<{ description: string; amount: number }>;
        }> = [];
        
        for (const photo of expense.receiptPhotos) {
          const fileExt = photo.file.name.split('.').pop();
          const fileName = `${user.id}/${jobId}_${expense.id}_${photo.id}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('expense-receipts')
            .upload(fileName, photo.file);
          
          if (uploadError) {
            throw new Error(`${t('expense.uploadError')}: ${uploadError.message}`);
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from('expense-receipts')
            .getPublicUrl(fileName);
          
          photoUrls.push(publicUrl);
          
          // Collect OCR data for this receipt
          if (photo.ocrAmount || photo.ocrDetailed) {
            ocrReceipts.push({
              receipt_number: photo.ocrDetailed?.receipt_number || null,
              container_number: photo.ocrDetailed?.container_number || null,
              total: photo.ocrAmount || 0,
              line_items: photo.ocrDetailed?.line_items || [],
            });
          }
        }
        
        // Send English expense type to API
        let expenseType: string;
        if (expense.type === "other") {
          expenseType = expense.customType;
        } else if (expense.type === "misc_no_receipt") {
          const base = expenseTypeEnglishMap["misc_no_receipt"];
          expenseType = expense.customType.trim()
            ? `${base} (${expense.customType.trim()})`
            : base;
        } else {
          expenseType = expenseTypeEnglishMap[expense.type || ""] || expense.type;
        }
        const totalOCRAmount = getTotalOCRAmount(expense);
        
        // Build ocr_data object
        const ocrData = ocrReceipts.length > 0 ? {
          total_amount: totalOCRAmount,
          receipts: ocrReceipts,
        } : null;
        
        // Send expense to external API with OCR data
        const { data: expenseData, error: expenseError } = await addExpense({
          order_number: orderNumber,
          driver_id: user.id,
          driver_type: driverType,
          expense_type: expenseType,
          amount: parseFloat(expense.amount),
          receipt_photo_url: photoUrls[0] || '',
          receipt_photo_urls: photoUrls.length > 0 ? photoUrls : undefined,
          notes: photoUrls.length > 1 ? `มี ${photoUrls.length} ใบเสร็จ` : '',
          ocr_data: ocrData,
        });
        
        if (expenseError) {
          throw new Error(`${t('expense.saveError')}: ${expenseError}`);
        }
      }
      
      toast({
        title: t('expense.success'),
        description: `${t('expense.successDesc')} ${calculateTotal()} ${t('expense.baht')}`,
      });
      
      // Reset form to allow adding more expenses
      setExpenses([{
        id: crypto.randomUUID(),
        type: '',
        customType: '',
        amount: '',
        receiptPhotos: [],
        showOCRDetails: false,
      }]);
      setShowConfirmDialog(false);
      
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
    <div className="min-h-screen bg-muted pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-background border-b">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-full transition-colors"
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
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                  aria-label={t('expense.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Expense Type - Select */}
            <div className="space-y-2">
              <Label>
                {t('expense.type')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={expense.type}
                onValueChange={(value) => {
                  handleExpenseChange(expense.id, "type", value);
                  if (value !== "other" && value !== "misc_no_receipt") {
                    handleExpenseChange(expense.id, "customType", "");
                  }
                }}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder={t('expense.selectType')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50" position="popper" sideOffset={4}>
                  {expenseTypes.map((type, idx) => (
                    <div key={type.value}>
                      <SelectItem value={type.value} className="cursor-pointer">
                        {type.label}
                      </SelectItem>
                      {idx < expenseTypes.length - 1 && <SelectSeparator />}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Type Input */}
            {(expense.type === "other" || expense.type === "misc_no_receipt") && (
              <div className="space-y-2">
                <Label htmlFor={`custom-type-${expense.id}`}>
                  {t('expense.customTypeName')} <span className="text-destructive">*</span>
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

            {/* Receipt Photos - Multiple - hidden for misc_no_receipt */}
            {expense.type !== "misc_no_receipt" && (
            <div className="space-y-2">
              <Label>
                {t('expense.uploadReceipt')} <span className="text-destructive">*</span>
                {expense.receiptPhotos.length > 0 && (
                  <span className="ml-2 text-muted-foreground text-sm">
                    ({expense.receiptPhotos.length} รูป)
                  </span>
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                หาก OCR อ่านผิด สามารถแนบรูปใหม่หรือแก้ไขข้อมูลได้
              </p>
              
              {/* Photo Grid */}
              <div className="grid grid-cols-2 gap-3">
                {expense.receiptPhotos.map((photo) => (
                  <div key={photo.id} className="relative rounded-lg overflow-hidden border border-border">
                    <img
                      src={photo.preview}
                      alt="Receipt"
                      className="w-full h-32 object-cover"
                    />
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(expense.id, photo.id)}
                      className="absolute top-1 right-1 bg-background/90 rounded-full p-1 shadow-md"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {/* OCR Status */}
                    {photo.ocrExtracting && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                    {/* OCR Amount Badge */}
                    {photo.ocrAmount && !photo.ocrExtracting && (
                      <div className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                        ฿{photo.ocrAmount.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Add Photo Button */}
                <div className="relative">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept={ACCEPT_IMAGE_DOC}
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (currentExpenseIdForPhoto) handlePhotoSelect(currentExpenseIdForPhoto, e);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept={ACCEPT_IMAGE_DOC}
                    className="hidden"
                    onChange={(e) => {
                      if (currentExpenseIdForPhoto) handlePhotoSelect(currentExpenseIdForPhoto, e);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentExpenseIdForPhoto(expense.id);
                      setPhotoDrawerOpen(true);
                    }}
                    className="block cursor-pointer h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-muted-foreground/50 transition-colors w-full"
                  >
                    <Camera className="w-6 h-6 mb-1" />
                    <p className="text-xs">
                      {expense.receiptPhotos.length === 0 ? t('expense.clickToTake') : 'เพิ่มรูป'}
                    </p>
                  </button>
                </div>
              </div>
              
              {/* OCR Extracting Status */}
              {isAnyPhotoExtracting(expense) && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-700">กำลังอ่านข้อมูลจากใบเสร็จ...</span>
                </div>
              )}
              
              {/* OCR Summary */}
              {expense.receiptPhotos.length > 0 && !isAnyPhotoExtracting(expense) && getTotalOCRAmount(expense) > 0 && expense.showOCRDetails && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-1">
                      <Scan className="w-4 h-4" />
                      รวมยอด OCR จาก {expense.receiptPhotos.filter(p => p.ocrAmount).length} ใบเสร็จ:
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
                  
                  {/* Individual receipts with line items */}
                  <div className="space-y-3">
                    {expense.receiptPhotos.filter(p => p.ocrAmount).map((photo, idx) => (
                      <div key={photo.id} className="bg-white/50 rounded p-2 space-y-1.5">
                        <div className="flex justify-between text-xs font-medium border-b border-green-200 pb-1">
                          <span className="text-green-800">ใบเสร็จ {idx + 1}</span>
                          <span className="text-green-900">฿{photo.ocrAmount?.toLocaleString()}</span>
                        </div>
                        
                         {/* Line items from this receipt - editable inline */}
                         {photo.ocrDetailed?.line_items && photo.ocrDetailed.line_items.length > 0 && (
                           <div className="space-y-1 pl-2">
                             {photo.ocrDetailed.line_items.map((item, itemIdx) => (
                               <div key={itemIdx} className="flex items-center text-xs gap-1">
                                 <span className="text-green-700">•</span>
                                 <input
                                   type="text"
                                   value={item.description}
                                   onChange={(e) => {
                                     const updatedPhotos = expense.receiptPhotos.map((p) => {
                                       if (p.id === photo.id && p.ocrDetailed?.line_items) {
                                         const newItems = [...p.ocrDetailed.line_items];
                                         newItems[itemIdx] = { ...item, description: e.target.value };
                                         return { ...p, ocrDetailed: { ...p.ocrDetailed, line_items: newItems } };
                                       }
                                       return p;
                                     });
                                     handleExpenseChange(expense.id, 'receiptPhotos', updatedPhotos);
                                   }}
                                   className="flex-1 px-1 py-0.5 bg-transparent border-b border-transparent hover:border-green-300 focus:border-green-500 focus:outline-none text-xs text-green-700 min-w-0"
                                 />
                                 <span className="text-green-800">฿</span>
                                 <input
                                   type="number"
                                   value={item.amount}
                                   onChange={(e) => {
                                     const updatedPhotos = expense.receiptPhotos.map((p) => {
                                       if (p.id === photo.id && p.ocrDetailed?.line_items) {
                                         const newItems = [...p.ocrDetailed.line_items];
                                         newItems[itemIdx] = { ...item, amount: parseInt(e.target.value) || 0 };
                                         return { ...p, ocrDetailed: { ...p.ocrDetailed, line_items: newItems } };
                                       }
                                       return p;
                                     });
                                     handleExpenseChange(expense.id, 'receiptPhotos', updatedPhotos);
                                   }}
                                   className="w-16 px-1 py-0.5 bg-transparent border-b border-transparent hover:border-green-300 focus:border-green-500 focus:outline-none text-xs text-green-800 text-right"
                                 />
                                 <button
                                   type="button"
                                   onClick={() => {
                                     const updatedPhotos = expense.receiptPhotos.map((p) => {
                                       if (p.id === photo.id && p.ocrDetailed?.line_items) {
                                         return {
                                           ...p,
                                           ocrDetailed: {
                                             ...p.ocrDetailed,
                                             line_items: p.ocrDetailed.line_items.filter((_, i) => i !== itemIdx),
                                             grand_total: (p.ocrDetailed.grand_total || 0) - item.amount,
                                           }
                                         };
                                       }
                                       return p;
                                     });
                                     handleExpenseChange(expense.id, 'receiptPhotos', updatedPhotos);
                                   }}
                                   className="p-0.5 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                                   title="ลบรายการนี้"
                                 >
                                   <Trash2 className="w-3 h-3" />
                                 </button>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                   
                   {/* Total */}
                   <div className="flex justify-between text-sm font-bold pt-2 border-t border-green-200">
                     <span className="text-green-800">ยอดรวมทั้งหมด:</span>
                     <span className="text-green-900">฿{getTotalOCRAmount(expense).toLocaleString()}</span>
                   </div>
                   
                   {/* Apply Button */}
                   <Button
                     type="button"
                     size="sm"
                     className="w-full bg-green-600 hover:bg-green-700 mt-3"
                     onClick={() => {
                       handleExpenseChange(expense.id, 'amount', String(getTotalOCRAmount(expense)));
                       handleExpenseChange(expense.id, 'showOCRDetails', false);
                     }}
                   >
                     ใช้ยอดรวม ฿{getTotalOCRAmount(expense).toLocaleString()}
                   </Button>
                </div>
              )}
              
              {/* Show OCR Button when hidden */}
              {expense.receiptPhotos.length > 0 && !expense.showOCRDetails && !isAnyPhotoExtracting(expense) && getTotalOCRAmount(expense) > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-green-600 border-green-300 hover:bg-green-50 hover:text-foreground"
                  onClick={() => handleExpenseChange(expense.id, 'showOCRDetails', true)}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  ดูข้อมูล OCR (รวม: ฿{getTotalOCRAmount(expense).toLocaleString()})
                </Button>
              )}
            </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`amount-${expense.id}`}>
                {t('expense.price')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`amount-${expense.id}`}
                inputMode="numeric"
                placeholder="0"
                value={expense.amount ? Number(expense.amount).toLocaleString() : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                  handleExpenseChange(expense.id, "amount", raw);
                }}
                className={cn("text-right", getTotalOCRAmount(expense) > 0 ? "border-green-300 ring-1 ring-green-200" : "")}
              />
            </div>

            {index < expenses.length - 1 && (
              <div className="border-b border-border my-6" />
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
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
            <AlertDialogTitle className="text-center text-base font-semibold text-foreground">
              {t('expense.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">{t('expense.totalAmount')}</p>
                <p className="text-2xl font-bold text-primary">
                  {calculateTotal()} {t('expense.baht')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('expense.checkDetails')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-8 mt-4 sm:justify-center">
            <AlertDialogCancel className="p-0 m-0 h-auto bg-transparent border-0 hover:bg-transparent text-muted-foreground font-medium text-sm">
              {t('expense.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="p-0 m-0 h-auto bg-transparent border-0 hover:bg-transparent text-primary font-semibold text-sm underline"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? t('expense.saving') : t('expense.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Source Drawer */}
      <Drawer open={photoDrawerOpen} onOpenChange={setPhotoDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">เพิ่มรูปภาพ</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => {
                if (isNative) {
                  takePhoto().then((file) => {
                    if (file && currentExpenseIdForPhoto) {
                      processPhotoFile(currentExpenseIdForPhoto, file);
                    }
                    setPhotoDrawerOpen(false);
                  });
                } else {
                  cameraInputRef.current?.click();
                  setPhotoDrawerOpen(false);
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-base">ถ่ายรูป</span>
            </button>
            <button
              onClick={() => {
                if (isNative) {
                  selectFromGallery().then((file) => {
                    if (file && currentExpenseIdForPhoto) {
                      processPhotoFile(currentExpenseIdForPhoto, file);
                    }
                    setPhotoDrawerOpen(false);
                  });
                } else {
                  galleryInputRef.current?.click();
                  setPhotoDrawerOpen(false);
                }
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Image className="w-6 h-6" />
              <span className="text-base">เลือกจากแกลเลอรี</span>
            </button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full rounded-xl h-12">
                ยกเลิก
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AddExpensePage;
