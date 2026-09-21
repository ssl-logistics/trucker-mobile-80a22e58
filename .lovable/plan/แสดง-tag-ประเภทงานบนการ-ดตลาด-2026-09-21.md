# แสดง tag ประเภทงานบนการ์ดตลาด

## ที่ต้องทำ

เพิ่มป้าย (badge) บอกประเภทงานตลาดบนการ์ดแต่ละใบ — งานด่วน / ประมูล / สนใจรับงาน — โดยการ์ดที่ไม่ใช่ของตลาด (หน้า Home, Current Jobs) จะไม่แสดงป้ายนี้

## รายละเอียด

### 1. `src/components/home/JobCard.tsx`
- เพิ่ม helper เลือกสี + label ตาม `job.marketType`:
  - `urgent` → ป้ายแดง/ส้ม ใช้ key `market.tab_urgent`
  - `auction` → ป้ายม่วง ใช้ key `market.tab_auction`
  - `interest` → ป้ายฟ้า ใช้ key `market.tab_interest`
- วางป้ายข้างป้ายประเภทขนส่งที่มีอยู่แล้ว (บล็อก domestic/international แถว ~163) โดยห่อทั้งสองใน `flex flex-wrap gap-2`
- แสดงเฉพาะเมื่อ `job.marketType` มีค่า (ไม่กระทบการ์ดหน้าอื่น)

### 2. ไม่ต้องเพิ่ม i18n key ใหม่
- ใช้ key `market.tab_urgent` / `market.tab_auction` / `market.tab_interest` ที่มีครบ 4 ภาษา (th/en/ko/zh) อยู่แล้ว

## ไม่แก้
- MarketPage, taladApi, ปุ่มกดรับงาน/เสนอราคา — คงพฤติกรรมเดิมทั้งหมด
