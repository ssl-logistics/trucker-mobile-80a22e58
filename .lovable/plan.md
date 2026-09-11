# เพิ่ม Checkbox "สำรองจ่าย" ในหน้าเพิ่มค่าใช้จ่าย

## พฤติกรรม
- แต่ละรายการค่าใช้จ่ายมี checkbox "สำรองจ่าย" ใต้ช่องราคา
- ไม่ติ๊ก (ปกติ): ส่ง `"amount": 100.5` เหมือนเดิม
- ติ๊ก: ส่ง `"advance_amount": 100.5` **แทน** `amount` (ไม่ส่ง amount)

## การแก้ไข

**`src/lib/externalApi.ts`**
- `addExpense()` เพิ่ม optional field `advance_amount?: number` ใน params และใส่ลง body เมื่อมีค่า

**`src/pages/AddExpensePage.tsx`**
- state รายการ expense เพิ่ม `isAdvance: boolean` (default `false`)
- UI: เพิ่ม Checkbox + label `t('expense.advancePayment')` ใต้ช่องราคาของแต่ละรายการ
- payload ตอนส่ง: ถ้า `isAdvance` ส่ง `advance_amount: parseFloat(expense.amount)` แทน `amount`; ถ้าไม่ติ๊กส่ง `amount` ตามเดิม
- reset form หลังบันทึกให้ `isAdvance: false`

**`src/contexts/LanguageContext.tsx`**
- เพิ่ม key `expense.advancePayment` 4 ภาษา: ไทย "สำรองจ่าย", EN "Advance payment", 中文 "垫付", 한국어 "선급금"

## ไม่เปลี่ยนแปลง
- รูปแบบอื่นของ body (expense_type, receipt, ocr_data, notes) เหมือนเดิม
- หน้าแสดง/แก้ไขค่าใช้จ่ายอื่นไม่แตะ

## ทดสอบ
- build ผ่าน, ตรวจ payload ทั้งสองกรณี (ติ๊ก/ไม่ติ๊ก)
