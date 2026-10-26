# แก้ค่า cod_method ที่ส่งตอนเช็คอินรับเงิน

## สาเหตุ
แอปส่ง `cod_method` เป็นชื่อภายในแอป แต่ระบบหลักรับแค่ `cash`, `qr_coke`, `qr_mint`

| วิธีที่เลือก | แอปส่งตอนนี้ | ระบบหลักต้องการ |
|---|---|---|
| เงินสด | cash | cash |
| QR โค้ก | static_qr | qr_coke |
| QR Mint | mint_qr | qr_mint |

## แก้ไข
- แปลงค่าก่อนส่ง: เงินสด -> `cash`, QR โค้ก -> `qr_coke`, QR Mint -> `qr_mint`
- ถ้าส่งไม่สำเร็จ ให้ขึ้นข้อความแจ้งเหตุผลแทนจอขาว ข้อมูลที่กรอกยังอยู่
- ไม่เปลี่ยนส่วนอื่นของการเช็คอิน

## Technical details
- `DeliveryDetailPage.tsx`: map `codState.method` -> API value before `driverCheckin`; update `cod_method` type in `src/lib/externalApi.ts` to `'cash' | 'qr_coke' | 'qr_mint'`.
- Make sure the payment check-in error is caught and shown as a toast (no unhandled rejection / blank screen).
- Add a small unit test for the mapping.
