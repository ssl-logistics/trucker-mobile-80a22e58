# แก้การ์ดงานตลาดที่แสดงราคา ฿ 0

## สาเหตุ (ตรวจสอบแล้ว)
- เรียก `get-talad-jobs` จริง: API ส่ง `price` และ `final_price` เป็น `null` มา 6 ใน 8 งาน (ส่วนใหญ่เป็นงาน `job_type: "auction"` ที่ยังไม่มีราคาตั้งต้น)
- ฝั่งแอปใน `MarketPage.tsx` map ด้วย `item.final_price ?? item.price ?? 0` จึงกลายเป็น `฿ 0` บนการ์ด

## สิ่งที่จะทำ

### 1. `src/pages/MarketPage.tsx`
- เปลี่ยน mapping ราคาเป็น `price: item.final_price ?? item.price ?? null` (interface `Job.price` รองรับ `number | null`)
- ไม่แตะตรรกะค้นหา/แบ่งหน้า

### 2. `src/components/home/JobCard.tsx`
- ถ้า `price` เป็น `null` → แสดงข้อความ "ไม่ระบุราคา" (ผ่าน i18n `market.price_not_set`) แทนตัวเลข `฿ 0`
- งานที่มีราคาจริงแสดงตามเดิม

### 3. `src/contexts/LanguageContext.tsx`
- เพิ่ม key `market.price_not_set` ครบ 4 ภาษา: ไทย "ไม่ระบุราคา", EN "Price not set", KO "가격 미정", ZH "价格待定"

## ไม่แตะ
- Edge function `get-talad-jobs` และ API ภายนอก (เป็นข้อมูลต้นทางที่ยังไม่มีราคาจริง)

## การทดสอบ
- เปิด `/market` → งาน 6 ใบที่ราคา null แสดง "ไม่ระบุราคา" แทน ฿ 0; งาน 2 ใบที่มีราคา (85000, 4158) แสดงตามเดิม
- build ผ่าน
