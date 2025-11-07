import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Truck, Users, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import financeBg from "@/assets/finance-bg-new.png";
import shippingBg from "@/assets/shipping-bg.png";
import customerBg from "@/assets/customer-bg.png";
import productBg from "@/assets/product-bg.png";
interface Profile {
  full_name: string;
  avatar_url?: string;
}
export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);
  const loadProfile = async () => {
    if (!user) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();
    if (profileData) {
      setProfile(profileData);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  const dashboardItems = [
    {
      id: "finance",
      title: t("dashboard.finance"),
      description: t("dashboard.finance_desc"),
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      path: "/dashboard/finance",
      imageSrc: financeBg,
    },
    {
      id: "shipping",
      title: t("dashboard.shipping"),
      description: t("dashboard.shipping_desc"),
      icon: Truck,
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-50",
      path: "/dashboard/shipping",
      imageSrc: shippingBg,
    },
    {
      id: "customer",
      title: t("dashboard.customer"),
      description: t("dashboard.customer_desc"),
      icon: Users,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      path: "/dashboard/customer",
      imageSrc: customerBg,
    },
    {
      id: "product",
      title: t("dashboard.product"),
      description: t("dashboard.product_desc"),
      icon: Package,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      path: "/dashboard/product",
      imageSrc: productBg,
    },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      <AppHeader userName={profile?.full_name} profilePhoto={profile?.avatar_url} onSignOut={handleSignOut} />

      {/* Dashboard Grid */}
      <div className="px-4 py-6 space-y-8">
        {dashboardItems.map((item) => (
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
                backgroundRepeat: "no-repeat",
              }}
              className="p-10 relative w-full min-h-[120px] -mt-4 rounded-3xl"
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                  <button
                    className={`bg-gradient-to-r ${item.color} text-white px-6 py-2.5 rounded-full font-medium shadow-md hover:shadow-lg transition-all`}
                  >
                    {t("dashboard.view")}
                    {item.title.split(" ")[0]}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <BottomNavigation />
    </div>
  );
}
