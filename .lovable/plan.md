# เพิ่มเมนู "เอกสาร" บนแถวปุ่มงาน (ดูค่าใช้จ่าย / เพิ่มค่าใช้จ่าย / แจ้งปัญหา)

## สิ่งที่ตกลงกัน

- เพิ่มปุ่ม "เอกสาร" ที่ 4 ในแถวปุ่มบนหน้ารายละเอียดงาน (`JobActionButtons.tsx` ใช้ร่วมทุกประเภทงาน ในประเทศ/ต่างประเทศ)
- กดแล้วเปิดหน้าต่างเลื่อนดูรูป (bottom sheet) — ไม่เปิดหน้าใหม่
- เนื้อหารวมทั้งสองแบบ: เอกสารที่คนขับส่ง + เอกสารจาก TMS

## ข้อมูลที่จะแสดง

**จาก API ของคนขับ (ดึงเมื่อเปิด sheet):**
- `get-driver-sop` → รูปสินค้า (`product_images`), เอกสารจุดรับ (`document_images`), ใบชั่ง (`weight_slips[].image_url`) จากทุก SOP ของออเดอร์นี้
- `get-driver-checkins` → รูป POD (`photo_url`/`photo_urls` จาก checkin `delivery_confirmed`) และลายเซ็น (`signature_url`)

**จาก TMS:**
- API ปัจจุบันยังไม่ส่งเอกสารแนบกับออเดอร์ (ไม่มีช่อง document/image ใน payload) — ทำหมวด "เอกสารจาก TMS" เป็นส่วนที่แสดงว่าง (empty state) ไว้รองรับเมื่อ TMS เพิ่มช่องในอนาคต ไม่ต้องแก้ API ตอนนี้

## ไฟล์ที่แตะ

1. `src/components/job/JobDocumentsSheet.tsx` (ใหม่)
   - Bottom sheet: หัวข้อ "เอกสารของงาน", กลุ่มรูปแยกหมวด (จุดรับ / ใบชั่ง / POD / ลายเซ็น / เอกสารจาก TMS)
   - Grid รูป, กดรูปเปิดดูเต็ม (dialog รูปใหญ่), กดกลับปิดได้
   - ดึงข้อมูลตอนเปิด sheet ครั้งแรก (fetch on open), loading skeleton, ถ้าโหลดไม่ได้แสดงข้อความแจ้ง, ถ้าไม่มีข้อมูลแสดง empty state
   - รับ `orderNumber`, `jobData` — ใช้ driver id/type จาก auth context (แพตเทิร์นเดียวกับหน้ารายละเอียด)
2. `src/components/job/JobActionButtons.tsx`
   - เพิ่มปุ่มที่ 4 ไอคอนเอกสาร (Lucide `FileText`, สไตล์เดียวกับปุ่มเดิม)
   - Grid ปรับ: 3 ปุ่มครบ = `grid-cols-4`; กฎการซ่อนคงเดิม + เอกสารแสดงได้จาก history เหมือน "ดูค่าใช้จ่าย" (อ่านอย่างเดียว); ซ่อนตามกฎ isExpired / POD เดิม
3. `src/contexts/LanguageContext.tsx`
   - คีย์ใหม่ครบ 4 ภาษา (th/en/ko/zh): `jobActions.documents`, หัวข้อ sheet, ชื่อหมวด, ข้อความว่าง/โหลดไม่สำเร็จ

## ไม่แตะ

- Flow ยืนยัน/เช็คอิน/SOP/POD ทั้งหมด, ลายเซ็น (`SignatureDialog`), ปุ่มเดิมทั้ง 3, QTruck, การเงิน

## ผลลัพธ์

หน้ารายละเอียดงานมีปุ่ม "เอกสาร" ในแถวเดียวกัน กดแล้วดูรูปเอกสารทั้งหมดของงานในหน้าเดียว
