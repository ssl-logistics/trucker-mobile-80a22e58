# แก้ปัญหา "ส่งแจ้งปัญหาการใช้แอป" ไม่สำเร็จ

## สิ่งที่ตรวจพบจาก log
- Edge function `report-app-problem` มีแค่ log `booted` ไม่มีการทำงานจริงเลย
- Log ฝั่ง gateway มีเฉพาะ `OPTIONS | 200` (preflight) — ไม่มี `POST` เข้ามาแม้แต่ครั้งเดียว
- สาเหตุ: ฝั่งแอปมี fetch wrapper ที่แนบ header `x-app-secret` ไปกับทุก request ของ edge function แต่ CORS ของ `report-app-problem` ยังไม่อนุญาต header นี้ เบราว์เซอร์จึงบล็อก POST หลัง preflight (อาการเดียวกับที่เคยเจอใน `create-tracking-room` / `log-client-event`)

## สิ่งที่จะแก้
1. `supabase/functions/report-app-problem/index.ts`
   - เพิ่ม `x-app-secret` (และ `x-client-info`, `apikey` ที่มีอยู่แล้ว) ใน `Access-Control-Allow-Headers`
   - เพิ่ม `Access-Control-Allow-Methods: POST, OPTIONS`
   - เพิ่ม log ของ request ที่เข้ามาเพื่อยืนยันการทำงาน
2. `supabase/config.toml`
   - เพิ่ม `[functions.report-app-problem] verify_jwt = false` ให้สอดคล้องกับ custom auth ของโปรเจกต์ (ผู้ใช้ไม่มี JWT ของระบบ)
3. ปรับ `src/pages/ReportAppProblemPage.tsx` ให้แสดงข้อความ error ที่แท้จริงจาก edge function แทนข้อความรวม ๆ เพื่อดีบักง่ายขึ้นในอนาคต (UI เดิม ไม่เปลี่ยน layout)

## การตรวจสอบหลังแก้
- ยิงทดสอบ `report-app-problem` ผ่าน edge function tester แล้วดู log ว่ามี `POST | 200`
- ตรวจ log ว่า external API ตอบกลับสำเร็จ ถ้าตอบ 4xx/5xx จะรายงานสาเหตุเพิ่มเติมให้ทราบ

หมายเหตุ: การอัปโหลดภาพหน้าจอปัจจุบันถ้าล้มเหลวจะถูกข้ามเงียบ ๆ (ส่งรายงานได้แต่ไม่มีรูป) — ถ้าต้องการให้แจ้งเตือนเมื่ออัปโหลดรูปไม่สำเร็จ บอกได้ครับ จะเพิ่มให้
