# สร้างไฟล์ Postman Collection สำหรับทดสอบ talad-push-chat

## เป้าหมาย
สร้างไฟล์ JSON รูปแบบ Postman Collection จากเอกสาร `talad-trucker-push-chat-api_1.md` เพื่อให้ผู้ใช้นำไป import ลง Postman ทดสอบ API ได้ทันที

## สิ่งที่จะทำ
1. แปลงเอกสาร API เป็น Postman Collection JSON (v2.1)
2. รวม request ตัวอย่างครบทั้งโหมด:
   - Pull messages ด้วย `POST` (job_id + dry_run)
   - Pull messages ด้วย `GET` (query string)
   - Push webhook ตัวอย่าง (POST body แบบที่ Talad ส่ง)
3. ใส่ headers `x-api-key` และ `Content-Type` ไว้ให้พร้อม
4. บันทึกไฟล์ที่ `/mnt/documents/talad-push-chat.postman_collection.json`
5. แนบไฟล์ให้ผู้ใช้ดาวน์โหลดผ่าน chat

## ข้อมูลที่ใช้
- Endpoint: `https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-chat`
- Method: GET และ POST
- Header `x-api-key`: `ttpc_7PrdspFcjNhBfltOUM5Na6YhEJq2Nz6HEhVvkFLy`
- Body/Query ตัวอย่าง: `job_id`, `limit`, `dry_run`, `message_id`, `since`, `page`, `event`
- Payload ตัวอย่างของ push webhook ตามเอกสาร

## ไฟล์ที่จะสร้าง
- `/mnt/documents/talad-push-chat.postman_collection.json`
