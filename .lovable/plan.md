# แผน: การ์ดแนะนำเมนูทั้งหมดแสดงทุกครั้งบน preview

## การ์ดแนะนำที่มีในแอป (6 จุด)
| เมนู | ไฟล์ | key ที่จำ |
|---|---|---|
| แจ้งซ่อม (หน้าตั้งค่า) | SettingsPage.tsx | `repair_menu_intro_ack:<userId>` |
| เอกสาร (หน้ารายละเอียดงาน) | JobActionButtons.tsx | `documents_menu_intro_ack:<userId>` |
| ดูคิว (หน้างานปัจจุบัน) | CurrentJobsPage.tsx | `queue_button_intro_ack:<userId>` |
| สำรองจ่าย (หน้าเพิ่มค่าใช้จ่าย) | AddExpensePage.tsx | `advance_payment_intro_ack:<userId>` |
| เลขไมล์/น้ำมัน (หน้าเพิ่มค่าใช้จ่าย) | AddExpensePage.tsx | `fuel_details_intro_ack:<userId>` |
| ลายเซ็น (หน้าต่างเซ็นชื่อ) | SignatureDialog.tsx | `signature_intro_ack:<userId>` |

## พฤติกรรมปัจจุบัน
- ทุกจุดเช็ค preview ด้วย `hostname.includes('id-preview--')` เท่านั้น — ลิงก์ Lovable แบบอื่น (เผยแพร่/แชร์) ถูกมองเป็น production จึงจำการกดรับทราบและไม่แสดงอีก
- ปุ่มดูคิวแก้ไปแล้วรอบก่อน เหลืออีก 5 จุด
- production: จำต่อบัญชีในเครื่อง (localStorage) — กดรับทราบแล้ว login ใหม่ก็ไม่ขึ้นอีก; ยังไม่กดจะขึ้นทุกครั้งที่เปิดหน้านั้น

## สิ่งที่จะแก้
1. สร้างตัวช่วยกลาง `isPreviewHost()` ใน `src/utils/previewHost.ts` ครอบคลุม: `id-preview--`, ลงท้าย `.lovable.app`, `localhost`
2. เปลี่ยนทั้ง 6 จุด (รวมคิวที่แก้แล้วให้ใช้ตัวกลาง) มาใช้ตัวช่วยเดียวกัน
3. โดเมนจริง (`mobile.thetroob.com`, `mobile.the-trucker.com`) ยังเป็น production — แสดงครั้งเดียวต่อบัญชีจนกว่าจะกดรับทราบ

## ขอบเขต
- แก้เฉพาะเงื่อนไขตรวจ preview ไม่แตะรูปแบบการ์ด ข้อความ หรือตรรกะการจำต่อบัญชี
