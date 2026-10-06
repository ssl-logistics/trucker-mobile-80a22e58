# แผน: ซ่อนค่า "NULL" ในชื่อจุดรับ/จุดส่ง หน้าต่างรายละเอียดงานหน้าแรก

## ปัญหาตอนนี้

- หน้าต่างรายละเอียดงานที่เปิดจากการ์ดงานหน้าแรก (`src/components/home/JobCard.tsx` บรรทัด ~394 และ ~361) แสดงชื่อจุดรับ/จุดส่งตรง ๆ จาก `dest.company_name` / `origin.company_name`
- หน้าแรก (`src/pages/Home.tsx` บรรทัด ~471 และ ~734) ส่งค่า `destinations[].company_name` จาก API แบบดิบ (`d.company_name || ''`) ไม่ผ่านตัวกรอง
- เมื่อทีม TMS ส่งค่าข้อความ "NULL" มา หน้าจอเลยแสดงคำว่า "NULL" ตรง ๆ

## สิ่งที่จะทำ

ใช้ตัวกรอง `isValidName` ที่มีอยู่แล้วใน Home.tsx (กรอง "-", "ไม่ระบุ", "n/a", "null", "undefined", ตัวเลขล้วน ฯลฯ) กับข้อมูลจุดรับ/จุดส่งก่อนส่งเข้าการ์ด:

- `src/pages/Home.tsx` — ใน map ของ `loadFactoryJobs` (~471) และ `loadJobs` (~734) เปลี่ยนเป็น:
  - `company_name: isValidName(d.company_name) || ''`
  - `contact_name: isValidName(d.contact_name || d.contact_person) || ''`
  - (จุดรับเป็น string เดียวผ่าน `resolveJobLocations` แล้ว — ตรวจและกรองด้วย `isValidName` เช่นกันถ้าพบค่า "NULL" ได้)
- `src/components/home/JobCard.tsx` — เพิ่ม 'null' (รวมทุกตัวพิมพ์) เป็นค่า generic ที่ข้ามในตรรกะ fallback ชื่อจุดส่งบนการ์ด (~230) และหน้าต่างรายละเอียด (~361, ~394, ~409) กันค่าที่หลุดมาแสดง
- เมื่อ company_name/contact_name ไม่มีค่าที่ใช้ได้ จะเลื่อนไปแสดง province/location ตามลำดับเดิมอัตโนมัติ ไม่แสดง "NULL" อีก

## ไม่แตะ

- ช่องอื่นในหน้าต่างรายละเอียด (เลขออเดอร์, ราคา, วันเวลา, ประเภทรถ, ข้อมูลสินค้า)
- การทำงานของปุ่มรับงาน/ยกเลิก, flow การรับงาน
- หน้าอื่น (Market, CurrentJobsPage ฯลฯ) — เฉพาะข้อมูลที่หน้าแรก map และการ์ดที่หน้าแรก/หน้าตลาดใช้
