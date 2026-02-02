import { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, Copy, Check, Lock } from "lucide-react";
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
  price?: number;
  price_hint?: number | null; // Fee to reveal market price (ค่า Hint)
  market_price?: number | null; // The market/middle price (ราคากลาง)
}

interface MultiBidPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobs: Job[];
  onSuccess: () => void;
}

// Default bidding fee per job (required)
const BIDDING_FEE_PER_JOB = 100;

// Bank account info
const BANK_INFO = {
  bankName: "ธนาคารกสิกรไทย",
  accountName: "บริษัท เอสเอสแอล โลจิสติกส์ จำกัด",
  accountNumber: "719-1-01475-2",
  accountNumberNormalized: "7191014752",
};


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
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track which jobs have paid hint fee to view market price
  const [paidHintJobs, setPaidHintJobs] = useState<Set<string>>(new Set());

  // Check hint payment status when modal opens
  useEffect(() => {
    const checkHintPaymentStatus = async () => {
      if (!open || !user || selectedJobs.length === 0) return;
      
      const paidJobIds = new Set<string>();
      
      try {
        // Check payment status for each job that has a hint fee
        const jobsWithHint = selectedJobs.filter(job => job.price_hint && job.price_hint > 0 && job.market_price);
        
        await Promise.all(
          jobsWithHint.map(async (job) => {
            try {
              // Use POST with action: 'check_status' since supabase.functions.invoke always uses POST
              const { data, error } = await supabase.functions.invoke('submit-price-hint', {
                body: {
                  ticket_id: job.id,
                  contractor_id: user.id,
                  action: 'check_status',
                },
              });
              
              if (!error && data?.paid === true) {
                paidJobIds.add(job.id);
                console.log(`Hint already paid for ticket ${job.id}`);
              }
            } catch (err) {
              console.error(`Error checking hint status for ${job.id}:`, err);
            }
          })
        );
        
        if (paidJobIds.size > 0) {
          setPaidHintJobs(prev => new Set([...prev, ...paidJobIds]));
        }
      } catch (err) {
        console.error('Error checking hint payment statuses:', err);
      }
    };
    
    checkHintPaymentStatus();
  }, [open, user, selectedJobs]);

  // Calculate total bidding fees (100 THB per job - always required)
  const totalBiddingFees = selectedJobs.length * BIDDING_FEE_PER_JOB;

  const handleBidAmountChange = (jobId: string, value: string) => {
    setBidAmounts((prev) => ({ ...prev, [jobId]: value }));
  };

  const handleCopyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(BANK_INFO.accountNumber.replace(/-/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: t("common.copied"),
        description: BANK_INFO.accountNumber,
      });
    } catch (err) {
      console.error("Failed to copy:", err);
    }
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
    // Validate all bid amounts (skip free jobs)
    for (const job of selectedJobs) {
      const isFreeJob = !job.price || job.price === 0;
      if (!isFreeJob) {
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
          const isFreeJob = !job.price || job.price === 0;
          const payload = {
            ticket_id: job.id,
            contractor_id: user.id,
            bid_price: isFreeJob ? 0 : parseFloat(bidAmounts[job.id]),
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
    // Free jobs don't need bid amount validation
    if (!job.price || job.price === 0) return true;
    const amount = parseFloat(bidAmounts[job.id] || "0");
    return !isNaN(amount) && amount > 0;
  });

  // Calculate total bid amount
  const totalBidAmount = selectedJobs.reduce((sum, job) => {
    const isFreeJob = !job.price || job.price === 0;
    if (isFreeJob) return sum;
    const amount = parseFloat(bidAmounts[job.id] || "0");
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  // Grand total = total bid amount + bidding fees (hint fees are optional and separate)
  const grandTotal = totalBidAmount + totalBiddingFees;

  const formatPrice = (price?: number | null) => {
    if (!price || price === 0) return t("common.free") || "ฟรี";
    return `฿${price.toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={coinsIcon} alt="coins" className="w-6 h-6" />
            {selectedJobs.length === 1 ? t("bidding.placeBid") : t("bidding.multiBidTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bank Transfer Info */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
            <div className="space-y-2">
                <p className="font-semibold">{t("bidding.bankTransferInfo")}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-80">{t("bidding.bankName")}:</span>
                    <span className="font-medium">{BANK_INFO.bankName}</span>
                  </div>
                  <div>
                    <span className="opacity-80">{t("bidding.accountName")}:</span>
                    <span className="font-medium ml-2">{BANK_INFO.accountName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-80">{t("bidding.accountNumber")}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{BANK_INFO.accountNumber}</span>
                      <button
                        onClick={handleCopyAccountNumber}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/20">
                    <span className="opacity-80">{t("bidding.biddingFeeTotal")}:</span>
                    <span className="font-bold">฿{totalBiddingFees.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/20">
                    <span className="opacity-80">{t("bidding.transferAmount")}:</span>
                    <span className="font-bold text-lg">฿{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
          </div>

          {/* Bid Amounts for Each Job */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("bidding.enterBidAmounts")}</p>
            {selectedJobs.map((job) => {
              const isFreeJob = !job.market_price && (!job.price || job.price === 0);
              const hasPaidHint = paidHintJobs.has(job.id);
              const marketPrice = job.market_price;
              
              return (
                <div key={job.id} className="bg-card border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{job.order_code}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {job.origin_location} → {job.destination_location}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-xs text-muted-foreground">{t("bidding.marketPrice")}</p>
                      {hasPaidHint || isFreeJob || !marketPrice ? (
                        <p className={`text-sm font-semibold ${isFreeJob ? "text-emerald-600" : "text-primary"}`}>
                          {marketPrice ? formatPrice(marketPrice) : formatPrice(job.price)}
                        </p>
                      ) : (
                        <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          <span>฿???</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!isFreeJob && (
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
                  )}
                  {/* Always show bidding fee */}
                  <p className="text-xs text-muted-foreground">
                    {t("bidding.biddingFee")}: <span className="font-medium text-foreground">฿{BIDDING_FEE_PER_JOB}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Total Summary */}
          <div className="bg-primary/10 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("bidding.yourBidTotal")}</span>
              <span className="font-medium">฿{totalBidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("bidding.biddingFee")} ({selectedJobs.length} {t("bidding.jobs")} × ฿{BIDDING_FEE_PER_JOB})</span>
              <span className="font-medium">฿{totalBiddingFees.toLocaleString()}</span>
            </div>
            <div className="border-t border-primary/20 pt-2 flex justify-between">
              <span className="font-semibold">{t("bidding.grandTotal")}</span>
              <span className="font-bold text-lg text-primary">฿{grandTotal.toLocaleString()}</span>
            </div>
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
