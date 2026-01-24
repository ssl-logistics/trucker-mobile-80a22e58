import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Coins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  expense_type: string;
  amount: number;
  receipt_photo_url: string;
  created_at: string;
}

export default function JobExpensesPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadExpenses();
  }, [jobId, user]);

  const loadExpenses = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    try {
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('job_id', jobId)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
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

  const getExpenseTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'fuel': t('expenses.types.fuel'),
      'toll': t('expenses.types.toll'),
      'port': t('expenses.types.port'),
      'food': t('expenses.types.food'),
      'maintenance': t('expenses.types.maintenance'),
      'other': t('expenses.types.other'),
    };
    return typeMap[type] || type;
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
                  {getExpenseTypeLabel(expense.expense_type)} : ฿ {Number(expense.amount).toLocaleString()}
                </div>
                
                {/* Receipt Image with Click Overlay */}
                <div 
                  className="relative rounded-lg overflow-hidden bg-muted cursor-pointer"
                  onClick={() => setSelectedImage(expense.receipt_photo_url)}
                >
                  <img 
                    src={expense.receipt_photo_url} 
                    alt={`${t('expenses.receipt')} ${getExpenseTypeLabel(expense.expense_type)}`}
                    className="w-full h-auto max-h-[300px] object-cover"
                  />
                  {/* Overlay with "Click to view" text */}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-white text-lg font-medium">
                      {t('expenses.clickToView')}
                    </span>
                  </div>
                  {/* Camera icon button */}
                  <button className="absolute top-3 right-3 w-10 h-10 rounded-full bg-background/90 flex items-center justify-center shadow-md">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
