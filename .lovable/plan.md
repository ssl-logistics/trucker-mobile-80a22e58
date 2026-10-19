# เช็คอินจุดดรอปตู้ และจุดรับ/ส่งสินค้าเพิ่ม (ถ่ายรูป + ส่งสถานะ)

ใช้เส้นเช็คอินเดิม `driver-checkin` ตามเอกสาร v2 ที่แนบมา ไม่มีเส้นใหม่

## ลำดับขั้น (เฉพาะงานต่างประเทศที่มีจุดเพิ่ม)

```text
รับตู้ (เดิม)
  -> จุดดรอปตู้: ถ่ายรูป -> ส่ง extra_drop         (สถานะ: ดรอปแล้ว)
  -> รับตู้ที่ดรอปไว้: ถ่ายรูป -> ส่ง extra_drop_pickup (สถานะ: รับตู้แล้ว)
  -> จุดรับ/ส่งสินค้าหลัก (เดิม)  <- ปลดล็อกเมื่อรับตู้ที่ดรอปครบทุกจุด
  -> จุดรับ/ส่งสินค้าเพิ่ม: ถ่ายรูป -> ส่ง extra_cargo (สถานะ: เสร็จ)
  -> คืนตู้ (เดิม)               <- ปลดล็อกเมื่อจุดสินค้าเพิ่มครบทุกจุด
```

งานที่ไม่มีจุดเพิ่ม และงานในประเทศ: ทุกขั้นเหมือนเดิมทั้งหมด ไม่ตรวจเงื่อนไขใหม่

## สิ่งที่ผู้ใช้จะเห็น

- การ์ดจุดดรอป / รับตู้ที่ดรอป / จุดสินค้าเพิ่ม มีปุ่ม "เช็คอิน" -> เปิดกล้อง/เลือกรูป (ได้หลายรูป บังคับอย่างน้อย 1) + ช่องหมายเหตุ -> ยืนยันส่ง
- หัวการ์ดเปลี่ยนสีตามสถานะ: รอขั้นก่อนหน้า (เทา) / รอเช็คอิน / เสร็จแล้ว (เขียว)
- ขั้น "รับตู้ที่ดรอป" กดได้ต่อเมื่อจุดนั้นดรอปแล้ว
- ขั้นถัดไปที่ยังล็อกจะแสดง "รอขั้นตอนก่อนหน้า" เหมือนเดิม
- ถ้าระบบหลักตอบว่ายังไม่ครบ (409) แสดงข้อความและรายชื่อจุดที่ขาดเป็นภาษาไทย
- ในประวัติงาน: แสดงรูปและสถานะอย่างเดียว

## Technical details

- `src/lib/externalApi.ts`: เพิ่ม `checkinExtraPoint({ orderNumber, type: 'extra_cargo'|'extra_drop'|'extra_drop_pickup', sequence, photoUrls, notes, lat, lng })` เรียก `driver-checkin` พร้อมข้อมูลคนขับเหมือนเช็คอินเดิม; parse `error_code` (PHOTO_REQUIRED, EXTRA_POINT_INVALID_STATE, EXTRA_POINTS_INCOMPLETE, EXTRA_POINT_NOT_FOUND)
- อัปโหลดรูปผ่านตัวอัปโหลด S3 เดิม (`upload-to-s3`) แบบขนาน แล้วส่ง `photo_urls`
- สถานะจุด: อ่านจาก `status` ใน `extra_cargo_points[]` / `extra_drop_points[]` (pending/completed/dropped/picked_up) ผสานกับผลเช็คอินที่เพิ่งทำ (เก็บในเครื่องชั่วคราวผ่าน `optimisticCheckins` / `lib/extraPoints.ts` ปรับให้ตรง status จริง) และ `get-driver-checkins` ที่ type extra_* + `destination_sequence_number`
- หน้าใหม่ `ExtraPointCheckinPage` (route เดิม `/job/:jobId/extra-point/:kind/:seq`, เพิ่ม step drop/pickup) : กล้องตามแบบหน้าเช็คอินเดิม (input ซ่อนสำหรับ Safari), ส่งพิกัดอัตโนมัติ, กลับหน้ารายละเอียดงานเมื่อสำเร็จ
- `DomesticJobDetail.tsx`:
  - `allDropsPickedUp` (true เมื่อไม่มีจุดดรอป) -> AND เข้าเงื่อนไขปลดล็อกการ์ดจุดรับ/ส่งสินค้าหลักเฉพาะเมื่อมีจุดดรอป
  - `allDeliveriesCompleted = mainCargoCompleted && allExtraCargoDone` (true เมื่อไม่มีจุดเพิ่ม) สำหรับการ์ดคืนตู้
  - จุดสินค้าเพิ่มปลดล็อกเมื่อจุดหลักเสร็จ
  - `ExtraPointCard`: เพิ่ม prop `status`, `locked`, `onCheckin` และสีหัวการ์ดตามสถานะ
- คำแปล TH/EN/ZH/KO สำหรับปุ่ม สถานะ และข้อความผิดพลาด
- Unit tests ใน `src/lib/__tests__/extraPoints.test.ts`: ไม่มีจุดเพิ่ม -> ไม่ล็อก; drop ยังไม่ picked_up -> ล็อกจุดหลัก; cargo ยังไม่ completed -> ล็อกคืนตู้; ครบ -> ปลดล็อก
- อัปเดต roadmap.md และ memory (กฎลำดับจุดเพิ่ม)
