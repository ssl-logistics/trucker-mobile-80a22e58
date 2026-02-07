

## แผนการย้ายรูปป้ายทะเบียนไปแสดงในแท็บข้อมูล

### สรุปปัญหา
ปัจจุบันรูปป้ายทะเบียน (license plate photo) แสดงอยู่ในแท็บ "รูปภาพ" ร่วมกับรูปรถ (หน้ารถ, ด้านซ้าย, ด้านหลัง) แต่ผู้ใช้ต้องการให้รูปป้ายทะเบียนแสดงแยกในแท็บ "ข้อมูล" ที่ div ซึ่งปัจจุบันแสดงข้อความ "ยังไม่มีรูปภาพ"

### แผนการแก้ไข

#### 1. แท็บ "รูปภาพ" - ลบรูปป้ายทะเบียนออก
- เปลี่ยน array จาก `['front', 'side', 'back', 'plate']` กลับเป็น `['front', 'side', 'back']`
- รูปป้ายทะเบียนจะไม่แสดงในแท็บนี้อีกต่อไป

#### 2. แท็บ "ข้อมูล" - เพิ่ม section รูปป้ายทะเบียน
- เพิ่ม section ใหม่สำหรับแสดงรูปป้ายทะเบียนแยกจากรูปทะเบียนรถ (registration photos)
- ใช้ `getPhotoByType('plate')` เพื่อดึงรูปป้ายทะเบียน
- แสดงรูปป้ายทะเบียนในรูปแบบเดียวกับ registration photos (ใช้ presigned URL)
- หากไม่มีรูป จะแสดงข้อความ "ยังไม่มีรูปภาพ" พร้อมปุ่มแก้ไข

---

### รายละเอียดทางเทคนิค

**ไฟล์ที่ต้องแก้ไข:** `src/pages/VehicleInfoPage.tsx`

**การเปลี่ยนแปลง 1:** แท็บรูปภาพ (บรรทัด ~778)
```tsx
// เปลี่ยนจาก
{['front', 'side', 'back', 'plate'].map((photoType) => {

// เป็น
{['front', 'side', 'back'].map((photoType) => {
```

**การเปลี่ยนแปลง 2:** แท็บข้อมูล - เพิ่ม section รูปป้ายทะเบียน (หลัง Registration Photos Gallery บรรทัด ~610)
```tsx
{/* License Plate Photo Section */}
<div className="mb-2">
  <h3 className="text-sm font-medium text-foreground">
    {t('vehicle.platePhoto') || 'รูปป้ายทะเบียน'}
  </h3>
</div>

{(() => {
  const platePhoto = getPhotoByType('plate');
  const platePhotoUrl = getPresignedPhotoUrl(platePhoto);
  
  return platePhoto && platePhotoUrl ? (
    <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
      <img 
        src={platePhotoUrl}
        alt={t('vehicle.platePhoto') || 'รูปป้ายทะเบียน'} 
        className="w-full h-full object-cover"
      />
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 bg-background/80 hover:bg-background"
        onClick={() => {
          setCurrentPhotoType('plate');
          setIsVehiclePhotoDrawerOpen(true);
        }}
      >
        <Edit2 className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  ) : (
    <div className="relative bg-muted rounded-lg p-4 aspect-video flex items-center justify-center overflow-hidden">
      <span className="text-muted-foreground">{t('vehicle.noPhotos') || 'ยังไม่มีรูปภาพ'}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 bg-background/80 hover:bg-background"
        onClick={() => {
          setCurrentPhotoType('plate');
          setIsVehiclePhotoDrawerOpen(true);
        }}
      >
        <Edit2 className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );
})()}
```

