# แชทตลาด (Talad) สำหรับฟรีแลนซ์

เปลี่ยนหน้าต่างแชทมุมขวาล่างของฟรีแลนซ์ จากรายการตัวอย่าง (mockup) ให้เป็นข้อความจริงจากตลาด อ่านได้และตอบกลับได้ โดยจับคู่ห้องแชทตามงานที่ฟรีแลนซ์รับไว้

## สิ่งที่ผู้ใช้จะได้

- กดไอคอนแชท → เห็นรายการห้องแชท 1 ห้องต่อ 1 งานที่รับไว้ พร้อมข้อความล่าสุด เวลา และจำนวนที่ยังไม่อ่าน
- กดเข้าไปในห้อง → เห็นบทสนทนาจริงของงานนั้น เรียงตามเวลา แยกฝั่งเราและฝั่งตลาด
- พิมพ์ข้อความส่งกลับได้ ข้อความจะขึ้นในห้องทันที
- ดึงข้อความใหม่ซ้ำอัตโนมัติทุก ~15 วินาทีขณะเปิดห้อง และตอนเปิดรายการ
- ผู้ใช้บทบาทอื่นไม่กระทบ ยังใช้ปุ่มผู้ช่วยอัตโนมัติเดิม

## ข้อจำกัดที่ต้องแจ้ง

ฝั่งตลาดยังไม่ได้ตั้งค่าปลายทางรับข้อความ (webhook) จากแอปเรา การส่งข้อความจะถูกยิงไปที่ตลาดและได้รับสถานะสำเร็จ แต่ตลาดอาจยังไม่แสดงให้คู่สนทนาเห็นจนกว่าจะตั้งค่าฝั่งนั้นเสร็จ ในแอปเราจะแสดงข้อความที่ส่งไว้เสมอ

## รายละเอียดทางเทคนิค

1. Edge function ใหม่ `talad-chat` (proxy, ใช้ `TALAD_CHAT_API_KEY`, CORS + `x-api-key`):
   - `action: "messages"` → เรียก `talad-push-chat` ด้วย `{ job_id, limit, page, event: "chat.message_created" }` คืน list ข้อความที่ normalize แล้ว (id, job_id, text, image_url, sender, direction, created_at)
   - `action: "send"` → ส่ง push payload `{ source: "trucker-mobile", event: "chat.message_created", messages: [...] }` (`dry_run: false`) และคืนสถานะ
   - ตรวจสอบ input ด้วย zod, log ทุกครั้ง (status/duration/count)
2. เก็บสำเนาข้อความที่ส่งออกไว้ในตาราง `messages`/`conversations` ที่มีอยู่ ไม่แตะ — ใช้ตารางใหม่ `talad_chat_messages` (`id`, `job_id`, `external_message_id`, `driver_id` text, `direction`, `message`, `image_url`, `sender_name`, `created_at`) พร้อม GRANT + RLS (อ่าน/เขียนผ่าน service role ใน edge function เท่านั้น เพราะแอปใช้ custom auth) เพื่อให้ข้อความขาออกไม่หายก่อน webhook พร้อม และใช้เก็บ `last_read_at` ต่อ job ในตาราง `talad_chat_reads`
3. Client:
   - `src/lib/taladChat.ts` — helper เรียก `talad-chat` (list/send) ผ่าน supabase functions พร้อม `apikey`
   - `ChatListSheet.tsx` — แทน MOCK ด้วยงานที่รับไว้จาก `get-freelance-accepted-jobs` + ข้อความล่าสุดต่อ job, สถานะโหลด/ว่าง/ผิดพลาด, badge จำนวนยังไม่อ่าน (เทียบ `last_read_at`)
   - `src/components/chat/TaladChatRoom.tsx` — หน้าห้องแชทในชีตเดิม (หัวข้อ = ชื่องาน/เลขออเดอร์, รายการข้อความ, ช่องพิมพ์ + ปุ่มส่ง, optimistic append, polling 15s)
   - ปุ่มลอยของฟรีแลนซ์ยังเปิดชีตเดิม ไม่เปลี่ยน UI ส่วนอื่น
4. ตรวจสอบก่อนเชื่อมจริง: ยืนยันว่า `job_id` ที่ตลาดใช้ตรงกับฟิลด์ใดในงานที่ฟรีแลนซ์รับไว้ (เช่น `job_id`/`ticket_id`/`order_number`) โดยดึงข้อความทดสอบเทียบ ถ้าไม่ตรง จะเพิ่มการจับคู่ในฝั่ง proxy และแจ้งกลับ
5. ยังคง `test-talad-chat` ไว้สำหรับทดสอบ ไม่ลบ
