# Fix Firebase Initialization Error (Android / Capacitor)

## อาการ (Crash)
ถ้าเจอ error แบบนี้ตอนกดเปิด Push หรือเรียก `PushNotifications.register()`:

```
java.lang.IllegalStateException: Default FirebaseApp is not initialized...
```

สาเหตุคือ **โปรเจกต์ Android ฝั่ง Native ยังไม่ได้ตั้งค่า Firebase** (ยังไม่มีการนำ `google-services.json` + Google Services Gradle plugin ไปใส่ใน Android project) ทำให้ Firebase ไม่ถูก initialize อัตโนมัติ

---

## วิธีแก้ (Native Android)

### 1) วางไฟล์ `google-services.json` ให้ถูกที่
นำไฟล์ `google-services.json` ไปไว้ที่:

```
android/app/google-services.json
```

> ตรวจสอบด้วยว่าใน `google-services.json` มี `package_name` ตรงกับ `com.thetroob.mobile`

### 2) เพิ่ม Google Services plugin ใน Gradle

**android/build.gradle** (ระดับโปรเจกต์) เพิ่ม classpath:

```gradle
dependencies {
  classpath 'com.google.gms:google-services:4.4.2'
}
```

**android/app/build.gradle** (ระดับแอป) apply plugin:

```gradle
apply plugin: 'com.google.gms.google-services'
```

> ถ้าใช้ `plugins {}` block ให้ใส่ `id "com.google.gms.google-services"` ตามรูปแบบ Gradle ของโปรเจกต์คุณ

### 3) Sync โปรเจกต์
หลังแก้ native files แล้ว ให้รัน:

```bash
npx cap sync android
```

จากนั้นเปิด Android project ใน Android Studio แล้ว **Sync Gradle** / Build ใหม่

---

## หมายเหตุ
- โค้ดฝั่งเว็บ (React) ไม่สามารถ initialize Firebase ใน native process แทนได้ — ต้องแก้ที่ Android project เท่านั้น
- ถ้ายัง crash อยู่ ให้ตรวจว่า `google-services.json` อยู่ใน path ถูกต้อง และ plugin ถูก apply จริง
