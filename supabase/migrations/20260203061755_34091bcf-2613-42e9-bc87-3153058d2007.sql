-- Create chatbot_faqs table for storing common Q&A
CREATE TABLE public.chatbot_faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;

-- Allow public read access (no auth needed for FAQ)
CREATE POLICY "Anyone can read active FAQs"
ON public.chatbot_faqs
FOR SELECT
USING (is_active = true);

-- Insert basic FAQs for common questions
INSERT INTO public.chatbot_faqs (keywords, question, answer, category, priority) VALUES
-- Greetings
(ARRAY['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ดี'], 'สวัสดี', 'สวัสดีครับ! ยินดีต้อนรับสู่ TheTroob มีอะไรให้ช่วยไหมครับ? 😊', 'greeting', 100),
(ARRAY['ขอบคุณ', 'thank', 'thanks'], 'ขอบคุณ', 'ยินดีครับ! หากมีคำถามเพิ่มเติมสามารถถามได้ตลอดเวลาครับ 🙏', 'greeting', 90),

-- App features
(ARRAY['สมัคร', 'ลงทะเบียน', 'register', 'signup'], 'วิธีสมัครใช้งาน', 'การสมัครใช้งาน TheTroob:
1. กดปุ่ม "สมัครสมาชิก" ที่หน้าแรก
2. กรอกข้อมูลส่วนตัว เบอร์โทร และรหัสผ่าน
3. ยืนยัน OTP ทาง SMS
4. กรอกข้อมูลรถและเอกสาร
5. รอการอนุมัติจากทีมงาน

หลังจากได้รับการอนุมัติก็สามารถเริ่มรับงานได้เลยครับ!', 'registration', 80),

(ARRAY['รับงาน', 'งาน', 'job', 'หางาน'], 'วิธีรับงาน', 'วิธีรับงานใน TheTroob:
1. ดูงานที่แนะนำในหน้าแรก (Home)
2. กดเข้าไปดูรายละเอียดงาน
3. กดปุ่ม "รับงาน" หากสนใจ
4. ติดตามงานได้ที่หน้า "Current Jobs"

งานจะแบ่งเป็น 2 ประเภท:
- งานที่ได้รับมอบหมาย (Assigned Jobs)
- งานประมูล (Bidding Jobs)', 'jobs', 75),

(ARRAY['ประมูล', 'bidding', 'bid', 'เสนอราคา'], 'วิธีประมูลงาน', 'วิธีประมูลงานใน TheTroob:
1. ไปที่หน้า "Bidding" ในเมนูล่าง
2. ดูรายการงานที่เปิดประมูล
3. กดเข้าไปดูรายละเอียดงาน
4. กดปุ่ม "เสนอราคา"
5. กรอกราคาที่ต้องการเสนอ
6. รอผลการพิจารณาจากผู้ว่าจ้าง

หมายเหตุ: การประมูลต้องใช้ Bid Ticket ครับ', 'bidding', 70),

(ARRAY['รายได้', 'เงิน', 'income', 'payment', 'จ่าย'], 'ดูรายได้', 'ดูรายได้ใน TheTroob:
1. ไปที่หน้า "Income" ในเมนูล่าง
2. จะเห็นรายได้รวมและรายละเอียดแต่ละงาน
3. สามารถกรองดูตามช่วงเวลาได้

การรับเงินจะโอนเข้าบัญชีธนาคารที่ลงทะเบียนไว้ครับ', 'income', 65),

(ARRAY['ติดต่อ', 'contact', 'support', 'ช่วยเหลือ', 'แจ้งปัญหา'], 'ติดต่อเรา', 'ช่องทางติดต่อ TheTroob:
- แชทในแอป: ไปที่หน้า Chat
- โทร: [เบอร์ติดต่อ]
- อีเมล: support@thetroob.com

หากพบปัญหาขณะทำงาน สามารถกด "แจ้งปัญหา" ในหน้างานได้ครับ', 'support', 60),

(ARRAY['check-in', 'เช็คอิน', 'checkin', 'รับสินค้า'], 'การ Check-in', 'การ Check-in ในงาน:
1. เมื่อถึงจุดรับสินค้า กดปุ่ม "Check-in"
2. ระบบจะบันทึกตำแหน่งและเวลา
3. ถ่ายรูปสินค้าตาม SOP
4. ดำเนินการขนส่งไปยังจุดหมาย
5. Check-in ที่จุดส่งสินค้า

หมายเหตุ: ต้องเปิด GPS เพื่อให้ระบบทำงานได้ถูกต้องครับ', 'workflow', 55);