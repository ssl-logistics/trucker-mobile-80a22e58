# แผน: ปิดปุ่ม Sign in with Apple ชั่วคราว

## เป้าหมาย
คอมเม้นปิดปุ่ม "Sign in with Apple" บนหน้า Sign In โดยไม่ลบโค้ด เพื่อให้สามารถเปิดใช้งานใหม่ได้ภายหลัง

## ขอบเขต
- แก้ไขเฉพาะไฟล์ `src/pages/SignIn.tsx`
- ไม่ลบ import หรือโค้ดที่ใช้ร่วมกับ flow อื่น (เช่น `Capacitor` ยังใช้กับ LINE login)
- ไม่เปลี่ยนแปลง logic อื่นของหน้า Sign In

## ขั้นตอนการทำ
1. คอมเม้นตัวแปร `showAppleSignIn` และ `console.log` ที่เกี่ยวข้อง (บรรทัด 135-136) เพื่อป้องกัน warning ตัวแปรไม่ได้ใช้งาน
2. คอมเม้นบล็อก JSX ของปุ่ม Sign in with Apple ทั้งหมด (บรรทัด 592-675) โดยห่อด้วย `{/* ... */}`
3. ตรวจสอบ build/typecheck หลังแก้ไข

## สิ่งที่ไม่ทำ
- ไม่ลบโค้ด Apple Sign In
- ไม่แก้ไข edge function หรือ OAuth callback
- ไม่เปลี่ยน UI ปุ่มอื่น
