/**
 * Accept attribute มาตรฐานสำหรับ input[type=file] ทั่วทั้งแอป
 * รองรับ: image (jpg/png/webp/heic/gif/bmp), PDF, Microsoft Office (Word/Excel/PowerPoint)
 */
export const ACCEPT_IMAGE_DOC =
  'image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

/**
 * ชนิดไฟล์ที่ API driver-documents รองรับเท่านั้น: รูป JPG/PNG/WEBP/HEIC หรือ PDF
 * ไม่ใช้ image/* เพราะจะปล่อย GIF/BMP และรูปชนิดอื่นที่ API ไม่รับผ่านเข้ามา
 */
export const ACCEPT_DOC_ALLOWED =
  'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,.pdf';
