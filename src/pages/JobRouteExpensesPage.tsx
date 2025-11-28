import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, MapPin, Package, CheckCircle2, Fuel } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  destination_company_name: string | null;
  price: number;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  origin_contact_person: string | null;
  destination_contact_person: string | null;
  origin_bill_of_lading: string | null;
  destination_bill_of_lading: string | null;
  start_date: string;
  start_time: string;
  origin_remarks: string | null;
  destination_remarks: string | null;
}

interface JobApplication {
  status: string;
  payment_completed_at: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
}

interface Expense {
  id: string;
  expense_type: string;
  amount: number;
  receipt_photo_url: string;
  created_at: string;
}

export default function JobRouteExpensesPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobData();
  }, [jobId, user]);

  const loadJobData = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    try {
      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Load job application
      const { data: appData, error: appError } = await supabase
        .from('job_applications')
        .select('status, payment_completed_at, checked_in_at, sop_completed_at, delivery_checked_in_at, delivery_sop_completed_at')
        .eq('job_id', jobId)
        .eq('driver_id', user.id)
        .single();

      if (appError) throw appError;
      setJobApplication(appData);

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('job_id', jobId)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
    } catch (error) {
      console.error('Error loading job data:', error);
      toast({
        title: t('jobRoute.error'),
        description: t('jobRoute.loadError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job || !jobApplication) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-muted-foreground">{t('jobRoute.noData')}</p>
        </div>
      </div>
    );
  }

  const pickupPoints = job.transport_type?.includes('หลายที่') ? 4 : 1;
  const totalItems = 60;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-center relative mb-4">
          <button onClick={() => navigate('/income')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{job.destination_company_name || job.employer_name}</h1>
        </div>
      </header>

      <div className="px-4 pt-6">
        <Tabs defaultValue="route" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="route">{t('jobRoute.route')}</TabsTrigger>
            <TabsTrigger value="expenses">{t('jobRoute.expenses')}</TabsTrigger>
          </TabsList>

          {/* Route Tab */}
          <TabsContent value="route" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card className="p-3 text-center bg-muted/50">
                <Truck className="w-6 h-6 mx-auto mb-1 text-primary" />
                <div className="text-lg font-semibold text-primary">฿ {job.price.toLocaleString()}</div>
              </Card>
              <Card className="p-3 text-center bg-muted/50">
                <MapPin className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-medium text-muted-foreground">{t('jobRoute.pickupDelivery')}: {pickupPoints}</div>
              </Card>
              <Card className="p-3 text-center bg-muted/50">
                <Package className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-medium text-muted-foreground">{t('jobRoute.itemsCount')}: {totalItems}</div>
              </Card>
            </div>

            {/* Payment Status */}
            {jobApplication.payment_completed_at && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-center">
                <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                <span className="text-green-700 dark:text-green-400 font-medium">{t('jobRoute.paid')}</span>
              </div>
            )}

            {/* Route Details */}
            <div className="space-y-4">
              <div className="text-base font-semibold text-foreground">
                {t('jobRoute.employer')} : {job.destination_company_name || job.employer_name}
              </div>

              {/* Pickup Point */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-0">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  {/* Dashed line */}
                  <div className="absolute left-3 top-6 w-0.5 h-24 border-l-2 border-dashed border-muted-foreground"></div>
                </div>

                <Card className="p-4 mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold">{t('jobRoute.pickupPoint')} {job.origin_contact_person || 'Factory1'}</div>
                    {jobApplication.sop_completed_at && (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1"></div>
                        {t('jobRoute.sopSuccess')}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.contactName')}</span>
                      <span className="text-foreground">: {job.origin_contact_person || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.billNumber')}</span>
                      <span className="text-foreground">: {job.origin_bill_of_lading || job.order_code}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.destination')}</span>
                      <span className="text-foreground">: {job.origin_location}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.productType')}</span>
                      <span className="text-foreground">: {job.transport_type}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.pickupTime')}</span>
                      <span className="text-foreground">: {new Date(job.start_date).toLocaleDateString('th-TH')} | {job.start_time}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.remarks')}</span>
                      <span className="text-foreground">: {job.origin_remarks || '-'}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Delivery Points */}
              {job.destination_location && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-0">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <Card className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold">{t('jobRoute.deliveryPoint')} {job.destination_contact_person || job.destination_location.split(' ')[0]}</div>
                      {jobApplication.delivery_sop_completed_at && (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                          <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1"></div>
                          {t('jobRoute.podSuccess')}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.contactName')}</span>
                        <span className="text-foreground">: {job.destination_contact_person || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.billNumber')}</span>
                        <span className="text-foreground">: {job.destination_bill_of_lading || job.order_code}</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.destination')}</span>
                        <span className="text-foreground">: {job.destination_location}</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.productType')}</span>
                        <span className="text-foreground">: {job.transport_type}</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.pickupTime')}</span>
                        <span className="text-foreground">: {new Date(job.start_date).toLocaleDateString('th-TH')} | {job.start_time}</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.remarks')}</span>
                        <span className="text-foreground">: {job.destination_remarks || '-'}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-4">
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t('jobRoute.noExpenses')}</p>
                <button
                  onClick={() => navigate(`/job/${jobId}/add-expense`)}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  {t('jobRoute.addExpense')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Total Summary */}
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Fuel className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      ฿ {expenses.reduce((sum, exp) => sum + Number(exp.amount), 0).toLocaleString()}
                    </div>
                  </div>
                </Card>

                {/* Expense Items */}
                {expenses.map((expense) => (
                  <div key={expense.id} className="space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      {expense.expense_type} : ฿ {Number(expense.amount).toLocaleString()}
                    </div>
                    <div className="relative rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={expense.receipt_photo_url} 
                        alt={`${t('jobRoute.receipt')} ${expense.expense_type}`}
                        className="w-full h-auto object-cover"
                      />
                      <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/90 flex items-center justify-center shadow-md">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add More Button */}
                <button
                  onClick={() => navigate(`/job/${jobId}/add-expense`)}
                  className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  {t('jobRoute.addExpense')}
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
