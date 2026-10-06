# เปลี่ยนเมนู "เอกสาร" เป็นหน้าแนบ/อัปโหลดเอกสาร (ยังไม่ดึงข้อมูลมาแสดง)

## สิ่งที่ตกลงกัน

- เมนู "เอกสาร" บนแถวปุ่มงาน ใช้สำหรับ **อัปโหลด/แนบเอกสาร** ของออเดอร์นั้นเท่านั้น
- **ยังไม่ดึงข้อมูลเอกสารจาก API มาแสดง** — ตัดส่วน fetch (get-driver-sop / get-driver-checkins) ออกทั้งหมด

## การแก้ไข

### 1. `src/components/job/JobDocumentsSheet.tsx` (เขียนใหม่)

Bottom sheet เดิม แต่เปลี่ยนเนื้อหาเป็น:

- ปุ่ม "แนบเอกสาร" — เปิดตัวเลือก ถ่ายรูป / เลือกจากแกลเลอรี (hidden file inputs แพตเทิร์นเดียวกับ `EditablePhoto`, รองรับรูป + PDF/เอกสารผ่าน `ACCEPT_IMAGE_DOC`)
- อัปโหลดขึ้น S3 ผ่าน edge function `upload-to-s3` (โฟลเดอร์ `mobile/documents/<order_number>/`, ตั้งชื่อไฟล์ `doc-<timestamp>`) — ใช้ `compressImage` เฉพาะไฟล์รูป
- แสดงรายการไฟล์ที่อัปโหลดสำเร็จในเซสชันนั้น (ชื่อไฟล์ + เวลา) เพื่อให้คนขับเห็นว่าแนบอะไรไปแล้วบ้าง — เก็บใน state ของ sheet เท่านั้น ไม่ดึงย้อนหลัง
- ระหว่างอัปโหลดแสดง spinner, สำเร็จ/ล้มเหลวแจ้ง toast (แพตเทิร์นเดียวกับ `EditablePhoto`)
- ลบโค้ด fetch/presign/buildGroups/i18n หมวดเอกสารที่ไม่ใช้แล้วออก

### 2. `src/contexts/LanguageContext.tsx`

- เพิ่มคีย์ครบ 4 ภาษา (th/en/ko/zh): `docs.attach` (แนบเอกสาร), `docs.takePhoto`, `docs.chooseFromGallery`, `docs.uploading`, `docs.uploadSuccess`, `docs.uploadFailed`, `docs.emptyUploaded` (ยังไม่ได้แนบเอกสาร)
- ลบคีย์หมวดแสดงเอกสารที่ไม่ใช้แล้ว (`docs.groupPickup`, `docs.groupWeightSlips`, `docs.groupPod`, `docs.groupSignatures`, `docs.groupTms`, `docs.loadFailed`, `docs.retry`) — เก็บ `docs.title` ไว้

## ไม่แตะ

- ปุ่ม "เอกสาร" บนแถวปุ่ม (`JobActionButtons.tsx`) และไอคอน — คงเดิม
- Flow เช็คอิน/SOP/POD/ลายเซ็น ทั้งหมด
- ไม่ผูกไฟล์ที่อัปโหลดเข้ากับ TMS ในขั้นนี้ (รอ spec ว่าจะส่ง URL ไปเก็บที่ไหน)

## ตรวจสอบหลังแก้

- typecheck + build ผ่าน
- กด "เอกสาร" → เห็นปุ่มแนบเอกสาร, อัปโหลดรูปได้, ขึ้นรายการที่แนบแล้ว, ไม่มีการเรียก get-driver-sop/get-driver-checkins
