import { useState } from "react";
import { ArrowLeft, Plus, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VehicleType {
  id: string;
  destination: string;
  vehicleSize: string;
}

const RegisterDriver = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("info");
  
  // Form states
  const [thaiName, setThaiName] = useState("");
  const [nickname, setNickname] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [province, setProvince] = useState("");
  const [transportTypes, setTransportTypes] = useState({
    charter: false,
    express: false,
    crossBorder: false,
    货运: false,
  });
  const [vehicles, setVehicles] = useState<VehicleType[]>([
    { id: "1", destination: "", vehicleSize: "4 ล้อ พื้นเรียบ" }
  ]);

  const addVehicle = () => {
    setVehicles([
      ...vehicles,
      { id: Date.now().toString(), destination: "", vehicleSize: "4 ล้อ พื้นเรียบ" }
    ]);
  };

  const removeVehicle = (id: string) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter(v => v.id !== id));
    }
  };

  const updateVehicle = (id: string, field: keyof VehicleType, value: string) => {
    setVehicles(vehicles.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const handleNext = () => {
    if (activeTab === "info") {
      setActiveTab("bank");
    } else if (activeTab === "bank") {
      setActiveTab("id");
    } else {
      // Submit form
      navigate("/home");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-medium">ข้อมูลผู้ขับเพิ่มเติม</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-background border-b rounded-none h-auto p-0">
            <TabsTrigger 
              value="info" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 text-xs"
            >
              ข้อมูลจนระหวนกันคำ
            </TabsTrigger>
            <TabsTrigger 
              value="bank" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 text-xs"
            >
              ข้อมูลธนาคาร
            </TabsTrigger>
            <TabsTrigger 
              value="id" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3 text-xs"
            >
              เลขประจำตัว
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Personal Info */}
          <TabsContent value="info" className="p-4 space-y-4">
            <div className="space-y-4">
              <h2 className="text-base font-medium text-foreground">ข้อมูลอนาคาร</h2>
              
              <div className="space-y-2">
                <Label htmlFor="thaiName" className="text-xs text-muted-foreground">
                  ชื่อภาษาไทย
                </Label>
                <Input
                  id="thaiName"
                  placeholder="กสิกรไทย"
                  value={thaiName}
                  onChange={(e) => setThaiName(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-xs text-muted-foreground">
                  ชื่อบุคคล
                </Label>
                <Input
                  id="nickname"
                  placeholder="สมชาย มากมี"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-xs text-muted-foreground">
                  เลขที่โมบาย
                </Label>
                <Input
                  id="mobile"
                  placeholder="0987654321"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Transport Info */}
          <TabsContent value="bank" className="p-4 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">จังหวัด</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="จังหวัด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bangkok">กรุงเทพมหานคร</SelectItem>
                    <SelectItem value="chiangmai">เชียงใหม่</SelectItem>
                    <SelectItem value="phuket">ภูเก็ต</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">
                  ประเภทการขนส่ง <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="charter"
                      checked={transportTypes.charter}
                      onCheckedChange={(checked) =>
                        setTransportTypes({ ...transportTypes, charter: checked as boolean })
                      }
                    />
                    <label htmlFor="charter" className="text-sm">
                      เหมาเที่ยว
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="货运"
                      checked={transportTypes.货运}
                      onCheckedChange={(checked) =>
                        setTransportTypes({ ...transportTypes, 货运: checked as boolean })
                      }
                    />
                    <label htmlFor="货运" className="text-sm">
                      กระชายสินค้า
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="express"
                      checked={transportTypes.express}
                      onCheckedChange={(checked) =>
                        setTransportTypes({ ...transportTypes, express: checked as boolean })
                      }
                    />
                    <label htmlFor="express" className="text-sm">
                      Express
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="crossBorder"
                      checked={transportTypes.crossBorder}
                      onCheckedChange={(checked) =>
                        setTransportTypes({ ...transportTypes, crossBorder: checked as boolean })
                      }
                    />
                    <label htmlFor="crossBorder" className="text-sm">
                      Cross Border
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">ประเภทกรอบส่งของคุณ</Label>
                {vehicles.map((vehicle, index) => (
                  <div key={vehicle.id} className="border-2 border-primary/30 rounded-lg p-3 space-y-3 bg-primary/5">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">กาเมืองเงล</Label>
                      <Input
                        placeholder="กาเมืองเงล"
                        value={vehicle.destination}
                        onChange={(e) => updateVehicle(vehicle.id, "destination", e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={vehicle.vehicleSize}
                          onValueChange={(value) => updateVehicle(vehicle.id, "vehicleSize", value)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4 ล้อ พื้นเรียบ">4 ล้อ พื้นเรียบ</SelectItem>
                            <SelectItem value="4 ล้อ">4 ล้อ</SelectItem>
                            <SelectItem value="6 ล้อ">6 ล้อ</SelectItem>
                            <SelectItem value="10 ล้อ">10 ล้อ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {vehicles.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVehicle(vehicle.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addVehicle}
                  className="w-auto"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  เพิ่มประเภทกร
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: ID Info */}
          <TabsContent value="id" className="p-4 space-y-4">
            <div className="space-y-4">
              <h2 className="text-base font-medium text-foreground">เลขประจำตัว</h2>
              
              <div className="space-y-2">
                <Label htmlFor="idNumber" className="text-xs text-muted-foreground">
                  เลขบัตรประชาชน
                </Label>
                <Input
                  id="idNumber"
                  placeholder="1234567890123"
                  maxLength={13}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseNumber" className="text-xs text-muted-foreground">
                  เลขที่ใบขับขี่
                </Label>
                <Input
                  id="licenseNumber"
                  placeholder="12345678"
                  className="bg-white"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <div className="max-w-md mx-auto">
          <Button 
            onClick={handleNext}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full h-12"
          >
            ถัดไป
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-24" />
    </div>
  );
};

export default RegisterDriver;