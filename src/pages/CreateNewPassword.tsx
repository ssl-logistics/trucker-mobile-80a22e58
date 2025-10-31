import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import loginBackground from "@/assets/login-background.png";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .regex(/[A-Z]/, "ต้องมีตัวอักษรพิมพ์ใหญ่")
    .regex(/[a-z]/, "ต้องมีตัวอักษรพิมพ์เล็ก")
    .regex(/[0-9]/, "ต้องมีตัวเลข"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const CreateNewPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const phone = location.state?.phone || "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid }
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    mode: "onChange"
  });

  const password = watch("password", "");

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const onSubmit = async (data: PasswordFormData) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { data: resetData, error } = await supabase.functions.invoke("reset-password", {
        body: { phone, password: data.password }
      });

      if (error || !resetData?.success) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: resetData?.error || "ไม่สามารถตั้งรหัสผ่านใหม่ได้",
          variant: "destructive"
        });
        return;
      }
      
      setShowSuccess(true);
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive"
      });
    }
  };

  const handleSuccess = () => {
    setShowSuccess(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="relative h-[40vh]">
        <img 
          src={loginBackground} 
          alt="The Truckers" 
          className="absolute inset-0 w-full h-full object-fill"
        />
      </div>

      {/* Form Section */}
      <div className="flex-1 rounded-t-[3rem] -mt-12 px-6 pt-8 pb-6 bg-white">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-center mb-8 text-foreground">
            สร้างรหัสผ่านใหม่
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                รหัสผ่านใหม่ <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  {...register("password")}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${hasMinLength ? "text-green-600" : "text-muted-foreground"}`}>
                <Check className={`w-4 h-4 ${hasMinLength ? "" : "invisible"}`} />
                <span>ความยาวอย่างน้อย 8 ตัวอักษร ขึ้นไป</span>
              </div>
              <div className={`flex items-center gap-2 ${hasUpperCase && hasLowerCase ? "text-green-600" : "text-muted-foreground"}`}>
                <Check className={`w-4 h-4 ${hasUpperCase && hasLowerCase ? "" : "invisible"}`} />
                <span>ต้องประกอบด้วย ตัวอักษรพิมพ์ใหญ่ (A-Z), (a-z)</span>
              </div>
              <div className={`flex items-center gap-2 ${hasNumber ? "text-green-600" : "text-muted-foreground"}`}>
                <Check className={`w-4 h-4 ${hasNumber ? "" : "invisible"}`} />
                <span>ตัวเลข (0-9) อย่างน้อย 1</span>
              </div>
              <div className={`flex items-center gap-2 ${hasSpecialChar ? "text-green-600" : "text-muted-foreground"}`}>
                <Check className={`w-4 h-4 ${hasSpecialChar ? "" : "invisible"}`} />
                <span>รหัสผ่านควรประกอบด้วย ตัวอักษรพิเศษ อย่างน้อย 1</span>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                ยืนยันรหัสผ่าน <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  {...register("confirmPassword")}
                  className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="space-y-3 pt-4">
              <Button
                type="submit"
                disabled={!isValid}
                className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 rounded-xl text-base font-medium disabled:opacity-50"
              >
                สร้างรหัสผ่านใหม่
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full h-12 rounded-xl text-base font-medium border-2"
              >
                เข้าสู่ระบบ
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">
              สร้างรหัสผ่านใหม่สำเร็จ!
            </DialogTitle>
            <DialogDescription className="text-center">
              คุณได้ทำการตั้งรหัสผ่านใหม่เรียบร้อยแล้ว!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                navigate("/");
              }}
              className="flex-1"
            >
              หน้าหลัก
            </Button>
            <Button
              onClick={handleSuccess}
              className="flex-1 bg-secondary hover:bg-secondary/90"
            >
              เริ่มต้นใช้งาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateNewPassword;
