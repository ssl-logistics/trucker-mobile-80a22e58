# หน้าต่างหลักฐาน: แสดง "ยังไม่ได้ชำระ"

- จุดที่ยังไม่เก็บเงิน: หน้าต่างหลักฐานแสดง "ยังไม่ได้ชำระ" แทน "ไม่ได้แนบหลักฐาน"
- จุดที่เก็บแล้วแต่ไม่มีรูป: ยังแสดง "ไม่ได้แนบหลักฐาน" เหมือนเดิม
- รองรับ 4 ภาษา; แก้แค่หน้าตา

## Technical
`CodClearPage.tsx`: pass `collected: p.collected` into `setProofView`; empty state shows `S.notPaid` when `!proofView.collected`; add `notPaid` to `SUM_TXT` (th ยังไม่ได้ชำระ, en Not paid yet, zh 尚未付款, ko 아직 미결제).
