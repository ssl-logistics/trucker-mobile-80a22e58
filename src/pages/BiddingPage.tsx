import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface BiddingJob {
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
}

interface Bid {
  id: string;
  job_id: string;
  bid_amount: number;
  status: string;
  created_at: string;
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
      .select(`
        *,
        jobs (*)
      `)
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMyBids(data as any);
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
          <button onClick={() => navigate(-1)}>
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
              <Card key={job.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      รหัสลูกค้าเจอร์ {job.order_code}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>📅 {new Date(job.start_date).toLocaleDateString('th-TH')} | {job.start_time}</span>
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold mb-2">
                  ชื่องาน : {job.job_type} {job.employer_name}
                </h3>
                
                <div className="text-sm text-primary font-semibold mb-3">
                  {job.transport_type}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="text-xs text-muted-foreground">ต้นทาง</div>
                      <div className="text-sm">{job.origin_location}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-destructive flex-shrink-0 mt-1" />
                    <div>
                      <div className="text-xs text-muted-foreground">ปลายทาง</div>
                      <div className="text-sm">{job.destination_location}</div>
                    </div>
                  </div>
                </div>

                {job.equipment_list && (
                  <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm">
                    <div className="font-medium mb-1">อุปกรณ์ที่ต้องมี:</div>
                    <div>{job.equipment_list}</div>
                  </div>
                )}

                {job.safety_equipment && (
                  <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm">
                    <div className="font-medium mb-1">อุปกรณ์ Safety:</div>
                    <div>{job.safety_equipment}</div>
                  </div>
                )}

                <Button 
                  className="w-full" 
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
