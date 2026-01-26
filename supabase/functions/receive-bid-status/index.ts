import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BidStatusPayload {
  bid_id?: string;
  order_code?: string;
  post_code?: string;  // Alternative field name from external system
  bidder_id?: string;  // Driver ID from external system
  status: 'accepted' | 'rejected' | 'won' | 'lost' | 'pending';
  message?: string;
  updated_at?: string;
  selected_bidder_name?: string;
  selected_price?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BidStatusPayload = await req.json();
    
    console.log('=== Received Bid Status Update ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.status) {
      console.error('Missing required field: status');
      return new Response(
        JSON.stringify({ error: 'Missing required field: status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Support both order_code and post_code
    const orderCode = payload.order_code || payload.post_code;

    // Need either bid_id or order_code/post_code to find the bid
    if (!payload.bid_id && !orderCode) {
      console.error('Missing identifier: need either bid_id or order_code/post_code');
      return new Response(
        JSON.stringify({ error: 'Missing identifier: need either bid_id or order_code/post_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status value
    const validStatuses = ['accepted', 'rejected', 'won', 'lost', 'pending'];
    if (!validStatuses.includes(payload.status)) {
      console.error('Invalid status value:', payload.status);
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let bidId = payload.bid_id;

    // If order_code/post_code is provided, find the bid(s) for that job
    if (!bidId && orderCode) {
      // First find the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('order_code', orderCode)
        .maybeSingle();

      if (jobError || !job) {
        console.error('Job not found for order_code:', orderCode);
        return new Response(
          JSON.stringify({ error: `Job not found for order_code: ${orderCode}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If bidder_id is provided, find that specific driver's bid
      let bidQuery = supabase
        .from('job_bids')
        .select('id')
        .eq('job_id', job.id)
        .eq('status', 'pending');

      if (payload.bidder_id) {
        bidQuery = bidQuery.eq('driver_id', payload.bidder_id);
      }

      const { data: bids, error: bidsError } = await bidQuery
        .order('created_at', { ascending: false })
        .limit(1);

      if (bidsError || !bids || bids.length === 0) {
        console.error('No pending bids found for job:', job.id);
        return new Response(
          JSON.stringify({ error: 'No pending bids found for this job' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      bidId = bids[0].id;
    }

    // Update the bid status
    const { data: updatedBid, error: updateError } = await supabase
      .from('job_bids')
      .update({ 
        status: payload.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', bidId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bid status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update bid status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated bid status:', updatedBid);

    // If bid is accepted/won, update the job status and send notification
    if (payload.status === 'accepted' || payload.status === 'won') {
      // Get job details for notification
      const { data: jobData } = await supabase
        .from('jobs')
        .select('order_code, origin_location, destination_location')
        .eq('id', updatedBid.job_id)
        .single();

      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({ status: 'assigned' })
        .eq('id', updatedBid.job_id);

      if (jobUpdateError) {
        console.warn('Warning: Failed to update job status:', jobUpdateError);
      } else {
        console.log('Job status updated to assigned');
      }

      // Create job application for the winning driver
      const { error: applicationError } = await supabase
        .from('job_applications')
        .upsert({
          job_id: updatedBid.job_id,
          driver_id: updatedBid.driver_id,
          status: 'accepted',
          applied_at: new Date().toISOString()
        }, {
          onConflict: 'job_id,driver_id'
        });

      if (applicationError) {
        console.warn('Warning: Failed to create job application:', applicationError);
      } else {
        console.log('Job application created for driver');
      }

      // Create notification in database
      const notifOrderCode = jobData?.order_code || payload.order_code || payload.post_code || 'N/A';
      const notificationData = {
        user_id: updatedBid.driver_id,
        title_th: '🎉 การเสนอราคาสำเร็จ!',
        title_en: '🎉 Bid Won!',
        title_ko: '🎉 입찰 성공!',
        title_zh: '🎉 竞标成功!',
        description_th: `ยินดีด้วย! คุณชนะการประมูลงาน ${notifOrderCode}`,
        description_en: `Congratulations! You won the bid for job ${notifOrderCode}`,
        description_ko: `축하합니다! ${notifOrderCode} 작업 입찰에 성공했습니다`,
        description_zh: `恭喜！您赢得了工作 ${notifOrderCode} 的竞标`,
        notification_type: 'bid_won',
        reference_id: updatedBid.job_id,
        reference_type: 'job',
        is_read: false
      };

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (notifError) {
        console.warn('Warning: Failed to create notification:', notifError);
      } else {
        console.log('Notification created for driver');
      }

      // Send push notification
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            user_id: updatedBid.driver_id,
            title: '🎉 การเสนอราคาสำเร็จ!',
            body: `ยินดีด้วย! คุณชนะการประมูลงาน ${notifOrderCode}`,
            data: {
              type: 'bid_won',
              job_id: updatedBid.job_id,
              url: '/bidding'
            }
          })
        });

        if (pushResponse.ok) {
          console.log('Push notification sent successfully');
        } else {
          console.warn('Push notification failed:', await pushResponse.text());
        }
      } catch (pushError) {
        console.warn('Warning: Failed to send push notification:', pushError);
      }
    }

    console.log('================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bid status updated to ${payload.status}`,
        bid: updatedBid
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
