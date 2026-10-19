ซ่อนแถว "Invoice" ในการ์ดจุดรับ/ส่งสินค้า สำหรับงานต่างประเทศ

- งานต่างประเทศ (BL / Booking): ไม่แสดงแถว Invoice
- งานในประเทศ: แสดงเหมือนเดิม (ไม่มีข้อมูลแสดง "-")
- ไม่เปลี่ยนส่วนอื่นหรือขั้นตอนงาน

## Technical
`DomesticJobDetail.tsx` ~บรรทัด 2500: ครอบแถว Invoice ด้วย `!isInternationalJobItem(job)` (จาก `src/lib/jobLocation.ts`) ซึ่งครอบคลุม job_type "bl"/"booking" และงานที่มี bl_no/booking_no
