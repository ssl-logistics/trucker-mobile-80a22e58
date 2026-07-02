## ปัญหา

ขนาดตู้ที่เพิ่มไปในการ์ด **"จุดรับตู้เปล่า"** (`DomesticJobDetail.tsx` บรรทัด 1557–1563) อ่านจาก `(job as any).container_size` — แต่ API จริงเก็บค่าไว้ **nested** ไม่ใช่ที่ root:

```
job.origin.container_size          = "40HC"   ← ตัวหลัก
job.origin.container_sizes[0]      = "40HC"   ← array fallback
job.containers[0].container_type   = "40HC"   ← fallback สุดท้าย
```

เลยไม่มีค่ามาแสดง

## สิ่งที่จะแก้

ไฟล์เดียว: `src/components/job-detail/DomesticJobDetail.tsx` บรรทัด 1557–1563

เปลี่ยน expression ให้ resolve จาก 3 แหล่งตามลำดับ:

```tsx
{(() => {
  const j: any = job;
  const containerSize =
    j.container_size ||
    j.origin?.container_size ||
    j.origin?.container_sizes?.[0] ||
    j.containers?.[0]?.container_type ||
    null;
  if (!containerSize) return null;
  return (
    <div className="flex items-start gap-2">
      <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
      <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.containerSize')}</span>
      <span className="font-semibold text-[#225795]">{containerSize}</span>
    </div>
  );
})()}
```

## ที่ไม่แตะ

- ไม่แก้ที่การ์ดอื่น (จุดรับสินค้า / จุดส่ง / จุดคืนตู้)
- ไม่แก้ interface `Job` / mapping กลาง / translation
- ไม่แตะฝั่ง API
- ไม่บั๊มพ์เวอร์ชั่น

## หลังแก้จะได้อะไร

การ์ด "จุดรับตู้เปล่า" ของงาน OR20260619036/01 จะโชว์บรรทัด **ขนาดตู้: 40HC** ใต้เบอร์โทร ตามที่ต้องการ
