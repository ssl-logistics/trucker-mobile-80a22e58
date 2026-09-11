# ซ่อนไอคอนแชท freelance ก่อน login

## เป้าหมาย
ไอคอนแชทฝั่ง freelance มุมขวาล่างต้องแสดงเฉพาะเมื่อผู้ใช้ login แล้วเท่านั้น หากยังไม่ได้เข้าสู่ระบบต้องไม่แสดง

## สาเหตุ
`AuthContext` กำหนดค่าเริ่มต้น `userType` เป็น `freelance_driver` แม้ `user` จะเป็น `null` ทำให้ `useUserRole().isFreelanceDriver` เป็น `true` ก่อน login จึงแสดงไอคอนแชท freelance ได้

## การแก้ไข

### 1. ปรับ `src/components/chatbot/FloatingChatbot.tsx`
- import `useAuth` จาก `@/contexts/AuthContext`
- อ่าน `user` หรือ `isAuthenticated` จาก `useAuth()`
- เปลี่ยนเงื่อนไขการแสดง freelance chat icon จาก `isFreelanceDriver` เป็น `isFreelanceDriver && user` (หรือ `isFreelanceDriver && isAuthenticated`)
- หากไม่ใช่ freelance ที่ login แล้ว ให้กลับไปใช้กฎเดิมของปุ่มบอท (เช็ค `shouldShow` และ `enabled`)
- หากไม่ผ่านเงื่อนไขใดเลย ให้ `return null` เหมือนเดิม

## ขอบเขตที่ไม่เปลี่ยน
- ไม่แก้ไข bottom navigation
- ไม่แก้ไขหน้าแชทหรือระบบแชท
- ไม่เปลี่ยนพฤติกรรมของ role อื่น
- ไม่เปลี่ยน `AuthContext` (เพื่อหลีกเลี่ยงผลกระทบกับส่วนอื่น)

## วิธีทดสอบ
1. เปิดหน้า `/` โดยไม่ login ตรวจสอบว่าไม่มีไอคอนแชทมุมขวาล่าง
2. ล็อกอินด้วยบัญชี freelance เปิด `/home` ตรวจสอบว่ามีไอคอนแชท MessageCircle
3. ล็อกอินด้วย role อื่น ตรวจสอบว่ายังเห็นปุ่มบอทตามเดิม
4. ออกจากระบบ ตรวจสอบว่าไอคอนแชทหายไป
