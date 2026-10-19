หัวการ์ดดรอปตู้ในหน้า "งานปัจจุบัน"

- หัวการ์ดสีส้มแสดง: "จุดดรอป" ตามด้วย BL หรือ Booking ของงาน เช่น "จุดดรอป · BL HLCUS2X2609BGNZ7"
- ไม่มีเลขลำดับต่อท้าย
- ย้าย BL/Booking ออกจากป้ายในเนื้อการ์ด (ไม่ให้ซ้ำ) เหลือแค่ "รหัสตู้ : 06"
- เนื้อหาอื่นและปุ่ม ดูข้อมูลงาน / โทร / เส้นทาง คงเดิม

## Technical
- `DropPointListCard.tsx`: ส่ง `title={`${t('dropPoint.label')} · ${ref}`}` ให้ `ExtraPointCard`, เอา chip ref ออกจาก subtitle
- เพิ่ม key `dropPoint.label`: th "จุดดรอป", en "Drop point", ko "드롭 지점", zh "甩柜点"
