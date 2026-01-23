import { useState, useRef } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import coinsIcon from "@/assets/coins-icon.png";

interface Job {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  destination_location: string;
}

interface MultiBidPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobs: Job[];
  onSuccess: () => void;
}

const DEPOSIT_PER_JOB = 100;

export function MultiBidPaymentModal({
  open,
  onOpenChange,
  selectedJobs,
  onSuccess,
}: MultiBidPaymentModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalDeposit = selectedJobs.length * DEPOSIT_PER_JOB;

  const handleBidAmountChange = (jobId: string, value: string) => {
    setBidAmounts((prev) => ({ ...prev, [jobId]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: t("placeBid.invalidFileType"),
        description: t("placeBid.pleaseUploadImage"),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("placeBid.fileTooLarge"),
        description: t("placeBid.maxFileSize"),
        variant: "destructive",
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSlipImage(previewUrl);

    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSlip = () => {
    setSlipImage(null);
    setSlipBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    // Validate all bid amounts
    for (const job of selectedJobs) {
      const amount = parseFloat(bidAmounts[job.id] || "0");
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: t("placeBid.invalidPrice"),
          description: `${t("placeBid.enterValidPrice")} - ${job.order_code}`,
          variant: "destructive",
        });
        return;
      }
    }

    if (!slipBase64) {
      toast({
        title: t("placeBid.slipRequired"),
        description: t("placeBid.pleaseUploadSlip"),
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setIsSubmitting(true);

    try {
      const freelancerName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
      
      // Submit bids for all selected jobs
      const results = await Promise.allSettled(
        selectedJobs.map(async (job) => {
          const payload = {
            ticket_id: job.id,
            contractor_id: user.id,
            bid_price: parseFloat(bidAmounts[job.id]),
            payment_transaction_id: `TXN${Date.now()}_${job.id.slice(0, 8)}`,
            payment_slip_base64: slipBase64,
            freelancer_name: freelancerName,
            freelancer_phone: user.phone || "",
          };

          const { data, error } = await supabase.functions.invoke("create-bid-proxy", {
            body: payload,
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          return { jobId: job.id, success: true };
        })
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      if (successCount > 0) {
        toast({
          title: t("placeBid.success"),
          description: `${t("bidding.multiBidSuccess")} ${successCount} ${t("bidding.jobs")}`,
        });
      }

      if (failCount > 0) {
        toast({
          title: t("placeBid.error"),
          description: `${t("bidding.multiBidPartialFail")} ${failCount} ${t("bidding.jobs")}`,
          variant: "destructive",
        });
      }

      // Reset state
      setBidAmounts({});
      setSlipImage(null);
      setSlipBase64(null);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Error submitting bids:", err);
      toast({
        title: t("placeBid.error"),
        description: t("placeBid.submitError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allBidsValid = selectedJobs.every((job) => {
    const amount = parseFloat(bidAmounts[job.id] || "0");
    return !isNaN(amount) && amount > 0;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={coinsIcon} alt="coins" className="w-6 h-6" />
            {t("bidding.multiBidTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Jobs Summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-2">
              {t("bidding.selectedJobs")}: <span className="font-semibold text-foreground">{selectedJobs.length}</span>
            </p>
            <div className="flex justify-between items-center">
              <span className="text-sm">{t("bidding.totalDeposit")}</span>
              <span className="text-lg font-bold text-primary">฿{totalDeposit.toLocaleString()}</span>
            </div>
          </div>

          {/* Bid Amounts for Each Job */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("bidding.enterBidAmounts")}</p>
            {selectedJobs.map((job) => (
              <div key={job.id} className="bg-card border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{job.order_code}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {job.origin_location} → {job.destination_location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">฿</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={t("placeBid.priceLabel")}
                    value={bidAmounts[job.id] || ""}
                    onChange={(e) => handleBidAmountChange(job.id, e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Payment Slip Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("placeBid.paymentSlip")} <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground">{t("placeBid.depositDescription")}</p>

            {slipImage ? (
              <div className="relative">
                <img
                  src={slipImage}
                  alt="Payment slip"
                  className="w-full max-h-48 object-contain rounded-lg border"
                />
                <button
                  onClick={handleRemoveSlip}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm">{t("placeBid.uploadSlipHint")}</span>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || !allBidsValid || !slipBase64}
          >
            {isSubmitting ? t("placeBid.submitting") : t("bidding.confirmMultiBid")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
