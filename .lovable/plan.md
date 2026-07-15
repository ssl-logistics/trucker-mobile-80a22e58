
## สรุปผลตรวจ log สำหรับ OR20260715025

ตรวจตาราง `edge_function_audit_logs` แล้ว **ไม่มี log ใด ๆ** ที่เกี่ยวข้องกับ order นี้เลย — ทั้ง `create-tracking-room` และ `client:create-tracking-room:*` (จากฝั่ง browser)

ทั้งตารางมีแค่ 1 แถวคือ record ทดสอบ `TEST-AUDIT`

## เหตุที่ log ไม่ขึ้น

1. **ผู้ใช้เป็น internal driver** (console log: `driver_type: "internal"`). Path ที่จะเรียก `createTrackingRoom` จากฝั่ง client มี 3 จุด:
   - `Home.tsx` → ปุ่ม "รับงาน" freelance (บรรทัด 886)
   - `Home.tsx` → ปุ่ม "เริ่มงาน" staff/internal (บรรทัด 1051, background)
   - `CurrentJobsPage.tsx` → bid accept (บรรทัด 948)
   - `PickupDetailPage.tsx` → ตอน check-in pickup (บรรทัด 382)

2. งาน OR20260715025 น่าจะถูก **auto-assign จากระบบ dispatcher** (มาผ่าน webhook `receive-freelance-selected` ฝั่ง server) — ซึ่ง path นี้เรียก `create-tracking-room` ด้วย `fetch` ตรง โดย**ไม่มีการเขียน audit log** ทั้งฝั่ง caller และไม่ผ่าน `log-client-event`

3. ถ้าผู้ใช้แค่เข้ามาดูหน้ารายละเอียดงานโดยไม่ได้กดปุ่ม "เริ่มงาน / รับงาน" ก็จะไม่มีการเรียกสร้างห้องเลย

**ยังไม่ต้องเช็คอินก่อน** — ห้องควรถูกสร้างตอนกดปุ่มรับ/เริ่มงาน แต่กรณีนี้ยังไม่พบว่าปุ่มไหนถูกกด

## แผนแก้ไขที่เสนอ

### 1. เพิ่ม audit log ที่ `receive-freelance-selected` (server-side)
บันทึกทุกครั้งที่ webhook นี้พยายามสร้างห้อง — `attempt`, `success`, `error` — พร้อม order_number, response_status, response body

### 2. เพิ่ม audit log ที่ `create-tracking-room` ฝั่ง server ให้บันทึกทุก request ที่เข้ามา
ตอนนี้บันทึกเฉพาะบาง path (ดูจาก log line 50, 110, 145, 170, 191) — เพิ่ม log แรกสุด `create-tracking-room:received` เพื่อยืนยันว่ามี request เข้าจริงหรือไม่ พร้อม caller (`x-api-key` vs `apikey`) และ headers info

### 3. เพิ่ม log จุด "accept factory job" / "start job" ก่อนเรียก createTrackingRoom
เขียน `client:accept-job:pressed` ใน Home.tsx (freelance + staff paths) และ CurrentJobsPage — เพื่อพิสูจน์ว่าผู้ใช้กดปุ่มจริง หรือ event ไม่เกิดขึ้น

### 4. เพิ่ม `log-client-event` เข้า `supabase/config.toml` อย่างชัดเจน (`verify_jwt = false`) — เพื่อกันปัญหา config drift

## หลังจากแก้เสร็จ ต้องทำอะไร
- ให้ผู้ใช้ทดสอบรับงานใหม่อีก 1 งาน
- Query:
  ```sql
  SELECT function_name, order_number, success, response_status, error_message, created_at
  FROM edge_function_audit_logs
  WHERE order_number = '<NEW_ORDER>'
  ORDER BY created_at DESC;
  ```
- จะได้ trace ครบตั้งแต่ผู้ใช้กดปุ่ม → client fetch → server received → external API response

## รายละเอียดเชิงเทคนิค (สำหรับ developer)
- Client logger `logClientEvent` ใน `src/lib/trackingRoomClient.ts` ใช้ `keepalive: true` แล้ว จึงไม่ควรถูก cancel ตอน navigate — ไม่ต้องแก้
- `edge_function_audit_logs` columns: `function_name, driver_id, order_number, room_code, request_payload, external_request_payload, response_status, response_body, success, error_message, duration_ms, created_at`
- Server-side insert ใช้ `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS) เหมือน pattern เดิมใน `log-client-event`
