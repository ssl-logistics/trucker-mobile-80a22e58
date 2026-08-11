import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, CircleDot, Package, CheckCircle2, Fuel } from 'lucide-react';
import coinsIcon from '@/assets/coins-icon.png';
import routeIcon from '@/assets/route-icon.png';
import boxIcon from '@/assets/box-icon.png';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/dateUtils';
import { getTranslatedVehicleType } from '@/utils/vehicleTypeTranslation';
import { getExpenses, getDriverAssignedJobs } from '@/lib/externalApi';

// API response interfaces (matching JobHistoryPage)
interface ApiJobDetail {
  id: string;
  order_number: string;
  transport_type_id: string | null;
  transport_mode: string | null;
  status: string;
  sender_name: string;
  sender_address: string;
  sender_province: string;
  sender_district: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  sender_contact_name: string | null;
  sender_contact_phone: string | null;
  destination_name: string;
  destination_address: string;
  destination_province: string;
  destination_district: string;
  destination_delivery_date: string;
  destination_delivery_time: string;
  destination_contact_name: string | null;
  destination_contact_phone: string | null;
  destination_company_name: string | null;
  product_name: string | null;
  product_type: string | null;
  product_weight: number | null;
  product_quantity: number | null;
  product_unit: string | null;
  vehicle_type: string | null;
  transport_price: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  destination_company_name: string | null;
  price: number;
  product_type: string;
  product_quantity: number | null;
  product_unit: string | null;
  vehicle_type: string;
  origin_location: string;
  destination_location: string;
  origin_contact_person: string | null;
  origin_contact_phone: string | null;
  destination_contact_person: string | null;
  destination_contact_phone: string | null;
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
  const { isInternalDriver, isExternalDriver, canViewPrice } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [destinations, setDestinations] = useState<JobDestination[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobData();
  }, [jobId, user, isInternalDriver, isExternalDriver]);

  const loadJobData = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    try {
      let allJobs: ApiJobDetail[] = [];

      // For Internal/External drivers, use get-driver-assigned-jobs API (direct external call)
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        
        // Fetch all statuses so completed jobs are also found
        const [inProgressRes, inTransitRes, deliveredRes, completedRes] = await Promise.all([
          getDriverAssignedJobs(user.id, driverType, 1000, 'in_progress'),
          getDriverAssignedJobs(user.id, driverType, 1000, 'in_transit'),
          getDriverAssignedJobs(user.id, driverType, 1000, 'delivered'),
          getDriverAssignedJobs(user.id, driverType, 1000, 'completed'),
        ]);

        const apiJobs = [
          ...((inProgressRes.data as any)?.data || []),
          ...((inTransitRes.data as any)?.data || []),
          ...((deliveredRes.data as any)?.data || []),
          ...((completedRes.data as any)?.data || []),
        ];
        
        // Map factory jobs to ApiJobDetail format
        allJobs = apiJobs.map((job: any) => ({
          id: job.id,
          order_number: job.order_number,
          transport_type_id: job.transport_type_id,
          transport_mode: job.transport_mode,
          status: job.status,
          sender_name: job.factory_name || job.sender_name,
          sender_address: job.sender_address,
          sender_province: job.sender_province,
          sender_district: job.sender_district,
          sender_pickup_date: job.sender_pickup_date,
          sender_pickup_time: job.sender_pickup_time,
          sender_contact_name: job.sender_contact_name,
          sender_contact_phone: job.sender_contact_phone,
          destination_name: job.destination_name,
          destination_address: job.destination_address,
          destination_province: job.destination_province,
          destination_district: job.destination_district,
          destination_delivery_date: job.destination_delivery_date,
          destination_delivery_time: job.destination_delivery_time,
          destination_contact_name: job.destination_contact_name,
          destination_contact_phone: job.destination_contact_phone,
          destination_company_name: job.destination_company_name,
          product_name: job.product_name,
          product_type: job.product_type,
          product_weight: job.product_weight,
          product_quantity: job.product_quantity,
          product_unit: job.product_unit,
          vehicle_type: job.vehicle_type,
          transport_price: job.transport_price,
          remarks: job.remarks,
          created_at: job.created_at,
          updated_at: job.updated_at,
        }));
      } else {
        // For Freelance drivers, use get-freelance-accepted-jobs API
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
        allJobs = result.data || [];
      }

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
          product_type: apiJob.product_name || '-',
          product_quantity: apiJob.product_quantity,
          product_unit: apiJob.product_unit,
          vehicle_type: apiJob.vehicle_type || '-',
          origin_location: `${apiJob.sender_district || ''}, ${apiJob.sender_province || ''}`.replace(/^, |, $/g, '') || apiJob.sender_address || '-',
          destination_location: `${apiJob.destination_district || ''}, ${apiJob.destination_province || ''}`.replace(/^, |, $/g, '') || apiJob.destination_address || '-',
          origin_contact_person: apiJob.sender_contact_name,
          origin_contact_phone: apiJob.sender_contact_phone,
          destination_contact_person: apiJob.destination_contact_name,
          destination_contact_phone: apiJob.destination_contact_phone,
          origin_bill_of_lading: apiJob.order_number,
          destination_bill_of_lading: apiJob.order_number,
          start_date: apiJob.sender_pickup_date,
          start_time: apiJob.sender_pickup_time?.substring(0, 5) || '-',
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
          contact_name: apiJob.destination_contact_name,
          contact_phone: apiJob.destination_contact_phone,
          address: apiJob.destination_address,
          province: apiJob.destination_province,
          district: apiJob.destination_district,
          delivery_date: apiJob.destination_delivery_date,
          delivery_time: apiJob.destination_delivery_time?.substring(0, 5),
          notes: apiJob.remarks,
          checked_in_at: ['delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
          sop_completed_at: ['delivered', 'completed'].includes(apiJob.status) ? new Date().toISOString() : null,
        };
        setDestinations([destination]);
        // Load expenses from external API via proxy
        const driverType = (isInternalDriver || isExternalDriver) 
          ? (isInternalDriver ? 'internal' : 'external') 
          : 'freelance';
        
        try {
          const { data: expensesResult, error: expensesError } = await getExpenses(apiJob.order_number, user.id, driverType);
          
          if (!expensesError && expensesResult) {
            console.log('Expenses from API:', expensesResult);
            
            // Map external API response to our Expense interface
            const rawExpenses = Array.isArray(expensesResult.data) ? expensesResult.data 
              : Array.isArray(expensesResult) ? expensesResult : [];
            const mappedExpenses: Expense[] = rawExpenses.map((exp: any) => ({
              id: exp.id,
              expense_type: exp.expense_type,
              amount: exp.amount,
              receipt_photo_url: exp.receipt_photo_url,
              created_at: exp.created_at,
            }));
            setExpenses(mappedExpenses);
          } else {
            console.error('Failed to fetch expenses from API:', expensesError);
            setExpenses([]);
          }
        } catch (expError) {
          console.error('Error loading expenses from API:', expError);
          setExpenses([]);
        }
      } else {
        // Job not found in API
        setJob(null);
        setJobApplication(null);
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error loading job data:', error);
      // Don't show error toast if we have job data but expenses failed
      if (!job) {
        toast({
          title: t('jobRoute.error'),
          description: t('jobRoute.loadError'),
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
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
  // Get total items from API product_quantity
  const totalItems = job?.product_quantity || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground rounded-b-xl shadow-lg">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/income')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full z-10">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-center">
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
              {canViewPrice && (
                <Card className="p-3 text-center bg-muted/50">
                  <img src={coinsIcon} alt="coins" className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-primary">฿ {job.price.toLocaleString()}</div>
                </Card>
              )}
              <Card className="p-3 text-center bg-muted/50">
                <img src={routeIcon} alt="route" className="w-6 h-6 mx-auto mb-1" />
                <div className="text-sm font-medium text-muted-foreground">{t('jobRoute.pickupDelivery')}: {totalPoints}</div>
              </Card>
              <Card className="p-3 text-center bg-muted/50">
                <img src={boxIcon} alt="box" className="w-6 h-6 mx-auto mb-1" />
                <div className="text-sm font-medium text-muted-foreground">{t('jobRoute.itemsCount')}: {totalItems} {job?.product_unit || ''}</div>
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
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 whitespace-nowrap flex-shrink-0">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1 flex-shrink-0"></div>
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
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.destination')}</span>
                      <span className="text-foreground">: {job.origin_location}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.productType')}</span>
                      <span className="text-foreground">: {job.product_type}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.vehicleType')}</span>
                      <span className="text-foreground">: {getTranslatedVehicleType(job.vehicle_type, t)}</span>
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
                        <div className="font-semibold">{t('jobRoute.deliveryPoint')}{destinations.length > 1 ? ` ${destination.sequence_number}` : ''} - {destination.company_name || destination.province || '-'}</div>
                        {destination.sop_completed_at && (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 whitespace-nowrap flex-shrink-0">
                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1 flex-shrink-0"></div>
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
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.productType')}</span>
                          <span className="text-foreground">: {job.product_type}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.vehicleType')}</span>
                          <span className="text-foreground">: {getTranslatedVehicleType(job.vehicle_type, t)}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.deliveryTime')}</span>
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
                        <div className="font-semibold">{t('jobRoute.deliveryPoint')} - {job.destination_contact_phone || '-'}</div>
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
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.destination')}</span>
                          <span className="text-foreground">: {job.destination_location}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.productType')}</span>
                          <span className="text-foreground">: {job.product_type}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">{t('jobRoute.vehicleType')}</span>
                          <span className="text-foreground">: {job.vehicle_type}</span>
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

          {/* Expenses Tab - Read-only display */}
          <TabsContent value="expenses" className="space-y-4">
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t('jobRoute.noExpenses')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Total Summary */}
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Fuel className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t('jobRoute.expenses')}</div>
                      <div className="text-2xl font-bold text-primary">
                        ฿ {expenses.reduce((sum, exp) => sum + Number(exp.amount), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Expense Items */}
                {expenses.map((expense) => (
                  <Card key={expense.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Fuel className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{expense.expense_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {expense.created_at ? new Date(expense.created_at).toLocaleDateString() : '-'}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        ฿ {Number(expense.amount).toLocaleString()}
                      </div>
                    </div>
                    {expense.receipt_photo_url && (
                      <div className="mt-3 rounded-lg overflow-hidden">
                        <img 
                          src={expense.receipt_photo_url} 
                          alt={expense.expense_type}
                          className="w-full h-auto object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
