
# เพิ่มระบบ Audit Log สำหรับ Edge Functions ที่เกี่ยวกับงาน/ตำแหน่ง

## เป้าหมาย
เก็บ log ทุกครั้งที่มีการเรียก Edge Functions 3 ตัวนี้ ไว้ในตารางเดียวเพื่อ debug และตรวจสอบย้อนหลังได้:
1. `reorder-destinations` — สลับลำดับจุดส่ง
2. `update-tracking-waypoints` — อัปเดต waypoints ห้องติดตาม (ตอนสลับจุด)
3. `create-tracking-room` — สร้างห้องติดตามตอนรับงาน

ทุก log จะเก็บ **driver_id** ด้วยเพื่อรู้ว่าคนขับคนไหนเป็นคนเรียก

---

## 1. สร้างตาราง `edge_function_audit_logs`

Columns หลัก (ข้ามฟิลด์มาตรฐาน id/created_at):
- `function_name` — ชื่อ edge function ที่ถูกเรียก
- `driver_id` — id ของคนขับที่เรียก (nullable, ส่งมาจาก client)
- `order_number` / `order_code` — เลขคำสั่งงานที่เกี่ยวข้อง
- `room_code` — รหัสห้องติดตาม (ถ้ามี)
- `request_payload` (jsonb) — body ที่ client ส่งเข้ามา
- `external_request_payload` (jsonb) — body ที่ส่งต่อไป TMS/tracking API
- `response_status` — HTTP status ที่ได้กลับจาก external API
- `response_body` (jsonb) — response กลับจาก external API
- `success` (boolean) — สำเร็จหรือไม่
- `error_message` — ข้อความ error (ถ้ามี)
- `duration_ms` — เวลาที่ใช้เรียก external API

## 2. สิทธิ์เข้าถึง (RLS)
- `service_role`: อ่าน/เขียนได้ทั้งหมด (edge function ใช้ตัวนี้ในการ insert)
- `authenticated`: อ่านเฉพาะ log ของ `driver_id` ตัวเอง (เผื่ออนาคตอยากดูใน UI)
- `anon`: ไม่ให้เข้าถึง

หมายเหตุ: เนื่องจากโปรเจกต์ใช้ custom auth (`auth.uid()` เป็น null) การอ่านจริงในอนาคตจะต้องผ่าน edge function proxy อีกที — แต่ตั้ง policy ไว้ก่อนตามมาตรฐาน

## 3. แก้ Edge Functions 3 ตัวให้เขียน log

ทั้ง 3 ฟังก์ชันจะ:
1. รับ `driver_id` เพิ่มจาก request body (optional field ใหม่ — ไม่ทำให้ของเดิมพัง)
2. หลังจากเรียก external API เสร็จ (ทั้งกรณี success และ error) → insert 1 row ลงตาราง audit ผ่าน service role client
3. ใช้ try/catch หุ้ม insert เพื่อไม่ให้ audit ล้มเหลวกระทบ flow หลัก
4. Log ทั้ง status code, response body, duration และ error

ไฟล์ที่แก้:
- `supabase/functions/reorder-destinations/index.ts`
- `supabase/functions/update-tracking-waypoints/index.ts`
- `supabase/functions/create-tracking-room/index.ts`

## 4. Client-side: ส่ง `driver_id` เพิ่ม

เพิ่ม `driver_id` (จาก `localStorage` auth user) ลงใน request body ตอนเรียก 3 ฟังก์ชันนี้:
- `src/components/job-detail/DomesticJobDetail.tsx` — จุดเรียก `reorder-destinations` และ `update-tracking-waypoints` (ราวบรรทัด 1093-1169)
- จุดที่เรียก `create-tracking-room` (ตอนรับงาน / start job) — ต้อง grep หา call site แล้วเพิ่ม `driver_id` ให้ครบทุกจุด

การเปลี่ยนแปลงเป็นแบบ additive — field ใหม่ optional ทั้งหมด ของเก่ายังทำงานได้ปกติ

---

## Technical details

**Migration SQL (สรุป):**
```
CREATE TABLE public.edge_function_audit_logs (...);
GRANT SELECT ON public.edge_function_audit_logs TO authenticated;
GRANT ALL   ON public.edge_function_audit_logs TO service_role;
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ...;
CREATE POLICY "drivers read own logs" USING (driver_id = ...);
CREATE INDEX ON (function_name, created_at DESC);
CREATE INDEX ON (driver_id, created_at DESC);
CREATE INDEX ON (order_number);
```

**Insert ใน edge function:**
```ts
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
await supabase.from('edge_function_audit_logs').insert({
  function_name: 'reorder-destinations',
  driver_id, order_number, request_payload: body,
  external_request_payload: payload,
  response_status: response.status,
  response_body: responseData,
  success: response.ok, duration_ms,
});
```

## นอกขอบเขต
- ไม่สร้าง UI สำหรับดู log (query ผ่าน DB tool ได้)
- ไม่ย้อน log ของ call เก่าที่เกิดก่อนหน้านี้
- ไม่แตะ edge function อื่นนอก 3 ตัวข้างต้น
