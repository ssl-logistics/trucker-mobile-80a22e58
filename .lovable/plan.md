# เพิ่มลายเซ็นให้ครบทุกจุดยืนยัน (ในประเทศ + ต่างประเทศ)

## สถานะปัจจุบัน (ตรวจสอบแล้ว)
คำขอที่ส่งรูปไปพร้อมลายเซ็น (`signature_url` + `signer_name`) อยู่แล้ว:
- จุดรับสินค้า ในประเทศ — `driver-sop` (sop_type pickup) — SOPCheckInPage.tsx:516
- จุดส่งสินค้า ในประเทศ — `driver-sop` + POD `delivery_confirmed` — DeliverySOPCheckInPage.tsx:285,293
- ต่างประเทศ รับตู้โหลด — `driver-checkin` (container_pickup_confirmed) — ContainerSOPPage.tsx:1346
- ต่างประเทศ คืนตู้ — `driver-checkin` (container_return_confirmed) — ContainerSOPPage.tsx:1410

**จุดที่ยังขาด:** ยืนยัน POD จากหน้าจุดส่งโดยตรง (DeliveryDetailPage.tsx:723 `delivery_confirmed` พร้อม `photo_url`) — ส่งรูปแต่ยังไม่แนบลายเซ็น

## สิ่งที่จะทำ

### 1. DeliveryDetailPage.tsx — ยืนยัน POD ต้องเซ็นก่อน
- เพิ่ม `signatureRef = useRef<SignatureResult | null>(null)` + `showSignature` state + import `SignatureDialog` (แพตเทิร์นเดียวกับหน้า SOP ที่ทำไว้)
- ปุ่มยืนยัน POD (line 1326) อยู่ที่เดิม กดได้ตามเดิม แต่แทนการเปิดหน้าต่างยืนยัน POD → เปิดหน้าต่าง "ลายเซ็นผู้รับ/ผู้ส่ง" (SignatureDialog) ก่อน
- ในหน้าต่างเซ็น: ช่องชื่อผู้เซ็น + พื้นที่เซ็นด้วยนิ้ว + ล้าง/ยกเลิก/ยืนยัน — ปุ่มยืนยันกดไม่ได้จนกว่าจะเซ็น
- เซ็นแล้วกดยืนยัน → อัปโหลด PNG ผ่าน `upload-to-s3` ไปโฟลเดอร์ `mobile/signatures` → `signatureRef.current = { signature_url, signer_name }` → รัน `submitPod()` เดิมทันที
- ใน `podPayload` (line 723) แนบ `...(signatureRef.current || {})` — ส่ง `signature_url` + `signer_name` ไปพร้อม `photo_url` ทุกจุดส่ง (รวมงานหลายจุดส่ง แต่ละ sequence ต้องเซ็นใหม่)
- กดยกเลิก → ไม่ส่ง POD อยู่หน้าเดิม
- i18n ครบ 4 ภาษา (ใช้ TEXT ที่มีใน SignatureDialog อยู่แล้ว)

### 2. เช็คจุดอื่นที่ยังขาด
- เช็คอินถึงจุด (arrival: pickup / delivery / container_pickup / container_return) ไม่ส่งรูป — ไม่มีอะไรให้แนบ ไม่แตะ
- งานจาก history อ่านอย่างเดียว — ไม่เด้งหน้าเซ็น (ตรวจ `isFromHistory` เหมือนหน้าต่างเดิม)

## ไม่แตะ
- flow เดิมทั้งหมด, SignatureDialog.tsx (ใช้ของเดิม), หน้า SOP ทั้ง 3 หน้า (มีลายเซ็นแล้ว), QTruck status sync

## ผลลัพธ์
POD จากหน้าจุดส่งโดยตรงต้องเซ็นก่อนส่งเหมือนจุดอื่น ทำให้ทุกจุดยืนยันที่ส่งรูป (จุดรับ/จุดส่ง ใน+ต่างประเทศ) แนบ `signature_url` + `signer_name` ไปครบทุกเส้น
