
## ปัญหา

จาก console log ล่าสุด (กดรับงาน OR20260713426):

- `[JobCard] accept clicked` ✅ ทำงาน
- `[audit] fire job-card:accept-click` ✅ ยิง fetch
- `[audit] fire accept-job:pressed` ✅ ยิง fetch
- `[audit] fire update-order-status:about-to-call` ✅ ยิง fetch
- `[audit] fire create-tracking-room:attempt` ✅ ยิง fetch

**แต่ทุก fetch โดน browser block ก่อนออกจากเครื่อง** เพราะ CORS preflight fail:

```
Request header field x-app-secret is not allowed by
Access-Control-Allow-Headers in preflight response
```

Client ส่ง `x-app-secret` header เพื่อ auth แต่ 2 edge function ที่เกี่ยวข้อง (`log-client-event`, `create-tracking-room`) ยังไม่ได้ประกาศรับ header นี้ใน CORS preflight → browser ปฏิเสธไม่ให้ POST เลย → ไม่มี row ใน `edge_function_audit_logs` และห้อง tracking ไม่ถูกสร้าง

รอบก่อนแก้เฉพาะ `update-truck-position` กับ `check-new-jobs` — ตกหล่น 2 ตัวนี้ไป

## วิธีแก้

เพิ่ม `x-app-secret` ลงใน `Access-Control-Allow-Headers` ของ:

1. **`supabase/functions/log-client-event/index.ts`** (บรรทัด 8-9)
2. **`supabase/functions/create-tracking-room/index.ts`** (แก้ที่บล็อก corsHeaders)

เปลี่ยนจาก:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

เป็น:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret'
```

## หลัง deploy

- กดรับงานใหม่ → ต้องเห็น `[audit] response 200` (ไม่ใช่ `fetch error`)
- ตาราง `edge_function_audit_logs` จะมี rows: `client:job-card:accept-click`, `client:accept-job:pressed`, `client:update-order-status:about-to-call`, `client:create-tracking-room:attempt`, และ `create-tracking-room` (ห้อง tracking ถูกสร้างจริง)

## หมายเหตุ

ควรเช็ค edge function อื่นที่ client เรียกด้วย `x-app-secret` ทั้งหมดในโปรเจกต์ เพื่อไม่ให้ตกหล่นแบบเดิมอีก (แต่จะทำในรอบนี้เฉพาะ 2 ตัวที่ block flow "กดรับงาน" ก่อน)
