
## Problem

จากล็อก:
- ห้อง `RM26JFUV` มีอยู่แล้ว (create-tracking-room สำเร็จ) แต่ถูกสร้างด้วย `origin_lat/lng = 0,0` และไม่มี waypoints
- เวลาเช็คอินจุด (checkin-waypoint) ส่ง `sequence_order: 1/2/3` ระบบภายนอกตอบ **404 "No matching waypoint found (or already checked in)"** เพราะห้องนั้นไม่มี waypoint ที่ seq นั้น ๆ ให้ match
- 404 จาก edge proxy ถูก Lovable overlay จับเป็น RUNTIME_ERROR + blank screen (ทั้ง ๆ ที่โค้ด client เป็น fire-and-forget)

ผู้ใช้ถามถูก: "ถ้าเช็คอินไม่ได้/หาห้องไม่เจอ ไม่ส่งไปสร้าง (หรือ sync) ห้องหรอ" — ปัจจุบันเราสร้างห้องอย่างเดียว แต่ไม่ได้ sync waypoints ให้ห้องนั้นก่อนเช็คอิน จึงเกิด 404 แม้ห้องมีอยู่

## Scope (backend proxy + minor client)

แก้เฉพาะ path เช็คอิน waypoint — ไม่แตะ business logic, ไม่แตะ external API payload

### 1. `supabase/functions/checkin-waypoint/index.ts` (proxy) — auto-repair + retry

เพิ่ม self-healing เมื่อได้ 404:

```text
POST /checkin-waypoint { room_code, sequence_order, order_number?, waypoints? }
  → forward → external
     ├─ 200/201 → return as-is
     ├─ 404 "No matching waypoint" →
     │     1) call update-tracking-waypoints ({ room_code, waypoints? หรือ order_number })
     │     2) retry checkin-waypoint (once)
     │     └─ still 404 → return 200 + { ok:false, code:'no_matching_waypoint', retried:true }
     └─ อื่นๆ → return 200 + { ok:false, status, body }  // ไม่ให้ overlay จับเป็น RUNTIME_ERROR
```

หมายเหตุ:
- proxy รับ `order_number` เพิ่ม เพื่อส่งต่อให้ `update-tracking-waypoints` (ซึ่ง resolve room_code ได้จาก store อยู่แล้ว)
- ตอบ HTTP 200 เสมอเมื่อ forward ไปถึง external ได้ (แนบ `ok/status/body` ใน JSON) เพื่อไม่ทำ blank screen ใน preview; ยัง log status จริงไว้ในทั้ง `console.log` และ audit log

### 2. `src/lib/checkinWaypoint.ts` — pass optional context

- เพิ่ม field เผื่อไว้ใน payload:
  - `order_number?: string`
  - `waypoints?: Array<{lat:number; lng:number}>`
- อ่านผล JSON, ถ้า `ok===false` ให้ `console.warn` เฉย ๆ (ยังคง fire-and-forget)

### 3. Callers ใส่ `order_number` + waypoints เท่าที่รู้

แก้ 3 ที่ให้ส่ง context ครบขึ้น เพื่อให้ proxy sync waypoints ได้ตอน 404:

- `src/pages/PickupDetailPage.tsx` (บรรทัด ~414)
- `src/pages/DeliveryDetailPage.tsx` (บรรทัด ~940)
- `src/pages/ContainerCheckInPage.tsx` (บรรทัด ~591)

ส่ง `{ room_code, sequence_order, order_number: job.order_code, waypoints: [...] }` โดย waypoints ประกอบจากพิกัดที่ page นั้นรู้อยู่แล้ว (origin/dest/current/container return) — ถ้าไม่มีก็ไม่ส่ง แล้วให้ `update-tracking-waypoints` ไป resolve จาก store

## ทำไมพอ

- 404 = ห้องมี แต่ waypoint sequence นั้นไม่มี → auto-sync แล้ว retry แก้ที่รากของปัญหา
- ผู้ใช้ไม่ต้องเจอ blank screen อีก (proxy ห่อ error ให้เป็น success envelope)
- ไม่ต้องแก้ create-tracking-room หรือ external contract; ไม่กระทบ flow อื่น

## Risk

Low — เปลี่ยนพฤติกรรมของ proxy ให้ resilient ขึ้น, client ยังคง fire-and-forget เหมือนเดิม. ถ้า update-tracking-waypoints ล้มเหลว จะได้ผลลัพธ์เท่าปัจจุบัน (ยัง log 404 แต่ไม่ crash).

## Out of scope

- ไม่แก้ create-tracking-room ให้บังคับ origin ที่ถูกต้อง (แยกงาน — ต้องรื้อ Start Job flow)
- ไม่แตะ UI แจ้งเตือน/ปุ่ม
