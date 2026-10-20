## เปลี่ยนปุ่มปิดหน้าต่าง "แจ้งปัญหา" ให้เหมือนปุ่มปิดหน้าต่างค่าใช้จ่าย

แก้ไขแค่หน้าตา (UI) ขั้นตอนอื่นเหมือนเดิม

- ปุ่ม "×" ตัวหนังสือสีเทา เปลี่ยนเป็นปุ่มกลมขนาดเดียวกับปุ่มปิดค่าใช้จ่าย มีไอคอน X พื้นหลังสีอ่อนและเงา
- ตำแหน่งยังอยู่มุมขวาบนเหมือนเดิม และยังกดไม่ได้ระหว่างกำลังส่งเรื่อง

### Technical
`src/components/job/ReportProblemDrawer.tsx` line 242: replace text `×` with `<X className="h-5 w-5" />` (lucide) and className `flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow`, keep `disabled={isSubmitting}`.
