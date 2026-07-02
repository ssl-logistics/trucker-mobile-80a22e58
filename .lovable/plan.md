## แสดงข้อมูลลูกค้า inline (ไม่ต้องกดเปิด modal)

### ปัจจุบัน
ที่ `src/components/job-detail/DomesticJobDetail.tsx` บรรทัด 1769–1778 มีปุ่ม "ข้อมูลลูกค้า" ที่ต้องกดเพื่อเปิด Dialog แสดงชื่อลูกค้า / เลขผู้เสียภาษี / ที่อยู่ / ผู้ติดต่อ / เบอร์ / หมายเหตุ

### สิ่งที่จะแก้
- แทนที่ปุ่มด้วยบล็อกแสดงข้อมูลลูกค้า inline ใต้จุดรับ ใช้ layout เดียวกับ row อื่นๆ ในการ์ด (icon + label + value ขนาด text-sm/xs)
- แสดงเฉพาะฟิลด์ที่มีค่า: `customer_name`, `tax_id`, `address`, `province/district`, `contact_name`, `contact_phone` (คลิกโทรได้), `notes`
- ลบปุ่ม + state `customerModalData` + Dialog ที่ไม่ใช้แล้ว (บรรทัด 2786–2839 และ useState บรรทัด 264)
- คงเงื่อนไข render เดิม: แสดงเมื่อ `job.origin_customer` มีค่า

### ไฟล์ที่แตะ
- `src/components/job-detail/DomesticJobDetail.tsx` เท่านั้น