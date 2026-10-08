# แผน: กรองชนิดไฟล์เอกสารให้ตรงกับที่หลังบ้านรองรับ

## ปัญหา
หลังบ้าน (driver-documents) รับเฉพาะ **รูป JPG/PNG/WEBP/HEIC หรือ PDF** เท่านั้น แต่ตัวกรองไฟล์ในหน้าต่าง "เอกสาร" (ACCEPT_IMAGE_DOC) ยังเปิดให้เลือกไฟล์ Office (.doc/.docx/.xls/.xlsx/.ppt/.pptx) ได้ ทำให้ผู้ใช้แนบไฟล์ได้ แล้วส่งจริงถึงโดนหลังบ้านปฏิเสธ (400: รองรับเฉพาะรูป JPG/PNG/WEBP/HEIC หรือ PDF)

## การแก้ (frontend เท่านั้น ไม่แตะ flow เดิม)

### 1. เพิ่มค่า accept ใหม่ใน `src/utils/uploadAccept.ts`
- คง `ACCEPT_IMAGE_DOC` เดิมไว้ (มีหน้าอื่นใช้อยู่) และเพิ่มค่าใหม่ เช่น `ACCEPT_DOC_ALLOWED` ที่จำกัดเฉพาะ:
  - `image/jpeg, image/png, image/webp, image/heic` + นามสกุล `.jpg .jpeg .png .webp .heic .heif`
  - `application/pdf` + นามสกุล `.pdf`
- ไม่ใช้ `image/*` เพราะจะปล่อย GIF/BMP และรูปชนิดอื่นที่หลังบ้านไม่รับผ่านเข้ามา

### 2. ตรวจไฟล์ก่อนเข้าลิสต์รออัปโหลด — `src/components/job/JobDocumentsSheet.tsx`
- เพิ่ม helper ตรวจชนิดไฟล์: อนุญาตเมื่อเป็น PDF หรือรูป JPG/PNG/WEBP/HEIC/HEIF
  (เช็คทั้ง MIME และนามสกุลไฟล์ เพราะ Safari/ไฟล์ HEIC มักรายงาน MIME ว่าง)
- กรองใน `addPendingFiles`: ไฟล์ที่ไม่รองรับจะ**ไม่ถูกเพิ่มเข้าลิสต์** (เทียบเท่ากับ remove ออกทันที) และแสดง toast เตือนภาษาไทย/อังกฤษ/เกาหลี/จีนว่า "รองรับเฉพาะไฟล์รูปภาพ JPG/PNG/WEBP/HEIC หรือ PDF"
- เปลี่ยน `accept` ของ input ทั้ง 3 ตัว (กล้อง/แกลเลอรี/แนบไฟล์จากเครื่อง) จาก `ACCEPT_IMAGE_DOC` เป็น `ACCEPT_DOC_ALLOWED` — ยังตรวจซ้ำในโค้ดด้วย เพราะ Android/เบราว์เซอร์บางตัวไม่เคารพ accept
- พฤติกรรมเดิมคงไว้: แนบได้ทีละไฟล์ ไฟล์ใหม่แทนไฟล์เดิม, กดอัปโหลดยืนยันเอง, ข้อความ 4 ภาษา

### 3. เพิ่ม key คำแปล — `src/contexts/LanguageContext.tsx`
- `docs.unsupportedFile` (พร้อมชื่อไฟล์ที่ถูกปฏิเสธ) ใน 4 ภาษา: th / en / ko / zh

## สิ่งที่ไม่แตะ
- Edge function driver-documents และหลังบ้านทุกส่วน
- Flow เช็คอิน / SOP / POD / OCR / อัปโหลดรูปอื่น ๆ
- หน้าอื่นที่ยังใช้ `ACCEPT_IMAGE_DOC` อยู่เดิม

## ตรวจสอบ
- `npx tsgo` + build ต้องผ่าน
- ทดสอบด้วย Playwright: แนบ .xlsx → ขึ้น toast เตือนและลิสต์รออัปโหลดว่าง; แนบ .png → เข้าลิสต์รออัปโหลดตามปกติ
