# รองรับข้อมูลคิว QTruck จากเส้นงาน (ธง has_qtruck_booking)

## สิ่งที่ยืนยันแล้ว (ตรวจโค้ดแล้ว)
- หน้างานปัจจุบันรวมงานจาก 4 เส้น: `get-freelance-accepted-jobs`, `get-factory-assigned-jobs`, `list-tickets`, `get-driver-assigned-jobs`
- ทุกจุดรวมงานใช้การส่งผ่านทุกช่อง (spread) — ช่องใหม่จาก API ไหลถึงการ์ดอัตโนมัติ
- `list-tickets` เป็นตัวกลางของแอปที่ส่งต่อผลตอบจากระบบหลักแบบไม่เปลี่ยนแปลง
- `getQueueInfo` ใน `CurrentJobsPage.tsx` อ่านช่องคิว: `has_queue`, `queue_data.{my_queue|queue_number, current_queue, remaining_queues}`, `queue_number`, `current_queue`, `remaining_queues`, `queue_estimated_time`

## เงื่อนไขจากระบบหลัก
- เส้น `get-driver-assigned-jobs` จะส่งช่อง `has_qtruck_booking` (true/false) — บอกว่างานนั้นมีการจองคิว QTruck หรือไม่
- **เช็คจากเส้นนี้เส้นเดียว** — เฉพาะงานที่โหลดมาจาก `get-driver-assigned-jobs` เท่านั้นที่มีโอกาสแสดงปุ่มคิว; งานจากเส้นอื่น (freelance-accepted / factory / list-tickets) ไม่แสดงปุ่มคิวและไม่แก้ไขอะไร
- แสดงปุ่มคิวเมื่อ `has_qtruck_booking === true` (รองรับ `'true'` / `1`)
- งานที่ไม่มีธงหรือเป็น false → แสดงปุ่มดูข้อมูลงานเต็มความกว้างปุ่มเดียวเหมือนเดิม

## สิ่งที่จะทำ (UI เท่านั้น — ไม่แตะวิธีดึงข้อมูล)
1. **ติดป้ายงานจากเส้น get-driver-assigned-jobs** — ตอนรวมรายการงานใน `CurrentJobsPage.tsx` ให้งานชุดนั้นมีตัวระบุแหล่งที่มา (เช่นช่องภายใน `_fromDriverAssigned`) เพื่อแยกจากงานเส้นอื่น
2. **แก้ `getQueueInfo`** — คืนค่าปุ่มคิวเฉพาะเมื่องานมาจากเส้น get-driver-assigned-jobs **และ** `has_qtruck_booking` เป็นจริง (หรือมี `queue_data` จริงส่งมาพร้อมธง)
3. **ค่าในป๊อปอัป** — ใช้ข้อมูลจริงจาก `queue_data` เมื่อส่งมา ถ้ามีแต่ธงแต่ยังไม่ส่งตัวเลข ใช้ค่าตัวอย่างเดิม (คิว 0015 / Q012 / เหลือ 2 คิว / เวลาตัวอย่าง) จนกว่าระบบหลักส่งค่าจริง
4. ป๊อปอัปคิวและข้อความ 4 ภาษามีอยู่แล้ว — ไม่แตะ

## ไฟล์ที่แก้
- `src/pages/CurrentJobsPage.tsx` — จุดรวมงานจาก get-driver-assigned-jobs + ฟังก์ชัน `getQueueInfo`

## ไม่ได้ทำ
- ไม่แตะ Edge Functions หรือเส้น API — ข้อมูลคิวรอรับจากระบบหลัก
- ไม่อัปเดตคิวแบบเรียลไทม์ / ไม่เพิ่มการยิงเส้นใหม่
