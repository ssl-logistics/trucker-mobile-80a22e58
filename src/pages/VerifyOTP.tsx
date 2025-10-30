import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { CheckCircle } from "lucide-react";

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phoneNumber = location.state?.phoneNumber || "XXX-XXX-5678";
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

  const handleResend = () => {
    setTimer(30);
    setCanResend(false);
    setOtp("");
    // TODO: Add actual OTP resend logic here
  };

  const handleOTPComplete = (value: string) => {
    setOtp(value);
    if (value.length === 6) {
      // TODO: Add actual OTP verification logic here
      // For now, simulate success after a short delay
      setTimeout(() => {
        setShowSuccess(true);
      }, 500);
    }
  };

  const handleGoToHome = () => {
    // TODO: Navigate to actual home page when it exists
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-primary/90"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-semibold flex-1 text-center mr-10">ยืนยันตัวตน</h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-6 pt-12">
        <div className="w-full max-w-md space-y-8">
          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              ใส่รหัส OTP 6 หลัก ที่ถูกส่งไปที่
            </p>
            <p className="text-xl font-semibold">{phoneNumber}</p>
            <p className="text-sm text-muted-foreground">Ref : RELK</p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={handleOTPComplete}
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

          {/* Resend OTP */}
          <div className="text-center">
            {canResend ? (
              <button
                onClick={handleResend}
                className="text-primary hover:underline"
              >
                อินไม่ได้รับรหัส <span className="font-semibold">ส่งอีกครั้ง</span>
              </button>
            ) : (
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <span className="inline-block">🔄</span>
                ส่งรหัส OTP อีกครั้ง{" "}
                <span className="text-destructive">
                  (00:{timer.toString().padStart(2, "0")})
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-semibold">ลงทะเบียนสำเร็จ!</h2>
            <Button
              onClick={handleGoToHome}
              className="mt-4"
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
