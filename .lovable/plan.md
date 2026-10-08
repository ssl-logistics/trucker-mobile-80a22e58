# แผน: เพิ่มตัวเลือก "แนบไฟล์จากเครื่อง" ในหน้าต่างเอกสาร

## สิ่งที่ตกลงกัน

หน้าต่างเลือกเอกสาร (Drawer ใน JobDocumentsSheet) จะมี 3 ตัวเลือก:
1. ถ่ายรูปใหม่ — คงเดิม
2. เลือกจากแกลเลอรี — คงเดิม
3. **แนบไฟล์จากเครื่อง (ใหม่)** — เปิด file picker ของเครื่อง เลือกได้หลายไฟล์ รองรับ PDF / Word / Excel / PowerPoint / รูปภาพ (ใช้ ACCEPT_IMAGE_DOC เดิม)

## การแก้ไข

### 1. `src/components/job/JobDocumentsSheet.tsx`

- เพิ่มปุ่มที่ 3 "แนบไฟล์จากเครื่อง" ใน Drawer (ไอคอน Paperclip)
- เพิ่ม hidden input ตัวใหม่ `fileInputRef` แยกจาก camera/gallery:
  - `accept={ACCEPT_IMAGE_DOC}` + `multiple`
  - ไม่มี `capture` (เพื่อให้เปิดตัวเลือกไฟล์ ไม่ใช่กล้อง)
- ไฟล์ที่เลือกเข้าลิสต์รออัปโหลด (pendingFiles) เหมือนปุ่มอื่น — ตรวจ PDF จาก type/นามสกุลเหมือนเดิม
- บน native (Capacitor) ปุ่มนี้ใช้ input เว็บตรง ๆ ได้เลย ไม่ต้องผ่าน useNativeCamera

### 2. `src/contexts/LanguageContext.tsx`

เพิ่มคีย์ `docs.attachFile` ครบ 4 ภาษา:
- th: แนบไฟล์จากเครื่อง
- en: Attach File from Device
- ko: 기기에서 파일 첨부
- zh: 从设备附加文件

## ไม่แตะ

- ปุ่มถ่ายรูป / เลือกจากแกลเลอรี และ flow อัปโหลด (pendingFiles → ปุ่มอัปโหลดเอกสาร) ที่เพิ่งทำ
- รูปแบบข้อมูลที่ส่งไป API `driver-documents`

## ตรวจสอบหลังแก้

- `npx tsgo` + build ผ่าน
- เปิดเมนูเอกสาร → กดแนบเอกสาร → เห็น 3 ปุ่ม → เลือกไฟล์ PDF จากเครื่องแล้วเข้าลิสต์รออัปโหลด
