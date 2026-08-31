# เพิ่มเมนู "ตลาด" (Market) สำหรับฟรีแลนซ์ + หน้าตลาดงานขนส่งใหม่

## เป้าหมาย
เพิ่มเมนู "ตลาด / Market" ใน quick menu ของ AppHeader **แสดงเฉพาะ `freelance_driver`** และสร้างหน้าตลาดงานขนส่งใหม่ (`/market`) ที่รวมงานเปิดรับ (express rent / transport posts) ให้ฟรีแลนซ์กดรับงานได้

## สิ่งที่จะทำ

### 1. เมนู "ตลาด" ใน AppHeader (`src/components/layout/AppHeader.tsx`)
- เพิ่ม item ใหม่ใน quick menu array:
  - icon: ใช้ไอคอน storefront/market (สร้าง asset ใหม่ หรือใช้ lucide `Store` ให้เข้ากับดีไซน์เดิม — ระหว่างทำจะเลือกให้เข้าชุดกับ icon เดิม)
  - `labelKey: "home.market"` → path `/market`
  - ตั้ง `showForFreelanceOnly: true` — ใช้ filter เดิม `canAccessBidding` (true เฉพาะ `freelance_driver`) ทำให้ internal/external/factory ไม่เห็นเมนูนี้
- UI/ตำแหน่งเดิมทุกอย่างคงไว้ เมนูจะแสดงเป็น 5 รายการสำหรับฟรีแลนซ์ (งานปัจจุบัน / เสนอราคา / ตลาด / รายได้ / ประวัติงาน)

### 2. หน้าตลาดงานขนส่งใหม่ (`src/pages/MarketPage.tsx`)
- โครงหน้าตามมาตรฐานแอป: `AppHeader` (showQuickMenu=false) + `BottomNavigation` + `PullToRefresh`
- ดึงงานด้วย `getExpressRentPosts()` (เส้นเดียวกับที่ Home ใช้สำหรับ "งานแนะนำ/งานสำหรับคุณ") — กรองเฉพาะงานที่ยังเปิดรับและไม่หมดอายุ ตาม logic เดิมของ Home (open, non-expired)
- แสดงการ์ดงานด้วย `JobCard` component เดิม (UI สม่ำเสมอกับหน้า Home) รองรับ pagination 5 งาน/หน้า
- กดรับงาน → ใช้ flow เดิมทั้งหมด: `ConfirmJobDialog` + `acceptExpressRentJob` + สร้าง tracking room + GPS (reuse logic จาก `Home.tsx`) พร้อม processing guard และ bank check (`useBankCheck`) สำหรับฟรีแลนซ์
- ค้นหา/กรองเบื้องต้น: ช่องค้นหา text เหมือนหน้า CurrentJobs (ค้นหา ต้นทาง/ปลายทาง/ชื่อบริษัท)
- ใช้ `resolveJobLocations` (`src/lib/jobLocation.ts`) เป็นแหล่งเดียวกับหน้าอื่นตาม memory

### 3. Route (`src/App.tsx`)
- เพิ่ม route `/market` → `MarketPage` ครอบด้วย `ProtectedRoute`
- กันเข้าถึง: ถ้าไม่ใช่ freelance_driver ให้ redirect กลับ `/` (เช็คผ่าน `useUserRole().isFreelanceDriver`)

### 4. i18n (`src/contexts/LanguageContext.tsx`)
เพิ่ม key `home.market` + ข้อความหน้า Market ครบ 4 ภาษา (TH/EN/KO/ZH):
- TH: `ตลาด`, EN: `Market`, KO: `마켓`, ZH: `市场`
- ข้อความเสริม: หัวข้อหน้า, empty state ("ไม่มีงานเปิดรับในขณะนี้"), ปุ่มรับงาน ฯลฯ

## Technical details
- ไม่แตะ backend/edge functions — ใช้ API เดิม (`get-express-rent-posts`, `accept-express-rent-job`)
- ไม่เปลี่ยน UI เดิมของเมนูอื่นหรือหน้า Home
- Visibility ใช้ `canAccessBidding` (เฉพาะ `freelance_driver`) ตาม pattern เดิมใน AppHeader

## การทดสอบ
- Login freelance → เห็นเมนูตลาด กดแล้วเข้า `/market` เห็นงานและรับงานได้
- Login internal/external driver → ไม่เห็นเมนูตลาด และเข้า `/market` ตรงๆ ถูก redirect
