# ส่งรหัสออเดอร์เต็มเข้าระบบคิว QTruck (ไม่ตัดส่วนท้าย)

## สิ่งที่แก้

ตอนสแกน QR สำเร็จ แอปส่งรหัสออเดอร์เข้าระบบคิว QTruck โดยตัดส่วนท้ายออก (`OR20261007026/01` → `OR20261007026`) — ให้ยกเลิกการตัด แล้วส่งรหัสเต็มตามที่สแกน/ตามงานจริงแทน

## การแก้ไข (frontend เท่านั้น)

ไฟล์เดียว: `src/components/job-detail/DomesticJobDetail.tsx`

- ใน `handleLoadingQrDone` (~บรรทัด 264): เปลี่ยน
  - เดิม: `const baseOrder = String(job.order_code || '').split('/')[0];`
  - ใหม่: `const baseOrder = String(job.order_code || '');`
  - ส่งรหัสเต็ม เช่น `OR20261007026/01` ไปกับ `notifyQtruckQueueScan(...)` ตามเดิม (เปลี่ยนแค่ค่าที่ส่ง ไม่เปลี่ยน flow fre-and-forget / station_token)

## สิ่งที่ไม่แตะ

- `loadingQrKey` (localStorage `loading_qr_<...>`) คงตัด `/` เหมือนเดิม — เป็นคีย์เก็บผลสแกนในเครื่อง ไม่เกี่ยวกับการส่ง API และไม่ให้ข้อมูลสแกนเก่าหาย
- edge function `qtruck-queue-scan` ส่ง `order_number` ตรง ๆ อยู่แล้ว (limit 100 ตัวอักษร พอสำหรับรหัสเต็ม) — ไม่ต้องแก้
- ผู้เรียก `notifyQtruckQueueStatus` อื่น ๆ (check-in/SOP/คอนเทนเนอร์) ส่งรหัสเต็มอยู่แล้ว — ไม่ต้องแก้
- flow สแกน/ข้าม/กล้อง และ UI ทุกอย่างคงเดิม

## ตรวจสอบ

- `npx tsgo --noEmit -p tsconfig.app.json` และ build ผ่าน
- Console log `[LoadingQR]` แสดงรหัสเต็ม (`OR20261007026/01`) ใน preview
