import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Clock, MapPin, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface JobApplication {
  job_id: string;
  status: string;
  applied_at: string;
  jobs: {
    id: string;
    order_code: string;
    job_type: string;
    employer_name: string;
    transport_type: string;
    origin_location: string;
    destination_location: string;
    price: number;
    start_date: string;
    start_time: string;
    equipment_list: string | null;
    safety_equipment: string | null;
  };
}

export default function CurrentJobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentJobs();
  }, [user]);

  const loadCurrentJobs = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        job_id,
        status,
        applied_at,
        jobs (
          id,
          order_code,
          job_type,
          employer_name,
          transport_type,
          origin_location,
          destination_location,
          price,
          start_date,
          start_time,
          equipment_list,
          safety_equipment
        )
      `)
      .eq('driver_id', user.id)
      .order('applied_at', { ascending: false });

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลงานได้',
        variant: 'destructive'
      });
    } else {
      setApplications(data || []);
    }
    setLoading(false);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4">
        <MapPin className="w-16 h-16 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-center">ยังไม่มีงานในตอนนี้</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/home')} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">งานปัจจุบัน</h1>
        </div>
      </header>

      {/* Search and Filter Bar */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-[72px] z-40">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="ค้นหา ชื่อ,ออเดอร์,รหัสออเดอร์" 
              className="pl-9 h-10 bg-muted/30"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : applications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const job = application.jobs;
              return (
                <Card key={application.job_id} className="p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                      รหัสออเดอร์ {job.order_code}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">ผู้จ้าง : </span>
                      <span className="font-medium">{job.employer_name}</span>
                    </div>
                    <div className="text-sm text-blue-600 font-medium">
                      {job.transport_type}
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-2">
                          <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <div className="text-muted-foreground">ต้นทาง</div>
                            <div className="font-medium">{job.origin_location}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <div className="text-muted-foreground">ปลายทาง</div>
                            <div className="font-medium">{job.destination_location}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 mb-2">
                          <span className="text-lg font-bold text-teal-700">฿ {job.price.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          วันเริ่มงาน
                        </div>
                        <div className="text-xs font-medium">
                          {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">อุปกรณ์ติดรถ : </span>
                        <span>{job.equipment_list || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">อุปกรณ์ Safety : </span>
                        <span>{job.safety_equipment || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full h-11 text-base font-medium">
                    ดูรายละเอียด
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
