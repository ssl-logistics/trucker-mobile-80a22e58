# แผนแก้ปัญหา Tracking Room — Reorder Fallback + Container Check-in Auto-create

## เป้าหมาย
1. Reorder จุดส่ง (ในประเทศ) ที่ไม่มีห้อง → auto-create ให้เลย ไม่ blank screen
2. Container/BL/Booking check-in จุดแรก (งานใหม่) → auto-create ห้องถ้ายังไม่มี
3. Server `get-tracking-room` ตอบ 200 null แทน 404 เมื่อข้อมูลไม่พอ recreate

## การเปลี่ยนแปลง

### 1. Server: `supabase/functions/get-tracking-room/index.ts`
- เมื่อ Tier 3 recreate ต้องใช้ coords/plate แต่ payload ไม่มี → return **HTTP 200** `{ room_code: null, source: 'not_started', tier: 0 }` แทน 404
- กรณี recreate ล้มเหลวจริง (call `create-tracking-room` แล้ว error) → ยังคง 502 ตามเดิม
- Audit log บันทึก `source='not_started'` เพื่อแยกจาก error จริง

### 2. Client: `src/components/job-detail/DomesticJobDetail.tsx` — `handleReorderConfirm`
- หลังเรียก `getRoomCodeForOrder()` ถ้าได้ `null`:
  - ประกอบ payload จาก job data ที่มีอยู่: `truck_plate`, pickup coords (จุดแรกล่าสุด) เป็น `origin`, จุดส่งสุดท้ายที่ resequence แล้วเป็น `destination`, GPS ปัจจุบันเป็น `current`, waypoints = จุดกลางทั้งหมด
  - เรียก `createTrackingRoom()` (import จาก `trackingRoomClient.ts`)
  - ถ้าสำเร็จ → เก็บ `room_code` ลง cache + localStorage → เรียก `update-tracking-waypoints` ตามปกติ
  - ถ้าล้มเหลว → toast "บันทึกลำดับใหม่แล้ว แต่ยังไม่ได้อัปเดตเส้นทาง GPS" (ไม่ block, ไม่ throw)
- ถ้า `getRoomCodeForOrder()` คืนค่า room (Tier 1/2 hit) → พฤติกรรมเดิม 100%

### 3. Client: `src/pages/ContainerCheckInPage.tsx`
- หลัง submit check-in สำเร็จ (fire-and-forget, ไม่ block UI):
  - เช็ค `localStorage.getItem('room_code_' + orderCode)` — ถ้ามีอยู่แล้ว → skip
  - ถ้าไม่มี → ประกอบ payload: `origin` = container pickup coords, `destination` = job final delivery coords, `current` = GPS ปัจจุบัน, `truck_plate` จาก job/localStorage
  - เรียก `createTrackingRoom()` — เก็บ `room_code` ลง localStorage เมื่อสำเร็จ
  - Error ทั้งหมด log แบบ warn เท่านั้น ไม่ throw
- เฉพาะงานใหม่หลัง deploy — ไม่ backfill งาน BL/Booking เก่า

## สิ่งที่ไม่แตะ
- Schema / migration
- `create-tracking-room`, `receive-freelance-selected`, `reorder-destinations`, `update-tracking-waypoints`
- `PickupDetailPage.tsx` (โดเมสติก) — auto-create มีอยู่แล้ว
- Home / CurrentJobs / flow ปกติของงานใหม่

## Backward Compat
- APK เก่า: ได้ประโยชน์จาก server 200 null (ลด error) แต่ auto-create ฝั่ง client ไม่มี → พฤติกรรมเดิม
- APK ใหม่: ครอบคลุมทั้ง reorder งานเก่าไม่มีห้อง + BL/Booking ใหม่

## Verification
1. `OR20260715026` (งานไม่มีห้อง) → เปิดหน้างาน → reorder จุดส่ง → เห็น toast success + row ใหม่ใน `order_tracking_rooms` + ไม่มี blank screen
2. Reorder ซ้ำครั้งที่ 2 → Tier 1 cache hit ไม่สร้างซ้ำ
3. `OR20260614011` (งานปกติ) → reorder → พฤติกรรมเดิม 100%
4. งาน BL/Booking ใหม่ → check-in จุดแรก → audit log `create-tracking-room:success` โผล่
5. งาน BL/Booking เก่า → check-in → ไม่มีห้องถูกสร้าง (ตามที่ตกลง)
