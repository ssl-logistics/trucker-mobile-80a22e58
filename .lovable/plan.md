
# แผนแก้ไข: สถานะเช็คอิน Pickup ไม่อัพเดตเป็น "รอ SOP"

## สรุปปัญหา
API ส่งข้อมูลเช็คอินมาถูกต้อง แต่ logic การ filter ใน `useCheckinStatus` hook ทำงานผิดพลาดเนื่องจาก:

1. **Field name ไม่ตรงกับ API response**:
   - Code เช็ค: `checkin.order_number`
   - API ส่งมา: `checkin.transport_orders.order_number`

2. **API call ซ้ำซ้อนด้วย parameter ต่างกัน**:
   - บางที่ใช้: `freelance_driver_id=xxx` (เก่า)
   - บางที่ใช้: `driver_id=xxx&driver_type=internal` (ใหม่ - ถูกต้อง)

---

## ไฟล์ที่ต้องแก้ไข

### 1. `src/hooks/useCheckinStatus.ts`

**การแก้ไข:**
- แก้ไขการเข้าถึง `order_number` ให้อ่านจาก `transport_orders.order_number` แทน
- รองรับทั้งสอง format เผื่อ API เปลี่ยน

```typescript
// ก่อน (Line 76)
const matchesOrder = checkin.order_number === orderNumber;

// หลัง
const matchesOrder = 
  checkin.order_number === orderNumber || 
  checkin.transport_orders?.order_number === orderNumber;
```

### 2. `src/pages/JobDetailPage.tsx` (ถ้าจำเป็น)

**ตรวจสอบ:**
- ให้แน่ใจว่าทุกจุดที่เรียก API check-in ใช้ parameter `driver_id` + `driver_type` ที่ถูกต้อง
- ลบการเรียก API แบบเก่าที่ใช้ `freelance_driver_id` สำหรับ Internal/External drivers

---

## ผลลัพธ์ที่คาดหวัง

หลังแก้ไข:
1. เมื่อมีข้อมูลเช็คอิน pickup ในระบบ → สถานะจะแสดงเป็น **"รอ SOP"**
2. Internal Driver จะเห็นสถานะที่ถูกต้องตาม `internal_driver_id` ที่ตรงกัน
3. Filter logic จะทำงานถูกต้องกับ nested data structure

---

## รายละเอียดทางเทคนิค

**API Response Structure ที่ได้รับ:**
```json
{
  "transport_order_id": "53430cbd-...",
  "checkin_type": "pickup",
  "internal_driver_id": "bdfb4171-...",
  "transport_orders": {
    "id": "53430cbd-...",
    "order_number": "OR20260126001",
    "status": "in_transit"
  }
}
```

**Filter Logic ที่แก้ไขแล้ว:**
```typescript
const checkins = result.data.filter((checkin: any) => {
  // Match by order_number (support both flat and nested)
  const matchesOrder = 
    checkin.order_number === orderNumber || 
    checkin.transport_orders?.order_number === orderNumber;
  
  // Match driver ID based on driver type
  let matchesDriver = false;
  if (isInternalDriver) {
    matchesDriver = checkin.internal_driver_id === driverId;
  } else if (isExternalDriver) {
    matchesDriver = checkin.external_driver_id === driverId;
  } else {
    matchesDriver = checkin.freelance_driver_id === driverId;
  }
  
  return matchesOrder && matchesDriver;
});
```
