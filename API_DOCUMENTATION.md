# API Documentation - Job Management System

## Overview
ระบบรับข้อมูลงานผ่าน API สำหรับการจัดการงานขนส่ง แบ่งเป็น 2 ประเภทตามกลุ่มผู้ใช้งาน

---

## 🚀 API Endpoints

### 1. Freelance Jobs API
**สำหรับ: งานฝ่าง Freelance**

**Endpoint:**
```
POST https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/receive
```

**Headers:**
```
Content-Type: application/json
```

---

### 2. Company & Factory Jobs API
**สำหรับ: งานฝ่าง Company และ Factory**

**Endpoint:**
```
POST https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/receive-company-factory
```

**Headers:**
```
Content-Type: application/json
```

---

## 📋 Request Body Structure

### ✅ Required Fields (ฟิลด์ที่จำเป็น)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `order_code` | string | รหัสงาน (ต้องไม่ซ้ำ) | "ORD-2024-001" |
| `employer_name` | string | ชื่อนายจ้าง/บริษัท | "บริษัท ABC จำกัด" |
| `job_type` | string | ประเภทงาน | "urgent", "daily", "contract" |
| `transport_type` | string | ประเภทการขนส่ง | "single", "multi", "import", "export" |
| `origin_location` | string | จุดรับสินค้า | "โรงงานกรุงเทพ" |
| `destination_location` | string | จุดส่งสินค้า | "คลังสินค้าชลบุรี" |
| `price` | number | ราคางาน (บาท) | 15000 |
| `start_date` | string | วันที่เริ่มงาน (YYYY-MM-DD) | "2024-02-01" |
| `start_time` | string | เวลาเริ่มงาน (HH:MM:SS) | "08:00:00" |

### 🔹 Optional Fields (ฟิลด์เสริม)

| Field | Type | Description | Example | Note |
|-------|------|-------------|---------|------|
| `assigned_role` | string | ฝ่ายที่รับผิดชอบ | "freelance", "company", "factory" | ใช้เฉพาะ company-factory API |
| `equipment_list` | string | รายการอุปกรณ์ | "รถกระบะ 6 ล้อ" | |
| `safety_equipment` | string | อุปกรณ์ความปลอดภัย | "เสื้อสะท้อนแสง, รองเท้าเซฟตี้" | |
| `province` | string | จังหวัด | "กรุงเทพมหานคร" | |
| `district` | string | เขต/อำเภอ | "บางกะปิ" | |
| `status` | string | สถานะงาน | "available" | Default: "available" |
| `origin_latitude` | number | ละติจูดจุดรับ | 13.7563 | |
| `origin_longitude` | number | ลองจิจูดจุดรับ | 100.5018 | |
| `destination_latitude` | number | ละติจูดจุดส่ง | 13.2345 | |
| `destination_longitude` | number | ลองจิจูดจุดส่ง | 100.9876 | |
| `container_checkpoint` | string | จุดตรวจตู้คอนเทนเนอร์ | "ด่านศุลกากรแหลมฉบัง" | สำหรับงานนำเข้า-ส่งออก |
| `container_checkpoint_code` | string | รหัสด่านศุลกากร | "THLCH" | |
| `container_checkpoint_latitude` | number | ละติจูดด่านศุลกากร | 13.0827 | |
| `container_checkpoint_longitude` | number | ลองจิจูดด่านศุลกากร | 100.9200 | |
| `container_number` | string | เลขตู้คอนเทนเนอร์ | "TCNU1234567" | |
| `seal_number` | string | เลขซีล | "SEAL-001" | |
| `empty_container_date` | string | วันที่รับตู้เปล่า (YYYY-MM-DD) | "2024-01-30" | |
| `destination_time` | string | เวลาถึงจุดหมาย (HH:MM:SS) | "16:00:00" | |
| `origin_contact_person` | string | ผู้ติดต่อจุดรับ | "คุณสมชาย" | |
| `origin_contact_role` | string | ตำแหน่งผู้ติดต่อจุดรับ | "หัวหน้าคลัง" | |
| `origin_bill_of_lading` | string | เลขที่ใบตราส่งจุดรับ | "BL-001" | |
| `origin_goods_type` | string | ประเภทสินค้าจุดรับ | "อิเล็กทรอนิกส์" | |
| `origin_goods_quantity` | string | จำนวนสินค้าจุดรับ | "100 กล่อง" | |
| `origin_remarks` | string | หมายเหตุจุดรับ | "ระวังของเปราะบาง" | |
| `destination_contact_person` | string | ผู้ติดต่อจุดส่ง | "คุณสมหญิง" | |
| `destination_bill_of_lading` | string | เลขที่ใบตราส่งจุดส่ง | "BL-002" | |
| `destination_goods_type` | string | ประเภทสินค้าจุดส่ง | "อิเล็กทรอนิกส์" | |
| `destination_goods_quantity` | string | จำนวนสินค้าจุดส่ง | "100 กล่อง" | |
| `destination_remarks` | string | หมายเหตุจุดส่ง | "แจ้งก่อนถึง 30 นาที" | |

---

## 🎯 Job Type Values

ระบบรองรับทั้งภาษาไทยและอังกฤษ:

| English | Thai | Description |
|---------|------|-------------|
| `urgent` | `งานด่วน` | งานเร่งด่วน |
| `daily` | `งานรายวัน` | งานรายวัน |
| `contract` | `งานสัญญาจ้าง` | งานสัญญาจ้าง |
| `domestic` | `งานรายวัน` | งานรายวัน (alias) |

---

## 🚚 Transport Type Values

ระบบรองรับทั้งภาษาไทยและอังกฤษ:

| English | Thai | Description |
|---------|------|-------------|
| `single` / `single_trip` / `one_way` | `ขนส่งเที่ยวเดียว` | ขนส่งเที่ยวเดียว |
| `round_trip` | `ขนส่งเที่ยวเดียว` | ไป-กลับ |
| `multi` / `multiple` | `ขนส่งหลายที่` | ขนส่งหลายจุด |
| `import` / `inbound` | `ขนส่งขาเข้า` | นำเข้า |
| `export` / `outbound` | `ขนส่งขาออก` | ส่งออก |

---

## 👥 Assigned Role Values (สำหรับ Company/Factory API เท่านั้น)

| English | Thai | Description |
|---------|------|-------------|
| `company` | `บริษัท` | ฝ่ายบริษัท |
| `factory` | `โรงงาน` | ฝ่ายโรงงาน |

**หมายเหตุ:** 
- Freelance API: ไม่ต้องส่ง `assigned_role` (จะถูกตั้งเป็น "freelance" อัตโนมัติ)
- Company/Factory API: ถ้าไม่ส่ง `assigned_role` จะใช้ "company" เป็นค่าเริ่มต้น

---

## 📝 Example Requests

### Example 1: Freelance Job (Domestic)
```json
{
  "order_code": "FL-2024-001",
  "employer_name": "บริษัท XYZ จำกัด",
  "job_type": "daily",
  "transport_type": "single",
  "origin_location": "โรงงานกรุงเทพ ถนนพระราม 9",
  "destination_location": "คลังสินค้าชลบุรี นิคมอมตะ",
  "price": 8000,
  "start_date": "2024-02-01",
  "start_time": "08:00:00",
  "equipment_list": "รถกระบะ",
  "safety_equipment": "เสื้อสะท้อนแสง",
  "province": "กรุงเทพมหานคร",
  "district": "ห้วยขวาง"
}
```

### Example 2: Company Job (International)
```json
{
  "order_code": "COMP-2024-001",
  "employer_name": "บริษัท ABC Logistics จำกัด",
  "job_type": "contract",
  "transport_type": "import",
  "origin_location": "ท่าเรือแหลมฉบัง",
  "destination_location": "โรงงานชลบุรี",
  "price": 25000,
  "start_date": "2024-02-05",
  "start_time": "06:00:00",
  "assigned_role": "company",
  "container_number": "TCNU1234567",
  "seal_number": "SEAL-12345",
  "container_checkpoint": "ด่านศุลกากรแหลมฉบัง",
  "container_checkpoint_code": "THLCH",
  "empty_container_date": "2024-02-04",
  "destination_time": "14:00:00",
  "origin_contact_person": "คุณสมชาย",
  "origin_goods_type": "เครื่องจักร",
  "origin_goods_quantity": "1 ตู้ 40 ฟุต",
  "destination_contact_person": "คุณสมหญิง",
  "destination_remarks": "แจ้งล่วงหน้า 1 ชั่วโมง"
}
```

### Example 3: Factory Job
```json
{
  "order_code": "FAC-2024-001",
  "employer_name": "โรงงาน DEF",
  "job_type": "urgent",
  "transport_type": "multi",
  "origin_location": "โรงงานสมุทรปราการ",
  "destination_location": "ลูกค้า 3 แห่ง (กรุงเทพ, นนทบุรี, ปทุมธานี)",
  "price": 12000,
  "start_date": "2024-02-01",
  "start_time": "05:00:00",
  "assigned_role": "factory",
  "equipment_list": "รถ 6 ล้อ, ผ้าใบคลุม",
  "safety_equipment": "เสื้อสะท้อนแสง, รองเท้าเซฟตี้, ถุงมือ"
}
```

---

## ✅ Success Response

```json
{
  "status": "success",
  "message": "Job created successfully",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "order_code": "ORD-2024-001",
  "assigned_role": "freelance",
  "timestamp": "2024-01-30T10:30:00.000Z"
}
```

**Status Code:** `200 OK`

---

## ❌ Error Responses

### 1. Missing Required Fields
```json
{
  "status": "error",
  "message": "Missing required fields",
  "missing_fields": ["start_date", "price", "start_time"]
}
```
**Status Code:** `400 Bad Request`

### 2. Invalid job_type
```json
{
  "status": "error",
  "message": "Invalid job_type value",
  "received_value": "invalid_type",
  "valid_values_thai": ["งานด่วน", "งานรายวัน", "งานสัญญาจ้าง"],
  "valid_values_english": ["urgent", "daily", "contract"],
  "note": "job_type can be in Thai or English. Auto-mapping is supported."
}
```
**Status Code:** `400 Bad Request`

### 3. Invalid transport_type
```json
{
  "status": "error",
  "message": "Invalid transport_type value",
  "received_value": "invalid_type",
  "valid_values_thai": ["ขนส่งเที่ยวเดียว", "ขนส่งหลายที่", "ขนส่งขาเข้า", "ขนส่งขาออก"],
  "valid_values_english": ["single/single_trip", "multi/multiple", "import/inbound", "export/outbound"],
  "note": "transport_type can be in Thai or English. Auto-mapping is supported."
}
```
**Status Code:** `400 Bad Request`

### 4. Database Error
```json
{
  "status": "error",
  "message": "Failed to upsert job into database",
  "error": "Database connection error"
}
```
**Status Code:** `500 Internal Server Error`

---

## 🔄 Update Existing Job

หากส่ง `order_code` ที่มีอยู่แล้วในระบบ ข้อมูลจะถูก **อัปเดต** แทนที่จะสร้างใหม่ (Upsert behavior)

---

## 🧪 Testing with cURL

### Test Freelance API:
```bash
curl -X POST 'https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/receive' \
  -H 'Content-Type: application/json' \
  -d '{
    "order_code": "TEST-FL-001",
    "employer_name": "บริษัททดสอบ",
    "job_type": "daily",
    "transport_type": "single",
    "origin_location": "กรุงเทพ",
    "destination_location": "ชลบุรี",
    "price": 5000,
    "start_date": "2024-02-10",
    "start_time": "08:00:00"
  }'
```

### Test Company/Factory API:
```bash
curl -X POST 'https://yhzurkotubkkaokhtmsb.supabase.co/functions/v1/receive-company-factory' \
  -H 'Content-Type: application/json' \
  -d '{
    "order_code": "TEST-COMP-001",
    "employer_name": "บริษัททดสอบ",
    "job_type": "contract",
    "transport_type": "import",
    "origin_location": "ท่าเรือแหลมฉบัง",
    "destination_location": "โรงงานชลบุรี",
    "price": 20000,
    "start_date": "2024-02-10",
    "start_time": "06:00:00",
    "assigned_role": "company"
  }'
```

---

## ⚙️ Important Notes

1. **Language Support:** ระบบรองรับทั้งภาษาไทยและอังกฤษสำหรับฟิลด์ `job_type`, `transport_type`, และ `assigned_role`

2. **Order Code:** รหัส `order_code` ต้องไม่ซ้ำกัน หากซ้ำจะเป็นการอัปเดตข้อมูลเดิม

3. **Date/Time Format:**
   - วันที่: `YYYY-MM-DD` (เช่น "2024-02-01")
   - เวลา: `HH:MM:SS` (เช่น "08:00:00")

4. **Role Assignment:**
   - **Freelance API:** ไม่ต้องส่ง `assigned_role` (ตั้งเป็น "freelance" อัตโนมัติ)
   - **Company/Factory API:** ส่ง `assigned_role` เป็น "company" หรือ "factory" (default: "company")

5. **CORS:** API รองรับ CORS สำหรับการเรียกใช้จาก Web Browser

6. **Upsert Behavior:** หาก `order_code` มีอยู่แล้ว ระบบจะอัปเดตข้อมูล ไม่ใช่สร้างใหม่

---

## 📞 Support

หากพบปัญหาหรือมีคำถาม กรุณาติดต่อทีมพัฒนา

**API Version:** 1.0  
**Last Updated:** January 2024
