import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type BiddingJob = Database['public']['Tables']['jobs']['Row'];
type JobBid = Database['public']['Tables']['job_bids']['Row'];


interface Bid extends JobBid {
  jobs: BiddingJob;
}

export default function BiddingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [availableJobs, setAvailableJobs] = useState<BiddingJob[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [activeTab, setActiveTab] = useState('bidding');

  useEffect(() => {
    if (user) {
      loadAvailableJobs();
      loadMyBids();
    }
  }, [user]);

  const loadAvailableJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAvailableJobs(data);
    }
  };

  const loadMyBids = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('job_bids')
      .select('*, jobs(*)')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMyBids(data as Bid[]);
    }
  };

  const handlePlaceBid = (jobId: string) => {
    navigate(`/bidding/${jobId}`);
  };

  const getBidStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'รอดำเนินการ', variant: 'secondary' as const },
      accepted: { label: 'เสร็จสิ้น', variant: 'default' as const },
      rejected: { label: 'ปฏิเสธ', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate('/home')}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">เสนอราคา</h1>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
          <TabsTrigger value="bidding" className="rounded-none">
            เสนอราคา
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none">
            ประวัติ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bidding" className="px-4 mt-4 space-y-4">
          {availableJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              ไม่มีงานที่เปิดรับเสนอราคา
            </div>
          ) : (
            availableJobs.map((job) => (
              <Card key={job.id} className="p-4 space-y-3 bg-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                    รหัสออเดอร์ {job.order_code}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(job.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} | {job.start_time.substring(0, 5)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">ผู้จ้าง : </span>
                    <span className="font-medium">{job.employer_name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
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
                  </div>

                  {(job.equipment_list || job.safety_equipment) && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                      {job.equipment_list && (
                        <div>
                          <span className="text-muted-foreground">อุปกรณ์ติดรถ : </span>
                          <span>{job.equipment_list}</span>
                        </div>
                      )}
                      {job.safety_equipment && (
                        <div>
                          <span className="text-muted-foreground">อุปกรณ์ Safety : </span>
                          <span>{job.safety_equipment}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full h-11 text-base font-medium" 
                  onClick={() => handlePlaceBid(job.id)}
                >
                  เริ่มเสนอราคา
                </Button>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="px-4 mt-4">
          <div className="mb-4">
            <select className="w-full p-3 border rounded-lg bg-background">
              <option>ทุกเดือน</option>
            </select>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-sm mb-3">กุมภาพันธ์</h3>
            {myBids.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                ยังไม่มีประวัติการเสนอราคา
              </div>
            ) : (
              <div className="space-y-4">
                {myBids.map((bid) => (
                  <Card key={bid.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Badge variant="secondary" className="mb-2">
                          รหัสลูกค้าเจอร์ {bid.jobs.order_code}
                        </Badge>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>📅 {new Date(bid.jobs.start_date).toLocaleDateString('th-TH')} | {bid.jobs.start_time}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-primary font-semibold mb-1">
                          ฿ {bid.bid_amount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <h3 className="font-semibold mb-2">
                      ชื่องาน : {bid.jobs.job_type} {bid.jobs.employer_name}
                    </h3>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-primary flex-shrink-0 mt-1" />
                        <div>
                          <div className="text-xs text-muted-foreground">ต้นทาง</div>
                          <div className="text-sm">{bid.jobs.origin_location}</div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground px-6">2 ชุดเเละ</div>
                      
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-destructive flex-shrink-0 mt-1" />
                        <div>
                          <div className="text-xs text-muted-foreground">ปลายทาง</div>
                          <div className="text-sm">{bid.jobs.destination_location}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span>ประกันสินค้า :</span>
                        <span>{bid.jobs.transport_type}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        วันเวลาเสนอราคา {new Date(bid.created_at).toLocaleString('th-TH')}
                      </span>
                      {getBidStatusBadge(bid.status)}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
