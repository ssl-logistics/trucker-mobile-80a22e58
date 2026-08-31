# ดึงงานตลาดจาก talad-push-job มาแสดงในหน้า "ตลาด"

## เป้าหมาย
เปลี่ยนแหล่งข้อมูลของหน้า `/market` จาก `get-express-rent-posts` เป็น API ภายนอก
`https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-job` (POST, ยืนยันด้วย `x-api-key`)
โดย UI เดิม (การ์ดงาน, ค้นหา, แบ่งหน้า 5 งาน) คงไว้ทั้งหมด

## สิ่งที่จะทำ

### 1. Edge function proxy ใหม่: `get-talad-jobs`
- รับ POST จากแอป (ไม่ต้องส่ง key จากฝั่ง client)
- เรียก `talad-push-job` แบบ POST พร้อมส่ง header `x-api-key` จาก secret `TALAD_API_KEY`
- คืน `{ jobs: [...] }` ตามที่ปลายทางส่งมา พร้อม CORS (รวม `x-app-secret` แบบเดียวกับ function อื่นในโปรเจกต์)
- มี log ย่อ (จำนวนงาน / error) เพื่อดีบักภายหลัง

### 2. Client API helper (`src/lib/api.ts` หรือไฟล์ใหม่ `src/lib/taladApi.ts`)
- ฟังก์ชัน `getTaladJobs()` เรียก edge function ผ่าน `supabase.functions.invoke`

### 3. หน้า Market (`src/pages/MarketPage.tsx`)
- เปลี่ยน `loadJobs()` มาใช้ `getTaladJobs()`
- กรองเฉพาะงาน `status === "open"` (และ `auction_status === "open"` ถ้ามี)
- map ฟิลด์เข้ากับ interface `Job` เดิมเพื่อไม่ต้องแก้ `JobCard`:
  - `id/post_id` ← `job_id`, `order_code` ← `talad_code` (fallback `job_id` ตัดสั้น)
  - `employer_name` ← `poster.company_name` / `poster.contact_name`
  - `origin_location` ← `locations.pickup` → `origin`
  - `destination_location` ← `locations.dropoff` → `destination`
  - `price` ← `final_price` → `price`, `transport_type` ← `truck_type`
  - `start_date` ← `locations.pickup_date` → `created_at`
  - `goods_type` ← `title`, `remarks` ← `description`, `booking_no` ← `container.booking_no`
- ค้นหา/แบ่งหน้าเดิมทำงานกับข้อมูลใหม่โดยไม่ต้องแก้
- งานจากตลาดยัง "ไม่มี" endpoint รับงาน — ปุ่มรับงานจะแสดงข้อความว่ายังไม่รองรับการรับงานจากตลาดนี้ (แทนการยิง `accept-express-rent-job` ผิดระบบ) จนกว่าจะได้เส้น accept ของ talad

## Technical details
- Secret ใหม่: `TALAD_API_KEY` — จะขอผ่านฟอร์มบันทึกความลับหลังอนุมัติแผน
- ไม่แตะ Home / Bidding / โครงสร้าง JobCard
- ตัวกรองประเภทรถ (`canHandleJobTruckType`) ใช้ `truck_type` จาก API ใหม่

## การทดสอบ
- เรียก proxy ตรงเพื่อดูจำนวนงานที่ได้
- เปิด `/market` ด้วยบัญชีฟรีแลนซ์ ตรวจว่าการ์ดแสดงต้นทาง/ปลายทาง/ราคา/ผู้ว่าจ้างถูกต้อง และค้นหา/เปลี่ยนหน้าได้
