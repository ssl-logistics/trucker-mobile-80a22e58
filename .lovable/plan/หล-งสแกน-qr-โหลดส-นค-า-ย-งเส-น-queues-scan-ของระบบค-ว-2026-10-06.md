# หลังสแกน QR โหลดสินค้า: ยิงเส้น queues/scan ของระบบคิว

## สถานะตอนนี้
หลังสแกน แอปแค่เก็บค่า QR ไว้ในเครื่อง ขึ้น "เริ่มโหลดสินค้าแล้ว" และเปลี่ยนปุ่มเป็น "แนบหลักฐาน" — ยังไม่ได้ยิงไประบบคิว

## สิ่งที่จะทำ (เฉพาะงานในประเทศ)
สแกนสำเร็จแล้วเรียกเส้นสแกนของระบบคิวตามเอกสารที่ส่งมา:

```text
GET /external-queue-api/queues/scan?external_ref=<เลขออเดอร์>&station_token=<ค่าจาก QR>&key=<API_KEY>
```

- `external_ref` = เลขออเดอร์ (ตัด /NN)
- `station_token` = ค่าที่สแกนได้จาก QR ทั้งหมด (ถ้า QR เป็น URL จะดึงค่า station_token ออกจากลิงก์ให้ ถ้าไม่ใช่ส่งค่าดิบ)
- `key` = key ตัวเดียวกับที่ใช้ดึงคิว (QTRUCK_API_KEY) — อยู่ฝั่งเซิร์ฟเวอร์ ไม่โผล่ในแอป
- เรียกผ่าน edge function ใหม่ `qtruck-queue-scan` (ตรวจ x-app-secret + บันทึก audit log เหมือนเส้นอื่น) เพื่อไม่ให้ key รั่วไปอยู่ในแอป
- ส่งแบบไม่รอผล: ถ้าคิวตอบ 404 (จบแล้ว) หรือ 400 (หลายคิว active) คนขับยังไปขั้น "แนบหลักฐาน" ได้ตามเดิม แค่บันทึก log
- กด "ข้าม" = ไม่ยิงเส้นนี้

## ไม่เปลี่ยน
เช็คอิน, SOP, ลายเซ็น, งานต่างประเทศ, จุดส่ง, การส่ง processing/completed เดิม, ไม่เปิดเว็บจาก QR

## Technical details
- ไฟล์ใหม่ `supabase/functions/qtruck-queue-scan/index.ts`: รับ `{order_number, station_token}` → GET `${BASE}/queues/scan?external_ref=...&station_token=...&key=${QTRUCK_API_KEY}`; verifyAppSecret + writeAuditLog
- `src/lib/qtruckQueueStatus.ts`: เพิ่ม `notifyQtruckQueueScan(orderNumber, stationToken)` fire-and-forget (invoke qtruck-queue-scan)
- `DomesticJobDetail.tsx` `handleLoadingQrDone`: value ไม่ null → ดึง station_token (`new URL(value).searchParams.get('station_token')` ถ้า parse ได้ ไม่งั้นใช้ value) → เรียก notifyQtruckQueueScan(baseOrder, token) + console.log('[LoadingQR]', ...)
