import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, CircleDot, Package, CheckCircle2, Fuel } from 'lucide-react';
import coinsIcon from '@/assets/coins-icon.png';
import routeIcon from '@/assets/route-icon.png';
import boxIcon from '@/assets/box-icon.png';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/dateUtils';

// API response interfaces
interface ApiJobDetail {
  id: string;
  order_number: string;
  sender_name: string;
  destination_company_name: string | null;
  transport_price: number;
  transport_type: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  sender_province: string;
  sender_district: string;
  sender_address: string;
  sender_contact_name: string | null;
  sender_contact_phone: string | null;
  receiver_province: string;
  receiver_district: string;
  receiver_address: string;
  receiver_contact_name: string | null;
  receiver_contact_phone: string | null;
  goods_type: string | null;
  goods_weight: number | null;
  goods_quantity: number | null;
  remarks: string | null;
  status: string;
}

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

interface JobDestination {
  id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
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
  const { t, language } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [destinations, setDestinations] = useState<JobDestination[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobData();
  }, [jobId, user]);

  const loadJobData = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    try {
      // Fetch job data from external API (same as job history and income)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(user.id)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch job data');
      }

      const result = await response.json();
      const allJobs: ApiJobDetail[] = result.data || [];

      // Find the specific job by ID (order_number)
      const apiJob = allJobs.find(j => j.order_number === jobId || j.id === jobId);

      if (apiJob) {
        // Map API data to existing JobDetail interface
        const mappedJob: JobDetail = {
          id: apiJob.id,
          order_code: apiJob.order_number,
          employer_name: apiJob.sender_name,
          destination_company_name: apiJob.destination_company_name,
          price: apiJob.transport_price,
          transport_type: apiJob.transport_type || apiJob.goods_type || '-',
          origin_location: `${apiJob.sender_district || ''} ${apiJob.sender_province || ''}`.trim() || apiJob.sender_address || '-',
          destination_location: `${apiJob.receiver_district || ''} ${apiJob.receiver_province || ''}`.trim() || apiJob.receiver_address || '-',
          origin_contact_person: apiJob.sender_contact_name,
          destination_contact_person: apiJob.receiver_contact_name,
          origin_bill_of_lading: apiJob.order_number,
          destination_bill_of_lading: apiJob.order_number,
          start_date: apiJob.sender_pickup_date,
          start_time: apiJob.sender_pickup_time || '-',
          origin_remarks: apiJob.remarks,
          destination_remarks: apiJob.remarks,
        };
        setJob(mappedJob);

        // Map job application status
        const mappedApplication: JobApplication = {
          status: apiJob.status,
          payment_completed_at: apiJob.status === 'completed' ? new Date().toISOString() : null,
          checked_in_at: apiJob.status !== 'accepted' ? new Date().toISOString() : null,
          sop_completed_at: ['in_transit', 'delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
          delivery_checked_in_at: ['delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
          delivery_sop_completed_at: ['delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
        };
        setJobApplication(mappedApplication);

        // Create destination from API data
        const destination: JobDestination = {
          id: apiJob.id,
          sequence_number: 1,
          company_name: apiJob.destination_company_name,
          contact_name: apiJob.receiver_contact_name,
          contact_phone: apiJob.receiver_contact_phone,
          address: apiJob.receiver_address,
          province: apiJob.receiver_province,
          district: apiJob.receiver_district,
          delivery_date: apiJob.sender_pickup_date,
          delivery_time: apiJob.sender_pickup_time,
          notes: apiJob.remarks,
          checked_in_at: ['delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
          sop_completed_at: ['delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
        };
        setDestinations([destination]);
      } else {
        // Job not found in API
        setJob(null);
        setJobApplication(null);
      }

      // Load expenses from local database
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

  // Calculate total points: 1 pickup + destinations count (or at least 1 if no destinations)
  const totalPoints = 1 + (destinations.length > 0 ? destinations.length : 1);
  const totalItems = 60;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-6 rounded-b-3xl shadow-lg page-header-safe">
        <div className="flex items-center justify-center relative mb-4">
          <button onClick={() => navigate('/income')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full z-10">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 
            className="font-semibold text-center px-10 max-w-[calc(100%-60px)] leading-tight"
            style={{
              fontSize: `clamp(0.875rem, ${20 / Math.max((job.destination_company_name || job.employer_name).length / 15, 1)}px, 1.25rem)`
            }}
          >
            {job.destination_company_name || job.employer_name}
          </h1>
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
                <img src={coinsIcon} alt="coins" className="w-6 h-6 mx-auto mb-1" />
                <div className="text-lg font-semibold text-primary">฿ {job.price.toLocaleString()}</div>
              </Card>
              <Card className="p-3 text-center bg-muted/50">
                <img src={routeIcon} alt="route" className="w-6 h-6 mx-auto mb-1" />
                <div className="text-sm font-medium text-muted-foreground">{t('jobRoute.pickupDelivery')}: {totalPoints}</div>
              </Card>
              <Card className="p-3 text-center bg-muted/50">
                <img src={boxIcon} alt="box" className="w-6 h-6 mx-auto mb-1" />
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
              <div className="text-base font-semibold text-[#005e53]">
                {t('jobRoute.employer')} : {job.destination_company_name || job.employer_name}
              </div>

              {/* Pickup Point */}
              <div className="relative pl-8">
                {/* Circle */}
                <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center z-10">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                {/* Dashed line - spans full height of container */}
                <div className="absolute left-[13px] top-7 -bottom-4 w-0.5 border-l-2 border-dashed border-muted-foreground"></div>

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
                      <span className="text-foreground">: {formatDate(job.start_date, language)} | {job.start_time}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.remarks')}</span>
                      <span className="text-foreground">: {job.origin_remarks || '-'}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Delivery Points from job_destinations */}
              {destinations.length > 0 ? (
                destinations.map((destination, index) => (
                  <div key={destination.id} className="relative pl-8">
                    {/* Circle */}
                    <div className={`absolute left-0 top-0 w-7 h-7 rounded-full ${destination.sop_completed_at ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center z-10`}>
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    {/* Dashed line to next point (if not last) */}
                    {index < destinations.length - 1 && (
                      <div className="absolute left-[13px] top-7 -bottom-4 w-0.5 border-l-2 border-dashed border-muted-foreground"></div>
                    )}

                    <Card className="p-4 mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold">{t('jobRoute.deliveryPoint')} {destination.sequence_number} - {destination.company_name || destination.province || '-'}</div>
                        {destination.sop_completed_at && (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1"></div>
                            {t('jobRoute.podSuccess')}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.contactName')}</span>
                          <span className="text-foreground">: {destination.contact_name || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.phone')}</span>
                          <span className="text-foreground">: {destination.contact_phone || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.destination')}</span>
                          <span className="text-foreground">: {destination.address || `${destination.district || ''} ${destination.province || ''}`.trim() || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.pickupTime')}</span>
                          <span className="text-foreground">: {destination.delivery_date ? formatDate(destination.delivery_date, language) : '-'} {destination.delivery_time ? `| ${destination.delivery_time}` : ''}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.remarks')}</span>
                          <span className="text-foreground">: {destination.notes || '-'}</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))
              ) : (
                /* Fallback to original destination if no job_destinations */
                job.destination_location && (
                  <div className="relative pl-8">
                    {/* Circle */}
                    <div className={`absolute left-0 top-0 w-7 h-7 rounded-full ${jobApplication.delivery_sop_completed_at ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center z-10`}>
                      <CheckCircle2 className="w-5 h-5 text-white" />
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
                          <span className="text-foreground">: {formatDate(job.start_date, language)} | {job.start_time}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.remarks')}</span>
                          <span className="text-foreground">: {job.destination_remarks || '-'}</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                )
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
