
# แผนแก้ไข: สถานะจุดส่งในงานหลายที่ไม่อัพเดตหลังเช็คอิน

## ปัญหา
งานหลายจุดส่ง (Multi-destination) เช็คอินจุดส่งแรกแล้ว แต่สถานะยังแสดงเป็น "รอเช็คอิน" แทนที่จะเป็น "รอชำระเงิน" เหมือนงานส่งเที่ยวเดียว

## สาเหตุ
API ส่งข้อมูลเช็คอินแบบ `checkin_type: "delivery"` โดยไม่มี sequence number แต่โค้ดพยายามหา `delivery_1`, `delivery_2` หรือ `destination_sequence_number` ซึ่งไม่มีใน API response ทำให้ `destinationCheckins` เป็น object ว่างและสถานะไม่ถูกต้อง

## การแก้ไข

### ไฟล์: `src/components/job-detail/DomesticJobDetail.tsx`

**เพิ่ม Fallback Logic สำหรับ `checkin_type: "delivery"` ที่ไม่มี sequence number:**

1. หากมี `checkin_type === 'delivery'` และ **ไม่มี** `destination_sequence_number` หรือ `delivery_N` pattern → ถือว่าเป็นเช็คอินสำหรับจุดส่งแรก (sequence 1)

2. อัพเดต logic ในส่วน Lines 389-424 ให้รองรับกรณีนี้:

```typescript
// ก่อน (ไม่รองรับ delivery ธรรมดา)
checkins.forEach((c: any) => {
  const deliveryMatch = c.checkin_type?.match(/^delivery_(\d+)$/);
  if (deliveryMatch) { ... }
  // ...
});

// หลัง (รองรับ delivery ธรรมดา → fallback เป็น sequence 1)
checkins.forEach((c: any) => {
  // รองรับ delivery ธรรมดา (ไม่มี _N) สำหรับงานหลายจุดส่ง
  // fallback เป็น sequence 1 หากไม่มี destination_sequence_number
  if (c.checkin_type === 'delivery' && !c.destination_sequence_number) {
    if (!destCheckins[1]) {
      destCheckins[1] = { checked_in_at: null, sop_completed_at: null };
    }
    destCheckins[1].checked_in_at = c.checked_in_at || c.created_at;
  }
  
  // รองรับ delivery_confirmed ธรรมดา → fallback เป็น sequence 1
  if (c.checkin_type === 'delivery_confirmed' && !c.destination_sequence_number) {
    if (!destCheckins[1]) {
      destCheckins[1] = { checked_in_at: null, sop_completed_at: null };
    }
    destCheckins[1].sop_completed_at = c.checked_in_at || c.created_at;
  }
  
  // เดิม: รองรับ delivery_N, delivery_confirmed_N
  const deliveryMatch = c.checkin_type?.match(/^delivery_(\d+)$/);
  if (deliveryMatch) { ... }
  // ...
});
```

---

## ผลลัพธ์ที่คาดหวัง

| สถานการณ์ | ก่อนแก้ไข | หลังแก้ไข |
|-----------|----------|----------|
| จุดส่ง #1 เช็คอินแล้ว | รอเช็คอิน (ผิด) | รอชำระเงิน (ถูก) |
| จุดส่ง #1 ยืนยัน POD แล้ว | รอเช็คอิน (ผิด) | POD สำเร็จ (ถูก) |

---

## รายละเอียดทางเทคนิค

**API Response ปัจจุบัน (ไม่มี sequence):**
```json
{
  "checkin_type": "delivery",
  "transport_order_id": "75a8f1bc-...",
  "checked_in_at": "2026-02-05T18:01:49..."
}
```

**Logic ที่เพิ่ม:**
- หาก `checkin_type === 'delivery'` และไม่มี pattern `_N` และไม่มี `destination_sequence_number` → map เข้า `destCheckins[1]`
- ใช้หลักการเดียวกันกับ `delivery_confirmed`

**หมายเหตุ:** หาก API ถูกปรับปรุงในอนาคตให้ส่ง `destination_sequence_number` มาด้วย logic นี้จะยังคงทำงานถูกต้องเพราะเป็น fallback เท่านั้น
