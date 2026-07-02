## แก้ให้ Container Size + Agent แสดงเฉพาะงานต่างประเทศ

ตอนนี้โค้ดที่ `src/components/job-detail/DomesticJobDetail.tsx` (บรรทัด 1557–1582) แสดงแถว **ขนาดตู้** และ **Agent** โดย**ไม่มีเงื่อนไข** ทำให้งานในประเทศก็โชว์ด้วย

### สิ่งที่จะแก้
- ห่อบล็อก container size + Agent ด้วยเงื่อนไข "งานต่างประเทศ" เท่านั้น
- เกณฑ์ตรวจว่าเป็นงานต่างประเทศ ใช้แพทเทิร์นเดียวกับที่โปรเจกต์ใช้อยู่ (BL / Booking):
  - `!!job.bl_no || !!job.booking_no` (หรือ helper `isInternationalJob` ถ้ามี)
- ถ้าไม่ใช่งานต่างประเทศ → ไม่แสดงทั้ง 2 แถว (กลับไปเป็นเหมือนเดิมก่อนหน้าที่เพิ่ม)
- งานในประเทศทั้งหมดคงพฤติกรรมเดิม ไม่มีผลกระทบส่วนอื่น

### ไฟล์ที่แตะ
- `src/components/job-detail/DomesticJobDetail.tsx` — เพิ่ม guard `isInternational` รอบบล็อก IIFE ที่ render container size + Agent

ไม่แก้ `JobDetailPage.tsx` (การ map `container_size` / `agent` เข้า object ยังเก็บไว้ได้ ไม่กระทบ UI งานในประเทศ)