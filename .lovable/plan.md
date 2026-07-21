## เป้าหมาย
แก้เฉพาะ `sequence_order` ที่ยิงไป external tracking ผ่าน `notifyCheckinWaypoint` ให้เป็น **0-based** และ Booking = 3 จุด (ข้าม Delivery)
- **ไม่แตะ** UI, workflow, order status, DB, useCheckinStatus, DomesticJobDetail, จำนวน/ลำดับหน้าจอในแอป
- ปรับเฉพาะเลขที่ส่ง external (payload only)

## Mapping ใหม่ (payload ที่ยิง external เท่านั้น)

| งาน | จุด | เดิม | ใหม่ |
|---|---|---|---|
| Domestic | Pickup | 1 | **0** |
| Domestic | Delivery #1 | 2 | **1** |
| Domestic | Delivery #N | N+1 | **N** |
| BL | Container Pickup | 1 | **0** |
| BL | Delivery | 2 | **1** |
| BL | Container Return | 3 | **2** |
| Booking | Container Pickup | 1 | **0** |
| Booking | Pickup (โรงงาน) | 2 | **1** |
| Booking | Delivery | — | **ข้าม (ไม่ยิง)** |
| Booking | Container Return | 3 | **2** |

Booking จะยิง external ทั้งหมด 3 ครั้ง เท่ากับ BL (แม้ในแอปยังมีหน้า Delivery ตามเดิม แค่ไม่ส่ง waypoint ที่จุดนั้น)

## ไฟล์ที่แก้

1. **`supabase/functions/checkin-waypoint/index.ts`** (บรรทัด 50)
   - `if (!room_code || !sequence_order)` → `if (!room_code || sequence_order == null || sequence_order < 0)` เพื่อรับ 0

2. **`src/pages/PickupDetailPage.tsx`** (บรรทัด 411–413)
   - Domestic: `1 → 0`
   - Booking: `2 → 1`

3. **`src/pages/DeliveryDetailPage.tsx`** (บรรทัด 936–939)
   - เพิ่ม guard: ถ้า `job.booking_no` → **ไม่เรียก** `notifyCheckinWaypoint` (skip Delivery สำหรับ Booking)
   - International BL: `2 → 1`
   - Domestic multi-dest: `destination.sequence_number ?? 1` (backend 1-based = waypoint index ตรงกันพอดี)
   - Fallback: `2 → 1`

4. **`src/pages/ContainerCheckInPage.tsx`** (บรรทัด 596)
   - `isContainerReturn ? 3 : 1` → `isContainerReturn ? 2 : 0`

5. **`src/hooks/useProximityAlert.ts`** (บรรทัด 280)
   - `booking_no ? 2 : 1` → `booking_no ? 1 : 0`

## สรุปความเสี่ยง

**สูง**
- **External อาจไม่รองรับ seq=0** — ถ้า validate `>= 1` จะได้ error กลับมา pickup แรกทุกงาน mark ไม่สำเร็จ
  - บรรเทา: ทดสอบ 1 งานหลัง deploy, ดู log proxy ทันที, rollback ได้ในไฟล์เดียว
- **APK/build เก่าที่ user ติดตั้ง** ยังยิง 1-based ต่อไป external จะมี mixed data ระหว่างเวอร์ชัน
  - บรรเทา: proxy รับทั้งสองแบบ, ยอมรับ transition period

**กลาง**
- **ห้องที่กำลังวิ่ง (in-flight rooms)** — ห้องที่เคยยิง pickup=1 ไปแล้ว หลัง deploy จะยิง delivery=1 ซ้ำเลขเดิม external อาจตอบ "already checked in" (409)
  - บรรเทา: proxy ห่อ 200 envelope, UI ไม่ crash, แค่ noise ใน log
- **Booking in-flight** — งาน Booking ที่เพิ่งเช็คอิน pickup โรงงาน (เดิม seq=2) หลัง deploy จะยิง return=2 ซ้ำเลข 2
  - บรรเทา: เหมือนด้านบน — reject ซ้ำ, ไม่กระทบ UI
- **Booking Delivery ที่ skip** — external จะไม่เห็น waypoint delivery ของ Booking อีกต่อไป ถ้า dashboard/report ฝั่ง external พึ่งข้อมูลนี้ อาจเห็นงาน "ข้าม" จุด
  - บรรเทา: ตกลงกับทีม external ก่อน หรือยอมรับว่า Booking = 3 จุดเท่านั้นในระบบใหม่

**ต่ำ**
- **`destination.sequence_number` ไม่ตรง 1-based** — ถ้าบาง endpoint คืน null/0 จะยิงเลขผิด
  - บรรเทา: มี fallback `?? 1`
- **Proximity auto-checkin ยิง seq=0** — เดิมยิง 1 ก็มี noise อยู่แล้ว ไม่เพิ่มความเสี่ยงใหม่

## ไม่ครอบคลุม (ตามคำสั่งผู้ใช้)
- ไม่แก้จำนวนหน้า / flow ในแอป (Booking ยังผ่าน DeliveryDetailPage ตามเดิม)
- ไม่แตะ status transitions, DB, RLS, migration
- ไม่แก้ business logic

## ยืนยันก่อนลงมือ
รับความเสี่ยง 3 ข้อสูง/กลาง (external อาจ reject seq=0, in-flight rooms log ซ้ำ, Booking ไม่มี delivery ฝั่ง external) ได้ไหม?