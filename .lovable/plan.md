# แผน: แก้ไขการแสดงน้ำหนักงานต่างประเทศ (BL/Booking)

## ปัญหา
งาน `OR20260619036/02` (Booking) API ส่ง:
- `products: []` (ว่าง)
- `destinations: []` (ว่าง)
- แต่มีข้อมูลที่ top-level: `product_name: "ทดสอบ"`, `product_quantity: 1`, `product_weight: 50`, `product_weight_unit: "kg"`, `goods_weight: 50`

โค้ดปัจจุบันใน `DomesticJobDetail.tsx` วน `job.products[]` ก่อน ถ้าว่างจะ fallback ไปที่ `origin_goods_type` (text) ซึ่ง**ไม่มีน้ำหนัก** → แสดง `-`

## จุดที่จะแก้

**ไฟล์เดียว:** `src/components/job-detail/DomesticJobDetail.tsx`

3 จุดที่วน `products[]`:
1. บรรทัด ~2442 — แถวสรุปสินค้าในการ์ด Destination (`goodsType` inline)
2. บรรทัด ~2962 — Modal สินค้าจุดรับ (Pickup goods modal)
3. บรรทัด ~2911 — Loop `destinations` (ใช้ `dest.products`)

## วิธีแก้ (Minimal, ไม่กระทบในประเทศ)

เพิ่ม helper เดียว: ถ้า `job.products` เป็น array ว่าง **และ** top-level มี `product_name`/`product_weight`/`product_quantity` → สังเคราะห์เป็น virtual product 1 ตัว:

```ts
const effectiveProducts = (job.products && job.products.length > 0)
  ? job.products
  : (job.product_name || job.product_weight || job.product_quantity)
    ? [{
        product_name: job.product_name,
        product_quantity: job.product_quantity,
        product_weight: job.product_weight ?? job.goods_weight ?? job.weight,
        product_unit: job.product_unit,
        weight_unit: job.product_weight_unit || job.weight_unit || 'kg',
      }]
    : [];
```

แล้วเปลี่ยน 2 จุด (บรรทัด 2442, 2962) ให้ใช้ `effectiveProducts` แทน `job.products` โดยตรง

## ผลกระทบต่องานในประเทศ

**ไม่มีผลกระทบ** ในเคสปกติ เพราะ:
- งานในประเทศส่ง `products[]` มาเต็ม → ยัง render จาก `job.products` เหมือนเดิม
- Fallback จะทำงาน**เฉพาะกรณี** `products[]` ว่าง + top-level มีค่า ซึ่งเดิมจะแสดง `-` อยู่แล้ว → ตอนนี้แสดงข้อมูลแทน (ดีขึ้น ไม่แย่ลง)
- ไม่แตะ logic international detection, ไม่แตะ modal destination (บรรทัด 3024) เพราะเป็น per-destination

## Type update
เพิ่ม field ที่หายในอินเทอร์เฟส `DomesticJob` (บรรทัด ~149): `product_name?`, `product_quantity?`, `product_unit?`, `product_weight?`, `product_weight_unit?`, `goods_weight?`, `weight?`, `weight_unit?` (บางตัวมีแล้ว เช็คแล้วเติมที่ขาด)

## ไม่แตะ
- API layer, JobDetailPage mapping — top-level fields ผ่านเข้ามาอยู่แล้วผ่าน spread
- ContainerSOPPage, JobCard — ไม่เกี่ยว

## เวอร์ชั่น
ยังไม่ bump ถ้าไม่บอก
