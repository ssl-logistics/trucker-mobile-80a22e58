# แผน: โหลดรูปพื้นหลังหัวแอปล่วงหน้า ไม่โหลดใหม่ทุกครั้ง

## สาเหตุ
- รูป `cover-header.webp` ถูก import ใน `AppHeader.tsx` ซึ่งถูกเรียกใช้จากหน้าแบบ lazy (Home / Dashboard / Market)
- รูปจึงถูกแพ็กรวมกับไฟล์ของแต่ละหน้า เริ่มโหลดก็ต่อเมื่อเปิดหน้านั้น → เห็นพื้นหลังแวบ/โหลดใหม่ทุกครั้งที่เปลี่ยนหน้า
- โค้ดอุ่นแคชด้วย `new Image()` ที่มีอยู่ ทำงานช้าเกินไป เพราะทำหลังไฟล์หน้าโหลดเสร็จแล้ว

## สิ่งที่จะทำ

### 1. ย้ายรูปไปไว้โฟลเดอร์ public
- คัดลอก `src/assets/cover-header.webp` ไปเป็น `public/cover-header.webp`
- รูปใน public จะถูกเสิร์ฟจากที่เดิมเสมอ (`/cover-header.webp`) ไม่ถูกแพ็กรวมกับไฟล์หน้า

### 2. สั่งโหลดล่วงหน้าตั้งแต่เปิดแอป
- เพิ่ม `<link rel="preload" as="image" href="/cover-header.webp">` ใน `index.html`
- เบราว์เซอร์จะโหลดรูปทันทีตอนเปิดแอป ก่อนหน้าใด ๆ แสดง

### 3. ปรับ AppHeader ให้ใช้รูปจาก public
- แก้ `src/components/layout/AppHeader.tsx`: เปลี่ยน `backgroundImage: url(${coverHeader})` เป็น `url(/cover-header.webp)` และเอา import รูปออกจากรายการอุ่นแคช
- หน้าตาและขนาดรูปเหมือนเดิมทุกอย่าง

## ผลที่คาดหวัง
- รูปพื้นหลังหัวแอปโหลดครั้งเดียวตอนเปิดแอป เปลี่ยนหน้าไปมาแสดงทันที ไม่แวบโหลดใหม่

## รายละเอียดทางเทคนิค
- ไฟล์ที่แก้: `index.html`, `src/components/layout/AppHeader.tsx`, เพิ่ม `public/cover-header.webp`
- ไม่แตะ flow หลัก / API / หลังบ้าน
- ตรวจด้วย `npx tsgo --noEmit -p tsconfig.app.json` และ build ต้องผ่าน
