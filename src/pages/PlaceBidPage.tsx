import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function PlaceBidPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitBid = async () => {
    if (!bidAmount || !user || !jobId) {
      toast({
        title: 'กรุณาระบุราคา',
        description: 'กรุณาใส่ราคาที่ต้องการเสนอ',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'ราคาไม่ถูกต้อง',
        description: 'กรุณาใส่ราคาที่ถูกต้อง',
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
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถส่งราคาเสนอได้',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'การเสนอราคาสำเร็จ',
        description: 'ส่งราคาเสนอสำเร็จเป็นที่เรียบร้อย "ประวัติ"'
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
          <h1 className="text-lg font-semibold">{jobId}</h1>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <label className="text-sm text-muted-foreground mb-2 block">
            ราคาที่ต้องการเสนอ <span className="text-destructive">*</span>
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
          {isSubmitting ? 'กำลังส่ง...' : 'ยืนยัน'}
        </Button>
      </div>
    </div>
  );
}
