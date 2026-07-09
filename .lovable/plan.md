แผนการแก้ไข: ปรับประเภทค่าใช้จ่ายสำหรับงาน Booking ให้เหลือ 8 ประเภทเหมือนงาน BL

## สรุปความต้องการ
- งาน BL (มี bl_no) → แสดง 8 ประเภท: น้ำมัน, ค่ามุด/น็อคเอาท์, คืนตู้, ซ่อมตู้, ค่าเสีย, ค่าท่า, เบ็ดเตล็ด, อื่นๆ
- งาน Booking (มี booking_no) → ปรับจาก 5 ประเภทเป็น 8 ประเภท เหมือน BL
- งานอื่น (ในประเทศ) → แสดงครบ 19 ประเภทตามเดิม

## จุดแก้ไข
- ไฟล์: `src/pages/AddExpensePage.tsx`
- บรรทัด 173: อาร์เรย์ `bookingAllowed` ปัจจุบันมี 5 ค่า จะเปลี่ยนให้เป็น 8 ค่าเดียวกับ `blAllowed`

## รายละเอียดเทคนิค
```
const blAllowed = ["fuel", "dive_knock_out", "return_container", "repair_container", "waste", "port_fee", "misc_no_receipt", "other"];
const bookingAllowed = ["fuel", "dive_knock_out", "return_container", "repair_container", "waste", "port_fee", "misc_no_receipt", "other"];
```

หรือกำหนดให้ `bookingAllowed = blAllowed` เพื่อให้ทั้งสองชนิดงานใช้ชุดเดียวกัน

## สิ่งที่ไม่เปลี่ยนแปลง
- ไม่มีการแก้ไข backend หรือฐานข้อมูล
- ไม่มีการเปลี่ยน UI, translation, หรือ validation
- งานในประเทศยังแสดงครบ 19 ประเภท
- เงื่อนไขบังคับกรอกข้อมูลในหน้าบ้านไม่มีการเปลี่ยนแปลง