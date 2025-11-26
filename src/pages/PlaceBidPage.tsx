import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Job = Database['public']['Tables']['jobs']['Row'];

export default function PlaceBidPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);

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

    setIsSubmitting(true);

    const { error } = await supabase
      .from('job_bids')
      .insert({
        job_id: jobId,
        driver_id: user.id,
        bid_amount: amount,
        status: 'pending'
      });

    setIsSubmitting(false);

    if (error) {
      toast({
        title: t('placeBid.error'),
        description: t('placeBid.submitError'),
        variant: 'destructive'
      });
    } else {
      toast({
        title: t('placeBid.success'),
        description: t('placeBid.successMessage')
      });
      
      // Navigate back to bidding page with history tab
      setTimeout(() => {
        navigate('/bidding');
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">
            {job ? job.order_code : t('placeBid.loading')}
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
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

        <Button 
          className="w-full" 
          onClick={handleSubmitBid}
          disabled={isSubmitting}
        >
          {isSubmitting ? t('placeBid.submitting') : t('placeBid.confirm')}
        </Button>
      </div>
    </div>
  );
}
