import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Upload, Trash2, CheckCircle } from "lucide-react";

const CreateBiddingPost = () => {
  const navigate = useNavigate();
  const [idCardNumber, setIdCardNumber] = useState("");
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  const handleIdCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIdCardFile(e.target.files[0]);
    }
  };

  const handleLicenseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLicenseFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    setShowSuccessScreen(true);
  };

  const handleGoToManagement = () => {
    navigate("/home");
  };

  if (showSuccessScreen) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="bg-primary h-28"></div>

        {/* Success Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-14">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </div>

          <h2 className="text-xl font-medium text-gray-900 mb-4">
            เพิ่มข้อมูลสำเร็จ
          </h2>

          <p className="text-center text-gray-600 leading-relaxed">
            ข้อมูลรถและผู้ขับขี่ได้รับการบันทึก
            <br />
            เรียบร้อยแล้ว
            <br />
            <span className="text-primary">
              คุณสามารถตรวจสอบและจัดการ
              <br />
              รายการรถทั้งหมดได้ที่เมนู
              <br />
              "จัดการรถ"
            </span>
          </p>
        </div>

        {/* Bottom Button */}
        <div className="p-4 pb-8">
          <Button
            onClick={handleGoToManagement}
            className="w-full bg-primary hover:bg-primary/90 text-white h-12 rounded-full"
          >
            ไปยังเมนูจัดการรถ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium">ข้อมูลผู้ขับเพิ่มเติม</h1>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* ID Card Number */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label className="text-primary">สำเนาบัตรประชาชน</Label>
            <span className="text-red-500">*</span>
          </div>
          <Input
            placeholder="หมายเลขบัตรประชาชน 13 หลัก"
            value={idCardNumber}
            onChange={(e) => setIdCardNumber(e.target.value)}
            maxLength={13}
            className="bg-white"
          />
        </div>

        {/* ID Card Upload */}
        <div className="space-y-3">
          <input
            type="file"
            id="id-card-upload"
            accept="image/jpeg,image/png"
            onChange={handleIdCardUpload}
            className="hidden"
          />
          
          {!idCardFile ? (
            <label
              htmlFor="id-card-upload"
              className="border-2 border-dashed border-primary rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-primary mb-3" />
              <p className="text-gray-900 font-medium mb-1">กดเพื่อเลือกไฟล์</p>
              <p className="text-gray-400 text-sm">JPEG, PNG formats, up to 20MB</p>
            </label>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <span className="text-sm text-gray-700">{idCardFile.name}</span>
              <button
                onClick={() => setIdCardFile(null)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* License Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            <Label className="text-primary">ใบชั้บิธรณวรรณาก</Label>
            <span className="text-red-500">*</span>
          </div>

          <input
            type="file"
            id="license-upload"
            accept="image/jpeg,image/png"
            onChange={handleLicenseUpload}
            className="hidden"
          />
          
          {!licenseFile ? (
            <label
              htmlFor="license-upload"
              className="border-2 border-dashed border-primary rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-primary mb-3" />
              <p className="text-gray-900 font-medium mb-1">กดเพื่อเลือกไฟล์</p>
              <p className="text-gray-400 text-sm">JPEG, PNG formats, up to 20MB</p>
            </label>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <span className="text-sm text-gray-700">{licenseFile.name}</span>
              <button
                onClick={() => setLicenseFile(null)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreeTerms}
              onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
            />
            <label htmlFor="terms" className="text-sm leading-relaxed">
              ฉันได้อ่านและยอมรับ<span className="text-yellow-500">ข้อกำหนดการใช้งาน</span>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy"
              checked={agreePrivacy}
              onCheckedChange={(checked) => setAgreePrivacy(checked as boolean)}
            />
            <label htmlFor="privacy" className="text-sm leading-relaxed">
              ฉันได้อ่านและยอมรับ<span className="text-yellow-500">นโยบายคุ้มครองข้อมูลส่วนบุคคล</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button
          onClick={handleSubmit}
          disabled={!idCardNumber || !idCardFile || !licenseFile || !agreeTerms || !agreePrivacy}
          className="w-full bg-primary hover:bg-primary/90 text-white h-12 rounded-full disabled:opacity-50"
        >
          เพิ่มข้อมูล
        </Button>
      </div>

      {/* Spacer for fixed button */}
      <div className="h-20"></div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm mx-4 rounded-2xl">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-3xl text-blue-500">!</span>
              </div>
            </div>
            <AlertDialogTitle className="text-center text-lg">
              ยืนยันการบันทึกข้อมูลผู้ขับขี่
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-600 leading-relaxed">
              ข้อมูลผู้ขับขี่ที่กรอกทั้งหมด
              <br />
              ได้รับการตรวจสอบความถูกต้องและครบถ้วน
              <br />
              เรียบร้อยแล้วใช่หรือไม่?
              <br />
              ในจุดตรวจสอบอีกครั้งก่อนบันทึก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 rounded-full border-2 border-primary text-primary hover:bg-primary/5"
            >
              กลับไปตรวจสอบ
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-white"
            >
              ยืนยันและบันทึก
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreateBiddingPost;
