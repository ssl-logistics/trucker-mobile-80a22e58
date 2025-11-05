import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CircleDot, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface JobApplication {
  id: string;
  applied_at: string;
  status: string;
  job_started_at: string | null;
  payment_completed_at: string | null;
  jobs: {
    id: string;
    order_code: string;
    employer_name: string;
    transport_type: string;
    origin_location: string;
    destination_location: string;
    price: number;
    start_date: string;
    start_time: string;
    job_type: string;
  };
}

export default function JobHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      loadJobHistory();
    }
  }, [user]);

  const loadJobHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("job_applications")
        .select(`
          id,
          applied_at,
          status,
          job_started_at,
          payment_completed_at,
          jobs:job_id (
            id,
            order_code,
            employer_name,
            transport_type,
            origin_location,
            destination_location,
            price,
            start_date,
            start_time,
            job_type
          )
        `)
        .eq("driver_id", user?.id)
        .order("applied_at", { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error("Error loading job history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  const getStatusColor = (status: string) => {
    if (status === "accepted" || status === "in_progress") return "bg-green-50 border-green-200";
    if (status === "completed") return "bg-gray-50 border-gray-200";
    return "bg-yellow-50 border-yellow-200";
  };

  const getStatusBadge = (app: JobApplication) => {
    if (app.payment_completed_at) {
      return (
        <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span className="text-xs font-medium text-gray-700">เสร็จสิ้น</span>
        </div>
      );
    }
    if (app.job_started_at) {
      return (
        <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <span className="text-xs font-medium text-orange-700">กำลังจัดส่ง</span>
        </div>
      );
    }
    return (
      <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
        <span className="text-xs font-medium text-blue-700">รับงานแล้ว</span>
      </div>
    );
  };

  const filterApplications = (apps: JobApplication[]) => {
    let filtered = apps;

    // Filter by tab
    if (activeTab === "in-progress") {
      filtered = filtered.filter(app => app.job_started_at && !app.payment_completed_at);
    } else if (activeTab === "completed") {
      filtered = filtered.filter(app => app.payment_completed_at);
    }

    // Filter by month
    if (selectedMonth !== "all") {
      const targetMonth = parseInt(selectedMonth);
      filtered = filtered.filter(app => {
        const month = new Date(app.applied_at).getMonth();
        return month === targetMonth;
      });
    }

    return filtered;
  };

  const filteredApplications = filterApplications(applications);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex-1">ประวัติงาน</h1>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-white h-auto p-0">
          <TabsTrigger 
            value="all" 
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
          >
            ทั้งหมด
          </TabsTrigger>
          <TabsTrigger 
            value="in-progress"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
          >
            กำลังส่ง
          </TabsTrigger>
          <TabsTrigger 
            value="completed"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent"
          >
            เสร็จสิ้น
          </TabsTrigger>
        </TabsList>

        {/* Month Filter */}
        <div className="p-4 bg-white">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกเดือน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกเดือน</SelectItem>
              <SelectItem value="0">มกราคม</SelectItem>
              <SelectItem value="1">กุมภาพันธ์</SelectItem>
              <SelectItem value="2">มีนาคม</SelectItem>
              <SelectItem value="3">เมษายน</SelectItem>
              <SelectItem value="4">พฤษภาคม</SelectItem>
              <SelectItem value="5">มิถุนายน</SelectItem>
              <SelectItem value="6">กรกฎาคม</SelectItem>
              <SelectItem value="7">สิงหาคม</SelectItem>
              <SelectItem value="8">กันยายน</SelectItem>
              <SelectItem value="9">ตุลาคม</SelectItem>
              <SelectItem value="10">พฤศจิกายน</SelectItem>
              <SelectItem value="11">ธันวาคม</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={activeTab} className="m-0">
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">ไม่พบประวัติงาน</div>
            ) : (
              filteredApplications.map((app) => (
                <Card
                  key={app.id}
                  className="p-4 space-y-3 bg-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/job/${app.jobs.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                      รหัสออเดอร์ {app.jobs.order_code}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(app.jobs.start_date)} | {formatTime(app.jobs.start_time)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">ผู้จ้าง : </span>
                      <span className="font-medium">{app.jobs.employer_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {app.jobs.job_type === "domestic" ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                          ขนส่งภายในประเทศ
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                            ขนส่งภายนอกประเทศ
                          </Badge>
                          {app.jobs.transport_type?.includes("inbound") && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                              ขาเข้า
                            </Badge>
                          )}
                          {app.jobs.transport_type?.includes("outbound") && (
                            <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                              ขาออก
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {app.jobs.transport_type}
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-2">
                          <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <div className="text-muted-foreground">ต้นทาง</div>
                            <div className="font-medium">{app.jobs.origin_location}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <div className="text-muted-foreground">ปลายทาง</div>
                            <div className="font-medium">{app.jobs.destination_location}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50">
                        <span className="text-lg font-bold text-teal-700">฿ {app.jobs.price.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      {getStatusBadge(app)}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
