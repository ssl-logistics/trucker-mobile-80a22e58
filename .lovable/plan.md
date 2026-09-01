# Plan: ทดสอบการเชื่อมต่อแชท Talad (เฟสทดสอบก่อน)

## เป้าหมาย
สร้างเฉพาะเครื่องมือทดสอบก่อน เพื่อพิสูจน์ว่าเส้น `talad-push-chat` ใช้งานได้จริง ยังไม่แตะโครงสร้างแชทในแอปหรือบันทึกข้อมูลลงฐานข้อมูล

## สิ่งที่จะสร้าง

### 1. Edge Function `test-talad-chat`
Function เดียวสำหรับยิงทดสอบ ไม่เขียนข้อมูลลง DB

รับ POST body (ทุกฟิลด์ optional):
- `job_id` — ค่าเริ่มต้นใช้ job ตัวอย่างจาก Postman collection
- `message_id` — ถ้าใส่ จะดึงข้อความเดียว
- `limit`, `page` — ค่าเริ่มต้น 50 / 1
- `dry_run` — ค่าเริ่มต้น `true`
- `mode` — `"pull"` | `"push"` | `"both"` (ค่าเริ่มต้น `"both"`)

การทำงาน:
- **Pull**: ยิง POST ไปยัง `https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-chat` พร้อม header `x-api-key` ที่อ่านจาก secret `TALAD_API_KEY` (ไม่ hardcode)
- **Push**: ยิง payload ตัวอย่างรูปแบบ webhook (`source`, `event`, `messages[]`) กลับไปที่เส้นเดียวกันด้วย `dry_run: true` เพื่อดูว่า Talad ตอบรับโครงสร้างถูกต้องหรือไม่

ตอบกลับผลสรุปที่อ่านง่าย:
```json
{
  "ok": true,
  "api_key_configured": true,
  "pull": { "status": 200, "ok": true, "count": 3, "sample": { }, "raw_snippet": "..." },
  "push": { "status": 200, "ok": true, "response": { } },
  "errors": []
}
```

พร้อม `console.log` ทุกขั้นตอน (สถานะ, จำนวนข้อความ, error body) เพื่อดูใน logs ได้

### 2. Deno test `index.test.ts`
ทดสอบเบื้องต้นว่า function ตอบ 200, มีฟิลด์ `pull`/`push` ครบ, และไม่ล้มเมื่อ upstream error

## สิ่งที่ยังไม่ทำในเฟสนี้
- ไม่บันทึกข้อความลง `conversations` / `external_chat_messages`
- ไม่ส่ง push notification
- ไม่แก้ UI แชทหรือหน้าตลาด

เมื่อยืนยันว่าเส้นใช้งานได้แล้ว ค่อยต่อเฟสถัดไป (รับข้อความเข้าแอปจริงและตอบกลับสองทาง)

## รายละเอียดเทคนิค
- ไฟล์ใหม่: `supabase/functions/test-talad-chat/index.ts`, `supabase/functions/test-talad-chat/index.test.ts`
- Secret ที่ใช้: `TALAD_API_KEY` (มีอยู่แล้วในโปรเจกต์)
- CORS: รองรับ `authorization, x-client-info, apikey, content-type, x-api-key`
- ทดสอบได้ทั้งผ่านเครื่องมือ curl edge function และ Postman collection เดิม
