import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface TermsStepProps {
  onNext: (data: any) => void;
}

const TermsStep = ({ onNext }: TermsStepProps) => {
  const handleAccept = () => {
    onNext({});
  };
  const [canAccept, setCanAccept] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (isAtBottom) {
      setCanAccept(true);
    }
  };

  return (
    <div className="flex flex-col max-h-[calc(100vh-200px)]">
      <div className="text-center mb-6 flex-shrink-0">
        <h2 className="text-xl font-bold text-foreground mb-2">
          Truckers นโยบายความเป็นส่วนตัวของผู้ขับรถ
        </h2>
        <p className="text-sm text-muted-foreground">
          มีผลบังคับเมื่อวันที่ 15 มกราคม 2567
        </p>
      </div>

      <div 
        className="flex-1 overflow-y-auto space-y-6 text-sm text-foreground mb-6 pr-2"
        onScroll={handleScroll}
        style={{ maxHeight: 'calc(100vh - 350px)' }}
      >
        <section>
          <h3 className="font-semibold mb-2">ข้อมูลที่เรารวบรวม</h3>
          <p className="mb-2">
            เรารวบรวมข้อมูลที่จำเป็นสำหรับการให้บริการแอป Truckers แก่ผู้ขับรถ 
            ซึ่งรวมถึงข้อมูลที่คุณให้โดยตรงและข้อมูลที่เรารวบรวมจากการใช้แอป เช่น:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>ข้อมูลส่วนบุคคล</strong> : เช่น ชื่อ, อีเมล, เบอร์โทรศัพท์, 
              และข้อมูลบัญชีที่เกี่ยวข้องกับการขนส่ง
            </li>
            <li>
              <strong>ข้อมูลการขับขี่</strong> : รวมถึงข้อมูลเกี่ยวกับการเดินทาง, 
              ตำแหน่งที่ตั้ง (GPS), ความเร็ว, เส้นทางที่เลือก, เวลาเริ่มต้นและสิ้นสุดการขนส่ง
            </li>
            <li>
              <strong>ข้อมูลรถ</strong> : รวมถึงหมายเลขทะเบียนรถ, ประเภทของรถ, 
              และข้อมูลที่เกี่ยวข้องกับสภาพของรถบรรทุก
            </li>
            <li>
              <strong>ข้อมูลทางการเงิน</strong> : ข้อมูลที่ใช้สำหรับการชำระเงิน เช่น 
              รายละเอียดบัญชีธนาคารหรือข้อมูลบัตรเครดิต
            </li>
            <li>
              <strong>ข้อมูลการสื่อสาร</strong> : ข้อความ, การพูดคุย, 
              หรือการติดต่อผ่านแอปที่เกี่ยวข้องกับการให้บริการ
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-2">วิธีการใช้ข้อมูล</h3>
          <p className="mb-2">เราจะใช้ข้อมูลของคุณในหลายๆ ด้าน เช่น:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>การประมวลผลคำขอขนส่งสินค้า</li>
            <li>การคำนวณค่าบริการและการชำระเงิน</li>
            <li>การปรับปรุงการให้บริการและการพัฒนาแอป</li>
            <li>การติดต่อคุณเพื่อให้ข้อมูลเกี่ยวกับสถานะการขนส่งหรือแจ้งเตือน</li>
            <li>การปรับปรุงประสบการณ์การใช้งานของคุณ</li>
            <li>การปฏิบัติตามข้อกำหนดทางกฎหมาย</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-2">การแชร์ข้อมูล</h3>
          <p className="mb-2">
            เราจะไม่แชร์ข้อมูลส่วนบุคคลของคุณกับบุคคลภายนอก ยกเว้นในกรณีดังต่อไปนี้:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>ผู้ให้บริการที่เราจ้าง</strong> : บริษัทหรือบุคคลที่เราใช้บริการ
              ในด้านต่างๆ (เช่น บริการชำระเงิน, การวิเคราะห์ข้อมูล) 
              ซึ่งมีข้อกำหนดความเป็นส่วนตัวที่ปกป้องข้อมูลของคุณ
            </li>
            <li>
              <strong>การปฏิบัติตามกฎหมาย</strong> : ในกรณีที่เราถูกบังคับตามกฎหมาย 
              เช่น การให้ข้อมูลแก่หน่วยงานราชการ หรือการปฏิบัติตามคำสั่งศาล
            </li>
            <li>
              <strong>การแชร์ข้อมูลที่ไม่สามารถระบุตัวตน</strong> : เช่น ข้อมูลทางสถิติ 
              ที่ไม่ระบุตัวตนหรือข้อมูลที่ใช้ในการวิเคราะห์เพื่อพัฒนาแอป
            </li>
          </ul>
        </section>

        <div className="h-20" />
      </div>

      <div className="flex-shrink-0 pt-4 border-t border-border">
        <Button
          onClick={handleAccept}
          disabled={!canAccept}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-medium disabled:bg-muted disabled:text-muted-foreground"
        >
          {canAccept ? "ยอมรับ" : "เลื่อนลงจนสุดเพื่อดำเนินการต่อ"}
        </Button>
        {!canAccept && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            กรุณาเลื่อนอ่านข้อกำหนดจนจบเพื่อดำเนินการต่อ
          </p>
        )}
      </div>
    </div>
  );
};

export default TermsStep;
