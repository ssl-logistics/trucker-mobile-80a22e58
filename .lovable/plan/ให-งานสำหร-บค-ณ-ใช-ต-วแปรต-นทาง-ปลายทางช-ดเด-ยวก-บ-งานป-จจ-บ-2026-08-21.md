# ให้ "งานสำหรับคุณ" ใช้ตัวแปรต้นทาง/ปลายทางชุดเดียวกับ "งานปัจจุบัน"

## ปัญหาปัจจุบัน (ตรวจสอบแล้วจากโค้ด)

สองหน้าอ่านข้อมูลจาก API ชุดเดียวกัน แต่ resolve ชื่อต้นทาง/ปลายทางคนละวิธี

- หน้างานปัจจุบัน (`CurrentJobsPage.tsx`)
  - ในประเทศ: `getApiLocationName(job.origin)` และ `getApiLocationName(job.destination)` = `origin.name` / `destination.name` (fallback `-`)
  - ต่างประเทศ: `origin.name` และ `return_terminal.location || return_terminal.name`
- หน้าแรก (`Home.tsx` → `JobCard`)
  - แปลงเป็นสตริง `origin_location` / `destination_location` ล่วงหน้า และมี fallback เพิ่มเติม เช่น `sender_name`, `sender_company_name`, `from_location`, `company_name`, การต่อชื่อบริษัท + อำเภอด้วย `\n` และเคส multi-destination ที่ตั้ง `destination_location = ''`
  - `JobCard` ยังมีลำดับ fallback ของตัวเองอีกชั้น: `origins[].company_name → employer_name → province → address → location` และ `destinations[].company_name → contact_name → province → location`

ผลคืองานเดียวกันแสดงชื่อสถานที่ไม่ตรงกันระหว่างสองหน้า

## สิ่งที่จะทำ

1. สร้าง helper กลาง `src/lib/jobLocation.ts` โดยย้ายตรรกะจาก `CurrentJobsPage` มาเป็นแหล่งความจริงเดียว
   - `normalizeLocationObject(value)` (รองรับทั้ง object และ JSON string)
   - `getApiLocationName(value)` → `name` หรือ `-`
   - `resolveJobLocations(item)` → คืน `{ originLocation, destinationLocation }` ตามกติกาเดียวกับหน้างานปัจจุบัน (ในประเทศ = `origin.name` / `destination.name`, ต่างประเทศ = `origin.name` / `return_terminal.location || name`)
2. `CurrentJobsPage.tsx` เปลี่ยนมา import helper แทนฟังก์ชันภายใน (พฤติกรรมและ UI เดิม 100%)
3. `Home.tsx` ให้ทั้งสองจุด map (งาน assigned ราวบรรทัด 350-399 และงานโพสต์/เช่าด่วน ราวบรรทัด 608-655) เรียก `resolveJobLocations` แทนตรรกะ fallback เดิม
4. `JobCard.tsx` ให้บล็อกแสดงต้นทาง/ปลายทางหลักใช้ค่า `origin_location` / `destination_location` ที่ส่งเข้ามาเป็นหลัก (ไม่ไป fallback หา `origins[]/destinations[]` ทับอีก) — โครง layout, ไอคอน, ขนาด, สี, ป้ายกำกับ คงเดิมทั้งหมด
5. งานหลายจุดส่ง: บล็อกรายการ "ปลายทาง #1, #2, +N" ใน `JobCard` ยังคงอยู่เหมือนเดิม แต่ค่าปลายทางหลักจะมาจากตัวแปรเดียวกับหน้างานปัจจุบัน

## สิ่งที่ไม่เปลี่ยน

- UI/ดีไซน์ทุกส่วนของหน้าแรกและการ์ดงาน
- ตรรกะการกรองงาน สถานะ ราคา หรือการ navigate
- โครงข้อมูลอื่นใน `Job` (พิกัด, วันเวลา, สินค้า ฯลฯ)

## รายละเอียดทางเทคนิค

ไฟล์ที่แตะ: `src/lib/jobLocation.ts` (ใหม่), `src/pages/Home.tsx`, `src/pages/CurrentJobsPage.tsx`, `src/components/home/JobCard.tsx`

ข้อควรทราบ: หลังแก้ งานบางรายการที่หน้าแรกเคยแสดงชื่อบริษัท/อำเภอจาก fallback จะเปลี่ยนไปแสดงค่าเดียวกับหน้างานปัจจุบัน และถ้า API ไม่มี `origin.name`/`destination.name` จะแสดง `-` เหมือนหน้างานปัจจุบัน
