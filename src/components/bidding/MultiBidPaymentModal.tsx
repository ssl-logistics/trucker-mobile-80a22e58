import { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, Copy, Check, Lock, Eye, Loader2, AlertCircle, CheckCircle2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createBid } from "@/lib/externalApi";
import { toast } from "@/hooks/use-toast";
import { useOCR } from "@/hooks/useOCR";
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

// Hint payment API endpoint
// Use our edge function proxy instead of calling external API directly
// This ensures API key is kept secure on the server side

// OCR validation result interface
interface OCRValidation {
  isValidating: boolean;
  validated: boolean;
  amountMatches: boolean | null;
  accountMatches: boolean | null;
  extractedAmount: number | null;
  extractedAccount: string | null;
  extractedBankName: string | null;
  extractedReceiverName: string | null;
  error: string | null;
}

export function MultiBidPaymentModal({
  open,
  onOpenChange,
  selectedJobs,
  onSuccess,
}: MultiBidPaymentModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { extractFromBase64 } = useOCR();
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track which jobs have paid hint fee to view market price
  const [paidHintJobs, setPaidHintJobs] = useState<Set<string>>(new Set());
  const [checkingHintStatus, setCheckingHintStatus] = useState(false);
  const [pendingPaymentJobId, setPendingPaymentJobId] = useState<string | null>(null);
  
  // Hint payment slip state (separate from main bidding slip)
  const [hintSlipBase64, setHintSlipBase64] = useState<string | null>(null);
  const [hintSlipPreview, setHintSlipPreview] = useState<string | null>(null);
  const [isPayingHint, setIsPayingHint] = useState(false);
  const hintFileInputRef = useRef<HTMLInputElement>(null);
  
  // OCR validation state for hint payment
  const [hintOCRValidation, setHintOCRValidation] = useState<OCRValidation>({
    isValidating: false,
    validated: false,
    amountMatches: null,
    accountMatches: null,
    extractedAmount: null,
    extractedAccount: null,
    extractedBankName: null,
    extractedReceiverName: null,
    error: null,
  });

  // Check hint payment status when modal opens
  useEffect(() => {
    const checkHintPaymentStatus = async () => {
      if (!open || !user || selectedJobs.length === 0) return;
      
      setCheckingHintStatus(true);
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
      } finally {
        setCheckingHintStatus(false);
      }
    };
    
    checkHintPaymentStatus();
  }, [open, user, selectedJobs]);

  // Calculate total bidding fees (100 THB per job - always required)
  const totalBiddingFees = selectedJobs.length * BIDDING_FEE_PER_JOB;

  // Calculate total hint fees (optional - only for viewing market price)
  const totalHintFees = selectedJobs.reduce((sum, job) => {
    return sum + (job.price_hint || 0);
  }, 0);

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

  // Handle hint slip file selection with OCR validation
  const handleHintSlipChange = async (e: React.ChangeEvent<HTMLInputElement>, expectedHintFee: number) => {
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
    setHintSlipPreview(previewUrl);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setHintSlipBase64(base64);
      
      // Reset and start OCR validation
      setHintOCRValidation({
        isValidating: true,
        validated: false,
        amountMatches: null,
        accountMatches: null,
        extractedAmount: null,
        extractedAccount: null,
        extractedBankName: null,
        extractedReceiverName: null,
        error: null,
      });
      
      try {
        const result = await extractFromBase64(base64, 'payment_slip', {
          expected_amount: expectedHintFee,
          expected_account_number: BANK_INFO.accountNumberNormalized,
        });
        
        if (result.success && result.data) {
          setHintOCRValidation({
            isValidating: false,
            validated: true,
            amountMatches: result.data.amount_matches ?? null,
            accountMatches: result.data.account_matches ?? null,
            extractedAmount: result.data.amount ?? null,
            extractedAccount: result.data.account_number ?? null,
            extractedBankName: result.data.bank_name ?? null,
            extractedReceiverName: result.data.receiver_name ?? null,
            error: null,
          });
        } else {
          setHintOCRValidation({
            isValidating: false,
            validated: false,
            amountMatches: null,
            accountMatches: null,
            extractedAmount: null,
            extractedAccount: null,
            extractedBankName: null,
            extractedReceiverName: null,
            error: result.error || "OCR validation failed",
          });
        }
      } catch (err) {
        console.error("OCR error:", err);
        setHintOCRValidation(prev => ({
          ...prev,
          isValidating: false,
          error: "Failed to validate slip",
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit hint payment to API
  const handlePayHint = async (jobId: string, hintFee: number) => {
    if (!user || !hintSlipBase64) {
      toast({
        title: t("placeBid.slipRequired"),
        description: t("placeBid.pleaseUploadSlip"),
        variant: "destructive",
      });
      return;
    }

    setIsPayingHint(true);
    try {
      // Call our edge function proxy which adds API key securely
      const { data, error } = await supabase.functions.invoke("submit-price-hint", {
        body: {
          ticket_id: jobId,
          contractor_id: user.id,
          price_hint: hintFee,
          transaction_id: `TXN${Date.now()}_HINT_${jobId.slice(0, 8)}`,
          slip_base64: hintSlipBase64,
        },
      });

      if (error) {
        throw error;
      }

      // Mark as paid and reveal market price
      setPaidHintJobs(prev => new Set([...prev, jobId]));
      setPendingPaymentJobId(null);
      setHintSlipBase64(null);
      setHintSlipPreview(null);
      
      toast({
        title: t("bidding.hintPaid"),
        description: t("bidding.priceNowVisible"),
      });
      
      // Reset OCR validation
      setHintOCRValidation({
        isValidating: false,
        validated: false,
        amountMatches: null,
        accountMatches: null,
        extractedAmount: null,
        extractedAccount: null,
        extractedBankName: null,
        extractedReceiverName: null,
        error: null,
      });
    } catch (err) {
      console.error("Error submitting hint payment:", err);
      toast({
        title: t("placeBid.error"),
        description: err instanceof Error ? err.message : t("placeBid.submitError"),
        variant: "destructive",
      });
    } finally {
      setIsPayingHint(false);
    }
  };

  // Clear hint slip when canceling
  const handleCancelHintPayment = () => {
    setPendingPaymentJobId(null);
    setHintSlipBase64(null);
    setHintSlipPreview(null);
    setHintOCRValidation({
      isValidating: false,
      validated: false,
      amountMatches: null,
      accountMatches: null,
      extractedAmount: null,
      extractedAccount: null,
      extractedBankName: null,
      extractedReceiverName: null,
      error: null,
    });
    if (hintFileInputRef.current) {
      hintFileInputRef.current.value = "";
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
          // Always send the entered bid amount (or 0 if not entered)
          const bidAmount = parseFloat(bidAmounts[job.id] || "0");
          const payload = {
            ticket_id: job.id,
            contractor_id: user.id,
            bid_price: isNaN(bidAmount) ? 0 : bidAmount,
            payment_transaction_id: `TXN${Date.now()}_${job.id.slice(0, 8)}`,
            payment_slip_base64: slipBase64,
            freelancer_name: freelancerName,
            freelancer_phone: user.phone || "",
          };

          const result = await createBid(payload);

          if (result.error) throw new Error(result.error);
          if (result.data?.error) throw new Error(result.data.error);
          
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

  // Calculate total bid amount from all entered bid amounts
  const totalBidAmount = selectedJobs.reduce((sum, job) => {
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
              const isFreeJob = !job.price || job.price === 0;
              const hasPaidHint = paidHintJobs.has(job.id);
              const isPendingPayment = pendingPaymentJobId === job.id;
              const hintFee = job.price_hint || 0;
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
                      {/* Show market price only if: hint is paid, no hint fee required, or no market price exists */}
                      {hasPaidHint || !marketPrice || hintFee <= 0 ? (
                        <p className={`text-sm font-semibold ${(!job.price || job.price === 0) ? "text-emerald-600" : "text-primary"}`}>
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
                  
                  {/* Pay to view price button - shown when price is hidden and has hint fee */}
                  {!hasPaidHint && marketPrice && hintFee > 0 && !isPendingPayment && (
                    <button
                      onClick={() => setPendingPaymentJobId(job.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t("bidding.payToViewPrice")} (฿{hintFee})
                    </button>
                  )}
                  
                  {/* Hint payment section for viewing market price */}
                  {isPendingPayment && !hasPaidHint && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            {t("bidding.payHintToViewPrice")}
                          </p>
                          <p className="text-xs text-amber-700">
                            {t("bidding.hintFee")}: <span className="font-bold">฿{hintFee}</span>
                          </p>
                        </div>
                      </div>
                      
                      {/* Hint slip upload */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-amber-900">{t("placeBid.paymentSlip")}</p>
                          {hintOCRValidation.isValidating && (
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                              <ScanLine className="w-3 h-3 animate-pulse" />
                              <span>กำลังตรวจสอบสลิป...</span>
                            </div>
                          )}
                        </div>
                        {hintSlipPreview ? (
                          <div className="relative">
                            <img
                              src={hintSlipPreview}
                              alt="Hint payment slip"
                              className="w-full max-h-32 object-contain rounded-lg border border-amber-200"
                            />
                            <button
                              onClick={() => {
                                setHintSlipPreview(null);
                                setHintSlipBase64(null);
                                setHintOCRValidation({
                                  isValidating: false,
                                  validated: false,
                                  amountMatches: null,
                                  accountMatches: null,
                                  extractedAmount: null,
                                  extractedAccount: null,
                                  extractedBankName: null,
                                  extractedReceiverName: null,
                                  error: null,
                                });
                                if (hintFileInputRef.current) {
                                  hintFileInputRef.current.value = "";
                                }
                              }}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => hintFileInputRef.current?.click()}
                            className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-100/50 transition-colors"
                          >
                            <div className="flex flex-col items-center gap-1 text-amber-600">
                              <ImageIcon className="w-6 h-6" />
                              <span className="text-xs">{t("placeBid.uploadSlipHint")}</span>
                            </div>
                          </div>
                        )}
                        <input
                          ref={hintFileInputRef}
                          type="file"
                          accept={ACCEPT_IMAGE_DOC}
                          onChange={(e) => handleHintSlipChange(e, hintFee)}
                          className="hidden"
                        />
                        
                        {/* OCR Validation Results */}
                        {hintSlipPreview && hintOCRValidation.validated && (
                          <div className="space-y-2 p-3 bg-white/80 rounded-lg border border-amber-200">
                            <p className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                              <ScanLine className="w-3.5 h-3.5" />
                              ผลการตรวจสอบสลิป
                            </p>
                            
                            {/* Amount check */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-800">ยอดโอน:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">
                                  {hintOCRValidation.extractedAmount !== null 
                                    ? `฿${hintOCRValidation.extractedAmount.toLocaleString()}` 
                                    : "ไม่พบข้อมูล"}
                                </span>
                                {hintOCRValidation.amountMatches === true && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                {hintOCRValidation.amountMatches === false && (
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                )}
                              </div>
                            </div>
                            
                            {/* Bank name */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-800">ธนาคาร:</span>
                              <span className="font-medium">
                                {hintOCRValidation.extractedBankName || "ไม่พบข้อมูล"}
                              </span>
                            </div>
                            
                            {/* Account name (receiver name) */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-800">ชื่อบัญชี:</span>
                              <span className="font-medium text-right max-w-[180px] truncate">
                                {hintOCRValidation.extractedReceiverName || "ไม่พบข้อมูล"}
                              </span>
                            </div>
                            
                            {/* Account number */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-800">เลขที่บัญชี:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">
                                  {hintOCRValidation.extractedAccount || "ไม่พบข้อมูล"}
                                </span>
                                {hintOCRValidation.accountMatches === true && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                {hintOCRValidation.accountMatches === false && (
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                )}
                              </div>
                            </div>
                            
                            {/* Validation summary */}
                            {(() => {
                              const amountOk = hintOCRValidation.amountMatches === true;
                              const accountOk = hintOCRValidation.accountMatches === true;
                              const allValid = amountOk && accountOk;
                              const hasErrors = hintOCRValidation.amountMatches === false || hintOCRValidation.accountMatches === false;
                              
                              if (hasErrors) {
                                return (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg space-y-1">
                                    <p className="text-xs text-red-700 font-medium flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      ข้อมูลไม่ตรง
                                    </p>
                                    {hintOCRValidation.amountMatches === false && (
                                      <p className="text-xs text-red-600">
                                        • ยอดโอนไม่ตรง (ต้องการ ฿{hintFee})
                                      </p>
                                    )}
                                    {hintOCRValidation.accountMatches === false && (
                                      <p className="text-xs text-red-600">
                                        • เลขที่บัญชีไม่ตรง (ต้องการ {BANK_INFO.accountNumber})
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              
                              if (allValid) {
                                return (
                                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      ข้อมูลถูกต้อง พร้อมชำระ
                                    </p>
                                  </div>
                                );
                              }
                              
                              // Partial validation - only amount matched
                              if (amountOk && hintOCRValidation.accountMatches === null) {
                                return (
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      ยอดเงินถูกต้อง (กรุณาตรวจสอบเลขบัญชีด้วยตนเอง)
                                    </p>
                                  </div>
                                );
                              }
                              
                              return null;
                            })()}
                          </div>
                        )}
                        
                        {/* OCR Error */}
                        {hintOCRValidation.error && (
                          <div className="p-2 bg-amber-100 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700">
                              ไม่สามารถตรวจสอบสลิปอัตโนมัติได้ กรุณาตรวจสอบด้วยตนเอง
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelHintPayment}
                          className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                          disabled={isPayingHint || hintOCRValidation.isValidating}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePayHint(job.id, hintFee)}
                          disabled={
                            !hintSlipBase64 || 
                            isPayingHint || 
                            hintOCRValidation.isValidating ||
                            (hintOCRValidation.validated && hintOCRValidation.amountMatches === false)
                          }
                          className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                        >
                          {isPayingHint ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              {t("placeBid.submitting")}
                            </>
                          ) : hintOCRValidation.isValidating ? (
                            <>
                              <ScanLine className="w-4 h-4 mr-1.5 animate-pulse" />
                              กำลังตรวจสอบ...
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-1.5" />
                              {t("bidding.payAndView")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Always show bid input for bidding jobs */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {t("placeBid.priceLabel")} <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">฿</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="0"
                        value={bidAmounts[job.id] || ""}
                        onChange={(e) => handleBidAmountChange(job.id, e.target.value)}
                        className="pl-8 text-lg font-semibold"
                      />
                    </div>
                  </div>
                  {/* Always show bidding fee */}
                  <p className="text-xs text-muted-foreground">
                    {t("bidding.biddingFee")}: <span className="font-medium text-foreground">฿{BIDDING_FEE_PER_JOB}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Total Summary - ค่า Hint ไม่รวมในบิลเพราะเป็นแบบสมัครใจ */}
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
              accept={ACCEPT_IMAGE_DOC}
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
