# ปิดโหมด debug ของแอปที่ติดตั้งในเครื่อง

## เป้าหมาย

ปิดไม่ให้ใครเปิดดูข้างในแอปที่ติดตั้งบนเครื่องจากคอมพิวเตอร์ได้ (Android ผ่าน `chrome://inspect`, iOS ผ่าน Web Inspector)

## สิ่งที่จะแก้

1. **ค่าหลักที่ขอมา** — ในไฟล์ตั่งค่าของแอป (`capacitor.config.ts`) เปลี่ยน `webContentsDebuggingEnabled` จาก `true` เป็น `false` (ตอนนี้เปิดอยู่ในชัน Android)
   - เป็นค่าเดียวในโปรเจกตท์ี่เปิดโหมดน้ี ทั้งไฟล์
   - ยืนยันแล้วว่าถ้าตั่งเป็น `false` แล้ว ระบบจะปิดจริงถิงงานที่ build แบบ debug (ไม่สลับกลาบเปิดอัติโนมัติ)

2. **สวิตชค์ู่ก้นฝัง iOS** — ไฟล์ตั่งคิ `ios/debug.xcconfig` ตั่ง `CAPACITOR_DEBUG = true` อยู่ และถูกเชื่อมเข้ากับโปรเจกตท์ี่เปิดใน Xcode (ทั้งสอง config การ build) → เปลี่ยนเป็น `false` ด้วย เพื่อปิดเครืองมือ debug ฝัง iPhone/iPad ให้สมำเสมอกัน
   - ถ้ายังตองการเปิดไวสำหรับงาน iOS บอกได้ จะไม่แตะไฟลน้ี

3. **ไม่แตะส่วนอื่่น** — ฟอรมแนบเอกสาร, การดึงเอกสาร, flow เช็คอิน/SOP/POD, QTruck, การเงิน, การแจ้งเตือน ไม่มีการเปลี่ยนแปลง

## ผลที่จะได

- เปิดแอปบนเครื่อง Android แล้วตอสายเข้่าคอมพิวเตอร์ → `chrome://inspect` จะไม่เห็นแอปให้อเลือกอีก
- หนาตาง debug ใดๆ ของแอปจะไม่สามารถเปิดจากภายนอกได้อีก
- หนาจอและการใช้งานของแอปในชีวิตจิง ไม่มีอะไรเปลี่ยน

## หมายเหตุทิงทาย

หลังแก้ว่า ผู้ใชต้อง git pull แล้วยิง `npx cap sync` (ตามด้วย build/ลงแอปใหม) เพื่้อใหค่านั้นถกูคัดลอกเข้่าโปรเจกต Android/iOS ในเครื่องของผใช

## รายละเอียดทคนิค (สำหรับผู้ทtechnical)

- `capacitor.config.ts` บรทด 32: `webContentsDebuggingEnabled: true` → `false` (ในบล็อก `android`)
- `ios/debug.xcconfig`: `CAPACITOR_DEBUG = true` → `false` (โปรเจกต `ios/App/App.xcodeproj/project.pbxproj` อางถึงไฟลน้ีเป็น baseConfigurationReference ทัง 2 build config)
- ไม่มีโค้ดอื่่นใดๆ ในโปรเจกตที่เรียกโหมด debug (MainActivity.java ไม่มมี `setWebContentsDebuggingEnabled`)
- ยืนยันจากแหล่งที่ของชัน Android: ค่า `android.webContentsDebuggingEnabled` ถกอาจากไฟล์ตั่งค่า และใช้ต่า default เฉพาะกรณีทไม่มคี่านั้นในไฟล์เท่านั้น → การเขียน `false` ระบุชัด จึงมีผลเสมอ
- โปรเจกตต์ัวจิงของ Android/iOS ในที่น้เป็นโครงส้นๆ การคัดลอกค่าจริงเกิดบนเครื่องผใชหลัง `npx cap sync`
