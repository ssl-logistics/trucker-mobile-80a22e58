# Plan: ทดสอบแชท Talad ผ่าน Edge Function แบบ Two-way

## เป้าหมาย
สร้าง Edge Function สำหรับทดสอบการเชื่อมต่อแชทกับตลาด Talad ทั้งสองทิศทาง:
1. **Pull** — ดึงข้อความจาก Talad API (`talad-push-chat`)
2. **Push** — จำลอง webhook ที่ Talad ส่งเข้ามา และประมวลผลให้เข้า conversations/messages ของแอป

## งานที่ต้องทำ

### 1. สร้าง Edge Function `receive-talad-chat-message`
- รับ payload แบบ Talad webhook (`source`, `event`, `messages[]` ที่มี `job_id`, `message`, `sender`, `recipient`)
- แปลงเป็นโครงสร้างภายใน:
  - `chat_id` = `job_id`
  - `target_user_email` = อีเมลผู้รับ (หรือหา user_id จาก auth ถ้าไม่มี email)
  - `message.text`, `message.sender_id`, `message.sender_name`
  - `source_project.id` = `talad-trucker-marketplace`
- ใช้ Service Role สร้าง/อัปเดต `external_chat_config`, `conversations`, `external_user_mapping`, `external_chat_messages`
- เรียก `send-push-notification` เพื่อแจ้งเตือนผู้รับ
- ตอบกลับ `{ success, conversation_id, message_id }`

### 2. สร้าง Edge Function `test-talad-chat`
- รับ POST body ที่มี:
  - `job_id` (optional, default ค่าจาก Postman collection)
  - `target_user_email` (optional, default `test@truckers.app`)
  - `dry_run` (default `true`)
- ทำ 2 ขั้นตอน:
  1. **Pull test**: ยิง POST ไปยัง `https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-chat` พร้อม `x-api-key` จาก `Deno.env.get('TALAD_API_KEY')` และ `dry_run`
  2. **Push test**: สร้าง payload ตัวอย่างจาก Pull test (หรือ sample) แล้วเรียก `receive-talad-chat-message` ภายใน project ตัวเอง
- คืนผลลัพธ์รวม: `{ pull: { ok, status, count, sample }, push: { ok, status, conversation_id, message_id } }`

### 3. เพิ่ม CORS และ Security
- ทั้งสอง function ใส่ `corsHeaders` รองรับ `authorization, x-client-info, apikey, content-type, x-api-key, x-app-secret`
- `test-talad-chat` ตรวจ `APP_EDGE_SHARED_SECRET` หรือ `apikey` เพื่อป้องกันการเรียกจากภายนอก (optional ตามความเหมาะสม)

### 4. เขียน Deno Tests
- `supabase/functions/receive-talad-chat-message/index.test.ts` — ทดสอบแปลง payload Talad และบันทึกลง DB
- `supabase/functions/test-talad-chat/index.test.ts` — ทดสอบ pull/push ด้วย mock fetch

### 5. เอกสารการทดสอบ
- เพิ่มวิธีเรียก `test-talad-chat` ผ่าน curl/Postman ในเอกสารสั้น ๆ ให้ทีม QA

## ไฟล์ที่เกี่ยวข้อง
- สร้างใหม่:
  - `supabase/functions/receive-talad-chat-message/index.ts`
  - `supabase/functions/test-talad-chat/index.ts`
  - `supabase/functions/receive-talad-chat-message/index.test.ts`
  - `supabase/functions/test-talad-chat/index.test.ts`
- ใช้ Secrets ที่มีอยู่แล้ว:
  - `TALAD_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_EDGE_SHARED_SECRET` (ถ้าต้องการ gate test function)
