# วิเคราะห์ความเสี่ยงหลังปรับ checkin-waypoint

## สรุประดับความเสี่ยง: 🟢 ต่ำมาก

การปรับครั้งนี้เป็น **additive change** (เพิ่มการยิง fire-and-forget) ไม่แตะ business logic เดิม

---

## จุดที่ปรับ vs ผลกระทบ version เดิม

| จุด | สิ่งที่เพิ่ม | กระทบของเดิม? |
|---|---|---|
| `checkinWaypoint.ts` | เพิ่ม `ensureRoomCode()` helper | ❌ ไม่กระทบ (ฟังก์ชันใหม่) |
| `PickupDetailPage` | refactor ใช้ helper | ⚠️ ต่ำ (logic เดิมยังทำงาน, helper แค่ห่อ localStorage+createRoom เดิม) |
| `DeliveryDetailPage` | fallback สร้าง room ถ้าไม่มี | ❌ ไม่กระทบ (เดิมไม่ยิง waypoint อยู่แล้ว) |
| `ContainerCheckInPage` | เพิ่มยิง waypoint หลัง checkin สำเร็จ | ❌ ไม่กระทบ (แค่เพิ่ม fire-and-forget) |
| `useProximityAlert` | เพิ่มยิง waypoint | ❌ ไม่กระทบ (auto checkin เดิมยังทำงาน) |

---

## ความเสี่ยงที่ต้องระวัง

### 1. 🟢 Network failure → ไม่กระทบผู้ใช้
- ใช้ `try/catch` + `keepalive: true` + fire-and-forget
- ถ้า endpoint ล่ม → แค่ log warning, ไม่ block check-in
- Check-in หลัก (driverCheckin, truck-arrival, update-order-status) ทำงานปกติ

### 2. 🟡 `ensureRoomCode` สร้าง room ซ้ำที่ delivery
- **Mitigation**: external API return `409` เมื่อ room มีอยู่ → `create-tracking-room` handle เป็น success + upsert `room_code` เดิม (มี code อยู่แล้วใน `create-tracking-room/index.ts` line ~120)
- ไม่มี duplicate room ในระบบ

### 3. 🟡 Race condition ที่ delivery
- ถ้า 2 tab เปิดพร้อมกัน → ทั้ง 2 เรียก create-tracking-room
- **Mitigation**: 409 idempotent handling รับได้อยู่แล้ว

### 4. 🟢 Sequence order ผิด
- ต่างประเทศ fix hard-code (1/2/3 ตาม job type) → ไม่พึ่ง destination array
- ในประเทศ ใช้ `destination.sequence_number` เดิม (ไม่เปลี่ยน)

### 5. 🟢 Performance
- fire-and-forget, ไม่ await ในเส้นทาง critical
- ไม่เพิ่ม latency ให้ผู้ใช้กดปุ่ม check-in

---

## Regression Test Checklist (หลัง implement)

1. ✅ Domestic pickup check-in → waypoint ยิง seq `1`
2. ✅ Domestic multi-delivery → waypoint ยิงตาม `sequence_number` ของแต่ละจุด
3. ✅ BL container_pickup → seq `1`
4. ✅ BL delivery (ไม่มี room_code ตั้งแต่ต้น) → สร้าง room ใหม่ + ยิง seq `2`
5. ✅ BL container_return → seq `3`
6. ✅ Booking container_pickup/pickup/container_return → seq 1/2/3
7. ✅ Proximity auto check-in → ยิง waypoint ตาม seq เดียวกับ manual
8. ✅ Endpoint ล่ม → check-in ยังสำเร็จ, UI ไม่ค้าง
9. ✅ POD/EIR confirm → **ไม่** ยิง waypoint ซ้ำ

---

## Rollback plan

ถ้ามีปัญหา:
- ทุกจุดที่ยิงห่อใน `try/catch` แยกก้อน → ลบ 1-2 บรรทัดต่อจุด revert ได้ทันที
- ไม่มี migration, ไม่แตะ DB schema, ไม่แตะ edge function ที่มีอยู่
- ใช้ chat history revert ได้ปลอดภัย

---

## สรุป

**ความเสี่ยงกระทบ version เดิม: ต่ำมาก** เพราะ:
- ไม่แก้ business logic เดิม
- ไม่แตะ database schema / edge function เดิม
- ทุกการยิงเป็น fire-and-forget + try/catch
- 409 idempotent มีอยู่แล้ว → ป้องกัน duplicate room

พร้อม implement ได้เมื่อกด Approve
