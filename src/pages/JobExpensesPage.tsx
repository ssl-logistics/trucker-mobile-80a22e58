import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Coins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  expense_type: string;
  expense_name?: string;
  amount: number;
  slip_url?: string;
  created_at: string;
}

export default function JobExpensesPage() {
  const { jobId } = useParams(); // This is order_number (e.g., OR20260126002)
  const navigate = useNavigate();
  const { user, userType } = useAuth();
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
      // Determine driver_type based on userType
      let driverType = 'internal';
      if (userType === 'freelance_driver') {
        driverType = 'external';
      } else if (userType === 'internal_driver') {
        driverType = 'internal';
      } else if (userType === 'external_driver') {
        driverType = 'external';
      }

      // Call the get-expenses-proxy Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-expenses-proxy?order_number=${jobId}&driver_id=${user.id}&driver_type=${driverType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Expenses API response:', result);

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

  const getExpenseTypeLabel = (expense: Expense) => {
    // Always prioritize translation based on expense_type
    const typeMap: Record<string, string> = {
      'fuel': t('expenses.types.fuel'),
      'toll': t('expenses.types.toll'),
      'port': t('expenses.types.port'),
      'food': t('expenses.types.food'),
      'maintenance': t('expenses.types.maintenance'),
      'parking': t('expenses.types.parking'),
      'other': t('expenses.types.other'),
    };
    
    // Use translated type if available, otherwise fall back to expense_name or expense_type
    return typeMap[expense.expense_type] || expense.expense_name || expense.expense_type;
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
                
                {/* Receipt Image with Click Overlay */}
                {expense.slip_url && (
                  <div 
                    className="relative rounded-lg overflow-hidden bg-muted cursor-pointer"
                    onClick={() => setSelectedImage(expense.slip_url || null)}
                  >
                    <img 
                      src={expense.slip_url} 
                      alt={`${t('expenses.receipt')} ${getExpenseTypeLabel(expense)}`}
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
                )}
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
