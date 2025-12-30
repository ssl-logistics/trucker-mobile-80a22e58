# iOS Permissions Setup

หลังจาก run `npx cap sync` แล้ว ต้องเพิ่ม permissions ใน iOS project

## วิธีเพิ่ม Permissions

1. เปิด Xcode project: `ios/App/App.xcworkspace`

2. เปิดไฟล์ `ios/App/App/Info.plist`

3. เพิ่ม key-value pairs ต่อไปนี้:

### Photo Library (จำเป็นสำหรับการเลือกรูปภาพ)

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs access to your photo library to upload vehicle photos and profile pictures.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>This app needs permission to save photos to your photo library.</string>
```

### Camera (จำเป็นสำหรับการถ่ายรูป)

```xml
<key>NSCameraUsageDescription</key>
<string>This app needs access to your camera to take vehicle photos, expense receipts, and SOP check-in photos.</string>
```

### Push Notifications

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

## ตัวอย่าง Info.plist แบบเต็ม

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- ... existing entries ... -->
    
    <!-- Photo Library -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>This app needs access to your photo library to upload vehicle photos and profile pictures.</string>
    
    <key>NSPhotoLibraryAddUsageDescription</key>
    <string>This app needs permission to save photos to your photo library.</string>
    
    <!-- Camera -->
    <key>NSCameraUsageDescription</key>
    <string>This app needs access to your camera to take vehicle photos, expense receipts, and SOP check-in photos.</string>
    
    <!-- Push Notifications Background Mode -->
    <key>UIBackgroundModes</key>
    <array>
        <string>remote-notification</string>
    </array>
    
    <!-- ... other entries ... -->
</dict>
</plist>
```

## เพิ่ม Push Notification Capability

1. ใน Xcode เลือก project target (App)
2. ไปที่ "Signing & Capabilities" tab
3. กด "+ Capability"
4. เพิ่ม "Push Notifications"
5. เพิ่ม "Background Modes" และติ๊ก "Remote notifications"

## หลังแก้ไข

รัน command:
```bash
npx cap sync ios
```

## Thai Language Descriptions (ถ้าต้องการภาษาไทย)

สำหรับ localization ภาษาไทย สร้างไฟล์ `ios/App/App/th.lproj/InfoPlist.strings`:

```
"NSPhotoLibraryUsageDescription" = "แอปต้องการเข้าถึงคลังรูปภาพเพื่ออัปโหลดรูปรถและรูปโปรไฟล์";
"NSPhotoLibraryAddUsageDescription" = "แอปต้องการสิทธิ์ในการบันทึกรูปภาพลงคลังรูปภาพของคุณ";
"NSCameraUsageDescription" = "แอปต้องการเข้าถึงกล้องเพื่อถ่ายรูปรถ ใบเสร็จค่าใช้จ่าย และรูป SOP check-in";
```
