

# แก้ไขเวลาเรือมาถึงและเวลาเข้ารับตู้เปล่าไม่แสดง

## ปัญหา
ในหน้ารายละเอียดงาน (Job Detail) สำหรับงาน International เช่น OR20260209026 ฟิลด์ "วัน/เวลาเรือถึง" และ "วันเริ่มเข้ารับตู้เปล่า" แสดงเป็น "-" เพราะ API ภายนอกอาจส่งชื่อฟิลด์ต่างจากที่โค้ดแมปไว้

## สาเหตุ
การแมปข้อมูลใน `JobDetailPage.tsx` รองรับชื่อฟิลด์จำกัด:
- **เรือถึง**: `container_checkpoint_time` หรือ `eta_date` เท่านั้น
- **รับตู้เปล่า**: `empty_container_date` เท่านั้น

แต่ API ภายนอกอาจส่งมาในชื่อฟิลด์อื่น เช่น `vessel_eta`, `empty_pickup_date`, `empty_pickup_time`, `eta_time` เป็นต้น

## แผนแก้ไข

### ขั้นตอนที่ 1: เพิ่ม Debug Log เพื่อดูฟิลด์ทั้งหมดจาก API
เพิ่ม `console.log` ใน `JobDetailPage.tsx` หลังจากหา `foundJob` ได้แล้ว เพื่อแสดงฟิลด์ทุกตัวที่เกี่ยวข้องกับ container/eta/empty:

```typescript
console.log('[JobDetailPage] Container fields:', {
  container_checkpoint_time: foundJob.container_checkpoint_time,
  eta_date: foundJob.eta_date,
  eta_time: foundJob.eta_time,
  vessel_eta: foundJob.vessel_eta,
  empty_container_date: foundJob.empty_container_date,
  empty_pickup_date: foundJob.empty_pickup_date,
  empty_pickup_time: foundJob.empty_pickup_time,
  allKeys: Object.keys(foundJob).filter(k => 
    k.includes('eta') || k.includes('empty') || k.includes('vessel') || k.includes('container') || k.includes('checkpoint')
  )
});
```

### ขั้นตอนที่ 2: เพิ่ม Fallback Field Names ในการแมป
ปรับการแมปใน `JobDetailPage.tsx` ให้รองรับชื่อฟิลด์เพิ่มเติม:

**ไฟล์: `src/pages/JobDetailPage.tsx`**
```typescript
// เวลาเรือถึง - เพิ่ม fallback หลายชื่อ
container_checkpoint_time: foundJob.container_checkpoint_time 
  || foundJob.eta_date 
  || foundJob.eta_time
  || foundJob.vessel_eta
  || foundJob.vessel_arrival_date
  || null,

// วันรับตู้เปล่า - เพิ่ม fallback
empty_container_date: foundJob.empty_container_date 
  || foundJob.empty_pickup_date 
  || foundJob.first_pickup_date
  || null,
```

### ขั้นตอนที่ 3: แก้ไขเดียวกันใน `ContainerCheckInPage.tsx`
ให้หน้า ContainerCheckIn มี fallback เหมือนกัน

### ขั้นตอนที่ 4: แก้ไขเดียวกันใน `PickupDetailPage.tsx`
ให้หน้า PickupDetail มี fallback เหมือนกัน (ถ้ามีการแสดงข้อมูลเหล่านี้)

---

## รายละเอียดทางเทคนิค

### ไฟล์ที่ต้องแก้ไข
1. **`src/pages/JobDetailPage.tsx`** - เพิ่ม debug log + fallback field mapping (บรรทัด ~258, ~290, ~309)
2. **`src/pages/ContainerCheckInPage.tsx`** - เพิ่ม fallback field mapping (บรรทัด ~127-130)

### ขั้นตอนการทำงาน
1. เพิ่ม console.log เพื่อดูชื่อฟิลด์จริงจาก API ก่อน
2. เพิ่ม fallback mapping ตามชื่อฟิลด์ที่เป็นไปได้
3. หลังจากเห็น log จริงแล้ว สามารถปรับเพิ่มได้อีกถ้ายังไม่ครบ
