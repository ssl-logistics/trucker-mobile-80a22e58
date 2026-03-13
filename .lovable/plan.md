

# ย้าย Proximity Alert ให้ทำงานทุกหน้า

## ปัญหาปัจจุบัน
`useProximityAlert()` ถูกเรียกใช้เฉพาะใน `Home.tsx` เท่านั้น เมื่อคนขับเปลี่ยนไปหน้าอื่น (เช่น หน้ารายละเอียดงาน, แชท, ตั้งค่า) Hook จะถูก unmount และหยุดตรวจสอบระยะทาง ทั้งที่ระบบ GPS Tracking ยังส่งพิกัดอยู่ตลอด

## วิธีแก้ไข
ย้าย `useProximityAlert()` ออกจาก `Home.tsx` ไปไว้ใน component ระดับบนสุดที่ mount ตลอดเวลา

### ขั้นตอน

**1. สร้าง Global Hook Component**
สร้าง component ใหม่ เช่น `GlobalProximityAlert` ที่เรียก `useProximityAlert()` และ render เป็น `null` (ไม่แสดง UI)

**2. เพิ่มใน App.tsx**
วาง `GlobalProximityAlert` ไว้ภายใน `AuthProvider` และ `Routes` เพื่อให้:
- มี access ถึง user context
- ทำงานตลอดไม่ว่าจะอยู่หน้าไหน

**3. ลบ useProximityAlert ออกจาก Home.tsx**
เอา import และ call ของ `useProximityAlert()` ออกจาก `Home.tsx` เพื่อไม่ให้ทำงานซ้ำซ้อน

## ผลลัพธ์
- ระบบตรวจสอบระยะทางจะทำงานตลอดเวลาที่แอปเปิดอยู่ ไม่ว่าคนขับจะอยู่หน้าไหน
- Push Notification จะถูกส่งไปยังมือถือ (Android/iOS) เมื่อใกล้จุดรับ/ส่งแม้คนขับไม่ได้อยู่หน้า Home

## ข้อจำกัดที่ยังมีอยู่
- หากคนขับปิดแอปทั้งหมด (kill app) ระบบจะหยุดตรวจสอบ เพราะ Capacitor ไม่รองรับ Background Location โดยตรง (ต้องใช้ native plugin เพิ่ม)

---

### รายละเอียดทางเทคนิค

**ไฟล์ที่แก้ไข:**

1. **`src/App.tsx`** - เพิ่ม component ที่เรียก `useProximityAlert()` ไว้ภายใน Router/AuthProvider
2. **`src/pages/Home.tsx`** - ลบ import และ call ของ `useProximityAlert()`

