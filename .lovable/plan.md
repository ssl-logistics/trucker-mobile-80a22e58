

# แก้ไขการ Filter เดือนใน IncomePage

## ปัญหา

ตัวเลือกเดือน (Select) มี value เป็น "jan", "feb", ... แต่ไม่มี logic ที่ใช้ `selectedMonth` ไป filter ข้อมูลจริง ทำให้เลือกเดือนไหนก็แสดงข้อมูลทั้งหมดเหมือนเดิม

## วิธีแก้ไข

แก้ไขไฟล์ `src/pages/IncomePage.tsx`:

1. **เพิ่ม mapping** จาก select value ("jan", "feb", ...) เป็นเลขเดือน (0-11)
2. **เพิ่มฟังก์ชัน filter** ที่กรองงานตาม `sender_pickup_date` เทียบกับเดือนที่เลือก
3. **ใช้ filtered data** แทนข้อมูลดิบในการ group และแสดงผล

## รายละเอียดทางเทคนิค

### ไฟล์ที่แก้ไข
| ไฟล์ | การแก้ไข |
|------|----------|
| `src/pages/IncomePage.tsx` | เพิ่ม filter logic ก่อน groupJobsByMonth |

### Logic ที่เพิ่ม

```text
monthMap = { jan: 0, feb: 1, mar: 2, ... , dec: 11 }

filterByMonth(jobs, selectedMonth):
  if selectedMonth === "all" -> return jobs
  else -> return jobs.filter(job => 
    new Date(job.date ต้นทาง sender_pickup_date).getMonth() === monthMap[selectedMonth]
  )
```

### ปัญหาที่ต้องแก้เพิ่ม

ปัจจุบัน `IncomeJob.date` เก็บเป็น string ที่ถูก format แล้ว (เช่น "1/9/2568") ซึ่งไม่สามารถ parse กลับเป็น Date ได้ง่าย ดังนั้นจะ **เพิ่ม field `rawDate`** (ISO string) ใน `IncomeJob` interface เพื่อใช้ในการ filter เดือนอย่างแม่นยำ

### ขั้นตอน
1. เพิ่ม `rawDate: string` ใน `IncomeJob` interface
2. ตอน map job เป็น IncomeJob ให้เก็บ `rawDate: job.sender_pickup_date` ด้วย
3. สร้าง `monthMap` object
4. สร้างฟังก์ชัน `filterBySelectedMonth` ที่ใช้ `rawDate` เทียบกับ `selectedMonth`
5. Apply filter ก่อน `groupJobsByMonth` ในทั้ง 3 tabs (all, paid, unpaid)

