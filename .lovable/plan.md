# ไม่เด้งป๊อปอัปสำหรับสถานะ processing / completed

## เป้าหมาย
แจ้งเตือนคิวสถานะ "กำลังขึ้น/ลงสินค้า" (processing) และ "คิวเสร็จสิ้น" (completed) ไม่ต้องเด้งป๊อปอัปกลางหน้าจอในแอป แต่ยังคง:
- แจ้งเตือนบนมือถือ (push) ตามเดิม
- แสดงในรายการแจ้งเตือน (หน้า Notifications) ตามเดิม

สถานะอื่น (ใกล้ถึงคิว, ถึงคิวแล้ว, คิวถูกย้าย, คิวถูกยกเลิก) ยังเด้งป๊อปอัปเหมือนเดิม

## การแก้ไข (frontend ไฟล์เดียว)

**`src/components/job/QueueAlertPopup.tsx`**
- ในฟังก์ชัน `check()` เพิ่มเงื่อนไขข้ามการแสดงป๊อปอัป: ถ้า `reference_type === 'queue.status_changed'` และหัวข้อเป็น "กำลังขึ้น/ลงสินค้า" หรือ "คิวเสร็จสิ้น" → ทำเครื่องหมายว่าเห็นแล้ว (markSeen) แต่ **ไม่** setAlert (ไม่เด้งป๊อปอัป)
- ใช้ชุดหัวข้อคงที่เทียบทั้งภาษาไทยและอังกฤษ (`กำลังขึ้น/ลงสินค้า`, `คิวเสร็จสิ้น`, `Loading/unloading in progress`, `Queue completed`) เพื่อไม่ให้พึ่งภาษาที่ผู้ใช้เลือก

## ไม่แตะต้อง
- `qtruck-webhook` edge function — ยังสร้าง notification + push เหมือนเดิมทุกสถานะ
- หน้ารายการแจ้งเตือน, push notification, audit log
- flow การส่งสถานะกลับ QTruck (update-qtruck-queue-status)

## ทดสอบ
- build ผ่าน
- เมื่อ QTruck ส่ง processing/completed: ไม่มีป๊อปอัป แต่มีแจ้งเตือนในรายการ + push บนมือถือ
- เมื่อ QTruck ส่ง called/upcoming/moved/cancelled: ป๊อปอัปยังเด้งปกติ
