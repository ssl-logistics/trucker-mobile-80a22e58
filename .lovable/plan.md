## เป้าหมาย
เพิ่มการแสดงขนาดตู้ (`container_size`) ในหน้ารายละเอียดงานต่างประเทศ (International Job) โดยแสดงในส่วน **จุดรับตู้เปล่า (Empty Container Pickup Card)** ใต้ข้อมูลเบอร์โทร และรองรับการแปลภาษาตามที่ผู้ใช้เลือก

## ขอบเขต
- แก้ไขเฉพาะการแสดงผล UI 1 จุดเท่านั้น
- ไม่แก้ไข logic อื่น ไม่แก้ไข API / mapping / interface
- ใช้ pattern `(job as any).container_size` ตามที่มีอยู่แล้วใน `DomesticJobDetail.tsx` (เช่น `empty_pickup_yard_name`, `empty_pickup_port`)

## ขั้นตอน

### 1. เพิ่ม Translation Key
ใน `src/contexts/LanguageContext.tsx` (หรือไฟล์ translation ที่ใช้) เพิ่ม key `jobDetail.containerSize` ใน object ทั้ง 4 ภาษา:
- **th**: `ขนาดตู้`
- **en**: `Container Size`
- **ko**: `컨테이너 크기`
- **zh**: `货柜尺寸`

### 2. เพิ่ม UI ในหน้างาน
ใน `src/components/job-detail/DomesticJobDetail.tsx` บรรทัด ~1557 (ในส่วน `space-y-1.5 text-xs text-muted-foreground` ของ Empty Container Pickup Card) เพิ่ม div แสดงข้อมูลใต้แถวเบอร์โทร:

```tsx
{(job as any).container_size && (
  <div className="flex items-start gap-2">
    <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
    <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.containerSize')}</span>
    <span className="font-semibold text-[#225795]">{(job as any).container_size}</span>
  </div>
)}
```

เงื่อนไขแสดง: เฉพาะงานต่างประเทศ (`job.job_type === 'international'`) และมีค่า `container_size` เท่านั้น

## ไฟล์ที่แก้ไข
- `src/contexts/LanguageContext.tsx` — เพิ่ม translation key
- `src/components/job-detail/DomesticJobDetail.tsx` — เพิ่ม UI element 1 จุด