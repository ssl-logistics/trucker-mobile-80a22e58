# COD: ให้คนขับเลือกวิธีรับเงินได้เอง 3 แบบ

## สิ่งที่คนขับจะเห็น (หน้าส่งสินค้า กล่อง COD)
- ไม่ล็อกวิธีรับเงินตามข้อมูลงานแล้ว มีปุ่มให้เลือก 3 แบบ: **เงินสด / QR โค้ก (QR ของโค้ก) / QR Mint**
  - ค่าเริ่มต้นเลือกให้ตามข้อมูลงาน (qr = QR Mint, cash = เงินสด) แต่เปลี่ยนได้
1. **เงินสด** — ต้องแนบรูปอย่างน้อย 1 รูป
2. **QR โค้ก (QR ของโค้ก)** — ปุ่ม "เปิด QR" แสดงรูป QR คงที่ (ตอนนี้ใช้รูปตัวอย่างไปก่อน) พร้อมยอดเงิน — ต้องแนบรูปสลิปอย่างน้อย 1 รูป
3. **QR Mint** — QR จริงแบบเดิม (นับถอยหลัง, เช็กสถานะทุก 4 วินาที) — จ่ายสำเร็จแล้วไม่ต้องแนบรูป; แนบได้ถ้าเช็กไม่ได้ และถ้าเช็กไม่ได้/ยังไม่จ่ายต้องแนบรูปถึงจะยืนยันได้
- เปลี่ยนวิธีแล้วรูปที่แนบไว้ยังอยู่
- ข้อความ 4 ภาษา

## Technical details
- `CodCollectSection.tsx`: add `method: 'cash' | 'static_qr' | 'mint_qr'` to `CodState` (default from `cod.method`), segmented 3-button selector; `ready = method === 'mint_qr' ? (qrConfirmed || urls.length>0) : urls.length>0`; static QR dialog shows bundled mockup image `src/assets/cod-static-qr.png` (generated placeholder) + amount.
- Pass chosen method up via `onChange` so the delivery check-in payload sends the selected method instead of the job's original one.
- Translations for the 3 labels in TXT.
