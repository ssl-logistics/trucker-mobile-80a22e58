# หน้าจุดส่งสินค้า: เปิดทันที ไม่ขึ้นหน้าจอ "กำลังโหลด..."

## สิ่งที่คนขับจะเห็น
1. กดจุดส่งสินค้าจากหน้างาน หน้าจุดส่งจะเปิดพร้อมข้อมูลทันที (ใช้ข้อมูลงานที่โหลดไว้ตั้งแต่เปิดงาน) ไม่มีวงกลมหมุนกลางจอ
2. สถานะเช็กอิน/ส่งสินค้าจะอัปเดตเงียบๆ ด้านหลัง ระหว่างนั้นแสดงแค่จุดหมุนเล็กๆ ที่ส่วนที่กำลังเช็ก (ปุ่มยังกดไม่ได้จนเช็กเสร็จ เหมือนเดิม)
3. กลับเข้ามาหน้าเดิมซ้ำ จะไม่ดึงข้อมูลใหม่ทั้งหน้า ใช้ข้อมูลที่จำไว้ก่อน แล้วค่อยอัปเดตด้านหลัง
4. กรณีเปิดหน้าตรงๆ ที่ยังไม่มีข้อมูลเลย (เช่น เปิดจากแจ้งเตือน) จะแสดงโครงหน้าจอแบบสีเทา (หัวหน้า + การ์ด) แทนวงกลมหมุนเปล่าๆ

## Technical details
- `DeliveryDetailPage.tsx`:
  - Init `job`/`destination` synchronously from `location.state.jobData` (or a per-order sessionStorage cache) so `loading` starts false when data exists.
  - `loadJobDetail`: only `setLoading(true)` when no job is shown yet; reruns from `user`/driver-type changes refresh silently.
  - Cache resolved job+destination in sessionStorage keyed by order+destination; read first on mount.
  - Replace the full-page spinner with a skeleton layout (header bar + 3 card placeholders) using existing `Skeleton`.
- No change to data rules, check-in logic or buttons.
