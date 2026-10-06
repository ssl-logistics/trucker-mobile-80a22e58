# ปรับ UI หน้าต่างสแกน QR โหลดสินค้าให้เรียบสวย

## ปัญหา
ด้านล่างกล้องสแกนมีขอบขาวเกินมา เพราะไลบรารี html5-qrcode แทรก element ของตัวเอง (พื้นหลังขาว, ข้อความสถานะ "Scanner paused", กรอบ shaded region) เข้ามาในกล่องสแกนโดยไม่มีสไตล์ควบคุม

## สิ่งที่จะทำ

### 1. เพิ่มสไตล์ควบคุมกล่องสแกน (ใน LoadingQrScanDialog.tsx ผ่าน CSS เฉพาะ region หรือ index.css scope `#loading-qr-region`)
- ซ่อน element ที่ไลบรารีแทรกมาเกิน: ข้อความสถานะ "Scanner paused", ปุ่ม/ลิงก์/รูปของไลบรารี, span ว่าง
- บังคับ `<video>` เต็มกรอบ: `width/height 100%`, `object-fit: cover`, ไม่มีพื้นขาวโผล่
- พื้นหลังกล่องเป็นสีเข้ม (bg-foreground/90 หรือโทนเข้มของธีม) แทนสีขาว/เทาอ่อน ให้เข้ากับภาพกล้อง
- เก็บ `aspect-square` + `rounded-lg overflow-hidden` เดิม มุมโค้งไม่มีขอบล้น

### 2. ปรับหน้าต่างรวมให้สวยขึ้น
- กรอบสแกนมีมุมโค้งและขอบบางๆ ให้ดูเป็น viewfinder
- ข้อความคำแนะนำ (hint) จัดกึ่งกลางใต้หัวข้อ
- ปุ่ม "ข้าม" คงเดิมด้านล่าง

## ไฟล์ที่แก้
- `src/components/job/LoadingQrScanDialog.tsx` — เพิ่ม style tag scoped หรือ className
- `src/index.css` — (ถ้าจำเป็น) เพิ่มกฎ CSS สำหรับ `#loading-qr-region` เพื่อ override สไตล์ไลบรารี

## ไม่แตะ
- ตรรกะสแกน/ข้าม/ปิดกล้อง เดิมทั้งหมด
- ไฟล์อื่น
