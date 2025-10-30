import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const phoneNumber = location.state?.phone || "";
  const token = location.state?.token || "";
  
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [verifyToken, setVerifyToken] = useState(token);

  // Mask phone number (XXX-XXX-5678)
  const maskedPhone = phoneNumber
    ? `XXX-XXX-${phoneNumber.slice(-4)}`
    : "XXX-XXX-XXXX";

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  // Auto verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6) {
      // Verify OTP with backend
      const verifyOTP = async () => {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke("verify-otp", {
            body: { phone: phoneNumber, otp, token: verifyToken }
          });

          if (error || !data?.success) {
            toast({
              title: "รหัส OTP ไม่ถูกต้อง",
              description: data?.error || "กรุณาตรวจสอบและลองใหม่อีกครั้ง",
              variant: "destructive"
            });
            setOtp("");
            return;
          }

          toast({
            title: "ยืนยันตัวตนสำเร็จ",
            description: "ลงทะเบียนเสร็จสมบูรณ์"
          });
          setShowSuccess(true);
        } catch (error) {
          console.error("Error verifying OTP:", error);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "กรุณาลองใหม่อีกครั้ง",
            variant: "destructive"
          });
          setOtp("");
        }
      };
      
      verifyOTP();
    }
  }, [otp, phoneNumber, verifyToken, toast]);

  const handleResendOTP = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: otpData, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: phoneNumber }
      });

      if (error || !otpData?.success) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถส่งรหัสยืนยันได้",
          variant: "destructive"
        });
        return;
      }

      setOtp("");
      setTimer(60);
      setCanResend(false);
      
      // Update verify token
      if (otpData?.token) {
        setVerifyToken(otpData.token);
        console.log("New token:", otpData.token);
      }
      
      toast({
        title: "ส่งรหัสยืนยันใหม่แล้ว",
        description: "กรุณาตรวจสอบ SMS"
      });
    } catch (error) {
      console.error("Error resending OTP:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "กรุณาลองใหม่อีกครั้ง",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSuccess = () => {
    // TODO: Navigate to home or dashboard
    navigate("/");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `(${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")})`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">ยืนยันตัวตน</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-6 pt-8">
        <div className="w-full max-w-md space-y-6">
          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              ใส่รหัส OTP 6 หลัก ที่คุณส่งไปที่
            </p>
            <p className="text-lg font-semibold">{maskedPhone}</p>
            <p className="text-sm text-muted-foreground">Ref : RELK</p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              inputMode="numeric"
              pattern="[0-9]*"
            >
              <InputOTPGroup className="gap-2">
                <InputOTPSlot index={0} className="w-12 h-12 text-lg border-2 rounded-lg" />
                <InputOTPSlot index={1} className="w-12 h-12 text-lg border-2 rounded-lg" />
                <InputOTPSlot index={2} className="w-12 h-12 text-lg border-2 rounded-lg" />
                <InputOTPSlot index={3} className="w-12 h-12 text-lg border-2 rounded-lg" />
                <InputOTPSlot index={4} className="w-12 h-12 text-lg border-2 rounded-lg" />
                <InputOTPSlot index={5} className="w-12 h-12 text-lg border-2 rounded-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Resend OTP */}
          <div className="text-center">
            {canResend ? (
              <button
                onClick={handleResendOTP}
                className="text-primary font-medium flex items-center justify-center gap-2 mx-auto"
              >
                <RotateCw className="w-4 h-4" />
                ส่งอีกครั้ง
              </button>
            ) : (
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4" />
                ส่งรหัส OTP อีกครั้ง{" "}
                <span className="text-destructive">{formatTime(timer)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <DialogTitle className="text-xl font-semibold text-center">
              ลงทะเบียนสำเร็จ!
            </DialogTitle>
            <Button
              onClick={handleSuccess}
              className="w-full"
              size="lg"
            >
              หน้าหลัก
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerifyOTP;
