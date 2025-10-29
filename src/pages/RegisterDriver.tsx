import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface VehicleType {
  id: string;
  city: string;
  wheels: string;
}

const RegisterDriver = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("vehicle");
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([
    { id: "1", city: "", wheels: "4" }
  ]);

  const addVehicleType = () => {
    setVehicleTypes([
      ...vehicleTypes,
      { id: Date.now().toString(), city: "", wheels: "4" }
    ]);
  };

  const removeVehicleType = (id: string) => {
    if (vehicleTypes.length > 1) {
      setVehicleTypes(vehicleTypes.filter(v => v.id !== id));
    }
  };

  const handleNext = () => {
    if (activeTab === "vehicle") {
      setActiveTab("bank");
    } else if (activeTab === "bank") {
      setActiveTab("id");
    } else if (activeTab === "id") {
      // Go to create bidding post page
      navigate("/create-bidding-post");
    }
  };

  const getButtonText = () => {
    if (activeTab === "id") {
      return "เสร็จสิ้น";
    }
    return "ถัดไป";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium">ข้อมูลผู้ขับเพิ่มเติม</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-white border-b rounded-none h-auto p-0">
          <TabsTrigger 
            value="vehicle" 
            className="flex-1 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:bg-white px-4 py-3"
          >
            ข้อมูลรถและงานที่ทำ
          </TabsTrigger>
          <TabsTrigger 
            value="bank"
            className="flex-1 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:bg-white px-4 py-3"
          >
            ข้อมูลธนาคาร
          </TabsTrigger>
          <TabsTrigger 
            value="id"
            className="flex-1 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:bg-white px-4 py-3"
          >
            เลขประจำตัว
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Vehicle and Job Info */}
        <TabsContent value="vehicle" className="p-4 space-y-6 mt-0">
          {/* Province */}
          <div className="space-y-2">
            <Select>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="จังหวัด" />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="bangkok">กรุงเทพมหานคร</SelectItem>
                <SelectItem value="nonthaburi">นนทบุรี</SelectItem>
                <SelectItem value="pathumthani">ปทุมธานี</SelectItem>
                <SelectItem value="samutprakarn">สมุทรปราการ</SelectItem>
                <SelectItem value="chiangmai">เชียงใหม่</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transport Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              <Label>ประเภทการขนส่ง</Label>
              <span className="text-red-500">*</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="charter" />
                <label htmlFor="charter" className="text-sm">เหมาเที่ยว</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cargo" />
                <label htmlFor="cargo" className="text-sm">กระชายสินค้า</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="express" />
                <label htmlFor="express" className="text-sm">Express</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="crossborder" />
                <label htmlFor="crossborder" className="text-sm">Cross Border</label>
              </div>
            </div>
          </div>

          {/* Vehicle Types */}
          {vehicleTypes.map((vehicle, index) => (
            <div 
              key={vehicle.id} 
              className="border-2 border-primary rounded-lg p-4 space-y-4 bg-white relative"
            >
              <div className="text-primary font-medium mb-3">
                ประเภทรถและขนของคุณ
              </div>
              
              <div className="space-y-2">
                <Input 
                  placeholder="กะเปาเมือง" 
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Select defaultValue="4">
                  <SelectTrigger className="bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="4">4 ล้อ</SelectItem>
                    <SelectItem value="6">6 ล้อ ทั้งเล็ม</SelectItem>
                    <SelectItem value="10">10 ล้อ</SelectItem>
                    <SelectItem value="12">12 ล้อ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {vehicleTypes.length > 1 && (
                <button
                  onClick={() => removeVehicleType(vehicle.id)}
                  className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}

          {/* Add Vehicle Button */}
          <Button
            variant="outline"
            onClick={addVehicleType}
            className="w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มประเภทรถ
          </Button>
        </TabsContent>

        {/* Tab 2: Bank Info */}
        <TabsContent value="bank" className="p-4 space-y-6 mt-0">
          <div className="space-y-4">
            <h3 className="font-medium">ข้อมูลธนาคาร</h3>
            
            <div className="space-y-2">
              <Label className="text-gray-500 text-sm">ชื่อธนาคาร</Label>
              <Input 
                placeholder="กสิกรไทย" 
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-500 text-sm">ชื่อบัญชี</Label>
              <Input 
                placeholder="สมชาย มากมี" 
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-500 text-sm">เลขที่บัญชี</Label>
              <Input 
                placeholder="0987654321" 
                className="bg-white"
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: ID Number */}
        <TabsContent value="id" className="p-4 space-y-6 mt-0">
          <div className="space-y-4">
            <h3 className="font-medium">เลขประจำตัว</h3>
            
            <div className="space-y-2">
              <Label className="text-gray-500 text-sm">เลขบัตรประชาชน</Label>
              <Input 
                placeholder="1234567890123" 
                className="bg-white"
                maxLength={13}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-500 text-sm">เลขใบขับขี่</Label>
              <Input 
                placeholder="12345678" 
                className="bg-white"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          onClick={handleNext}
          className="w-full bg-primary hover:bg-primary/90 text-white h-12 rounded-full"
        >
          {getButtonText()}
          <span className="ml-2">→</span>
        </Button>
      </div>

      {/* Spacer for fixed button */}
      <div className="h-20"></div>
    </div>
  );
};

export default RegisterDriver;