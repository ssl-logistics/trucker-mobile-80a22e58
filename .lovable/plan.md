# ตรวจสอบ/รองรับภาษาสำหรับ label สำรองจ่าย

## สถานะปัจจุบัน
Label "สำรองจ่าย" ในหน้า `AddExpensePage` เรียกใช้ `t('expense.advancePayment')` ผ่าน `useLanguage` ซึ่งเป็นระบบ i18n อยู่แล้ว

## เป้าหมาย
ยืนยันว่า label เปลี่ยนตามภาษาของแอปได้ทุกภาษา และไม่มี hardcode ทับค่าแปล

## ขั้นตอนการทำงาน
1. ตรวจสอบ `src/contexts/LanguageContext.tsx` ว่ามี key `expense.advancePayment` ในทุกภาษาที่รองรับ (th, en, ko, zh)
2. ตรวจสอบ `src/pages/AddExpensePage.tsx` ว่า label สำรองจ่ายใช้ `t('expense.advancePayment')` โดยตรง ไม่มี fallback ข้อความภาษาไทย hardcode
3. ตรวจสอบว่า `useLanguage` context อัปเดตและทำให้คอมโพเนนต์ re-render เมื่อภาษาเปลี่ยน
4. หากพบข้อความ hardcode หรือ fallback ที่ขัดขวางการแปล ให้แก้ไขให้ใช้ key แปลแทน

## ผลลัพธ์ที่คาดหวัง
- Label สำรองจ่ายแสดงตามภาษาที่ผู้ใช้เลือกในแอป
- ไม่มี hardcode ภาษาไทยหรือภาษาอื่นที่ทับการแปล
