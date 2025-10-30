import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";

const VerifyOTPReset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const phone = location.state?.phone || "";
  const maskedPhone = phone.replace(/(\d{3})(\d{3})(\d{4})/, "XXX-XXX-$3");

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

  useEffect(() => {
    if (otp.length === 6) {
      // Simulate OTP verification
      setTimeout(() => {
        toast({
          title: "ยืนยัน OTP สำเร็จ",
          description: "กรุณาสร้างรหัสผ่านใหม่"
        });
        navigate("/create-new-password", { state: { phone } });
      }, 500);
    }
  }, [otp, navigate, toast, phone]);

  const handleResendOTP = () => {
    setOtp("");
    setTimer(60);
    setCanResend(false);
    toast({
      title: "ส่งรหัสยืนยันใหม่แล้ว",
      description: "กรุณาตรวจสอบ SMS"
    });
  };

  const handleBack = () => {
    navigate(-1);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-secondary text-white p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">ยืนยันตัวตน</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-8 pb-6">
        <div className="max-w-md mx-auto text-center">
          <p className="text-foreground mb-2">ใส่รหัส OTP 6 หลัก ที่ถูกส่งไปที่</p>
          <p className="text-xl font-bold text-foreground mb-1">{maskedPhone}</p>
          <p className="text-sm text-muted-foreground mb-8">Ref : RELK</p>

          {/* OTP Input */}
          <div className="flex justify-center mb-8">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => setOtp(value)}
              pattern="^[0-9]+$"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Resend Section */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {canResend ? (
              <button
                onClick={handleResendOTP}
                className="flex items-center gap-2 text-secondary hover:underline font-medium"
              >
                <RotateCw className="w-4 h-4" />
                ส่งรหัส OTP อีกครั้ง
              </button>
            ) : (
              <p className="text-muted-foreground">
                ส่งรหัส OTP อีกครั้ง{" "}
                <span className="text-destructive font-medium">
                  ({formatTime(timer)})
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTPReset;
