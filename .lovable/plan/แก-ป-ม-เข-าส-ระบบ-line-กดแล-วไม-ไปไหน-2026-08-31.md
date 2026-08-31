# แก้ปุ่ม "เข้าสู่ระบบ LINE" กดแล้วไม่ไปไหน

## สาเหตุที่ตรวจพบ

- Edge function `line-auth` **ไม่มี log เลย** → คำขอไม่เคยถึงหลังบ้าน ปัญหาอยู่ฝั่งหน้าเว็บ ก่อนถึงขั้นส่ง access token
- Console ที่ผู้ใช้ส่งมาชี้ชัด:
  `Refused to display 'https://access.line.me/' in a frame because it set 'X-Frame-Options' to 'deny'`
- LIFF init สำเร็จ (`isLoggedIn = false`, `isInClient = false`) แล้ว `liff.login()` พยายาม redirect หน้าเดิม แต่หน้าเดิมถูกฝังอยู่ใน iframe (พรีวิว Lovable / webview บางกรณี) LINE บล็อกการแสดงผลในกรอบ ผลคือหน้าโหลดค้าง ไม่มีอะไรเกิดขึ้น

## สิ่งที่จะแก้ (เฉพาะฝั่ง client)

1. `src/lib/liff.ts`
   - เพิ่มตัวช่วย `isInIframe()` (`window.top !== window.self`)
   - ใน `liffLogin()` ถ้าอยู่ใน iframe: ไม่เรียก `liff.login()` ตรง ๆ แต่พาออกไปเปิดที่ระดับ top-level แทน

2. `src/pages/SignIn.tsx` (ปุ่ม LINE บรรทัด ~430)
   - ก่อนเรียก LIFF ให้เช็คว่าอยู่ใน iframe หรือไม่
   - ถ้าอยู่ใน iframe → เปิด URL LINE OAuth (ใช้ `buildNativeLineOAuthUrl()` ที่มีอยู่แล้ว) ด้วย `window.open(url, '_blank')` หรือ `window.top.location.href` เพื่อหลุดจากกรอบ พร้อมคืนสถานะปุ่ม (`setIsLoggingIn(false)`) ไม่ให้ค้างหมุน
   - ถ้าไม่ได้อยู่ใน iframe → ทำงานตามเดิม (native ใช้ Capacitor Browser, เว็บใช้ LIFF)
   - เพิ่ม `try/catch` แสดง toast บอกสาเหตุเมื่อ init/login ล้มเหลว แทนที่จะเงียบ

3. เพิ่ม log ให้เห็นชัดขึ้น: บันทึกว่าเลือกเส้นทางไหน (iframe / native / liff) เพื่อไล่ปัญหาครั้งถัดไปได้เร็ว

## หมายเหตุ

- ต้องมั่นใจว่า `https://mobile.the-trucker.com/auth/line/callback` และ Endpoint URL ของ LIFF ถูกตั้งไว้ใน LINE Developers Console ตรงกัน (ค่านี้อยู่ในโค้ดแล้ว ไม่แก้)
- ไม่แตะ edge function หรือ flow สมัคร/ผูกบัญชีหลังบ้าน
- หลังแก้: ทดสอบกดปุ่มจากพรีวิว (ควรเด้งแท็บใหม่ไป LINE), จากเบราว์เซอร์ปกติ และจากแอปติดตั้ง
