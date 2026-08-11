import { useNavigate } from "react-router-dom";
import { TrendingUp, Truck, Users, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useVehiclePhoto } from "@/hooks/useVehiclePhoto";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import financeBg from "@/assets/finance-bg-new.png";
import shippingBg from "@/assets/shipping-bg.png";
import customerBg from "@/assets/customer-bg.png";
import productBg from "@/assets/product-bg.png";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { vehiclePhoto } = useVehiclePhoto();

  const handleSignOut = () => {
    logout();
    navigate("/");
  };
  const dashboardItems = [{
    id: "finance",
    title: t("dashboard.finance"),
    description: t("dashboard.finance_desc"),
    icon: TrendingUp,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    path: "/dashboard/finance",
    imageSrc: financeBg
  }, {
    id: "shipping",
    title: t("dashboard.shipping"),
    description: t("dashboard.shipping_desc"),
    icon: Truck,
    color: "from-teal-500 to-teal-600",
    bgColor: "bg-teal-50",
    path: "/dashboard/shipping",
    imageSrc: shippingBg
  }, {
    id: "customer",
    title: t("dashboard.customer"),
    description: t("dashboard.customer_desc"),
    icon: Users,
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    path: "/dashboard/customer",
    imageSrc: customerBg
  }, {
    id: "product",
    title: t("dashboard.product"),
    description: t("dashboard.product_desc"),
    icon: Package,
    color: "from-orange-500 to-orange-600",
    bgColor: "bg-orange-50",
    path: "/dashboard/product",
    imageSrc: productBg
  }];
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Fixed Header */}
      <div>
        <AppHeader 
          userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || user?.name || user?.username} 
          profilePhoto={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined} 
          onSignOut={handleSignOut} 
          showQuickMenu={false} 
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 pb-24">
        <div className="px-4 py-6 space-y-8">
          {dashboardItems.map(item => (
            <Card 
              key={item.id} 
              className="shadow-md hover:shadow-lg transition-shadow cursor-pointer rounded-3xl" 
              onClick={() => navigate(item.path)}
            >
              <div 
                style={{
                  backgroundImage: `url(${item.imageSrc})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat"
                }} 
                className="p-2 relative w-full min-h-[120px] -mt-4 rounded-2xl"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-[#1B4D36] mt-4 text-sm">{item.title}</h3>
                    <p className="text-[#22733F] mb-4 text-xs">{item.description}</p>
                    <button className={`bg-gradient-to-r ${item.color} text-white w-[90px] h-[30px] rounded-full font-medium text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center`}>
                      {t("dashboard.view")}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}