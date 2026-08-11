import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFreelanceAcceptedJobs,
  getFactoryAssignedJobs,
  getDriverCheckins,
  listTickets,
} from '@/lib/externalApi';
import { buildCheckinMaps, isJobFullyCompleted } from '@/utils/jobCompletionFilter';

import profitIcon from '@/assets/profit-icon.png';
import successIcon from '@/assets/success-icon.png';
import deliveryIcon from '@/assets/delivery-icon.png';
import cancelIcon from '@/assets/cancel-icon.png';

export default function ShippingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [timePeriod, setTimePeriod] = useState('month');
  const [vehicleType, setVehicleType] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Separated data sources for stats
  const [completedJobsFromHistory, setCompletedJobsFromHistory] = useState<any[]>([]);
  const [currentJobsFromCurrentPage, setCurrentJobsFromCurrentPage] = useState<any[]>([]);

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const koreanMonths = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const chineseMonths = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const months = language === 'th' ? thaiMonths : language === 'ko' ? koreanMonths : language === 'zh' ? chineseMonths : englishMonths;

  // Fetch and split data by source logic:
  // - completed: history page logic
  // - in delivery: current jobs page logic
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const [companyJobsRes, factoryJobsRes, checkinsRes, bidJobsRes] = await Promise.all([
          getFreelanceAcceptedJobs(user.id, 1000),
          getFactoryAssignedJobs(user.id, 1000),
          getDriverCheckins(user.id, 'freelance', 'all'),
          listTickets({ freelanceDriverId: user.id, bidsStatus: 'accepted' }).catch(() => ({ data: null, error: 'Failed' })),
        ]);

        const extractItems = (response: any): any[] => {
          if (Array.isArray(response)) return response;
          if (Array.isArray(response?.data)) return response.data;
          if (Array.isArray(response?.items)) return response.items;
          if (Array.isArray(response?.results)) return response.results;
          return [];
        };

        const dedupeByOrder = (jobs: any[]) => {
          const seen = new Set<string>();
          return jobs.filter((job: any) => {
            const key = job.order_number || job.id;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const companyJobs = extractItems(companyJobsRes.data);
        const factoryJobsRaw = extractItems(factoryJobsRes.data);
        const checkinsRaw = extractItems(checkinsRes.data);
        const tickets = bidJobsRes.error ? [] : extractItems(bidJobsRes.data);

        const driverCheckins = checkinsRaw.filter((c: any) => c.freelance_driver_id === user.id);
        const maps = buildCheckinMaps(driverCheckins, user.id, 'freelance');

        const normalizeFactoryJob = (job: any) => ({
          ...job,
          sender_name: job.factory_name || job.sender_name,
          sender_pickup_date: job.sender_pickup_date || job.pickup_date,
          order_number: job.order_number || job.job_order_number,
        });

        const mapBidTicketToJob = (ticket: any) => ({
          id: ticket.id,
          order_number: ticket.ticket_number || ticket.order_code || ticket.post_code || ticket.ticket_code,
          status: ticket.status || 'accepted',
          sender_name: ticket.customer?.company_name || ticket.creator?.company_name || ticket.creator?.full_name || ticket.company_name || ticket.employer_name || '',
          sender_pickup_date: ticket.pickup_location?.date || ticket.pickup_date || ticket.start_date || ticket.created_at?.split('T')[0],
          sender_province: ticket.route?.origin_district?.province?.name || ticket.pickup_location?.province || '',
          destination_province: ticket.route?.destination_district?.province?.name || ticket.dropoff_location?.province || '',
          vehicle_type: ticket.vehicle_type?.name || ticket.truck_type || ticket.vehicle_type || null,
          transport_price: ticket.bids?.find((b: any) => b.status === 'accepted' && b.contractor_id === user.id)?.bid_price || ticket.price || 0,
          isBidJob: true,
          created_at: ticket.created_at,
          destinations: ticket.destinations,
          booking_no: ticket.booking_no || null,
          bl_no: ticket.bl_no || null,
          transport_category: ticket.transport_category || null,
        });

        const acceptedBidTickets = tickets.filter((ticket: any) => {
          const userAcceptedBid = ticket.bids?.find((b: any) =>
            b.status === 'accepted' && b.contractor_id === user.id
          );
          return !!userAcceptedBid;
        });

        const bidJobsMapped = acceptedBidTickets.map(mapBidTicketToJob);

        // ===== Completed jobs (History logic) =====
        const historyFactoryJobs = factoryJobsRaw
          .filter((job: any) => job.freelance_accepted_at)
          .map(normalizeFactoryJob);

        const historySourceJobs = dedupeByOrder([
          ...companyJobs,
          ...historyFactoryJobs,
          ...bidJobsMapped,
        ]);

        const completedFromHistory = historySourceJobs.filter((job: any) =>
          isJobFullyCompleted(job, maps)
        );

        // ===== Current jobs (CurrentJobs logic) =====
        const currentCompanyJobs = companyJobs.filter((job: any) => !isJobFullyCompleted(job, maps));

        const activeFactoryStatuses = ['in_progress', 'in_transit', 'assigned', 'accepted'];
        const currentFactoryJobs = factoryJobsRaw
          .map(normalizeFactoryJob)
          .filter((job: any) => {
            if (isJobFullyCompleted(job, maps)) return false;

            const status = (job?.status || '').toLowerCase().trim();
            if (status === 'awaiting_response') return false;

            return activeFactoryStatuses.includes(status) || Boolean(job.freelance_accepted_at);
          });

        const currentBidJobs = bidJobsMapped.filter((job: any) => {
          const status = (job.status || '').toLowerCase();
          if (['cancelled', 'closed'].includes(status)) return false;
          return !isJobFullyCompleted(job, maps);
        });

        const bidOrderNumbers = new Set(currentBidJobs.map((j: any) => j.order_number).filter(Boolean));
        const filteredCurrentCompanyJobs = currentCompanyJobs.filter((j: any) => !bidOrderNumbers.has(j.order_number));
        const filteredCurrentFactoryJobs = currentFactoryJobs.filter((j: any) => !bidOrderNumbers.has(j.order_number));

        const currentFromCurrentPage = dedupeByOrder([
          ...filteredCurrentCompanyJobs,
          ...filteredCurrentFactoryJobs,
          ...currentBidJobs,
        ]);

        setCompletedJobsFromHistory(completedFromHistory);
        setCurrentJobsFromCurrentPage(currentFromCurrentPage);
      } catch (error) {
        console.error('Error fetching shipping data:', error);
        setCompletedJobsFromHistory([]);
        setCurrentJobsFromCurrentPage([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const getDisplayDate = () => {
    const day = selectedDate.getDate();
    const month = months[selectedDate.getMonth()];
    const year = language === 'th' ? selectedDate.getFullYear() + 543 : selectedDate.getFullYear();
    if (timePeriod === 'day') {
      return `${day} ${month} ${year}`;
    } else if (timePeriod === 'month') {
      return `${month} ${year}`;
    } else {
      return `${t('finance.buddhist_era')} ${year}`;
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (timePeriod === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (timePeriod === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Filter jobs by date
  const filterByDate = (jobs: any[]) => {
    return jobs.filter((job: any) => {
      const jobDate = new Date(job.sender_pickup_date || job.created_at);
      if (isNaN(jobDate.getTime())) return false;

      if (timePeriod === 'day') {
        return (
          jobDate.getDate() === selectedDate.getDate() &&
          jobDate.getMonth() === selectedDate.getMonth() &&
          jobDate.getFullYear() === selectedDate.getFullYear()
        );
      } else if (timePeriod === 'month') {
        return (
          jobDate.getMonth() === selectedDate.getMonth() &&
          jobDate.getFullYear() === selectedDate.getFullYear()
        );
      } else {
        return jobDate.getFullYear() === selectedDate.getFullYear();
      }
    });
  };

  // Compute stats from separated sources
  const { jobStats, regionStats } = useMemo(() => {
    if (!user?.id) {
      return {
        jobStats: [
          { label: t('shipping.all_jobs'), value: 0, icon: 'profit' },
          { label: t('shipping.success'), value: 0, icon: 'success' },
          { label: t('shipping.in_delivery'), value: 0, icon: 'delivery' },
          { label: t('shipping.cancelled'), value: 0, icon: 'cancel' },
        ],
        regionStats: [],
      };
    }

    const filteredCurrentJobs = vehicleType === 'all'
      ? currentJobsFromCurrentPage
      : currentJobsFromCurrentPage.filter((job: any) => job.vehicle_type === vehicleType);

    const filteredCompletedJobs = vehicleType === 'all'
      ? completedJobsFromHistory
      : completedJobsFromHistory.filter((job: any) => job.vehicle_type === vehicleType);

    const dateFilteredCompleted = filterByDate(filteredCompletedJobs);

    const inDeliveryJobs = filteredCurrentJobs.length;
    const successJobs = dateFilteredCompleted.length;
    const totalJobs = inDeliveryJobs + successJobs;

    const regionMap: Record<string, number> = {};
    const allActiveAndCompleted = [...filteredCurrentJobs, ...dateFilteredCompleted];
    allActiveAndCompleted.forEach((job: any) => {
      const province = job.sender_province || job.destination_province || '';
      const region = getRegionFromProvince(province);
      if (region) {
        regionMap[region] = (regionMap[region] || 0) + 1;
      }
    });

    return {
      jobStats: [
        { label: t('shipping.all_jobs'), value: totalJobs, icon: 'profit' },
        { label: t('shipping.success'), value: successJobs, icon: 'success' },
        { label: t('shipping.in_delivery'), value: inDeliveryJobs, icon: 'delivery' },
        { label: t('shipping.cancelled'), value: 0, icon: 'cancel' },
      ],
      regionStats: [
        { region: t('shipping.north'), value: regionMap['north'] || 0 },
        { region: t('shipping.central'), value: regionMap['central'] || 0 },
        { region: t('shipping.northeast'), value: regionMap['northeast'] || 0 },
        { region: t('shipping.east'), value: regionMap['east'] || 0 },
        { region: t('shipping.west'), value: regionMap['west'] || 0 },
        { region: t('shipping.south'), value: regionMap['south'] || 0 },
      ],
    };
  }, [completedJobsFromHistory, currentJobsFromCurrentPage, user?.id, timePeriod, vehicleType, selectedDate, t]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground px-4 py-4 shadow-md">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/dashboard')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{t('shipping.title')}</h1>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Time Period Tabs */}
        <Tabs value={timePeriod} onValueChange={setTimePeriod} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm">
            <TabsTrigger value="day">{t('finance.day')}</TabsTrigger>
            <TabsTrigger value="month">{t('finance.month')}</TabsTrigger>
            <TabsTrigger value="year">{t('finance.year')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-4 py-2">
          <button onClick={() => navigateDate('prev')} className="p-2 rounded-full transition-colors">
            <span className="text-2xl">{'<'}</span>
          </button>
          <span key={getDisplayDate()} className="text-xl font-bold animate-in fade-in duration-300 text-[#153860]">
            {getDisplayDate()}
          </span>
          <button onClick={() => navigateDate('next')} className="p-2 rounded-full transition-colors">
            <span className="text-2xl">{'>'}</span>
          </button>
        </div>

        {/* Vehicle Type Dropdown */}
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger className="w-full bg-white shadow-sm border-2 border-primary">
            <SelectValue placeholder={t('shipping.all_types')} />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">{t('shipping.all_types')}</SelectItem>
            <SelectItem value="หัวลาก">{t('shipping.tractor')}</SelectItem>
            <SelectItem value="รถ 12 ล้อ">{t('shipping.12wheels')}</SelectItem>
            <SelectItem value="รถ 10 ล้อ">{t('shipping.10wheels')}</SelectItem>
            <SelectItem value="รถ 6 ล้อ">{t('shipping.6wheels')}</SelectItem>
            <SelectItem value="รถ 4 ล้อ">{t('shipping.4wheels')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Job Stats */}
        {isLoading ? (
          <Card className="p-8 bg-white shadow-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </Card>
        ) : (
          <Card key={`stats-${timePeriod}-${vehicleType}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">{t('shipping.job_data')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {jobStats.map((stat, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-2xl">
                    {stat.icon === 'profit' ? <img src={profitIcon} alt="Profit" className="w-10 h-10" /> :
                     stat.icon === 'success' ? <img src={successIcon} alt="Success" className="w-10 h-10" /> :
                     stat.icon === 'delivery' ? <img src={deliveryIcon} alt="Delivery" className="w-10 h-10" /> :
                     stat.icon === 'cancel' ? <img src={cancelIcon} alt="Cancel" className="w-10 h-10" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">{stat.label}</p>
                    <p className="text-xl font-bold text-primary">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Region Stats */}
        {isLoading ? (
          <Card className="p-8 bg-white shadow-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </Card>
        ) : (
          <Card key={`region-${timePeriod}-${vehicleType}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">{t('shipping.by_region')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {regionStats.map((stat, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 mb-1">{stat.region}</p>
                  <p className="text-xl font-bold text-primary">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Map Thai province to region
function getRegionFromProvince(province: string): string | null {
  if (!province) return null;
  const p = province.replace('จังหวัด', '').trim();

  const northProvinces = ['เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่', 'อุตรดิตถ์'];
  const northeastProvinces = ['กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์', 'มหาสารคาม', 'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อำนาจเจริญ', 'อุดรธานี', 'อุบลราชธานี'];
  const centralProvinces = ['กรุงเทพมหานคร', 'กรุงเทพ', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'สมุทรสงคราม', 'นครปฐม', 'พระนครศรีอยุธยา', 'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท', 'สระบุรี', 'นครนายก', 'นครสวรรค์', 'อุทัยธานี', 'พิจิตร', 'กำแพงเพชร', 'สุโขทัย', 'พิษณุโลก', 'ตาก', 'เพชรบูรณ์'];
  const eastProvinces = ['ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว'];
  const westProvinces = ['กาญจนบุรี', 'ราชบุรี', 'สุพรรณบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์'];
  const southProvinces = ['ชุมพร', 'ระนอง', 'สุราษฎร์ธานี', 'พังงา', 'กระบี่', 'ภูเก็ต', 'นครศรีธรรมราช', 'ตรัง', 'พัทลุง', 'สงขลา', 'สตูล', 'ปัตตานี', 'ยะลา', 'นราธิวาส'];

  if (northProvinces.some(np => p.includes(np))) return 'north';
  if (northeastProvinces.some(np => p.includes(np))) return 'northeast';
  if (centralProvinces.some(np => p.includes(np))) return 'central';
  if (eastProvinces.some(np => p.includes(np))) return 'east';
  if (westProvinces.some(np => p.includes(np))) return 'west';
  if (southProvinces.some(np => p.includes(np))) return 'south';

  return null;
}
