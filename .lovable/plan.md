# สาเหตุ

Error `Failed to fetch dynamically imported module: /assets/SOPCheckInPage-I1RirIAz.js` เกิดจาก **stale bundle**:

- ผู้ใช้เปิดแอปไว้ก่อนหน้า (bundle เก่า `index-CwG2FB72.js` อ้างชื่อไฟล์ `SOPCheckInPage-I1RirIAz.js`)
- มีการ deploy ใหม่ → Vite สร้าง hash ใหม่ ไฟล์เก่าถูกลบจาก CDN
- เมื่อ user กด navigate ไปหน้า SOP (`React.lazy` / dynamic `import()`) เบราว์เซอร์ไปโหลดไฟล์ hash เก่า → 404 → throw `TypeError` → blank screen

ไม่เกี่ยวกับ logic เช็คอิน / ไม่เกี่ยวกับ edge function — เป็น cache/versioning ล้วนๆ

# แผนแก้ (ให้ recover อัตโนมัติ ไม่ต้องให้ user refresh เอง)

## 1. Global handler สำหรับ chunk-load error
เพิ่มใน `src/main.tsx`:
- ดัก `window.addEventListener('error', ...)` และ `'unhandledrejection'`
- ถ้า message ตรง pattern `Failed to fetch dynamically imported module` หรือ `Loading chunk` / `error loading dynamically imported module`:
  - ใช้ `sessionStorage` guard (`__chunk_reload_at`) กัน reload loop (ถ้า reload ไปแล้วใน 10 วิ ให้ข้าม)
  - unregister service worker + `caches.delete(...)` ทั้งหมด (กัน sw.js เสิร์ฟไฟล์เก่า)
  - `window.location.reload()` ครั้งเดียว

## 2. Retry wrapper สำหรับ `React.lazy`
สร้าง `src/lib/lazyWithRetry.ts`:
```ts
export function lazyWithRetry<T>(factory: () => Promise<T>) {
  return React.lazy(() =>
    factory().catch((err) => {
      if (/dynamically imported module|Loading chunk/i.test(String(err?.message))) {
        // trigger global handler above
        throw err;
      }
      throw err;
    })
  );
}
```
ใช้แทน `React.lazy` ในจุดที่ import lazy pages (ดูใน `src/App.tsx`)

## 3. Service worker
ตรวจ `public/sw.js` / `vite-plugin-pwa` config ให้:
- ใช้ `registerType: 'autoUpdate'` (มีอยู่แล้วจาก `registerSW` ใน main.tsx)
- ไม่ precache HTML แบบ stale-while-revalidate ยาว → ให้ index.html เป็น network-first เพื่อให้ hash chunk ใหม่ถูกอ้างทันหลัง deploy

## ไฟล์ที่จะแก้
- `src/main.tsx` — เพิ่ม global error listener + cache/sw cleanup
- `src/lib/lazyWithRetry.ts` — ใหม่
- `src/App.tsx` — เปลี่ยน `lazy(...)` เป็น `lazyWithRetry(...)` ในทุก route
- (ถ้าจำเป็น) `vite.config.ts` — ปรับ workbox `navigateFallback` / runtimeCaching ของ HTML เป็น NetworkFirst

## ไม่แก้
- SOPCheckInPage / DomesticJobDetail / edge functions — ไม่เกี่ยวกับ error นี้
