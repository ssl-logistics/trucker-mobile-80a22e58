## ปัญหา

หลังจากผู้ใช้สลับลำดับจุดส่ง (reorder) แล้วเช็คอิน → ออกจากหน้า → กลับเข้ามาใหม่ ลำดับที่แสดงและสถานะ "รอเช็คอิน / SOP สำเร็จ" ไม่ตรงกับการสลับล่าสุด (ตามภาพ: จุด #3 กับ #5 อยู่ผิดตำแหน่ง / ไอคอนเช็คอินโผล่ผิดการ์ด)

## สาเหตุ (ที่วิเคราะห์จากโค้ด)

ไฟล์หลัก: `src/components/job-detail/DomesticJobDetail.tsx`

1. **การสลับ (`performSwap`)** re-sequences `sequence_number = idx + 1` ตาม visual order ใหม่ แล้วบันทึกลง `localStorage[dest_order_${order_code}]` เป็น `{id, sequence_number}` — และยิง `reorder-destinations` edge function (fire-and-forget) เพื่ออัปเดตฝั่ง server

2. **การเช็คอิน** (`DeliveryDetailPage` / `DeliverySOPCheckInPage`) — เมื่อเปิดจากการ์ด จะได้รับทั้ง URL `sequence_number` (ค่าใหม่หลัง swap) และ `state.destId`. ปลายทางค้น destination ด้วย `destId` จาก `job.destinations` (ค่าจาก API ที่ยัง "seq เดิม") แล้วส่ง `destination_sequence_number` = **seq เดิม** ไปกับ payload check-in / POD

3. **การ map check-in กลับมาแสดง** (`destCheckinById`, บรรทัด 1002–1012) ใช้ `origDests[i].sequence_number` (seq จาก API) ไปดึง `destinationCheckins[seq]` แล้วผูกเข้ากับ `dest.id`

4. **ปัญหาที่เกิด**: 
   - หลัง swap + check-in สำเร็จ → `reorder-destinations` ทำงานเบื้องหลัง server อัปเดต seq ใหม่
   - รอบ fetch ถัดไป (กลับเข้าหน้า) `job.destinations` จาก API มาพร้อม seq ใหม่ (server side)
   - แต่ `localStorage.dest_order_*` ยัง keep mapping ที่บันทึกไว้จากตอน swap และ effect บรรทัด 976–995 จะ **บังคับ sort ทับ** ด้วย mapping เก่านั้นเสมอ (ตราบใดที่ยังมี key นี้อยู่)
   - เมื่อ id ใน `savedOrder` ไม่ครอบคลุมทั้งหมด (เช่น เพิ่ม/ลด destinations, หรือ seq ที่ id อื่น fallback `d.sequence_number` ชนกับ mapping ที่บันทึก) จะเกิด duplicate seq → sort ไม่เสถียร → ลำดับผิด
   - เมื่อ check-in ถูกบันทึกด้วย seq เดิม (ตอนก่อน swap ยิงถึง server) แต่ปัจจุบัน server ทำ resequence แล้ว → `destinationCheckins[seqเดิม]` ยังคีย์เดิม แต่ `origDests[i].sequence_number` เป็น seq ใหม่ (จาก server) → `destCheckinById` ผูกผิด id → ไอคอน "SOP สำเร็จ / รอเช็คอิน" โผล่บนการ์ดผิด

พูดสั้น ๆ: มี **แหล่งความจริงเรื่องลำดับ 3 แหล่ง** ที่ไม่ sync กัน — API (server), `localStorage.dest_order_*`, และ `destinationCheckins` (คีย์ด้วย seq snapshot ตอนเช็คอิน) — ทำให้เข้าออกหน้าใหม่ทีไรก็เพี้ยน

## แผนการแก้ (Scope: frontend เท่านั้น ไม่แตะ business logic ฝั่ง server)

**1. ใช้ `destination.id` เป็น key เดียวทั่วทั้ง component**
- เปลี่ยน `destinationCheckins` จาก `Record<seq, ...>` เป็น `Record<destId, ...>` เมื่อเป็นไปได้ โดย resolve seq → id ตอนอ่านผลจาก API (ใช้ `job.destinations` snapshot ปัจจุบัน). fallback ให้ค้นทั้ง old seq (`destination_sequence_number`) และ new seq (จาก suffix `delivery_N`) → id
- ปรับ `destCheckinById` ให้ใช้ map ที่คีย์ id ตรง ๆ (ไม่ต้องแปลผ่าน `origDests[i].sequence_number`)

**2. ให้ localStorage เป็นแค่ "hint สำหรับช่วง optimistic" ไม่ใช่ source of truth**
- หลัง swap สำเร็จและ `reorder-destinations` ตอบ 2xx → **ลบ** `localStorage.dest_order_${order_code}` แล้วปล่อยให้ API เป็นตัวกำหนดลำดับใน render ถัดไป
- ถ้า API ล้มเหลว → เก็บ localStorage ไว้เป็น fallback แต่มี TTL (เช่น 10 นาที) พร้อม timestamp; effect restore ต้องตรวจ TTL ก่อนใช้
- effect restore เดิม (บรรทัด 976–995): เพิ่มการตรวจว่า **ทุก id ใน `destinations` มี entry ใน savedOrder ครบหรือไม่** ถ้าไม่ครบ → ไม่ใช้ localStorage เลย (กัน seq ชน)

**3. หน้าเช็คอิน (`DeliveryDetailPage`, `DeliverySOPCheckInPage`)**
- ยึด `destId` จาก `state` เป็นหลัก (ไม่ใช้ URL sequence_number เป็น key ของ destination)
- เพิ่ม logging ตอนส่ง check-in ให้ระบุ `dest_id` + `sequence_number_at_send` เพื่อ debug audit
- ไม่เปลี่ยน payload ที่ส่ง external API (ยังคงส่ง `destination_sequence_number` ตามค่าล่าสุดของ `job.destinations`)

**4. Voice / drag swap**
- ก่อน swap ตรวจว่ามี pending API call อยู่หรือไม่ ถ้ามี queue ไว้ ให้เสร็จก่อนค่อย swap รอบถัดไป (ป้องกัน race)

## การตรวจสอบหลังแก้

- reproduce เคสในภาพ: multi-destination, swap #3↔#5, เช็คอินจุดหนึ่ง, ออกจากหน้า, กลับเข้ามา → ลำดับตรง + สถานะเช็คอินตรงกับการ์ดที่ถูกต้อง
- log `[Reorder]` และ `[useCheckinStatus]` แสดง id/seq ตรงกัน
- ตรวจ `destCheckinById` snapshot ใน React DevTools ว่า key เป็น id ทั้งหมด

## ความเสี่ยง

ต่ำ–กลาง: แตะเฉพาะ presentation/hook mapping ใน `DomesticJobDetail.tsx` และ 2 หน้า check-in. ไม่แตะ schema, edge functions, หรือ payload ที่ส่ง external API. Rollback ง่ายด้วยการคืน mapping เดิม
