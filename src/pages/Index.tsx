import { Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="flex justify-center mb-8">
          <div className="rounded-2xl bg-primary/10 p-6">
            <Shield className="w-16 h-16 text-primary" />
          </div>
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          SSL Marketplace
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          โปรเจคพร้อมสำหรับทีมเข้ามาพัฒนา
        </p>
        <div className="pt-4">
          <p className="text-sm text-muted-foreground">
            เริ่มสร้างโปรเจคของคุณได้เลย
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
