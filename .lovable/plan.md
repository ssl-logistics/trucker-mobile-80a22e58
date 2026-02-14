

## Plan: ปรับสีพื้นหลังหน้ารายละเอียดงานให้ตรงกับหน้างานปัจจุบัน

### สิ่งที่จะเปลี่ยน
เปลี่ยนสีพื้นหลังของหน้ารายละเอียดงาน (DomesticJobDetail) จาก `bg-background` เป็น `bg-gradient-to-b from-blue-50 to-white` ให้ตรงกับหน้างานปัจจุบัน (CurrentJobsPage)

### รายละเอียดทางเทคนิค

**ไฟล์ที่แก้ไข:** `src/components/job-detail/DomesticJobDetail.tsx`

- บรรทัด 579: เปลี่ยน `className="min-h-screen bg-background pb-20"` เป็น `className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20"`

แก้ไขแค่ 1 จุด ไม่กระทบข้อมูลหรือ layout อื่นใด

