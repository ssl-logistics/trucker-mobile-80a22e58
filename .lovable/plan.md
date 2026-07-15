# เพิ่ม client-side log + เปลี่ยน invoke เป็น fetch สำหรับ `create-tracking-room`

## เป้าหมาย
ให้เห็นได้ว่า client ยิง `create-tracking-room` สำเร็จ/ล้มเหลว และรู้ error message จริง เพื่อ debug ปัญหา OR20260715022 ที่เห็นแค่ OPTIONS ไม่มี POST

## สิ่งที่จะทำ

### 1. Edge function ใหม่ `log-client-event`
รับ event จาก client แล้ว insert ลงตาราง `edge_function_audit_logs` เดิม (`function_name = 'client:<event>'`) ผ่าน service role. Fire-and-forget, return 200 เสมอ ไม่ block flow

Fields ที่รับ: `event`, `driver_id`, `order_number`, `room_code`, `payload`, `response_status`, `response_body`, `success`, `error_message`, `duration_ms`

### 2. Helper ใหม่ `src/lib/trackingRoomClient.ts`
Export `createTrackingRoom(body, context)`:
- **ใช้ `fetch` ตรง** ไปที่ `${VITE_SUPABASE_URL}/functions/v1/create-tracking-room` พร้อม `apikey` + `Authorization: Bearer <anon_key>` — เลี่ยง `supabase.functions.invoke()` ที่ fail เงียบ ๆ กับ custom auth
- Log 3 event ผ่าน `log-client-event`:
  - `create-tracking-room:attempt` — ก่อนยิง (payload + context)
  - `create-tracking-room:success` — สำเร็จ (status + response + room_code + duration)
  - `create-tracking-room:error` — fail (status + error message + duration)
- คืน `{ ok, status, data, error }`

### 3. แทนที่ 4 call sites เดิม
เปลี่ยน `supabase.functions.invoke('create-tracking-room', ...)` → `createTrackingRoom(body, '<context>')`:
- `src/pages/Home.tsx` ~885 (context: `home-freelance-accept`)
- `src/pages/Home.tsx` ~1053 (context: `home-staff-accept`)
- `src/pages/PickupDetailPage.tsx` ~381 (context: `pickup-checkin`)
- `src/pages/CurrentJobsPage.tsx` ~947 (context: `current-jobs-bid`)

รักษา logic เดิมทั้งหมด (localStorage `room_code_*`, การจับ 409 idempotent, ฯลฯ) — แค่เปลี่ยนวิธีเรียก

## หลังทดสอบรับงานใหม่ 1 รอบ — query ตรวจได้:
```sql
SELECT function_name, order_number, response_status, success, error_message, duration_ms, created_at
FROM edge_function_audit_logs
WHERE order_number = 'OR...'
ORDER BY created_at;
```

จะแยกได้ทันที:
| เห็นอะไร | แปลว่า |
|---|---|
| ไม่มี `client:*:attempt` | Code ไม่ได้เข้า branch ที่เรียก |
| มี `attempt` + `error` (fetch threw) | Network ล้มก่อนถึง server |
| มี `attempt` + `error` (HTTP 4xx/5xx) | ถึง server แต่ปลายทาง reject — ดู response_body ได้ |
| มี `attempt` + `success` + row `create-tracking-room` | ทำงานครบ end-to-end |

## นอกขอบเขต
- ไม่แตะ 3 edge function เดิม (server-side audit ทำงานถูกแล้ว)
- ไม่ทำ UI ดู log
- ไม่แก้ retry logic
