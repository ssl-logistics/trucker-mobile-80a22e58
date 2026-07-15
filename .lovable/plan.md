## หาสาเหตุที่ log ไม่ถูกเก็บสำหรับ OR20260614004

### สถานะปัจจุบัน
- ตาราง `edge_function_audit_logs` มีแค่ 2 rows: `TEST-AUDIT` + `client:diagnostic-ping` (ที่ผมยิงเทสเอง)
- ไม่มี `client:accept-job:pressed` ใด ๆ ทั้งจาก OR20260715026 และ OR20260614004
- แต่ order OR20260614004 **status = `in_transit`** และ `updated_at = 2026-07-15T03:44:13` (หลัง deploy)
- แสดงว่า `update-order-status` **ถูกเรียกสำเร็จ** — แต่ log ตัวก่อนหน้า (`logClientEvent`) ที่อยู่ก่อน fetch ในไฟล์ ไม่ได้ผลลัพธ์ในตาราง

### ทฤษฎีที่เป็นไปได้

1. **`update-order-status` ถูกเรียกจาก path อื่น** ที่ไม่ผ่าน `handleStartAssignedJob` เช่น
   - Backend / dispatcher เปลี่ยน status ให้เอง
   - อีก device / session เก่าที่ยังใช้ bundle เก่า
   - ปุ่มบน dashboard ฝั่งบริษัท

2. **`logClientEvent` fetch ถูก browser ปฏิเสธก่อนส่ง** — ยาก แต่เป็นไปได้ถ้ามี extension บล็อก `keepalive` request หรือ CORS preflight ล้ม (แต่ diagnostic ping ผมยิงตรงจาก server ผ่านได้)

3. **Preview ยังโหลด bundle เก่า** — ผู้ใช้ยืนยัน Ctrl+Shift+R แล้ว แต่ Service Worker / PWA cache อาจยังเสิร์ฟไฟล์เก่า

4. **Handler ถูกเรียก แต่ throw sync ก่อน logClientEvent** — ไม่น่าเป็น เพราะ log อยู่บรรทัดแรกสุดหลัง `if (!user) return;`

### แผนดักหลักฐานให้ครบ

จุดเดียวที่จะฟันธงได้ คือดักตั้งแต่ปุ่มถูกกด → handler ถูกเรียก → fetch ถูกส่ง จุดใดขาด

#### 1. ดัก event ที่ระดับ **onClick ของปุ่มใน `JobCard.tsx`** (ก่อนสุดของ chain)
เพิ่ม `logClientEvent` ลงใน onClick handler ของปุ่ม "รับงาน/เริ่มงาน" ทั้ง 2 จุด (line 252, 276) — ก่อนเรียก `onAccept(job)`
- Event: `job-card:accept-click`
- ถ้ามี event นี้แต่ไม่มี `accept-job:pressed` → handler ถูก short-circuit
- ถ้าไม่มี event นี้ → ปุ่มไม่ได้ถูกกดในเซสชันปัจจุบัน (bundle เก่า / กดจากที่อื่น)

#### 2. เพิ่ม `console.warn` เห็นชัดใน `logClientEvent`
`console.warn('[audit] fire', event)` ก่อน `fetch` เพื่อให้ user ยืนยันได้ทันทีจาก Dev Tools ว่าเวอร์ชันใหม่โหลดแล้วจริง

#### 3. Log module load
`console.warn('[trackingRoomClient] loaded v2')` ที่ top-level ของ `src/lib/trackingRoomClient.ts` — ถ้า reload แล้วไม่เห็นบรรทัดนี้ = bundle เก่า

#### 4. Log ที่ระดับ **service worker bypass** (ถ้ามี PWA)
เช็คว่า `public/sw.js` / `manifest` มีการ cache JS chunk มั้ย ถ้ามี ต้อง unregister ก่อนเทส

#### 5. เพิ่ม log ก่อนเรียก `update-order-status`
```
logClientEvent({ event: 'update-order-status:about-to-call', ... })
```
เพื่อยืนยันว่า handler ไปถึงจุด fetch จริงหรือไม่

### หลังทำเสร็จ ทดสอบยังไง
1. เปิด Dev Tools → Console
2. Reload preview → ควรเห็นบรรทัด `[trackingRoomClient] loaded v2` **(ถ้าไม่เห็น = bundle เก่า → แนะให้ปิดแท็บ/ล้าง cache/ unregister SW)**
3. กด "รับงาน" → ควรเห็นทันที `[audit] fire job-card:accept-click`, `[audit] fire accept-job:pressed`
4. Query:
   ```sql
   SELECT function_name, order_number, created_at FROM edge_function_audit_logs
   WHERE created_at > NOW() - INTERVAL '10 minutes' ORDER BY created_at DESC;
   ```

## เทคนิค

- ไฟล์ที่ต้องแก้: `src/lib/trackingRoomClient.ts`, `src/components/home/JobCard.tsx`, `src/pages/Home.tsx`
- ไม่มีการแก้ backend / RLS / DB schema
- Fire-and-forget pattern ยังคงเดิม, แค่เพิ่ม console.warn ให้เห็นชัดใน Dev Tools
