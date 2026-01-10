import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { BackButton } from '@/components/layout/BackButton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Package, Truck, Calendar, Clock, User, Building, CircleDot } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

interface AcceptedJob {
  id: string;
  order_number: string;
  transport_type_id: string;
  transport_mode: string | null;
  status: string;
  sender_name: string;
  sender_address: string;
  sender_latitude: number;
  sender_longitude: number;
  sender_province: string;
  sender_district: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  sender_contact_name: string;
  sender_contact_phone: string;
  destination_name: string;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_province: string;
  destination_district: string;
  destination_delivery_date: string;
  destination_delivery_time: string;
  destination_contact_name: string;
  destination_contact_phone: string;
  destination_company_name: string | null;
  product_name: string | null;
  product_type: string | null;
  product_category: string | null;
  product_weight: number | null;
  product_weight_value: number | null;
  product_quantity: number | null;
  product_unit: string | null;
  vehicle_type: string | null;
  vehicle_category: string | null;
  transport_price: number;
  driver_name: string;
  driver_phone: string;
  license_plate: string;
  freelance_bidder_id: string;
  freelance_bidder_name: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export default function JobDetailPage() {
  const { jobId } = useParams(); // This is now order_number
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [job, setJob] = useState<AcceptedJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && jobId) {
      loadJobDetail();
    }
  }, [jobId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    try {
      // Fetch from external API using the user's freelance_bidder_id
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: AcceptedJob) => j.order_number === jobId);
        if (foundJob) {
          setJob(foundJob);
        } else {
          toast({
            title: t('jobDetail.error'),
            description: t('jobDetail.notFound'),
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('jobDetail.error'),
        description: t('jobDetail.errorLoadDesc'),
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

  if (!job || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
          <BackButton />
          <h1 className="text-lg font-semibold">{t('jobDetail.title')}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground">{t('jobDetail.notFound')}</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge className="bg-amber-50 text-amber-700">กำลังดำเนินการ</Badge>;
      case 'completed':
        return <Badge className="bg-green-50 text-green-700">เสร็จสิ้น</Badge>;
      default:
        return <Badge className="bg-gray-50 text-gray-700">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <BackButton />
        <h1 className="text-lg font-semibold">{t('jobDetail.title')}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Order Info Card */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('job.order_code')}</span>
              <span className="font-semibold text-primary">{job.order_number}</span>
            </div>
            {getStatusBadge(job.status)}
          </div>
          
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{job.vehicle_type || '-'}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">ค่าขนส่ง</span>
            <span className="text-xl font-bold text-primary">฿ {job.transport_price?.toLocaleString()}</span>
          </div>
        </Card>

        {/* Origin Info */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <CircleDot className="w-5 h-5" />
            <span className="font-semibold">{t('job.origin')}</span>
          </div>
          
          <div className="pl-7 space-y-2">
            <div className="flex items-start gap-2">
              <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span className="text-sm font-medium">{job.sender_name}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span className="text-sm text-muted-foreground">{job.sender_address}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{formatDate(job.sender_pickup_date, language)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{job.sender_pickup_time?.substring(0, 5)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{job.sender_contact_name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${job.sender_contact_phone}`} className="text-sm text-primary underline">
                {job.sender_contact_phone}
              </a>
            </div>
          </div>
        </Card>

        {/* Destination Info */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-600">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold">{t('job.destination')}</span>
          </div>
          
          <div className="pl-7 space-y-2">
            {job.destination_company_name && (
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className="text-sm font-medium">{job.destination_company_name}</span>
              </div>
            )}
            
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span className="text-sm text-muted-foreground">{job.destination_address}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{formatDate(job.destination_delivery_date, language)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{job.destination_delivery_time?.substring(0, 5)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{job.destination_contact_name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${job.destination_contact_phone}`} className="text-sm text-primary underline">
                {job.destination_contact_phone}
              </a>
            </div>
          </div>
        </Card>

        {/* Product Info */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-600">
            <Package className="w-5 h-5" />
            <span className="font-semibold">ข้อมูลสินค้า</span>
          </div>
          
          <div className="pl-7 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('job.goods')}</span>
              <span>{job.product_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ประเภท</span>
              <span>{job.product_type || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">น้ำหนัก</span>
              <span>{job.product_weight ? `${job.product_weight.toLocaleString()} ${job.product_unit || 'kg'}` : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">จำนวน</span>
              <span>{job.product_quantity || '-'}</span>
            </div>
          </div>
        </Card>

        {/* Remarks */}
        {job.remarks && (
          <Card className="p-4 space-y-2">
            <span className="font-semibold text-sm">หมายเหตุ</span>
            <p className="text-sm text-muted-foreground">{job.remarks}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
