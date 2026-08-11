# แก้ Header หน้าแรกยังเลื่อนหลุดได้

## สาเหตุ

หน้าแรก (`src/pages/Home.tsx:1289`) ครอบ `AppHeader` + ช่องค้นหาไว้ใน div ที่มี `overflow-hidden` (ใช้เพื่อทำมุมโค้งด้านล่าง)

ใน CSS ตัว `position: sticky` จะ "ติดบน" ได้เฉพาะภายในกล่องแม่ที่มี `overflow` ไม่ใช่ `visible` เท่านั้น — เมื่อแม่เป็น `overflow-hidden` และสูงเท่ากับ header เอง header จึงเลื่อนหลุดขึ้นไปพร้อมเนื้อหา ทั้งที่คลาส `app-sticky-header` ถูกใส่ไว้แล้ว

## สิ่งที่จะทำ

1. หน้าแรก: ย้ายการ sticky ไปไว้ที่ตัว wrapper แทน
   - wrapper ที่ `Home.tsx:1289` เปลี่ยนเป็น sticky (top 0, z-index เดียวกับ header อื่น) และตัด `overflow-hidden` ออก โดยยังคงมุมโค้ง `rounded-b-3xl` และเงาไว้เหมือนเดิม (ใช้การครอบมุมที่ตัวลูกแทน)
   - ให้ header + แถบค้นหา ติดบนสุดพร้อมกันตอนเลื่อน
2. ตรวจหน้าอื่นที่ครอบ header ด้วย element ที่มี `overflow-hidden` / `transform` แล้วทำแบบเดียวกัน (Dashboard ใช้ wrapper เปล่าอยู่แล้ว จึงปกติ)
3. ป้องกันซ้ำในระดับ CSS: เพิ่มกฎใน `src/index.css` ให้ wrapper ที่ทำ sticky ใช้คลาสเดียวกัน (`app-sticky-header`) และไม่ตั้ง `overflow: hidden` ที่ตัวแม่ของ header

## หมายเหตุทางเทคนิค

- แก้เฉพาะ CSS/className ไม่แตะ logic
- ไฟล์ที่คาดว่าจะแก้: `src/pages/Home.tsx`, `src/index.css`
- ตรวจผลด้วยการเลื่อนหน้าแรกใน preview ว่า header + ช่องค้นหาค้างอยู่บนสุดและลากลงไม่ได้
