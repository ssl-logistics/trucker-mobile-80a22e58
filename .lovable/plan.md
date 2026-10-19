# จุดรับ/ส่งสินค้าเพิ่ม และการ์ดดรอปตู้ แสดงเฉพาะงานต่างประเทศ

## สิ่งที่จะแก้
- การ์ดดรอปตู้ (สีส้ม) ในหน้า "งานปัจจุบัน": แสดงเฉพาะงานต่างประเทศ (BL / Booking) งานในประเทศจะไม่แสดง
- การ์ดจุดรับ/ส่งสินค้าเพิ่ม ในหน้ารายละเอียดงาน: แสดงเฉพาะงานต่างประเทศเช่นกัน (ใส่เงื่อนไขกันไว้ชัดเจน)
- งานในประเทศหน้าตาและขั้นตอนเหมือนเดิมทุกอย่าง

## รายละเอียดทางเทคนิค
- `src/pages/CurrentJobsPage.tsx` (~1492): render `DropPointListCard` เมื่อ `isInternationalJobItem(job)` เท่านั้น
- `src/components/job-detail/DomesticJobDetail.tsx` (~2847): `xcPoints = isInternationalJobItem(job) ? (...) : []`
- ใช้ `isInternationalJobItem` จาก `src/lib/jobLocation.ts`; ไม่แตะ flow เช็คอิน/SOP/POD/คืนตู้
