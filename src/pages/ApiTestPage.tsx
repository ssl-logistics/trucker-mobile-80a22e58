import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ApiTestPage = () => {
  const { toast } = useToast();
  const [jsonData, setJsonData] = useState(`{
  "order_code": "ORO0006",
  "employer_name": "บริษัททดสอบ จำกัด",
  "job_type": "งานรายวัน",
  "transport_type": "ขนส่งเที่ยวเดียว",
  "origin_location": "กรุงเทพมหานคร",
  "origin_latitude": 13.7563,
  "origin_longitude": 100.5018,
  "destination_location": "ชลบุรี",
  "destination_latitude": 13.3611,
  "destination_longitude": 100.9847,
  "price": 5000,
  "start_date": "2025-12-01",
  "start_time": "09:00",
  "origin_contact_person": "คุณทดสอบ",
  "origin_goods_type": "อิเล็กทรอนิกส์",
  "origin_goods_quantity": "100 กล่อง"
}`);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const sendTestData = async () => {
    try {
      setLoading(true);
      setResponse(null);

      // Parse JSON to validate
      const data = JSON.parse(jsonData);

      // Call the receive edge function
      const { data: result, error } = await supabase.functions.invoke('receive', {
        body: data
      });

      if (error) throw error;

      setResponse(result);
      toast({
        title: "สำเร็จ",
        description: "ส่งข้อมูลไปยัง API สำเร็จ"
      });
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
      setResponse({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ทดสอบ API Receive</h1>
          <p className="text-muted-foreground mt-2">
            ส่งข้อมูล JSON ไปยัง edge function เพื่อทดสอบการรับข้อมูล
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                JSON Data (แก้ไขได้)
              </label>
              <Textarea
                value={jsonData}
                onChange={(e) => setJsonData(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
              />
            </div>

            <Button 
              onClick={sendTestData} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'กำลังส่ง...' : 'ส่งข้อมูลทดสอบ'}
            </Button>
          </div>
        </Card>

        {response && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">ผลลัพธ์</h2>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(response, null, 2)}
            </pre>
          </Card>
        )}

        <Card className="p-6 bg-blue-50 dark:bg-blue-950">
          <h2 className="text-lg font-semibold mb-2">API Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Endpoint:</strong> <code className="bg-muted px-2 py-1 rounded">
              https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/receive
            </code></p>
            <p><strong>Method:</strong> POST</p>
            <p><strong>Content-Type:</strong> application/json</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">ตัวอย่างการเรียกใช้จาก cURL</h2>
          <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
{`curl -X POST \\
  https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/receive \\
  -H "Content-Type: application/json" \\
  -d '{
    "order_code": "ORO0006",
    "employer_name": "บริษัททดสอบ จำกัด",
    "job_type": "งานรายวัน",
    "transport_type": "ขนส่งเที่ยวเดียว",
    "origin_location": "กรุงเทพมหานคร",
    "origin_latitude": 13.7563,
    "origin_longitude": 100.5018,
    "destination_location": "ชลบุรี",
    "destination_latitude": 13.3611,
    "destination_longitude": 100.9847,
    "price": 5000,
    "start_date": "2025-12-01",
    "start_time": "09:00"
  }'`}
          </pre>
        </Card>
      </div>
    </div>
  );
};

export default ApiTestPage;