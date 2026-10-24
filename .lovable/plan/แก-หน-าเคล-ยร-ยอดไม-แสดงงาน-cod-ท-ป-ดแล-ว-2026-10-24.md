# แก้หน้าเคลียร์ยอดไม่แสดงงาน COD ที่ปิดแล้ว

## สาเหตุ (ตรวจจากข้อมูลจริงที่ระบบส่งกลับมา)
- ระบบส่งข้อมูลเช็คอินกลับมาได้ปกติ ไม่มี error
- แต่แอปมองหาเฉพาะรายการประเภท "payment" ซึ่งระบบไม่เคยส่งมาให้ การเก็บเงิน COD ถูกบันทึกไว้ในรายการ "delivery" / "delivery_confirmed" แทน (มี `payment_method: "cod"` หรือ `cod_proof_urls`)
- รายการเหล่านี้ไม่มีเลขออเดอร์ (`transport_orders` เป็น null) มีแค่ `transport_order_id`
- เลยไม่มีออเดอร์ไหนถูกส่งไปเช็คยอดค้าง หน้าจึงขึ้นว่า "ไม่มียอดค้างเคลียร์"

## สิ่งที่จะแก้
1. นับรายการเช็คอินเป็น COD เมื่อเป็น `payment` หรือมี `payment_method = 'cod'` หรือมี `cod_proof_urls`
2. หาเลขออเดอร์จาก `transport_orders.order_number` / `order_number` ก่อน ถ้าไม่มีให้ใช้ `transport_order_id` แปลงเป็นเลขออเดอร์จากรายการงาน (ปัจจุบัน + ประวัติ) ที่แอปโหลดอยู่แล้ว
3. เพิ่มงานที่ `jobHasCod` เป็นจริงในรายการงานที่ปิดแล้วเข้าไปเป็นตัวเลือกด้วย กันกรณีไม่มีเช็คอิน
4. ส่งไปเช็คทีละออเดอร์ด้วย `driver-cod-clear` เหมือนเดิม และเก็บไว้เฉพาะที่ยัง pending
5. ทำแบบเดียวกันในตัวแจ้งเตือน 05:00/05:30 (`cod-clear-reminder`) แล้ว deploy ใหม่
6. อัปเดตเทสต์ให้ครอบคลุมรายการ delivery ที่มี `payment_method: cod`

## หมายเหตุทางเทคนิค
- ไฟล์: `src/lib/codClear.ts`, `src/hooks/usePendingCodClears.ts`, `supabase/functions/cod-clear-reminder/index.ts`, `src/lib/__tests__/codClear.test.ts`
- ถ้า `driver-cod-clear` ตอบว่าไม่พบ COD (404) จะต้องแก้ฝั่งระบบหลัก ฝั่งแอปทำไม่ได้
