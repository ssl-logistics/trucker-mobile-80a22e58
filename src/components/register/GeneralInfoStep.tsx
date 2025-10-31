import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Eye, EyeOff, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { RegistrationData } from "@/pages/Register";

const generalInfoSchema = z.object({
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  phone: z.string().min(10, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง"),
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  username: z.string().min(1, "กรุณากรอกชื่อผู้ใช้งาน"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  confirmPassword: z.string().min(8, "กรุณายืนยันรหัสผ่าน"),
  priceRangeMin: z.string().min(1, "กรุณากรอกราคาต่ำสุด"),
  priceRangeMax: z.string().min(1, "กรุณากรอกราคาสูงสุด"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

type GeneralInfoFormData = z.infer<typeof generalInfoSchema>;

interface GeneralInfoStepProps {
  data: RegistrationData;
  onNext: (data: Partial<RegistrationData>) => void;
}

const GeneralInfoStep = ({ data, onNext }: GeneralInfoStepProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string>("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(data.workAreas || []);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<GeneralInfoFormData>({
    resolver: zodResolver(generalInfoSchema),
    defaultValues: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      password: data.password,
      confirmPassword: data.confirmPassword,
      priceRangeMin: data.priceRangeMin,
      priceRangeMax: data.priceRangeMax,
    }
  });

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result as string);
        setIsDrawerOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (formData: GeneralInfoFormData) => {
    onNext({
      ...formData,
      workAreas: selectedAreas,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Profile Photo */}
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-4">รูปภาพผู้ขับขี่</h3>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>
            <div className="relative inline-block cursor-pointer">
              <Avatar className="w-24 h-24 mx-auto">
                {profilePreview ? (
                  <AvatarImage src={profilePreview} />
                ) : (
                  <AvatarFallback className="bg-primary/10">
                    <Camera className="w-8 h-8 text-primary" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute bottom-0 right-0 bg-primary rounded-full p-2">
                <Camera className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-center">เลือกรูปภาพ</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-3 pb-8">
              <label htmlFor="camera-capture" className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <Camera className="w-6 h-6 text-primary" />
                <div className="text-left flex-1">
                  <p className="font-medium">ถ่ายภาพ</p>
                  <p className="text-sm text-muted-foreground">เปิดกล้องเพื่อถ่ายภาพ</p>
                </div>
              </label>
              <input
                id="camera-capture"
                type="file"
                accept="image/*"
                capture
                className="hidden"
                onChange={handleProfilePhotoChange}
              />
              
              <label htmlFor="gallery-select" className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <Image className="w-6 h-6 text-primary" />
                <div className="text-left flex-1">
                  <p className="font-medium">เลือกจากแกลลอรี่</p>
                  <p className="text-sm text-muted-foreground">เลือกรูปภาพที่มีอยู่ในเครื่อง</p>
                </div>
              </label>
              <input
                id="gallery-select"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePhotoChange}
              />
            </div>
          </DrawerContent>
        </Drawer>
        <p className="text-sm text-muted-foreground mt-2">กดเพื่อถ่ายรูปหรือเลือกรูปใบหน้า</p>
      </div>

      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">ข้อมูลส่วนตัว</h3>
        
        <div className="space-y-2">
          <Label htmlFor="firstName">
            ชื่อ (ระบุชื่อตามบัตรประชาชน) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            {...register("firstName")}
            className={errors.firstName ? "border-destructive" : ""}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">
            นามสกุล (ระบุนามสกุลตามบัตรประชาชน) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            {...register("lastName")}
            className={errors.lastName ? "border-destructive" : ""}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            เบอร์โทรศัพท์ <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            {...register("phone")}
            className={errors.phone ? "border-destructive" : ""}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Login Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">ข้อมูลผู้ใช้งาน</h3>
        
        <div className="space-y-2">
          <Label htmlFor="username">
            ชื่อผู้ใช้ <span className="text-destructive">*</span>
          </Label>
          <Input
            id="username"
            {...register("username")}
            className={errors.username ? "border-destructive" : ""}
          />
          {errors.username && (
            <p className="text-sm text-destructive">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            รหัสผ่าน <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...register("password")}
              className={errors.password ? "border-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            ยืนยันรหัสผ่าน <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              {...register("confirmPassword")}
              className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      {/* Work Area */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">พื้นที่วิ่งงาน</h3>
        
        <div className="space-y-2">
          <Label>อำเภอ หรือ จังหวัด ที่ถนัดหรือวิ่งงานเป็นประจำ</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="อำเภอ/จังหวัด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bangkok">กรุงเทพมหานคร</SelectItem>
              <SelectItem value="nonthaburi">นนทบุรี</SelectItem>
              <SelectItem value="samutprakan">สมุทรปราการ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>เรทราคาวิ่งงาน (฿)</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="ใส่ราคาต่ำสุด"
              {...register("priceRangeMin")}
              className={errors.priceRangeMin ? "border-destructive" : ""}
            />
            <span className="text-muted-foreground">—</span>
            <Input
              placeholder="ใส่ราคาสูงสุด"
              {...register("priceRangeMax")}
              className={errors.priceRangeMax ? "border-destructive" : ""}
            />
          </div>
          {(errors.priceRangeMin || errors.priceRangeMax) && (
            <p className="text-sm text-destructive">กรุณากรอกช่วงราคา</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium"
      >
        ต่อไป →
      </Button>
    </form>
  );
};

export default GeneralInfoStep;
