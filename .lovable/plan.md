# เทียบเลขตู้ + เลขซีล จาก EIR ตอนรับตู้

เพิ่มการเปรียบเทียบ **เลขซีล** จาก OCR ใบ EIR กับเลขซีลที่อ่านได้จากรูปถ่ายซีล (หรือเลขซีลในงาน) พร้อมแสดงผลเทียบเลขตู้/เลขซีลให้เห็นชัดในการ์ดผลตรวจ EIR

## พฤติกรรมที่จะได้

- หลัง OCR ใบ EIR ระบบจะดึง 3 ค่า: BL/Booking, เลขตู้, **เลขซีล**
- การ์ดผลตรวจจะแสดงตารางเทียบแบบคู่:
  - เลขตู้: จากรูปตู้ (หรือในงาน) ↔ จาก EIR
  - เลขซีล: จากรูปซีล (หรือในงาน) ↔ จาก EIR
  พร้อมไอคอน ✓ / ❌ ต่อบรรทัด
- **ซีลไม่ตรง** → แสดงกล่องเตือนสีส้ม + toast "เลขซีลใน EIR ไม่ตรงกับที่ถ่าย" แต่ **ยังกดยืนยันได้** (ไม่บล็อก)
- **EIR อ่านเลขซีลไม่เจอ** → เตือนให้ถ่าย EIR ใหม่ให้เห็นเลขซีลชัดเจน แต่ **ยังกดยืนยันได้** และกรอกเลขซีลเองได้ในช่อง input
- เงื่อนไขบล็อกเดิม (BL/Booking และเลขตู้) คงไว้ตามเดิมทุกอย่าง

## รายละเอียดทางเทคนิค

ไฟล์เดียว: `src/pages/ContainerSOPPage.tsx`

1. ขยาย type ผลลัพธ์ `eirBlOcrResult` ให้มี `seal_number` (edge function `ocr-extract` type `eir_document` คืน `seal_number` อยู่แล้ว ไม่ต้องแก้ backend)
2. เพิ่ม state `eirSealMatchStatus: 'match' | 'mismatch' | 'not_found' | null`
3. เพิ่ม helper `getExpectedSealForEir()` ตามลำดับ: `ocrSealNumber` (เมื่อ `isSealOcrDone`) → `sealNumber` → `jobDetail?.seal_number` — normalize ด้วย `normalizeRef` เดิม
4. ใน `evaluateEirMatches` เพิ่มการคำนวณ `sealStatus` (ถ้าไม่มีเลขซีลอ้างอิงเลย ให้ถือเป็น `match` = ข้ามการเทียบ) และคืนค่ากลับมาด้วย
5. ใน `runEirBlOcr` และ `useEffect` ที่ re-evaluate เมื่อค่า OCR เปลี่ยน ให้ set `eirSealMatchStatus` และยิง toast เตือนกรณี mismatch / not_found
6. UI: เพิ่มการ์ดเทียบเลขซีล (สีส้ม/amber สำหรับเตือน, เขียวเมื่อตรง) ใต้การ์ดเทียบเลขตู้ พร้อม `Input` ให้แก้เลขซีลจาก OCR เองได้ เหมือนที่ทำกับ BL/Booking
7. **ไม่แตะ** `isEirBlockingConfirm` — สถานะซีลไม่มีผลต่อการปิดปุ่มยืนยัน
