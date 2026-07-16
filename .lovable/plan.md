## สิ่งที่จะทำ

### 1. งาน Booking (ส่งออก) – เปิด cron แจ้งเตือน 6 ชม.
เพิ่ม cron job รายชั่วโมง เรียก `check-booking-closing-warning` (edge function มีอยู่แล้ว เตือน ≤ 6 ชม. ก่อน CY Closing Time พร้อม dedupe ด้วย `reference_id`)

```sql
select cron.schedule(
  'booking-closing-warning-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url:='https://<project>.supabase.co/functions/v1/check-booking-closing-warning',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```
ยิงผ่าน `supabase--insert` (ไม่ใช่ migration) ตามข้อกำหนดของ Lovable Cloud

### 2. งาน BL (นำเข้า) – เพิ่มด่านเตือน 6 ชม.
ปัจจุบัน `check-container-return-deadline` เตือนแค่ ≤ 24 ชม. ครั้งเดียว จะปรับให้เตือน **2 ด่าน**:
- **24 ชม.**: heads-up (ใช้ `reference_id = container_return_deadline:<order>` เดิม → ไม่ยิงซ้ำในงานที่เคยเตือนแล้ว)
- **6 ชม.**: urgent reminder (`reference_id = container_return_deadline:<order>:6h` ใหม่ → ยิงอีก 1 ครั้งได้)

แก้ไฟล์เดียว: `supabase/functions/check-container-return-deadline/index.ts`
- แทน constant `WARN_BEFORE_HOURS = 24` ด้วย array `WARN_STAGES = [{hours:24, suffix:''}, {hours:6, suffix:':6h'}]`
- วน loop ทั้งสองด่านต่อ 1 งาน, dedupe ต่อด่านด้วย `reference_id` ที่ต่างกัน
- ปรับ title/body ของด่าน 6 ชม. เป็นข้อความเร่งด่วน (⚠️ + "เหลือเวลา ~6 ชม.")

### ความเสี่ยง 🟢 ต่ำมาก
- ไม่แก้ client, schema, business logic
- Cron ตัวใหม่ = additive, rollback: `select cron.unschedule('booking-closing-warning-hourly');`
- BL 6h stage มี `reference_id` แยก จึงไม่ชนกับด่าน 24h เดิม; งานเก่าที่ผ่านด่าน 24h ไปแล้วจะได้รับด่าน 6h เพิ่มอีก 1 ครั้ง (พึงประสงค์)
- Edge function ทั้ง 2 ตัวมี dedupe `(user_id, reference_id)` อยู่แล้ว → cron ทุกชั่วโมงปลอดภัย
