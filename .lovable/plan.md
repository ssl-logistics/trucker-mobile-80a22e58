# แผน: การ์ดแนะนำเมนูคิวแสดงทุกครั้งในหน้า preview

## สาเหตุ (ตรวจจากโค้ดแล้ว)
`src/pages/CurrentJobsPage.tsx` บรรทัด 194 ตรวจ preview ด้วยเงื่อนไขเดียว:

```text
window.location.hostname.includes('id-preview--')
```

- เปิดผ่านลิงก์ preview ของ Lovable (`id-preview--...lovable.app`) → แสดงทุกครั้ง ถูกต้อง
- แต่ถ้าเปิดผ่านลิงก์ที่เผยแพร่แล้ว (`thetrucker-mobile.lovable.app`) หรือโดเมนจริง (`mobile.thetroob.com`, `mobile.the-trucker.com`) → ระบบถือว่าเป็น production จำการกด "รับทราบ" ไว้ในเครื่อง การ์ดจึงไม่ขึ้นอีก

## สิ่งที่จะแก้
1. ขยายเงื่อนไขการตรวจ preview ให้ครอบคลุม:
   - hostname มี `id-preview--` (เดิม)
   - hostname ลงท้ายด้วย `.lovable.app` (ลิงก์ที่เผยแพร่ของ Lovable)
   - `localhost` (ตอนพัฒนา)
2. โดเมนจริง (`mobile.thetroob.com`, `mobile.the-trucker.com`) ยังคงเป็น production — แสดงครั้งเดียวต่อบัญชีตามเดิม
3. บน preview: กด "รับทราบ" แล้วการ์ดหายเฉพาะรอบนั้น เปิดหน้าใหม่จะขึ้นอีก (ไม่เขียนจำถาวร)

## ขอบเขต
- แก้เฉพาะเงื่อนไขตรวจ preview ใน `CurrentJobsPage.tsx` จุดเดียว
- ไม่แตะรูปแบบการ์ด ตำแหน่ง ข้อความ หรือการ์ดแนะนำเมนูอื่น (เอกสาร/ซ่อม/สำรองจ่าย/น้ำมัน/ลายเซ็น) — ถ้าต้องการให้เมนูอื่นใช้เงื่อนไขเดียวกันนี้ แจ้งได้
