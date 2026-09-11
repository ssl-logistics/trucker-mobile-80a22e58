# แก้รูปในหน้าประวัติ (SOP Summary) ไม่แสดง

## สาเหตุ (ยืนยันแล้ว)

- API `get-driver-sop` ส่งรูปมาปกติ: `product_images` / `document_images` เป็น URL ดิบของ S3 (`ssl-thetroob.s3...amazonaws.com/mobile/mobile/...`)
- ไฟล์รูปมีอยู่จริงบน S3 และเปิดได้ (ทดสอบด้วย presigned URL ได้ HTTP 200, รูปถูกต้อง)
- แต่ URL ดิบเปิดไม่ได้ (HTTP 403) เพราะ bucket เป็น private — ต้องขอ presigned URL ผ่าน edge function `get-image-url`
- ปัญหา: แอปแนบ header `x-app-secret` ให้ทุกคำขอ edge function (ผ่าน `installFetchWrapper.ts`) แต่ `get-image-url` มี `Access-Control-Allow-Headers` แค่ `authorization, x-client-info, apikey, content-type` — ไม่มี `x-app-secret`
- ผลคือเบราว์เซอร์บล็อก preflight → ขอ presigned URL ไม่ได้ → hook fallback ไปใช้ URL ดิบ → 403 → รูปแตก (เห็นกรอบว่าง + alt text ตามภาพที่ส่งมา)

## สิ่งที่จะแก้

1. `supabase/functions/get-image-url/index.ts`
   - เพิ่ม `x-app-secret` ใน `Access-Control-Allow-Headers` (และสะกะรอพิมพ์ `x-client-info`)
2. Deploy `get-image-url`
3. ทดสอบ: เรียก presign ด้วย header `x-app-secret` ผ่าน curl → ต้องได้ presigned URL ที่เปิดรูปได้จริง

## ขอบเขต

- แก้เฉพาะ CORS header ของ `get-image-url` เท่านั้น ไม่แตะ logic การเซ็นลายเซ็น, hook ฝั่งหน้าเว็บ หรือหน้าประวัติ (พฤติกรรม read-only เดิมคงไว้)
- ผลกระทบ: รูปทุกจุดที่ใช้ `usePresignedImageUrl` จะกลับมาแสดงได้ (SOP, POD, ใบชั่ง, ใบเสร็จ, ตู้) ทั้งหน้างานปัจจุบันและประวัติ
