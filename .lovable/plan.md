# แผน: ส่งเอกสารแนบงานไปที่ API `/driver-documents`

## สิ่งที่จะทำ

เปลี่ยนหน้าต่าง "เอกสาร" (JobDocumentsSheet) ให้ส่งเอกสารไปที่ API ภายนอก `driver-documents` ตามรูปแบบที่กำหนด แทนการอัปโหลดไป S3 อย่างเดียว

### ข้อมูลที่ส่ง (POST `driver-documents?order_number=...`)

```json
{
  "order_number": "OR20260923009",
  "title": "ใบชั่งน้ำหนัก",
  "description": "ชั่งที่ด่านขาเข้า",
  "driver_name": "manit jaidee",
  "files_base64": ["data:image/jpeg;base64,...", {"file_name": "bill.pdf", "data": "data:application/pdf;base64,..."}]
}
```

- `order_number` — รหัสออเดอร์ (ตัด suffix /01 ออก เหมือนเดิม)
- `title` — หัวข้อเอกสาร (ช่องกรอกใหม่ บังคับกรอก)
- `description` — รายละเอียด (ช่องกรอกใหม่ ไม่บังคับ)
- `driver_name` — ชื่อคนขับ ดึงจากโปรไฟล์ที่ล็อกอินอยู่ (first_name + last_name / full_name / name)
- `files_base64` — ไฟล์ที่แนบ แปลงเป็น base64 data URL; ถ้าเป็น PDF ส่งเป็น object `{file_name, data}` ตามตัวอย่าง

### การเปลี่ยนแปลงในหน้าแอป

1. **src/lib/externalApi.ts** — เพิ่มฟังก์ชัน `uploadDriverDocument()` เรียก `callExternalApi('driver-documents', ...)` แบบ POST ผ่าน proxy เดิม (ไม่เปิดเผย key)
2. **src/components/job/JobDocumentsSheet.tsx**
   - เพิ่มช่องกรอก "หัวข้อเอกสาร" (บังคับ) และ "รายละเอียด" ด้านบนปุ่มแนบเอกสาร
   - รองรับแนบได้หลายไฟล์ต่อครั้ง (เพิ่ม `multiple` ให้ input)
   - แปลงไฟล์เป็น base64 (รูปบีบอัดก่อนตามเดิม, PDF ส่งตรงพร้อม file_name)
   - กดส่งแล้วเรียก API ใหม่ — สำเร็จแสดง toast สำเร็จ + เพิ่มรายการในลิสต์, ล้มเหลวแสดง toast ผิดพลาด
   - เก็บการอัปโหลดไป S3 ไว้ด้วยหรือไม่: **เลิกอัปโหลด S3** ส่งเข้า API ใหม่อย่างเดียว (ตามที่ระบุ) — ถ้าต้องการเก็บ S3 คู่กันแจ้งได้
3. เพิ่มข้อความแปล (ไทย/อังกฤษ) สำหรับช่องหัวข้อ/รายละเอียด

### ไม่แตะต้อง

- flow เช็คอิน / SOP / POD / OCR เดิม
- หน้าอื่นที่ใช้คำว่า driver-documents (สมัครสมาชิก, ข้อมูลรถ) — คนละส่วนกัน

### ตรวจสอบ

- `npx tsgo` + build ต้องผ่าน
- ทดลองแนบรูป + PDF ในหน้างานจริง ดูว่าส่งสำเร็จและแสดงรายการ
