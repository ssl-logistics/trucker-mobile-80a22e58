# แก้ key ของเส้น finance-category-types (แยกจาก key เดิม)

## ปัญหา
- `finance-category-types` ตอบ 401 `invalid x-api-key` เพราะตอนนี้แอปส่ง key ตัวเดียวกับ `transport-expenses` (`fld_sk_2026_...`) แต่เส้นนี้ใช้ key แยก
- ผู้ใช้ให้ key ที่ถูกต้องมาแล้ว: `1lc-wc9NNSm5RZXSsqlGQ8By_t7tqWRxKo3RPd8kMNw`

## การแก้ไข (ไฟล์เดียว)
**`src/lib/externalApi.ts`**
1. เพิ่ม key ใหม่ใน `API_KEYS`:
   - `FINANCE_API_KEY: '1lc-wc9NNSm5RZXSsqlGQ8By_t7tqWRxKo3RPd8kMNw'`
2. เปลี่ยน mapping ใน `ENDPOINT_API_KEY_MAP`:
   - `'finance-category-types'` จาก `EXPRESS_RENT_API_KEY` → `FINANCE_API_KEY`

## ไม่เปลี่ยนแปลง
- เส้นอื่นทั้งหมดใช้ key เดิมตามเดิม
- หน้าเพิ่มค่าใช้จ่ายและ fallback hardcode ไม่แตะต้อง (ทำงานเหมือนเดิม เพียงแต่ตอนนี้ API จะตอบสำเร็จ)

## ทดสอบ
- เรียก `GET finance-category-types` ด้วย key ใหม่ ต้องได้ 200 พร้อมรายการหมวดค่าใช้จ่าย
- build ผ่าน

## รายละเอียดทางเทคนิค
- key ฝั่ง client ถูกฝังในโค้ดอยู่แล้ว (pattern เดียวกับ key อื่นในไฟล์นี้) จึงใส่ตรงๆ ไม่ต้องผ่าน secret store
