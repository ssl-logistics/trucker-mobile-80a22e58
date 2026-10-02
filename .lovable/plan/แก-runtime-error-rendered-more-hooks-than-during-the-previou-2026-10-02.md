# แก้ Runtime Error: Rendered more hooks than during the previous render (หน้าประวัติงาน)

## สาเหตุ (ยืนยันแล้วจากโค้ด)
ใน `src/pages/JobHistoryPage.tsx` มี early return ตอนโหลดอยู่ที่บรรทัด ~804:

```tsx
if (loading) {
  return <JobHistoryLoadingSkeleton ... />;
}
```

แต่ยังมี `useEffect` อีกตัวอยู่ถัดลงมา (บรรทัด ~809 — ตัวรีเซ็ตหน้า pagination) ซึ่งประกาศหลัง early return

ผลคือ: รอบแรกที่ `loading = true` คอมโพเนนต์ return ก่อน ทำให้ useEffect ตัวหลังไม่ถูกเรียก → พอโหลดเสร็จ (`loading = false`) useEffect ตัวนั้นถูกเรียกเพิ่ม → React ฟ้อง "Rendered more hooks than during the previous render" แล้วจอขาว

เกิดจากการเพิ่ม skeleton ตอนโหลดในรอบก่อน โดยวาง early return ไว้ก่อน hooks ทั้งหมด

## สิ่งที่จะทำ
1. ย้ายบล็อก `if (loading) { return ...skeleton... }` ลงไปไว้หลัง hooks ทั้งหมด (หลัง `useEffect` ตัวสุดท้าย ก่อน `return` หลัก) ใน `src/pages/JobHistoryPage.tsx`
2. ไม่เปลี่ยนพฤติกรรมอื่น — skeleton ยังแสดงตอนโหลดครั้งแรก (ไม่มีแคช) เหมือนเดิม

## ตรวจสอบ
- `bunx tsgo --noEmit` ผ่าน
- ตรวจ `/tmp/observability/build-errors.log` ว่า build OK
- เปิดหน้าประวัติงานยืนยันว่าไม่มี error จอขาวอีก

## ขอบเขต
- แก้เฉพาะ `src/pages/JobHistoryPage.tsx` (ย้ายตำแหน่ง early return เท่านั้น)
- ไม่แตะตรรกะการดึงข้อมูล แคช หรือหน้าอื่น
