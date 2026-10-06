# แผน: แก้ชื่อจุดรับ/จุดส่งบนการ์ดหน้าแรก — กรอง "NULL" และอ่าน company_name ที่ซ้อนอยู่

## ปัญหาตอนนี้ (ยืนยันจากข้อมูล API จริง)

1. **แสดงคำว่า "NULL"** — TMS ส่งข้อความ "NULL" มาจริงใน `destinations[].company_name` (เช่น OR20260820183, OR20260820184 ทุกจุดส่ง) หน้าแรกส่งค่านี้เข้าการ์ดแบบดิบ (`d.company_name || ''`) ไม่ผ่านตัวกรอง `isValidName` เลยโชว์ "NULL" ตรง ๆ
2. **company_name ที่ส่งมาไม่แสดง** — งานจุดส่งเดียว API ส่ง `destination: { name: "-", company_name: "ศูนย์กระจายสินค้าซีเจบุรีรัมย์" }` แต่การ์ดดึงแค่ `destination.name` (ผ่าน `resolveJobLocations`) ไม่เคยอ่าน `destination.company_name` ที่ซ้อนอยู่ เลยแสดง "-"

## สิ่งที่จะทำ

1. `src/lib/jobLocation.ts` (`resolveJobLocations` — ตัวกลางที่หน้าแรกและหน้างานปัจจุบันใช้ร่วมกัน):
   - ในประเทศ: ถ้า `destination.name` เป็น "-"/ว่าง/"NULL" → ใช้ `destination.company_name` แทน (เช่น "ศูนย์กระจายสินค้าซีเจบุรีรัมย์"); จุดรับทำแบบเดียวกัน (`origin.name` → `origin.company_name`)
   - กรองค่า "NULL"/"null"/"-"/ว่าง ออกก่อนตัดสิน (ใช้เกณฑ์เดียวกับ `isValidName`)
   - ผลลัพธ์: หน้าแรกและหน้างานปัจจุบันจะแสดงชื่อเดียวกันเสมอ (ยังคงแหล่งความจริงเดียว)
2. `src/pages/Home.tsx` — map `destinations[]` ทั้ง 2 จุด (loadFactoryJobs ~471, loadJobs ~734): ส่ง `company_name`/`contact_name` ผ่าน `isValidName` ก่อน (`isValidName(d.company_name) || ''`) ค่า "NULL" จะกลายเป็นว่าง
3. `src/components/home/JobCard.tsx` — เพิ่ม 'null' (ทุกตัวพิมพ์) เข้า list คำ generic ที่ข้าม ในตรรกะ fallback ชื่อจุดส่ง (~230) และหน้าต่างรายละเอียด (~361, ~394, ~409) กันค่าหลุดจากแหล่งอื่น
4. เมื่อ company_name ไม่มีค่าใช้ได้ → เลื่อนไปแสดง contact_name → province → location ตามลำดับเดิม ไม่แสดง "NULL" อีก

## ไม่แตะ

- ช่องอื่นในหน้าต่างรายละเอียด (เลขออเดอร์, ราคา, วันเวลา, ประเภทรถ, ข้อมูลสินค้า)
- flow การรับงาน/ปุ่มต่าง ๆ, การกรองงาน, สถานะ
- งานต่างประเทศ (ใช้ return_terminal ตามเดิม)

## หมายเหตุ

- ข้อ 1 ทำให้หน้างานปัจจุบันได้ประโยชน์ด้วย (แสดง company_name แทน "-" เหมือนกัน) เพราะใช้ helper ตัวเดียวกัน
- ถ้าต้องการให้ TMS แก้ที่ต้นทาง (ส่ง null จริงแทนข้อความ "NULL") แจ้งทีม TMS ได้ แต่ฝั่งแอปจะกันไว้แล้ว
