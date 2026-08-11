# ทำ Header ทุกหน้าให้ตำแหน่งเหมือนกัน

## ปัญหาปัจจุบัน

Header แต่ละหน้าใช้รูปแบบต่างกัน 3 แบบ จึงมีบางหน้าที่ header เลื่อนหลุดหรือ "ดึงลง" ได้:

| รูปแบบ | หน้า | อาการ |
|---|---|---|
| `app-header-fixed` (AppHeader) | Home, Dashboard | ติดบนสุด ถูกต้อง |
| `sticky top-0 z-50` / `z-10` | Pickup/Delivery/SOP/Container, CurrentJobs, Bidding, JobHistory, Terms, Contact, PlaceBid, AddExpense, ChatRoom, Dashboard ย่อย, DomesticJobDetail | ติดบน แต่ยัง "ดึงลง" ได้จาก overscroll bounce และ z-index ไม่เท่ากัน |
| `page-header-safe` เฉยๆ (ไม่ sticky) | Income, Profile, Notifications, Language, VehicleInfo, Account, JobRouteExpenses, BidJobDetail | เลื่อนหลุดขึ้นไปตอน scroll |

## สิ่งที่จะทำ

1. เพิ่ม utility class เดียวใน `src/index.css` ชื่อ `app-sticky-header` รวมทุกคุณสมบัติที่ต้องการ:
   - `position: sticky; top: 0; z-index: 100`
   - `padding-top: env(safe-area-inset-top)` (แทน `page-header-safe`)
   - `transform: translate3d(0,0,0)` + `backface-visibility: hidden` + `contain: layout style paint` กัน header ขยับ/สั่นตอน scroll บน iOS
   - `overscroll-behavior: none` ที่ตัว header
2. กัน overscroll bounce ระดับ container: เพิ่ม `overscroll-behavior-y: none` ให้ `#root` (ปัจจุบันเป็น `contain`) เพื่อไม่ให้ลากทั้งหน้าลงมาแล้ว header ขยับตาม
3. แทนที่คลาส header เดิมของทุกหน้าในตารางด้านบนด้วย `app-sticky-header` โดยคงสี/มุมโค้ง/เงาเดิมของแต่ละหน้าไว้ (เปลี่ยนเฉพาะส่วนตำแหน่ง: ลบ `sticky top-0`, `z-10/z-50`, `page-header-safe` ออก)
4. ปรับ `AppHeader` (`app-header-fixed`) ให้ใช้ค่า z-index และ padding safe-area ชุดเดียวกัน เพื่อให้ Home/Dashboard เท่ากับหน้าอื่น
5. หน้าที่มีแถบรองใต้ header (เช่น `CurrentJobsPage` แถบ filter ที่ `sticky top-0 z-40`) จะปรับให้ stack ต่อจาก header ไม่ทับกัน

## หมายเหตุทางเทคนิค

- ไม่แตะ logic/ข้อมูล เป็นการเปลี่ยน CSS และ className เท่านั้น
- ไฟล์ที่แก้: `src/index.css`, `src/components/layout/AppHeader.tsx`, และไฟล์ page/component ที่ระบุในตาราง (~25 ไฟล์)
- ตรวจผลด้วยการเปิด preview หลายหน้าและเลื่อน/ลากดูว่า header อยู่กับที่
