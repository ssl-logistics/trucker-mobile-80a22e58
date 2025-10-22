import { Bell, FileText, Gavel, Truck, ClipboardCheck, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white p-4 rounded-b-3xl">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold tracking-wider">SSL</div>
          </div>
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
            <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></div>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Hero Image Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-center gap-4">
            <div className="text-6xl">🚛</div>
            <div className="text-6xl">📱</div>
            <div className="text-6xl">⚖️</div>
          </div>
        </div>

        {/* Poster Menu Section */}
        <section className="bg-secondary rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">เมนูหลักผู้โพสต์</h2>
          <div className="grid grid-cols-3 gap-4">
            <MenuCard
              icon={<Gavel className="w-8 h-8" />}
              label="สร้างโพสต์งานประมูล"
              onClick={() => console.log("Create auction post")}
            />
            <MenuCard
              icon={<Gavel className="w-8 h-8" />}
              label="สร้างโพสต์งานด่วน"
              onClick={() => console.log("Create urgent post")}
            />
            <MenuCard
              icon={<FileText className="w-8 h-8" />}
              label="โพสต์ของฉัน"
              onClick={() => console.log("My posts")}
            />
          </div>
        </section>

        {/* Driver Menu Section */}
        <section className="bg-primary rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">เมนูหลักผู้ขับ</h2>
          
          {/* Alert Message */}
          <div className="bg-red-100 text-red-800 rounded-xl p-4 mb-4 flex items-start gap-3">
            <div className="text-xl">⚠️</div>
            <p className="text-sm">
              คุณไม่สามารถรับงานได้ในเวลานี้เนื่องจากบัญชีกำลังถูกระงับเวลาคงเหลือ ในการระงับบัญชีคือ 2 วัน 50 นาที
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <MenuCard
              icon={<Gavel className="w-8 h-8" />}
              label="งานประมูล"
              onClick={() => console.log("Auction jobs")}
            />
            <MenuCard
              icon={<Gavel className="w-8 h-8" />}
              label="งานด่วน"
              onClick={() => console.log("Urgent jobs")}
            />
            <MenuCard
              icon={<Truck className="w-8 h-8" />}
              label="งานของฉัน"
              onClick={() => console.log("My jobs")}
            />
            <MenuCard
              icon={<ClipboardCheck className="w-8 h-8" />}
              label="รถพร้อมใช้งาน"
              onClick={() => console.log("Available trucks")}
            />
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb">
        <div className="max-w-6xl mx-auto flex items-center justify-around py-3">
          <NavItem icon={<div className="text-2xl">🏠</div>} label="หน้าหลัก" active />
          <NavItem icon={<FileText className="w-6 h-6" />} label="โพสต์ของฉัน" />
          <NavItem icon={<div className="text-2xl">➕</div>} label="สร้างโพสต์" />
          <NavItem icon={<Truck className="w-6 h-6" />} label="งานของฉัน" />
          <NavItem icon={<div className="text-2xl">⚙️</div>} label="ตั้งค่า" />
        </div>
      </nav>
    </div>
  );
};

const MenuCard = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className="bg-white/20 hover:bg-white/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-colors min-h-[100px]"
    >
      {icon}
      <span className="text-xs text-center leading-tight">{label}</span>
    </button>
  );
};

const NavItem = ({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) => {
  return (
    <button className="flex flex-col items-center gap-1">
      <div className={active ? "text-primary" : "text-muted-foreground"}>{icon}</div>
      <span className={`text-xs ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </button>
  );
};

export default Home;
