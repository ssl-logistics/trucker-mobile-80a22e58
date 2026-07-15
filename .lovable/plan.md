# แผนแก้ปัญหา Tracking Room ครอบคลุมทุกกรณี + Backward Compat

## เป้าหมาย
ทุกงาน (เก่า/ใหม่/freelance auto/reorder) ต้องหา `room_code` ที่ถูกต้องเจอเสมอ พร้อม log ครบ และไม่กระทบ APK เวอร์ชันเก่า

## Database

**Migration:** สร้าง `public.order_tracking_rooms`
- `order_number` (PK), `room_code` (NOT NULL), `truck_plate`, `driver_id`, `origin_lat/lng`, `destination_lat/lng`
- `source` enum: `created | idempotent_409 | external_lookup | recreated | server_freelance | backfill_audit`
- `status` default `'active'`, `created_at`, `updated_at` + trigger
- RLS: deny client (service role only), GRANT service_role
- **Backfill** จาก `edge_function_audit_logs` ที่มี `room_code` + `order_number` (source=`backfill_audit`)

## Edge Functions

1. **`create-tracking-room`** — เพิ่ม UPSERT ทั้ง path success และ 409 (`source='created'` / `'idempotent_409'`) + CORS `x-app-secret` ครบ
2. **`get-tracking-room`** (ใหม่) — 3-tier:
   - Tier 1: SELECT จาก `order_tracking_rooms`
   - Tier 2: เรียก external `/get-tracking-rooms?order_code=X` → UPSERT (`source='external_lookup'`)
   - Tier 3: เรียก `create-tracking-room` ใหม่ด้วย coords จาก payload → UPSERT (`source='recreated'`)
   - ทุก tier เขียน audit log สำเร็จ/ล้มเหลว
3. **`update-tracking-waypoints`** — รับได้ทั้ง `{room_code}` (backward compat, คงไว้ถาวร) และ `{order_number}` (lookup ผ่าน Tier 1-3)
4. **`receive-freelance-selected`** — UPSERT ตอน server สร้างห้องอัตโนมัติ (`source='server_freelance'`)

## Client

1. **`src/lib/trackingRoomLookup.ts`** (ใหม่)
   - `getRoomCodeForOrder(orderCode, jobData?)` → เรียก `get-tracking-room` edge, cache in-memory
   - `clearRoomCache(orderCode)`
2. **`DomesticJobDetail.tsx handleReorderConfirm`** — เลิกอ่าน `gps_tracking_state`, ใช้ `getRoomCodeForOrder()` + toast แจ้งถ้า `source='recreated'`
3. จุดอื่นที่อ่าน `room_code_${order}` (Home, PickupDetail, DeliveryDetail, CurrentJobs, truck-arrival caller) — ค่อย ๆ ย้ายมาใช้ helper (ไม่บังคับใน rollout แรก แต่ helper รองรับ fallback อ่าน localStorage ก่อน)
4. **`useGpsTracking.ts`** — เปลี่ยน `gps_tracking_state` เป็น map `{[orderCode]: roomCode}` แก้บั๊กหลายงานทับกัน

## Backward Compat (APK เก่า)

- ✅ Response schema `create-tracking-room` ไม่เปลี่ยน
- ✅ `update-tracking-waypoints` คง dual mode ถาวร (`{room_code}` ยังใช้ได้)
- ✅ `order_tracking_rooms` RLS deny client → APK เก่าไม่รู้จักตารางนี้ก็ไม่พัง
- ⚠️ บั๊ก reorder ผิดห้องบน APK เก่ายังอยู่ (แก้ไม่ได้ retroactive) — ต้องบังคับอัปเดต

## Rollout Order

1. Migration (สร้างตาราง + backfill จาก audit_logs)
2. Deploy `create-tracking-room` (UPSERT + CORS), `receive-freelance-selected` (UPSERT)
3. Deploy `get-tracking-room`, `update-tracking-waypoints` (dual mode)
4. Deploy client (`trackingRoomLookup.ts` + fix DomesticJobDetail + useGpsTracking map)
5. ทดสอบกับ `OR20260614011` (Tier 2 external lookup), งานใหม่ (Tier 1), งานที่ external ไม่มี (Tier 3 recreate)

## Verification

- Reorder งานเก่า → ต้องเห็น row ใน `order_tracking_rooms` และ waypoints อัปเดตด้วย `room_code` ที่ถูก
- Audit logs มีทั้ง success/failure + `source` ทุกครั้ง
- ไม่มีการเรียก `create-tracking-room` ซ้ำถ้า Tier 1 hit
