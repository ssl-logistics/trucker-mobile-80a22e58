# ส่งลายเซ็นแยกไปเส้น driver-signatures

## สิ่งที่เปลี่ยน
- เซ็นเสร็จกด "ยืนยัน" → แอปส่งลายเซ็นไปเส้นใหม่ `POST .../driver-signatures` โดยตรง (ใช้ key ตัวเดียวกับเส้นเช็คอิน) ไม่อัปโหลดรูปแยกก่อนแล้ว
- ส่งทีละจุด บอกว่าเป็นจุดไหน:
  - จุดรับสินค้า / จุดโหลดสินค้า (SOP) → `checkin_type: "pickup"`
  - จุดส่งสินค้า (POD) → `checkin_type: "delivery"` + `destination_sequence_number` = ลำดับจุดส่ง (งานส่งหลายจุด) ถ้าจุดเดียวส่ง `null`
  - ลานรับตู้ → `pickup`, ลานคืนตู้ → `delivery` (เส้นนี้รับแค่ 2 ค่า)
- เอา `signature_url` / `signer_name` ออกจาก body ของ driver-sop และ driver-checkin (เอกสารระบุว่า driver-sop ไม่รับลายเซ็น)
- การส่งลายเซ็นทำแยกเบื้องหลัง ไม่บล็อก flow: กดยืนยันแล้วเช็คอิน/SOP/POD เดินต่อตามเดิมทันที ถ้าส่งลายเซ็นไม่สำเร็จแค่แจ้งเตือนเล็กๆ (ส่งซ้ำจุดเดิมระบบจะอัปเดตทับ)

## ตัวอย่าง body
```json
{
  "order_number": "OR20261007026/01",
  "checkin_type": "delivery",
  "destination_sequence_number": 2,
  "signer_name": "สมชาย ใจดี",
  "signature_base64": "data:image/png;base64,....",
  "latitude": 13.75, "longitude": 100.50,
  "signed_at": "2026-10-09T09:45:00.000Z",
  "driver_id": "...", "driver_type": "freelance"
}
```

## สิ่งที่ไม่เปลี่ยน
- หน้าต่างลายเซ็น การ์ดแนะนำ ลำดับขั้นตอน รูปถ่าย OCR และ API SOP/POD เดิม ทำงานเหมือนเดิม

## Technical details
- `externalApi.ts`: เพิ่ม `submitDriverSignature(payload)` → `callExternalApi('driver-signatures', POST)` ใช้ API key เดียวกับ `driver-checkin`
- `SignatureDialog.tsx`: รับ props ใหม่ `checkinType: 'pickup'|'delivery'`, `destinationSequence?: number|null`; ใน `confirm` ส่ง `canvas.toDataURL` เป็น `signature_base64` พร้อมพิกัด (ถ้าได้, ไม่บล็อก), driver_id/driver_type จาก localStorage; สำเร็จแล้วเรียก `onSigned`
- `SOPCheckInPage`, `DeliverySOPCheckInPage`, `DeliveryDetailPage`, `ContainerSOPPage`: ส่ง checkinType/sequence ให้ dialog และลบ `...signatureRef.current` ออกจาก payload เดิม
