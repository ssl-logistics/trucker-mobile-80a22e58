import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Coins, Loader2, Plus, ImagePlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { getExpenses, addExpense } from '@/lib/externalApi';
import { supabase } from '@/integrations/supabase/client';
import { useNativeCamera } from '@/hooks/useNativeCamera';

interface Expense {
  id: string;
  expense_type: string;
  expense_name?: string;
  amount: number;
  slip_url?: string;
  slip_urls?: string[];
  created_at: string;
}

export default function JobExpensesPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, userType } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingExpenseId, setUploadingExpenseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

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
            slip_urls: exp.slip_urls || (exp.slip_url ? [exp.slip_url] : []), // ใช้ slip_urls ถ้ามี, ไม่งั้น fallback เป็น slip_url
            created_at: exp.created_at,
          }));
          setExpenses(mappedExpenses);
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

  const handleEditPhoto = async (expenseId: string) => {
    if (isNative) {
      // On native, use camera directly
      setUploadingExpenseId(expenseId);
      try {
        const file = await takePhoto();
        if (file) {
          await uploadReceiptPhoto(expenseId, file);
        } else {
          // Try gallery if camera cancelled
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
      // On web, use file input
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
        description: 'อัพโหลดรูปใบเสร็จสำเร็จ',
      });

      await loadExpenses();
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: t('expenses.error'),
        description: 'ไม่สามารถอัพโหลดรูปใบเสร็จได้',
        variant: 'destructive',
      });
    }
  };

  const getExpenseTypeLabel = (expense: Expense) => {
    // Normalize expense_type to lowercase for matching
    const normalizedType = expense.expense_type?.toLowerCase().replace(/\s+/g, '_') || '';
    
    // Map API expense types to translation keys
    const typeMap: Record<string, string> = {
      'fuel': t('expenses.types.fuel'),
      'toll': t('expenses.types.toll'),
      'port': t('expenses.types.port'),
      'port_fee': t('expenses.types.port'),
      'food': t('expenses.types.food'),
      'maintenance': t('expenses.types.maintenance'),
      'parking': t('expenses.types.parking'),
      'other': t('expenses.types.other'),
      // Container handling types
      'drop_empty_container': t('expenses.types.dropEmptyContainer'),
      'drop_loaded_container': t('expenses.types.dropLoadedContainer'),
      'pickup_empty_container': t('expenses.types.pickupEmptyContainer'),
      'pickup_loaded_container': t('expenses.types.pickupLoadedContainer'),
      'container_wash': t('expenses.types.containerWash'),
      'return_container': t('expenses.types.returnContainer'),
      'container_repair': t('expenses.types.containerRepair'),
      'overtime': t('expenses.types.overtime'),
    };
    
    // Use translated type if available, otherwise fall back to expense_name or expense_type
    return typeMap[normalizedType] || expense.expense_name || expense.expense_type;
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
            onClick={() => navigate(-1)} 
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
                {/* Expense Type Label */}
                <div className="text-base font-medium text-foreground">
                  {getExpenseTypeLabel(expense)} : ฿ {Number(expense.amount).toLocaleString()}
                </div>
                
                {/* Receipt Images */}
                {expense.slip_urls && expense.slip_urls.length > 0 ? (
                  <div className="space-y-3">
                    {expense.slip_urls.map((imageUrl, imgIndex) => (
                      <div 
                        key={imgIndex}
                        className="relative rounded-lg overflow-hidden bg-muted cursor-pointer"
                        onClick={() => setSelectedImage(imageUrl)}
                      >
                        <img 
                          src={imageUrl} 
                          alt={`${t('expenses.receipt')} ${getExpenseTypeLabel(expense)} (${imgIndex + 1})`}
                          className="w-full h-auto max-h-[300px] object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="text-white text-lg font-medium">
                            {t('expenses.clickToView')}
                          </span>
                        </div>
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
                      เพิ่มรูปใบเสร็จ
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
                    <span className="text-muted-foreground">อัพโหลดรูปใบเสร็จ</span>
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
        accept="image/*"
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
    </div>
  );
}
