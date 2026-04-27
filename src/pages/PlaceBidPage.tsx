import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { createBid } from '@/lib/externalApi';
import type { Database } from '@/integrations/supabase/types';

type Job = Database['public']['Tables']['jobs']['Row'];

const DEPOSIT_AMOUNT = 100;

export default function PlaceBidPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (jobId) {
      loadJob();
    }
  }, [jobId]);

  const loadJob = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!error && data) {
      setJob(data);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - accept images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'application/pdf'];
    if (!file.type.startsWith('image/') && !allowedTypes.includes(file.type)) {
      toast({
        title: t('placeBid.invalidFileType'),
        description: t('placeBid.pleaseUploadImage'),
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('placeBid.fileTooLarge'),
        description: t('placeBid.maxFileSize'),
        variant: 'destructive'
      });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setSlipImage(previewUrl);

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSlipBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSlip = () => {
    setSlipImage(null);
    setSlipBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitBid = async () => {
    if (!bidAmount || !user || !jobId) {
      toast({
        title: t('placeBid.pleaseEnterPrice'),
        description: t('placeBid.enterPriceDescription'),
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('placeBid.invalidPrice'),
        description: t('placeBid.enterValidPrice'),
        variant: 'destructive'
      });
      return;
    }

    // Validate payment slip is uploaded
    if (!slipBase64) {
      toast({
        title: t('placeBid.slipRequired'),
        description: t('placeBid.pleaseUploadSlip'),
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('=== User object from login ===');
      console.log('User:', JSON.stringify(user, null, 2));

      // Build payload for external create-bid API
      const freelancerName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const payload = {
        ticket_id: jobId,
        contractor_id: user.id,
        bid_price: amount,
        payment_transaction_id: `TXN${Date.now()}_${jobId?.substring(0, 8)}`,
        payment_slip_base64: slipBase64,
        freelancer_email: user.email || undefined,
        freelancer_name: freelancerName || undefined,
        freelancer_phone: user.phone || undefined
      };
      
      console.log('Bid amount entered:', bidAmount, 'Parsed amount:', amount);
      console.log('=== Submitting bid directly to external API ===');
      console.log('Payload:', JSON.stringify({ ...payload, payment_slip_base64: '[BASE64_IMAGE]' }, null, 2));

      // Call external API directly (no proxy)
      const { data: result, error: apiError } = await createBid(payload);

      console.log('External API response:', result);

      setIsSubmitting(false);

      if (apiError || result?.error) {
        console.error('Error submitting bid:', apiError || result?.error);
        toast({
          title: t('placeBid.error'),
          description: apiError || result?.error || t('placeBid.submitError'),
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('placeBid.success'),
          description: t('placeBid.successMessage')
        });
        
        // Navigate back to bidding page
        setTimeout(() => {
          navigate('/bidding');
        }, 1500);
      }
    } catch (err) {
      console.error('Error in handleSubmitBid:', err);
      setIsSubmitting(false);
      toast({
        title: t('placeBid.error'),
        description: t('placeBid.submitError'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b page-header-safe">
        <div className="flex items-center gap-4 px-4 py-3">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">
            {job ? job.order_code : t('placeBid.loading')}
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Pickup & Delivery Dates */}
        {job && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('placeBid.pickupDate') || 'วันรับสินค้า'}</span>
              <span className="text-sm font-medium">
                {job.start_date ? `${job.start_date} ${job.start_time || ''}`.trim() : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('placeBid.deliveryDate') || 'วันส่งสินค้า'}</span>
              <span className="text-sm font-medium">
                {job.destination_date ? `${job.destination_date} ${job.destination_time || ''}`.trim() : '-'}
              </span>
            </div>
          </div>
        )}

        {/* Bid Amount */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">
            {t('placeBid.priceLabel')} <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="text-lg"
          />
        </div>

        {/* Deposit Payment Section */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t('placeBid.depositAmount')}</span>
            <span className="text-lg font-bold text-primary">฿{DEPOSIT_AMOUNT.toLocaleString()}</span>
          </div>
          
          <p className="text-xs text-muted-foreground">
            {t('placeBid.depositDescription')}
          </p>

          {/* Payment Slip Upload */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              {t('placeBid.paymentSlip')} <span className="text-destructive">*</span>
            </label>
            
            {slipImage ? (
              <div className="relative">
                {slipImage.endsWith('.pdf') || slipImage.includes('application/pdf') ? (
                  <div className="w-full h-48 flex items-center justify-center rounded-lg border bg-muted">
                    <span className="text-sm text-muted-foreground">📄 PDF Uploaded</span>
                  </div>
                ) : (
                  <img 
                    src={slipImage} 
                    alt="Payment slip" 
                    className="w-full max-h-64 object-contain rounded-lg border"
                  />
                )}
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
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-10 h-10" />
                  <span className="text-sm">{t('placeBid.uploadSlipHint')}</span>
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
        </div>

        <Button 
          className="w-full" 
          onClick={handleSubmitBid}
          disabled={isSubmitting || !slipBase64}
        >
          {isSubmitting ? t('placeBid.submitting') : t('placeBid.confirm')}
        </Button>
      </div>
    </div>
  );
}