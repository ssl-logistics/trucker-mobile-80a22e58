import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Terms = () => {
  const navigate = useNavigate();

  const handleAccept = () => {
    // Store acceptance in localStorage
    localStorage.setItem("termsAccepted", "true");
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-8">
      {/* Illustration Section */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-8">
            {/* Notification illustration placeholder */}
            <div className="w-48 h-48 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="text-6xl">🔔</div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-4">
            เปิดใช้งานการแจ้งเตือน
          </h1>
          
          <p className="text-muted-foreground leading-relaxed">
            อย่าพลาดข้อความสำคัญเกี่ยวกับกิจกรรมบัญชี
            <br />
            เช่น เมื่อถึงเวลาอนุมัติการประมูลจากผู้ส่ง
          </p>
        </div>
      </div>

      {/* Accept Button */}
      <div className="w-full max-w-md">
        <Button
          onClick={handleAccept}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-6 text-lg font-medium"
        >
          เปิดใช้งานการแจ้งเตือน
        </Button>
      </div>
    </div>
  );
};

export default Terms;
