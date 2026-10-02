# ซ่อนช่องทะเบียนรถในหน้าแจ้งซ่อม (ยังส่งค่าไป API เหมือนเดิม)

## ทำอะไร
- เอาช่องกรอก "ทะเบียนรถ *" (label + input) ออกจากหน้าแจ้งซ่อม — หน้าจะขึ้นเริ่มจาก "รายละเอียด" เป็นช่องแรก
- ค่าทะเบียนยังเติมให้เองจากข้อมูลรถแบบเดิม (user.plate_number + plate_province หรือ auth_truck_plate) และยังส่งไปกับ payload เมื่อกดส่ง — ส่วนส่งข้อมูลไม่เปลี่ยนเลย

## ที่โดนแก้
- `src/pages/RepairReportPage.tsx`
  - ลบ UI บล็อก License plate (label + Input)
  - ลบ `setLicensePlate` ที่ไม่ใช้แล้ว (เปลี่ยนเป็นค่าคงที่จาก prefill)
  - เก็บ prefillPlate, licensePlate, และ payload `license_plate` ตามเดิม
  - เก็บกันพลาดไว้: ถ้าไม่มีทะเบียนเลยในเครื่องนั้น ยังขึ้นเตือน "กรุณาระบุทะเบียนรถ" ตอนกดส่ง (เกิดได้ยากมาก เพราะเติมให้อัตโนมัติ)
- ไม่แตะ edge function `report-vehicle-maintenance` และไม่แตะหน้าอื่น
