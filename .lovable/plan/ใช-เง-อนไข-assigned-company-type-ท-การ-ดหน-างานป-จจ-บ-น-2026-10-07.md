# ใช้เงื่อนไข assigned_company_type ที่การ์ดหน้างานปัจจุบัน

## สิ่งที่ต้องแก้

หน้า "งานปัจจุบัน" (`src/pages/CurrentJobsPage.tsx`) การ์ดแต่ละใบยังใช้ label เดิม (โรงงาน/ผู้จ้าง ตามประเภทคนขับ) อยู่บรรทัด 1217 ให้เปลี่ยนมาใช้เงื่อนไขเดียวกับการ์ดหน้าแรก (`src/components/home/JobCard.tsx` บรรทัด 162-165)

## รายละเอียดการแก้

1. **Interface `AcceptedJob`** — เพิ่มฟิลด์ `assigned_company_type?: string | null;` (ข้อมูลจาก API ติดมากับ `...job` อยู่แล้ว แค่ประกาศ type ให้ใช้ได้)

2. **บรรทัด 1217** — เปลี่ยน label เป็น logic เดียวกับ JobCard:
   - ถ้า `job.assigned_company_type` มีค่า: `'factory'` → "โรงงาน", อื่น ๆ → "บริษัท" (`job.ownerCompany` — มีคำแปลครบ 4 ภาษาแล้ว)
   - ถ้าไม่มีค่า: คง fallback เดิมของหน้านี้ (internal/external driver → "โรงงาน", อื่น ๆ → "ผู้จ้าง")

3. **Mapping ข้อมูล (บรรทัด ~558)** — เพิ่ม `assigned_company_type: job.assigned_company_type ?? null` ให้ชัดเจนใน mapping ของ driver-assigned jobs (เส้นข้อมูลอื่นในหน้านี้ spread `...job` อยู่แล้ว จะติดมาเอง)

## ขอบเขต

- แก้เฉพาะการ์ดในหน้า "งานปัจจุบัน" ตามที่เลือก — หน้าอื่น (History / Bidding) ไม่แตะ
- ชื่อจุดรับ-ส่ง (resolveJobLocations) ยังไม่แก้ในงานนี้
- ไม่แตะ flow งานอื่น

## ตรวจสอบ

- `npx tsgo` + build ผ่าน
- เปิดหน้างานปัจจุบันดู label การ์ดแสดงถูกตามเงื่อนไข
