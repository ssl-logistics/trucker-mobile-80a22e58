import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ApiTestCompanyPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [jsonData, setJsonData] = useState(`{
  "order_code": "COMP-2024-001",
  "employer_name": "บริษัท ABC จำกัด",
  "job_type": "งานสัญญาจ้าง",
  "transport_type": "ขนส่งเที่ยวเดียว",
  "origin_location": "โรงงานกรุงเทพ",
  "destination_location": "คลังสินค้าชลบุรี",
  "price": 15000,
  "start_date": "2024-02-01",
  "start_time": "08:00:00",
  "assigned_role": "company",
  "equipment_list": "รถกระบะ 6 ล้อ",
  "safety_equipment": "เสื้อสะท้อนแสง, รองเท้าเซฟตี้",
  "province": "กรุงเทพมหานคร",
  "district": "บางกะปิ"
}`);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  const sendTestData = async () => {
    try {
      setLoading(true);
      const parsedData = JSON.parse(jsonData);

      const { data, error } = await supabase.functions.invoke(
        "receive-company-factory",
        {
          body: parsedData,
        }
      );

      if (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: error.message,
          variant: "destructive",
        });
        setResponse(JSON.stringify({ error: error.message }, null, 2));
      } else {
        toast({
          title: "ส่งข้อมูลสำเร็จ",
          description: "ส่งข้อมูลงานบริษัท/โรงงานสำเร็จแล้ว",
        });
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถส่งข้อมูลได้",
        variant: "destructive",
      });
      setResponse(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-accent rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">ทดสอบ API บริษัท/โรงงาน</h1>
        </div>
      </div>
      
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-semibold mb-4">ทดสอบ API รับงานบริษัท/โรงงาน</h2>
            <p className="text-muted-foreground mb-4">
              API นี้ใช้สำหรับรับงานจากฝั่งบริษัทและโรงงาน ระบบจะตั้งค่า assigned_role เป็น "company" หรือ "factory" โดยอัตโนมัติ
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">JSON Data:</label>
                <Textarea
                  value={jsonData}
                  onChange={(e) => setJsonData(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="ใส่ JSON data ที่นี่"
                />
              </div>
              
              <Button 
                onClick={sendTestData} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "กำลังส่ง..." : "ส่งข้อมูลทดสอบ"}
              </Button>
            </div>
          </div>

          {response && (
            <div className="bg-card p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <pre className="bg-muted p-4 rounded overflow-auto text-sm">
                {response}
              </pre>
            </div>
          )}

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">ข้อมูล API Endpoint</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Endpoint:</p>
                <code className="block bg-muted p-2 rounded mt-1 text-sm break-all">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-company-factory`}
                </code>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground">Method:</p>
                <code className="block bg-muted p-2 rounded mt-1 text-sm">POST</code>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Headers:</p>
                <code className="block bg-muted p-2 rounded mt-1 text-sm">
                  Content-Type: application/json
                </code>
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">ตัวอย่างการเรียกใช้ cURL</h3>
            <pre className="bg-muted p-4 rounded overflow-auto text-sm">
{`curl -X POST '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-company-factory' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "order_code": "COMP-2024-001",
    "employer_name": "บริษัท ABC จำกัด",
    "job_type": "contract",
    "transport_type": "single",
    "origin_location": "โรงงานกรุงเทพ",
    "destination_location": "คลังสินค้าชลบุรี",
    "price": 15000,
    "start_date": "2024-02-01",
    "start_time": "08:00:00",
    "assigned_role": "company"
  }'`}
            </pre>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">📋 คำแนะนำสำหรับระบบอื่น</h3>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">🎯 สำหรับทีมพัฒนาระบบภายนอก</h4>
                <p className="text-sm mb-3">
                  API นี้รับข้อมูลงานสำหรับฝั่งบริษัทและโรงงาน ส่งข้อมูลงานมาในรูปแบบ JSON ผ่าน HTTP POST
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">📝 ฟิลด์ที่จำเป็นต้องส่ง (Required):</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code>order_code</code> - รหัสงาน (ไม่ซ้ำกัน)</li>
                  <li><code>employer_name</code> - ชื่อนายจ้าง/บริษัท</li>
                  <li><code>job_type</code> - ประเภทงาน: "urgent", "daily", "contract" (ภาษาไทยหรืออังกฤษได้)</li>
                  <li><code>transport_type</code> - ประเภทการขนส่ง: "single", "multi", "import", "export" (ภาษาไทยหรืออังกฤษได้)</li>
                  <li><code>origin_location</code> - จุดรับสินค้า</li>
                  <li><code>destination_location</code> - จุดส่งสินค้า</li>
                  <li><code>price</code> - ราคางาน (ตัวเลข)</li>
                  <li><code>start_date</code> - วันที่เริ่มงาน (YYYY-MM-DD)</li>
                  <li><code>start_time</code> - เวลาเริ่มงาน (HH:MM:SS)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">🔹 ฟิลด์เสริม (Optional):</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><code>assigned_role</code> - ระบุฝั่งงาน: "company" หรือ "factory" (ถ้าไม่ส่ง จะใช้ "company" เป็นค่าเริ่มต้น)</li>
                  <li><code>equipment_list</code> - รายการอุปกรณ์ที่ต้องใช้</li>
                  <li><code>safety_equipment</code> - อุปกรณ์ความปลอดภัย</li>
                  <li><code>province</code>, <code>district</code> - จังหวัด, เขต</li>
                  <li><code>origin_latitude</code>, <code>origin_longitude</code> - พิกัดจุดรับ</li>
                  <li><code>destination_latitude</code>, <code>destination_longitude</code> - พิกัดจุดส่ง</li>
                  <li><code>container_number</code>, <code>seal_number</code> - เลขตู้คอนเทนเนอร์, เลขซีล (สำหรับงานนำเข้า-ส่งออก)</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">✅ Response ที่จะได้รับ:</h4>
                <p className="text-sm mb-2">เมื่อสำเร็จ:</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
{`{
  "status": "success",
  "message": "Company/Factory job created successfully",
  "job_id": "uuid-of-created-job",
  "order_code": "COMP-2024-001",
  "assigned_role": "company",
  "timestamp": "2024-01-30T10:30:00.000Z"
}`}
                </pre>
              </div>

              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">❌ กรณีเกิดข้อผิดพลาด:</h4>
                <pre className="bg-muted p-2 rounded text-xs overflow-auto">
{`{
  "status": "error",
  "message": "Missing required fields",
  "missing_fields": ["start_date", "price"]
}`}
                </pre>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">⚠️ หมายเหตุสำคัญ:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>ระบบรองรับทั้งภาษาไทยและอังกฤษสำหรับ job_type และ transport_type</li>
                  <li>หาก order_code ซ้ำ ระบบจะอัปเดตข้อมูลงานเดิม</li>
                  <li>assigned_role ที่รองรับ: "company", "factory" (หรือ "บริษัท", "โรงงาน")</li>
                  <li>ค่า default ของ assigned_role คือ "company"</li>
                  <li>งานที่สร้างจะแสดงเฉพาะกับคนขับในฝั่งที่ระบุเท่านั้น</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTestCompanyPage;
