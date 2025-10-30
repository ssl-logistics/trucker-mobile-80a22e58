import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().min(1, { message: "กรุณากรอกชื่อผู้ใช้" }).email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }),
  password: z.string().min(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }),
  remember: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

const SignIn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false,
    },
  });

  const rememberValue = watch("remember");

  const onSubmit = async (data: LoginFormData) => {
    try {
      setServerError("");
      // TODO: Implement actual login logic
      console.log("Login data:", data);
      
      // Simulate login validation
      if (data.email === "test@example.com" && data.password === "password123") {
        toast({
          title: "เข้าสู่ระบบสำเร็จ",
          description: "ยินดีต้อนรับกลับมา",
        });
        navigate("/home");
      } else {
        setServerError("รหัสผ่านของคุณไม่ถูกต้อง กรุณาใส่ใหม่อีกครั้ง");
      }
    } catch (error) {
      setServerError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section with Truck Image */}
      <div className="relative h-[45vh] bg-gradient-to-br from-primary/20 via-background to-secondary/20 rounded-b-[3rem] overflow-hidden">
        <div className="absolute top-8 right-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-full"></div>
          <div className="text-2xl font-bold text-foreground">The</div>
        </div>
        <div className="absolute top-12 right-8 text-xl font-bold text-foreground">Truckers</div>
        
        {/* Truck Image */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center">
          <div className="relative w-full max-w-md">
            <div className="absolute top-0 right-12 w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
            <div className="w-full h-48 bg-gradient-to-r from-primary/80 to-accent/80 rounded-t-3xl flex items-center justify-center overflow-hidden">
              <div className="text-8xl">🚛</div>
            </div>
          </div>
        </div>

        {/* Decorative Grid Pattern */}
        <div className="absolute top-8 left-8 grid grid-cols-3 gap-2 opacity-20">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-12 h-12 border-2 border-foreground/30 rounded-lg"></div>
          ))}
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 bg-white rounded-t-[3rem] -mt-12 px-6 pt-8 pb-6">
        <h1 className="text-2xl font-bold text-center mb-8 text-foreground">
          เข้าสู่ระบบหรือสมัครสมาชิก
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-md mx-auto">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              ชื่อผู้ใช้ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              รหัสผ่าน <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••"
                {...register("password")}
                className={`pr-10 ${errors.password || serverError ? "border-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberValue}
                onCheckedChange={(checked) => setValue("remember", checked as boolean)}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal cursor-pointer text-foreground"
              >
                จดจำฉันในระบบ
              </Label>
            </div>
            <button
              type="button"
              onClick={() => console.log("Forgot password")}
              className="text-sm text-secondary hover:underline"
            >
              ลืมรหัสผ่านใช่หรือไป?
            </button>
          </div>

          {/* Submit Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              type="submit"
              className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 rounded-xl text-base font-medium"
            >
              เข้าสู่ระบบ
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/register")}
              className="w-full h-12 rounded-xl text-base font-medium border-2"
            >
              ลงทะเบียน
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
