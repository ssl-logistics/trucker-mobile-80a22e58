import { ACCEPT_IMAGE_DOC } from '@/utils/uploadAccept';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, Coins, Loader2, Plus, ImagePlus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { getExpenses, addExpense, deleteExpense } from '@/lib/externalApi';
import { supabase } from '@/integrations/supabase/client';
import { useNativeCamera } from '@/hooks/useNativeCamera';

interface Expense {
  id: string;
  expense_type: string;
  expense_name?: string;
  amount: number;
  slip_url?: string;
  slip_urls?: string[];
  notes?: string;
  created_at: string;
}

export default function JobExpensesPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNavigatingRef = useRef(false);
  const { user, userType } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingExpenseId, setUploadingExpenseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  // Delete confirmation dialog state
  const [deleteExpenseDialogOpen, setDeleteExpenseDialogOpen] = useState(false);
  const [deletePhotoDialogOpen, setDeletePhotoDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<{ expenseId: string; imgIndex: number } | null>(null);

  useEffect(() => {
    loadExpenses();
  }, [jobId, user]);

  const loadExpenses = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    try {
      // Determine driver_type based on userType
      let driverType = 'internal';
      if (userType === 'freelance_driver') {
        driverType = 'external';
      } else if (userType === 'internal_driver') {
        driverType = 'internal';
      } else if (userType === 'external_driver') {
        driverType = 'external';
      }

      // Call the getExpenses function
      const { data: result, error } = await getExpenses(jobId, user.id, driverType);

      if (error) {
        throw new Error(`API error: ${error}`);
      }

      if (result.success && result.data) {
        // API returns { expenses: [...], total, count } or direct array
        const expenseArray = result.data.expenses || result.data;
        
        if (Array.isArray(expenseArray)) {
          // Map API response to our Expense interface
          const mappedExpenses: Expense[] = expenseArray.map((exp: any) => ({
            id: exp.id,
            expense_type: exp.expense_type,
            expense_name: exp.expense_name,
            amount: exp.amount,
            slip_url: exp.slip_url,
            slip_urls: exp.slip_urls || (exp.slip_url ? [exp.slip_url] : []),
            notes: exp.notes,
            created_at: exp.created_at,
          }));

          // Some API "update receipt" calls return a new row instead of updating the old one.
          // Normalize these revision rows so totals don't get duplicated in UI.
          const mutationNoteRegex = /(อัพเดทรูปใบเสร็จ|ลบรูปใบเสร็จ)/;
          const groupedBySignature = mappedExpenses.reduce((acc, exp) => {
            const signature = `${exp.expense_type}|${Number(exp.amount)}|${exp.expense_name || ''}`;
            if (!acc[signature]) acc[signature] = [];
            acc[signature].push(exp);
            return acc;
          }, {} as Record<string, Expense[]>);

          const normalizedExpenses = Object.values(groupedBySignature).flatMap((group) => {
            const mutationRows = group.filter((exp) => mutationNoteRegex.test(exp.notes || ''));
            if (mutationRows.length === 0) return group;

            const latestMutation = [...mutationRows].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            const nonMutationRows = group
              .filter((exp) => exp.id !== latestMutation.id && !mutationNoteRegex.test(exp.notes || ''))
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // If latest mutation has no receipt (delete-all case), remove only the most recent predecessor row.
            if ((latestMutation.slip_urls?.length || 0) === 0) {
              return [latestMutation, ...nonMutationRows.slice(1)];
            }

            const latestUrls = new Set(latestMutation.slip_urls || []);
            const keepUnrelatedRows = nonMutationRows.filter((exp) => {
              const urls = exp.slip_urls || [];
              return !urls.some((url) => latestUrls.has(url));
            });

            return [latestMutation, ...keepUnrelatedRows];
          });

          setExpenses(
            normalizedExpenses.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          );
        } else {
          setExpenses([]);
        }
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast({
        title: t('expenses.error'),
        description: t('expenses.loadError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!user || !jobId) return;

    setUploadingExpenseId(expenseId);
    try {
      const { error } = await deleteExpense(expenseId);
      if (error) throw new Error(error);

      toast({
        title: t('common.success'),
        description: t('expenses.deleteExpenseSuccess'),
      });

      await loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: t('expenses.error'),
        description: t('expenses.deleteExpenseError'),
        variant: 'destructive',
      });
    } finally {
      setUploadingExpenseId(null);
    }
  };

  const handleDeletePhoto = async (expenseId: string, photoIndex: number) => {
    if (!user || !jobId) return;

    const expense = expenses.find(exp => exp.id === expenseId);
    if (!expense || !expense.slip_urls) return;

    const updatedUrls = expense.slip_urls.filter((_, i) => i !== photoIndex);

    setUploadingExpenseId(expenseId);
    try {
      let driverType: 'internal' | 'external' | 'freelance' = 'internal';
      if (userType === 'freelance_driver') driverType = 'freelance';
      else if (userType === 'external_driver') driverType = 'external';

      const { error } = await addExpense({
        order_number: jobId,
        driver_id: user.id,
        driver_type: driverType,
        expense_type: expense.expense_type,
        amount: expense.amount,
        receipt_photo_url: updatedUrls[0] || '',
        receipt_photo_urls: updatedUrls,
        expense_id: expense.id,
        notes: 'ลบรูปใบเสร็จ',
      });

      if (error) throw new Error(error);

      toast({
        title: t('common.success'),
        description: t('expenses.deletePhotoSuccess'),
      });

      await loadExpenses();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: t('expenses.error'),
        description: t('expenses.deletePhotoError'),
        variant: 'destructive',
      });
    } finally {
      setUploadingExpenseId(null);
    }
  };

  const handleEditPhoto = async (expenseId: string) => {
    if (isNative) {
      setUploadingExpenseId(expenseId);
      try {
        const file = await takePhoto();
        if (file) {
          await uploadReceiptPhoto(expenseId, file);
        } else {
          const galleryFile = await selectFromGallery();
          if (galleryFile) {
            await uploadReceiptPhoto(expenseId, galleryFile);
          }
        }
      } catch (error) {
        console.error('Native camera error:', error);
      } finally {
        setUploadingExpenseId(null);
      }
    } else {
      setEditingExpenseId(expenseId);
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingExpenseId) return;
    
    setUploadingExpenseId(editingExpenseId);
    await uploadReceiptPhoto(editingExpenseId, file);
    setUploadingExpenseId(null);
    setEditingExpenseId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadReceiptPhoto = async (expenseId: string, file: File) => {
    if (!user || !jobId) return;

    try {
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${jobId}_${expenseId}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('expense-receipts')
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;

      // Find the expense to get its details
      const expense = expenses.find(exp => exp.id === expenseId);
      if (!expense) return;

      // Determine driver_type
      let driverType: 'internal' | 'external' | 'freelance' = 'internal';
      if (userType === 'freelance_driver') driverType = 'freelance';
      else if (userType === 'external_driver') driverType = 'external';

      // Collect existing photos and add new one
      const existingUrls = expense.slip_urls || [];
      const allPhotoUrls = [...existingUrls, photoUrl];

      // Submit expense update with expense_id for backend to handle as update
      const { error } = await addExpense({
        order_number: jobId,
        driver_id: user.id,
        driver_type: driverType,
        expense_type: expense.expense_type,
        amount: expense.amount,
        receipt_photo_url: photoUrl,
        receipt_photo_urls: allPhotoUrls,
        expense_id: expense.id,
        notes: 'อัพเดทรูปใบเสร็จ',
      });

      if (error) throw new Error(error);

      toast({
        title: t('common.success'),
        description: t('expenses.uploadPhotoSuccess'),
      });

      await loadExpenses();
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: t('expenses.error'),
        description: t('expenses.uploadPhotoError'),
        variant: 'destructive',
      });
    }
  };

  const getExpenseTypeLabel = (expense: Expense) => {
    const raw = expense.expense_type?.trim() || '';
    const normalizedType = raw.toLowerCase().replace(/\s+/g, '_');
    
    // All code keys → translation key
    const codeToTransKey: Record<string, string> = {
      'fuel': 'expense.fuel',
      'fuel_drop': 'expense.fuelDrop',
      'transport_fee': 'expense.transportFee',
      'labor': 'expense.labor',
      'loading': 'expense.loading',
      'toll': 'expense.tollFee',
      'port': 'expense.portFee',
      'port_fee': 'expense.portFee',
      'parking': 'expense.parkingFee',
      'other': 'expense.other',
      'drop_empty': 'expense.dropEmpty',
      'drop_empty_container': 'expense.dropEmpty',
      'drop_loaded': 'expense.dropLoaded',
      'drop_loaded_container': 'expense.dropLoaded',
      'pickup_container': 'expense.pickupContainer',
      'pickup_empty_container': 'expense.pickupContainer',
      'pickup_loaded_container': 'expense.pickupContainer',
      'wash_container': 'expense.washContainer',
      'container_wash': 'expense.washContainer',
      'return_container': 'expense.returnContainer',
      'repair_container': 'expense.repairContainer',
      'container_repair': 'expense.repairContainer',
      'overtime': 'expense.overtime',
      'misc_no_receipt': 'expense.miscNoReceipt',
      'food': 'expenses.types.food',
      'maintenance': 'expenses.types.maintenance',
    };

    // Reverse map: all known labels (TH/EN/KO/ZH) → translation key
    const labelToTransKey: Record<string, string> = {
      // Thai
      'ค่าน้ำมัน': 'expense.fuel', 'ค่าน้ำมันดรอป': 'expense.fuelDrop',
      'ค่าขนส่ง': 'expense.transportFee', 'ค่าแรงงาน': 'expense.labor',
      'ค่าแรงยกของ': 'expense.loading',
      'ค่าดรอปตู้เปล่า': 'expense.dropEmpty', 'ค่าดรอปตู้หนัก': 'expense.dropLoaded',
      'ค่ารับตู้': 'expense.pickupContainer', 'ค่าล้างตู้': 'expense.washContainer',
      'ค่าคืนตู้': 'expense.returnContainer', 'ค่าซ่อมตู้': 'expense.repairContainer',
      'ค่าผ่านท่า': 'expense.portFee', 'ค่าล่วงเวลา': 'expense.overtime',
      'ค่าทางด่วน': 'expense.tollFee', 'ค่าที่จอด': 'expense.parkingFee',
      'อื่นๆ': 'expense.other', 'ค่าใช้จ่ายไม่มีใบเสร็จ': 'expense.miscNoReceipt',
      // English
      'fuel': 'expense.fuel', 'fuel (drop)': 'expense.fuelDrop',
      'transport fee': 'expense.transportFee', 'labor': 'expense.labor',
      'loading': 'expense.loading',
      'drop empty container': 'expense.dropEmpty', 'drop loaded container': 'expense.dropLoaded',
      'container pickup': 'expense.pickupContainer', 'container wash': 'expense.washContainer',
      'container return': 'expense.returnContainer', 'container repair': 'expense.repairContainer',
      'port fee': 'expense.portFee', 'overtime': 'expense.overtime',
      'toll fee': 'expense.tollFee', 'parking fee': 'expense.parkingFee',
      'other': 'expense.other',
      'misc (no receipt)': 'expense.miscNoReceipt',
      'misc no receipt': 'expense.miscNoReceipt',
      // Korean
      '연료비': 'expense.fuel', '연료비 (드롭)': 'expense.fuelDrop',
      '운송비': 'expense.transportFee', '인건비': 'expense.labor',
      '하역비': 'expense.loading',
      '빈 컨테이너 드롭': 'expense.dropEmpty', '적재 컨테이너 드롭': 'expense.dropLoaded',
      '컨테이너 픽업': 'expense.pickupContainer', '컨테이너 세척': 'expense.washContainer',
      '컨테이너 반납': 'expense.returnContainer', '컨테이너 수리': 'expense.repairContainer',
      '항만 통과료': 'expense.portFee', '초과 근무': 'expense.overtime',
      '통행료': 'expense.tollFee', '주차 요금': 'expense.parkingFee',
      '기타': 'expense.other',
      '기타 (영수증 없음)': 'expense.miscNoReceipt',
      // Chinese
      '油费': 'expense.fuel', '油费（配送）': 'expense.fuelDrop',
      '运输费': 'expense.transportFee', '人工费': 'expense.labor',
      '装卸费': 'expense.loading',
      '空柜配送': 'expense.dropEmpty', '重柜配送': 'expense.dropLoaded',
      '提柜费': 'expense.pickupContainer', '洗柜费': 'expense.washContainer',
      '还柜费': 'expense.returnContainer', '修柜费': 'expense.repairContainer',
      '港口通行费': 'expense.portFee', '加班费': 'expense.overtime',
      '过路费': 'expense.tollFee', '停车费': 'expense.parkingFee',
      '其他': 'expense.other',
      '杂费（无收据）': 'expense.miscNoReceipt',
    };

    // Try code-based match first
    const transKey = codeToTransKey[normalizedType];
    if (transKey) return t(transKey);

    // Match "<base> (<suffix>)" — split on the LAST "(...)" to handle bases with parens like "Misc (No Receipt)"
    if (raw.endsWith(')')) {
      const lastOpen = raw.lastIndexOf('(');
      if (lastOpen > 0) {
        const basePart = raw.slice(0, lastOpen).trim();
        const suffix = raw.slice(lastOpen + 1, -1).trim();
        const baseNorm = basePart.toLowerCase().replace(/\s+/g, '_');
        const baseKey =
          codeToTransKey[baseNorm] ||
          labelToTransKey[basePart] ||
          labelToTransKey[basePart.toLowerCase()];
        if (baseKey && suffix) return `${t(baseKey)} (${suffix})`;
      }
    }

    // Try label-based match (API may return localized text)
    const labelKey = labelToTransKey[raw] || labelToTransKey[raw.toLowerCase()];
    if (labelKey) return t(labelKey);

    return expense.expense_name || expense.expense_type;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-center relative">
          <button 
            onClick={() => {
              if (isNavigatingRef.current) return;
              isNavigatingRef.current = true;
              // If there's history, go back; otherwise navigate to a sensible default
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(`/job/${encodeURIComponent(jobId)}`, { replace: true });
              }
            }} 
            className="absolute left-0 p-1 hover:bg-white/10 rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('expenses.title')}</h1>
        </div>
      </header>

      <div className="px-4 pt-6 space-y-6">
        {/* Total Summary Card */}
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <Coins className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-primary">
              ฿ {totalExpenses.toLocaleString()}
            </span>
          </div>
        </Card>

        {/* Expense List */}
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('expenses.noData')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {expenses.map((expense) => (
              <div key={expense.id} className="space-y-2">
                {/* Expense Type Label with Delete */}
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium text-foreground">
                    {getExpenseTypeLabel(expense)} : ฿ {Number(expense.amount).toLocaleString()}
                  </div>
                  <button
                    className="p-1.5 rounded-full text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    onClick={() => {
                      setExpenseToDelete(expense.id);
                      setDeleteExpenseDialogOpen(true);
                    }}
                    disabled={uploadingExpenseId === expense.id}
                  >
                    {uploadingExpenseId === expense.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {/* Receipt Images */}
                {expense.slip_urls && expense.slip_urls.length > 0 ? (
                  <div className="space-y-3">
                    {expense.slip_urls.map((imageUrl, imgIndex) => (
                      <div 
                        key={imgIndex}
                        className="relative rounded-lg overflow-hidden bg-muted"
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => setSelectedImage(imageUrl)}
                        >
                          <img 
                            src={imageUrl} 
                            alt={`${t('expenses.receipt')} ${getExpenseTypeLabel(expense)} (${imgIndex + 1})`}
                            className="w-full h-auto max-h-[300px] object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-lg font-medium">
                              {t('expenses.clickToView')}
                            </span>
                          </div>
                        </div>
                        {/* Delete button */}
                        <button
                          className="absolute top-3 right-3 p-1.5 rounded-full bg-destructive text-destructive-foreground shadow-md z-10 hover:bg-destructive/90"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoToDelete({ expenseId: expense.id, imgIndex });
                            setDeletePhotoDialogOpen(true);
                          }}
                          disabled={uploadingExpenseId === expense.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expense.slip_urls && expense.slip_urls.length > 1 && (
                          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-background/90 shadow-md">
                            <span className="text-xs font-medium text-foreground">
                              {imgIndex + 1}/{expense.slip_urls.length}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Add more photos button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      disabled={uploadingExpenseId === expense.id}
                      onClick={() => handleEditPhoto(expense.id)}
                    >
                      {uploadingExpenseId === expense.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {t('expenses.addPhoto')}
                    </Button>
                  </div>
                ) : (
                  /* No photos - show upload button */
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed gap-2"
                    disabled={uploadingExpenseId === expense.id}
                    onClick={() => handleEditPhoto(expense.id)}
                  >
                    {uploadingExpenseId === expense.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">{t('expenses.uploadPhoto')}</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for re-uploading receipt photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGE_DOC}
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Full Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          {selectedImage && (
            <img 
              src={selectedImage} 
              alt={t('expenses.receipt')}
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirmation Dialog */}
      <AlertDialog open={deleteExpenseDialogOpen} onOpenChange={setDeleteExpenseDialogOpen}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl p-0 overflow-hidden border-0 shadow-2xl gap-0">
          <div className="flex flex-col items-center px-6 pt-7 pb-5">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Trash2 className="w-7 h-7 text-destructive" />
            </div>
            <AlertDialogHeader className="space-y-1 text-center sm:text-center">
              <AlertDialogTitle className="text-lg font-semibold text-center">
                {t('expenses.deleteExpenseConfirm')}
              </AlertDialogTitle>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-row gap-0 border-t border-border p-0 sm:justify-stretch">
            <AlertDialogCancel
              className="flex-1 m-0 h-12 rounded-none border-0 bg-transparent hover:bg-muted text-muted-foreground font-medium"
              onClick={() => setExpenseToDelete(null)}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <div className="w-px bg-border" />
            <AlertDialogAction
              className="flex-1 m-0 h-12 rounded-none border-0 bg-transparent hover:bg-destructive/10 text-destructive font-semibold"
              onClick={() => {
                if (expenseToDelete) {
                  handleDeleteExpense(expenseToDelete);
                }
                setExpenseToDelete(null);
              }}
              disabled={uploadingExpenseId !== null}
            >
              {uploadingExpenseId === expenseToDelete ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('common.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Photo Confirmation Dialog */}
      <AlertDialog open={deletePhotoDialogOpen} onOpenChange={setDeletePhotoDialogOpen}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl p-0 overflow-hidden border-0 shadow-2xl gap-0">
          <div className="flex flex-col items-center px-6 pt-7 pb-5">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Trash2 className="w-7 h-7 text-destructive" />
            </div>
            <AlertDialogHeader className="space-y-1 text-center sm:text-center">
              <AlertDialogTitle className="text-lg font-semibold text-center">
                {t('expenses.deletePhotoConfirm')}
              </AlertDialogTitle>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-row gap-0 border-t border-border p-0 sm:justify-stretch">
            <AlertDialogCancel
              className="flex-1 m-0 h-12 rounded-none border-0 bg-transparent hover:bg-muted text-muted-foreground font-medium"
              onClick={() => setPhotoToDelete(null)}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <div className="w-px bg-border" />
            <AlertDialogAction
              className="flex-1 m-0 h-12 rounded-none border-0 bg-transparent hover:bg-destructive/10 text-destructive font-semibold"
              onClick={() => {
                if (photoToDelete) {
                  handleDeletePhoto(photoToDelete.expenseId, photoToDelete.imgIndex);
                }
                setPhotoToDelete(null);
              }}
              disabled={uploadingExpenseId !== null}
            >
              {uploadingExpenseId === photoToDelete?.expenseId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('common.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
