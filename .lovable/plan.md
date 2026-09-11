# แผน: ดึงประเภทรายจ่ายจาก API แทน hardcode (มี fallback)

## เป้าหมาย
หน้า "เพิ่มค่าใช้จ่าย" (AddExpensePage) เปลี่ยนจากรายการประเภทรายจ่ายที่ hardcode ไว้ 19 รายการ ไปดึงจาก API `GET https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/finance-category-types` แทน โดยถ้า API ล้มเหลว/ว่าง จะ fallback กลับไปใช้รายการ hardcode เดิมอัตโนมัติ ผู้ใช้ไม่สะดุด

## โครงสร้างข้อมูล API (ยืนยันแล้ว)
- ตอบกลับ: `{ success, count, data: [...] }`
- แต่ละรายการ: `code`, `name_th`, `name_en`, `name_zh`, `name_ko`, `kind` ("expense"), `is_active`, `sort_order`
- มี 37 รายการ รวมประเภทใหม่ที่ hardcode ไม่มี เช่น `driver`, `subcontract`, `commission`

## สิ่งที่จะทำ

### 1. เพิ่มเส้น API ใน `src/lib/externalApi.ts`
- เพิ่ม mapping `'finance-category-types': 'EXPRESS_RENT_API_KEY'` ใน `ENDPOINT_API_KEY_MAP`
- เพิ่มฟังก์ชัน `getFinanceCategoryTypes()` เรียกผ่าน `callExternalApi` (แนบ `x-api-key` เหมือนเส้นอื่น)

หมายเหตุ: ตอนทดสอบด้วย key `EXPRESS_RENT_API_KEY` เดิม เส้นนี้ตอบ `invalid x-api-key` — ถ้าฝั่ง API ใช้ key เดียวกันจริงจะทำงานได้ทันที ถ้าไม่ได้ กลไก fallback จะดูแลให้หน้าเพจยังใช้งานได้ตามเดิม

### 2. สร้าง helper ใหม่ `src/lib/expenseCategoryTypes.ts`
- ดึง API ครั้งเดียวต่อ session (cache ใน memory) กรองเฉพาะ `kind === 'expense'` และ `is_active === true` เรียงตาม `sort_order`
- คืนรายการ `{ value: code, label: ชื่อตามภาษาปัจจุบัน, nameEn: name_en }`
- เลือก label ตามภาษาแอป: th → `name_th`, en → `name_en`, zh → `name_zh`, ko → `name_ko` (ว่าง → `name_en`)
- ถ้า API error / data ว่าง → คืน `null` เพื่อให้หน้าเพจใช้ hardcode เดิม

### 3. ปรับ `src/pages/AddExpensePage.tsx`
- โหลดประเภทจาก helper ตอนเปิดหน้า (useEffect + state)
- ระหว่างโหลดหรือโหลดไม่สำเร็จ → ใช้ `allExpenseTypes` hardcode เดิม (label จาก i18n เหมือนเดิม)
- ถ้าโหลดสำเร็จ → ใช้รายการจาก API แทน
- ตัวกรองตามประเภทงาน BL/Booking (`blAllowed` / `bookingAllowed`) ยังทำงานเหมือนเดิม โดยจับคู่กับ `code` จาก API — ถ้างาน BL/Booking จะแสดงเฉพาะ code ที่อยู่ใน whitelist เช่นเดิม
- กันรายการหาย: ถ้า code ที่อยู่ในเงื่อนไขเดิม (whitelist หรือ 19 รายการ hardcode) ไม่มีในข้อมูล API จะเติมรายการนั้นจาก hardcode เข้าไปแทน — ตัวเลือกที่เคยมีจะไม่หายไปแม้ฝั่ง API สะกด code ต่างหรือขาดบางรายการ
- ถ้าหลังกรองแล้วไม่เหลือรายการเลย → fallback ใช้ hardcode ทั้งชุด
- ตอนส่ง API: ชื่อภาษาอังกฤษ (`expense_type`) ใช้ `name_en` จาก API ถ้ามี ไม่อย่างนั้นใช้ `expenseTypeEnglishMap` hardcode เดิม

### 4. ไม่แตะต้อง
- โครงสร้าง body ที่ส่งไป `transport-expenses` เหมือนเดิมทุกประการ
- หน้าอื่นที่แสดงประเภทรายจ่าย (เช่น หน้าดูค่าใช้จ่าย) ไม่เปลี่ยนในรอบนี้

## การทดสอบ
- เปิดหน้าเพิ่มค่าใช้จ่าย: dropdown แสดงรายการจาก API (รวมรายการใหม่ เช่น ค่าคนขับ, ค่าจ้างช่วง, ค่าคอมมิชชั่น)
- สลับภาษา th/en/zh/ko: label เปลี่ยนตามภาษา
- งาน BL/Booking: dropdown ยังถูกกรองตามเดิม
- จำลอง API ล้มเหลว (offline/invalid key): dropdown กลับไปใช้ 19 รายการเดิม
- บันทึกค่าใช้จ่ายจริง: `expense_type` ที่ส่งเป็นชื่อภาษาอังกฤษถูกต้อง
