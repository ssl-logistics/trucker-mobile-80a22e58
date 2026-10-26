# แก้กล่องเก็บเงินปลายทาง (COD) รีเซ็ตเมื่อปิดแล้วเปิดหน้าต่างใหม่

## สาเหตุ
กล่อง COD จำวิธีรับเงิน, QR และรูปที่แนบไว้ในเครื่องอยู่แล้ว แต่ตอนเปิดหน้าต่างใหม่ ข้อมูลจุดส่งยังโหลดไม่ครบ กล่องเลยไปอ่านข้อมูลผิดช่อง (เจอแต่ช่องว่าง) พอข้อมูลจุดส่งโหลดเสร็จ กล่องก็เอาค่าว่างไปเขียนทับข้อมูลที่เคยบันทึกไว้ จึงดูเหมือนถูกรีเซ็ต

## แก้ไข
- ใช้เลขจุดส่งจากลิงก์ของหน้า (เช่น /delivery/1) เป็นตัวระบุช่องที่บันทึก ให้ตรงกันตั้งแต่ตอนเปิดหน้า
- ถ้าตัวระบุเปลี่ยน ให้โหลดข้อมูลที่บันทึกไว้ของช่องใหม่ก่อน และห้ามเขียนค่าว่างทับ
- ผลที่ได้: ปิดหน้าต่างแล้วเปิดใหม่ วิธีรับเงินที่เลือก, รูปที่แนบ และ QR Mint (ถ้ายังไม่หมดอายุ) จะยังอยู่เหมือนเดิม
- ไม่เปลี่ยนขั้นตอนเช็คอิน/POD หรือข้อมูลที่ส่งเข้าระบบ

## Technical details
- `DeliveryDetailPage.tsx`: build COD `storageKey` from the route's delivery index param (fallback to current logic) so it is stable on first render.
- `CodCollectSection.tsx`: track the key in a ref; when `storageKey` changes, re-read localStorage into state and skip the persist effect for that render so it never overwrites saved data with the empty initial state.
