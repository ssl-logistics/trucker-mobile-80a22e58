# การ์ดแจ้งเตือน "รับทราบ" สำหรับเมนู เอกสาร

## ทำอะไร
เพิ่มการ์ดแนะนำเมนู "เอกสาร" (JobActionButtons) แบบเดียวกับการ์ดเมนู "แจ้งซ่อม" และ "ดูคิว" ที่ทำไว้ก่อนหน้า:

- แสดงครั้งแรกเมื่อเปิดหน้าที่มีปุ่มเอกสาร: กรอบสีส้มครอบปุ่ม + การ์ดด้านล่างปุ่ม ("เมนูใหม่! เอกสาร" + คำอธิบาย + ปุ่ม "รับทราบ")
- กด "รับทราบ" หรือกดปุ่มเอกสารเอง = นับว่ารับทราบ การ์ดหายไป
- จำตามบัญชี (user id): production แสดงครั้งเดียวต่อบัญชี (localStorage `documents_menu_intro_ack:<driverId>`)
- หน้า preview (hostname มี `id-preview--`): แสดงทุกครั้งเป็นข้อยกเว้น เพื่อทดสอบซ้ำได้
- ข้อความรองรับ 4 ภาษา (ไทย/อังกฤษ/เกาหลี/จีน) ตามภาษาแอป
- auto scrollIntoView ให้เห็นปุ่ม+การ์ดตอนแสดง

## แก้ไฟล์

### 1. `src/components/job/JobActionButtons.tsx`
- เพิ่ม state + ref + logic เดียวกับ pattern เดิม:
  - `docIntroUserId` จาก localStorage `auth_driver_id`
  - key `documents_menu_intro_ack:<driverId>`
  - `isPreviewHost` เช็ค hostname มี `id-preview--`
  - state เริ่มต้น: preview → แสดงเสมอ, production → แสดงเมื่อยังไม่มี key ใน localStorage
  - `ackDocumentsIntro()` → set localStorage + ปิดการ์ด
  - useEffect: แสดงแล้ว setTimeout 300ms `scrollIntoView({ block: 'center' })`
- ปุ่มเอกสาร (บรรทัด ~90): ครอบด้วย div `relative`, ใส่ ring ส้มเมื่อยังไม่รับทราบ, onClick เรียก `ackDocumentsIntro()` ร่วมกับ `setIsDocumentsSheetOpen(true)`
- การ์ด absolute ใต้ปุ่ม สไตล์เดียวกับการ์ดดูคิว (bg-card, border-orange-300, ลูกศรหัวการ์ด, ปุ่มส้มเต็มความกว้าง)
- ซ่อนการ์ดเมื่อ `isFromHistory` (เหมือนปุ่มแจ้งปัญหาที่ซ่อนในโหมดอ่านอย่างเดียว — เอกสารยังกดได้ แต่ไม่ต้องแนะนำซ้ำ)

### 2. `src/contexts/LanguageContext.tsx`
เพิ่ม 3 keys × 4 ภาษา (ใต้กลุ่ม intro เดิม):
- `jobActions.documents_intro_title` — ไทย: "เมนูใหม่! เอกสาร"
- `jobActions.documents_intro_desc` — ไทย: "ส่งเอกสาร/ใบชั่งพร้อมไฟล์แนบให้ทีมงานได้จากหน้างานนี้"
- `jobActions.documents_intro_ack` — ไทย: "รับทราบ"
- อังกฤษ / เกาหลี / จีน แปลตามใจความเดียวกัน

## หมายเหตุ
- การ์ดรับทราบของแต่ละเมนู **แยกกันสมบูรณ์** — เอกสารใช้ key `documents_menu_intro_ack` ต่างจาก `repair_menu_intro_ack` (แจ้งซ่อม) และ `queue_button_intro_ack` (ดูคิว) รับทราบเมนูใดเมนูหนึ่งไม่กระทบอีกเมนู และแต่ละเมนูแจ้งของตัวเองแยกกัน
- ไม่แตะ flow เดิม (เอกสาร/อัปโหลด/ReportProblem) — เพิ่มเฉพาะการ์ดแนะนำ
- ตรวจ `npx tsgo --noEmit -p tsconfig.app.json` + build ต้องผ่าน
