# COD: แก้ค่าที่ส่งเข้าระบบ + แสดงสรุปเก็บเงินหลังส่งเสร็จ

## 1. แก้ค่า cod_method ที่ส่งตอนเช็คอินรับเงิน (สาเหตุของ error 400)
แอปส่งชื่อภายในแอป แต่ระบบหลักรับแค่ `cash`, `qr_coke`, `qr_mint`

| วิธีที่เลือก | แอปส่งตอนนี้ | ระบบหลักต้องการ |
|---|---|---|
| เงินสด | cash | cash |
| QR โค้ก | static_qr | qr_coke |
| QR Mint | mint_qr | qr_mint |

- แปลงค่าก่อนส่ง และถ้าส่งไม่สำเร็จ ให้ขึ้นข้อความเหตุผลแทนจอขาว ข้อมูลที่กรอกยังอยู่

## 2. แสดงกล่อง "สรุปเก็บเงินปลายทาง (COD)" ในหน้าจุดส่งที่ทำเสร็จแล้ว
แสดงใต้ส่วน "POD สำเร็จ" เฉพาะจุดที่มี COD:
- ยอดที่ต้องเก็บ: ฿xxx และวิธีที่งานกำหนด (เงินสด / QR)
- จ่ายจริง: ฿xxx ผ่าน เงินสด / QR Mint / QR โค้ก พร้อมเวลาที่รับเงิน
- รูปหลักฐานการรับเงิน (กดดูขยายได้) ถ้ามี
- 4 ภาษา

## Technical details
- `DeliveryDetailPage.tsx`: map `codState.method` -> `cash|qr_coke|qr_mint` before `driverCheckin`; update `cod_method` type in `src/lib/externalApi.ts`; catch payment check-in failure and show toast.
- Summary data: read the `checkin_type: 'payment'` record from the driver's check-ins (`payment_amount`, `cod_method`, `cod_proof_urls`, created time); fall back to the locally saved COD state (method, urls) when the record lacks those fields. Accept both old and new method values when displaying.
- Proof photos via existing `usePresignedImageUrl`.
- Unit test for the method mapping.
