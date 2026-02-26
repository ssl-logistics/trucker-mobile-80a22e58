

# แผนเพิ่มฟังก์ชันแจ้งเตือนเมื่อรถใกล้จุดรับ/ส่ง แต่ยังไม่อัพโหลดหลักฐาน

## สรุปภาพรวม

เพิ่มระบบตรวจจับว่ารถอยู่ห่างจากจุดรับสินค้า (Pickup) หรือจุดส่งสินค้า (Delivery) ไม่เกิน 1 กม. แต่ยังไม่ได้อัพโหลดหลักฐาน (SOP) โดยจะส่งทั้ง Notification ในแอป และ Push Notification

## ขั้นตอนการทำงาน

### 1. สร้าง Hook ใหม่: `useProximityAlert`

สร้างไฟล์ `src/hooks/useProximityAlert.ts` ที่ทำงานดังนี้:

- ทำงานคู่กับ GPS Tracking ที่มีอยู่แล้ว (ทุกๆ 30 วินาที ตรวจสอบระยะทาง)
- ดึงพิกัดรถปัจจุบันจาก `navigator.geolocation`
- ดึงงานที่กำลังทำอยู่ (Current Jobs) เพื่อได้พิกัดจุดรับ/จุดส่ง
- คำนวณระยะทางด้วยสูตร Haversine
- ตรวจสอบสถานะ SOP/Check-in จาก External API (`getDriverCheckins`, `getDriverSop`)
- ถ้าระยะทาง <= 1 กม. และยังไม่มีหลักฐาน -> ส่งแจ้งเตือน
- ใช้ cooldown (ไม่แจ้งซ้ำภายใน 30 นาทีต่อจุด)

### 2. ฟังก์ชันคำนวณระยะทาง (Haversine)

```text
function haversineDistance(lat1, lng1, lat2, lng2) -> km
- ใช้สูตร Haversine มาตรฐาน
- คืนค่าเป็นกิโลเมตร
```

### 3. Logic ตรวจสอบ

สำหรับแต่ละงานที่กำลังทำ:
- **จุดรับ (Pickup)**: ใช้พิกัด `sender_latitude`, `sender_longitude` เทียบกับพิกัดรถ
  - ถ้า <= 1 กม. และยังไม่ได้ Check-in Pickup หรือยังไม่ได้ทำ Pickup SOP -> แจ้งเตือน
- **จุดส่ง (Delivery)**: ใช้พิกัด `destination_latitude`, `destination_longitude` (รวม multi-destination)
  - ถ้า <= 1 กม. และยังไม่ได้ทำ Delivery SOP/POD -> แจ้งเตือน

### 4. ส่ง In-App Notification

ใช้ Edge Function `get-notifications` ที่มีอยู่แล้ว (action: `create_status_notification`) เพื่อ:
- บันทึกแจ้งเตือนในฐานข้อมูล (ตาราง `notifications`)
- ส่ง Push Notification ผ่าน `send-push-notification`

เนื้อหาแจ้งเตือน:
- ภาษาไทย: "คุณอยู่ใกล้จุดรับสินค้า งาน {order_code} แล้ว กรุณาอัพโหลดหลักฐาน"
- ภาษาอังกฤษ: "You are near the pickup point for job {order_code}. Please upload evidence."

### 5. ติดตั้ง Hook ใน App

เพิ่ม `useProximityAlert()` ใน `src/pages/Home.tsx` (หรือ component ที่ mount ตลอด เช่น `App.tsx`) เพื่อให้ทำงานตลอดเวลาที่ user login อยู่

### 6. Cooldown และ Deduplication

- เก็บ record ใน `localStorage` ว่าเคยแจ้งเตือนจุดไหนไปแล้ว (`proximity_alert_{orderCode}_{type}`)
- ไม่แจ้งซ้ำภายใน 30 นาที
- เมื่อ SOP เสร็จแล้ว ล้าง cooldown ออก

---

## รายละเอียดทางเทคนิค

### ไฟล์ที่สร้างใหม่
| ไฟล์ | รายละเอียด |
|------|-----------|
| `src/hooks/useProximityAlert.ts` | Hook หลักสำหรับตรวจจับระยะทางและส่งแจ้งเตือน |

### ไฟล์ที่แก้ไข
| ไฟล์ | การแก้ไข |
|------|----------|
| `src/pages/Home.tsx` | เพิ่ม `useProximityAlert()` |

### การทำงานของ Hook

```text
useProximityAlert
  |
  +-- ทุก 30 วินาที
  |     |
  |     +-- getCurrentPosition()
  |     +-- โหลด Current Jobs (getDriverAssignedJobs / getFreelanceAcceptedJobs)
  |     +-- สำหรับแต่ละงาน:
  |           +-- คำนวณระยะทางจุดรับ (Haversine)
  |           +-- คำนวณระยะทางจุดส่ง (Haversine)
  |           +-- ตรวจสอบ SOP status (getDriverCheckins)
  |           +-- ถ้า distance <= 1km && ไม่มี SOP && ไม่อยู่ใน cooldown
  |                 +-- เรียก get-notifications (create_status_notification)
  |                 +-- บันทึก cooldown ใน localStorage
  |
  +-- Cleanup on unmount
```

### ข้อมูลพิกัดที่ใช้
- **พิกัดรถ**: จาก `navigator.geolocation.getCurrentPosition()`
- **พิกัดจุดรับ**: `sender_latitude`, `sender_longitude` จาก API response
- **พิกัดจุดส่ง**: `destination_latitude`, `destination_longitude` หรือ `destinations[].latitude/longitude` สำหรับ multi-destination

### สถานะที่ตรวจสอบ
- **จุดรับ**: ดูว่ามี check-in type `pickup` หรือ SOP type `pickup` หรือยัง
- **จุดส่ง**: ดูว่ามี check-in type `delivery` + `delivery_confirmed` หรือยัง

