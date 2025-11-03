import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, X } from "lucide-react";
import { RegistrationData } from "@/pages/Register";

interface ReviewStepProps {
  data: RegistrationData;
  onBack: () => void;
  onSubmit: () => void;
}

const ReviewStep = ({ data, onBack, onSubmit }: ReviewStepProps) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">ข้อมูลทั่วไป</TabsTrigger>
          <TabsTrigger value="photos">อัพโหลดรูปรถ</TabsTrigger>
          <TabsTrigger value="vehicle">ข้อมูลรถ</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">ข้อมูลทั่วไป</h3>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Pencil className="w-4 h-4 mr-1" />
              แก้ไข
            </Button>
          </div>

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">ข้อมูลส่วนตัว</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ชื่อ</span>
                  <span>{data.firstName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">นามสกุล</span>
                  <span>{data.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เบอร์โทรศัพท์</span>
                  <span>{data.phone}</span>
                </div>
                {data.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">อีเมล</span>
                    <span>{data.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">ข้อมูลผู้ใช้งาน</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ชื่อผู้ใช้</span>
                  <span>{data.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">รหัสผ่าน</span>
                  <span>••••••••</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">พื้นที่วิ่งงาน</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">อำเภอ หรือ จังหวัด ที่ถนัดหรือวิ่งงานเป็นประจำ</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.workAreas?.map((area, index) => (
                    <span key={index} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs">
                      {area}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เรทราคาวิ่งงาน (฿)</span>
                  <span>{data.priceRangeMin} - {data.priceRangeMax}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">อัพโหลดรูปรถ</h3>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Pencil className="w-4 h-4 mr-1" />
              แก้ไข
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">รูปหน้ารถ</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.frontPhoto ? (
                  <img src={URL.createObjectURL(data.frontPhoto)} alt="รูปหน้ารถ" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">รูปข้างรถ</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.sidePhoto ? (
                  <img src={URL.createObjectURL(data.sidePhoto)} alt="รูปข้างรถ" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">รูปหลังรถ</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.backPhoto ? (
                  <img src={URL.createObjectURL(data.backPhoto)} alt="รูปหลังรถ" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">รูปป้ายทะเบียน</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.platePhoto ? (
                  <img src={URL.createObjectURL(data.platePhoto)} alt="รูปป้ายทะเบียน" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
          </div>

          {data.hasTrailer && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">รูปภาพป้ายทะเบียนหางลาก</p>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {data.trailerPlatePhoto ? (
                  <img src={URL.createObjectURL(data.trailerPlatePhoto)} alt="รูปป้ายทะเบียนหางลาก" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">📷</span>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vehicle" className="space-y-4 mt-6">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-foreground">ข้อมูลรถยนต์</h3>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <Pencil className="w-4 h-4 mr-1" />
              แก้ไข
            </Button>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">หมายเลขทะเบียน</span>
              <span>{data.plateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">จังหวัดเลขทะเบียน</span>
              <span>{data.plateProvince}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ยี่ห้อรถยนต์</span>
              <span>{data.vehicleBrand}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">สีรถยนต์</span>
              <span>{data.vehicleColor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VIN</span>
              <span>{data.vin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ประเภทรถยนต์</span>
              <span>{data.vehicleType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ประเภทเชื้อเพลิง</span>
              <span>{data.fuelType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ความจุที่ได้รับ (กิโลกรัม)</span>
              <span>{data.loadCapacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ขนาดที่บรรทุกได้</span>
              <span>{data.dimensions.width} x {data.dimensions.length} x {data.dimensions.height}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ตู้คอนเทนเนอร์</span>
              <span>{data.containerTypes.join(", ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">มูลค่าประกันสินค้า</span>
              <span>{data.insuranceValue} บาท</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCancelDialog(true)}
          className="flex-1 rounded-xl h-12 text-base font-medium border-2"
        >
          ยกเลิก
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
        >
          สร้างบัญชี
        </Button>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">ลงทะเบียนไม่สำเร็จ</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              ขออภัย เกิดข้อผิดพลาดระหว่างการลงทะเบียน กรุณาตรวจสอบข้อมูลของคุณและลองอีกครั้ง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-0 sm:flex-col gap-2">
            <AlertDialogCancel className="m-0">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="m-0 bg-primary">ลองอีกครั้ง</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReviewStep;
