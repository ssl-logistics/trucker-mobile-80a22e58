# แก้ Header ยังถูกดึงลงบน iOS

## สาเหตุที่ยืนยันจากโค้ด

- หน้า Home รวม Header และช่องค้นหาไว้ใน `.app-sticky-wrapper` ถูกต้องแล้ว
- ตัวเลื่อนหลักของแอปคือ `#root` ซึ่งยังใช้ `-webkit-overflow-scrolling: touch`
- บน iOS/WKWebView การเลื่อนแบบ touch ยังทำให้ scroll container เกิด rubber-band ได้ แม้ตั้ง `overscroll-behavior: none`; Header แบบ `sticky` จึงถูกลากลงพร้อม scroll layer

## สิ่งที่จะทำ

1. ปิด native momentum/rubber-band ของ `#root` โดยเปลี่ยน `-webkit-overflow-scrolling` จาก `touch` เป็น `auto` และคง `overscroll-behavior: none`
2. เพิ่มตัวกัน pull-down เฉพาะกรณีที่ `#root.scrollTop === 0`:
   - จับตำแหน่งเริ่มต้นของ touch
   - ป้องกันเฉพาะ gesture ที่ลากลงจากขอบบน
   - ไม่ขัดขวางการเลื่อนขึ้นลงปกติเมื่อมีเนื้อหา และไม่กระทบ input/modal
3. ใช้ตัวป้องกันนี้ระดับแอปครั้งเดียว เพื่อครอบคลุมทุกหน้า ไม่ใส่ logic ซ้ำในแต่ละหน้า
4. คง Header หน้า Home เป็นก้อนเดียวกับช่องค้นหา และคงคลาส header ของหน้าอื่นไว้
5. ตรวจบน viewport มือถือโดยเลื่อนหน้า Home และหน้ารายการอื่น ทั้งที่ด้านบนสุดและกลางหน้า เพื่อยืนยันว่า Header ไม่ถูกลากลงและเนื้อหายังเลื่อนได้ปกติ

## ไฟล์ที่เกี่ยวข้อง

- `src/index.css`
- `src/App.tsx` หรือ component เล็กสำหรับป้องกัน pull-down ระดับแอป

## ขอบเขต

- แก้เฉพาะพฤติกรรม scroll/pull-down
- ไม่เปลี่ยนหน้าตา ตำแหน่งปกติ หรือ logic ข้อมูล