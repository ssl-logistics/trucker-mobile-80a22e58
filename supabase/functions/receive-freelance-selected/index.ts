import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeAuditLog } from "../_shared/auditLog.ts";
import { upsertTrackingRoom } from "../_shared/trackingRoomStore.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface FreelanceSelectedPayload {
  ticket_id: string;
  contractor_id: string;
  bid_id?: string;
  status: string; // e.g., 'accepted', 'rejected', 'selected'
  message?: string;
  selected_at?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: FreelanceSelectedPayload = await req.json();

    console.log('=== Received Freelance Selected Webhook ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.ticket_id || !payload.contractor_id) {
      console.error('Missing required fields: ticket_id or contractor_id');
      return new Response(
        JSON.stringify({ success: false, error: 'ticket_id and contractor_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map external status to our internal bid status
    let bidStatus = 'pending';
    if (payload.status === 'accepted' || payload.status === 'selected') {
      bidStatus = 'accepted';
    } else if (payload.status === 'rejected') {
      bidStatus = 'rejected';
    } else if (payload.status === 'pending') {
      bidStatus = 'pending';
    }

    // Update bid status in job_bids table
    const { data: updatedBid, error: updateError } = await supabase
      .from('job_bids')
      .update({
        status: bidStatus,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', payload.ticket_id)
      .eq('driver_id', payload.contractor_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bid status:', updateError);
      // Try to find if the bid exists
      const { data: existingBid } = await supabase
        .from('job_bids')
        .select('*')
        .eq('job_id', payload.ticket_id)
        .eq('driver_id', payload.contractor_id)
        .single();

      if (!existingBid) {
        console.log('Bid not found locally, this may be from external system only');
      }
    } else {
      console.log('Bid status updated successfully:', updatedBid);
    }

    // Create a notification for the driver
    const notificationData = {
      user_id: payload.contractor_id,
      title_th: bidStatus === 'accepted' ? 'ยินดีด้วย! คุณได้รับงานแล้ว' : 
                bidStatus === 'rejected' ? 'ขออภัย ราคาเสนอของคุณไม่ถูกเลือก' : 
                'อัปเดตสถานะการประมูล',
      title_en: bidStatus === 'accepted' ? 'Congratulations! You got the job' : 
                bidStatus === 'rejected' ? 'Sorry, your bid was not selected' : 
                'Bid status update',
      description_th: payload.message || `สถานะการประมูลงาน ${payload.ticket_id} ได้รับการอัปเดต`,
      description_en: payload.message || `Bid status for job ${payload.ticket_id} has been updated`,
      notification_type: 'bid_status',
      reference_type: 'job',
      reference_id: payload.ticket_id,
      is_read: false
    };

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationData);

    if (notifError) {
      console.error('Error creating notification:', notifError);
    } else {
      console.log('Notification created for driver:', payload.contractor_id);
    }

    // If accepted, update job application status and create tracking room
    if (bidStatus === 'accepted') {
      const { error: appError } = await supabase
        .from('job_applications')
        .upsert({
          job_id: payload.ticket_id,
          driver_id: payload.contractor_id,
          status: 'accepted',
          applied_at: new Date().toISOString()
        }, {
          onConflict: 'job_id,driver_id'
        });

      if (appError) {
        console.error('Error updating job application:', appError);
      } else {
        console.log('Job application status updated to accepted');
      }

      // Create tracking room for the accepted bid job
      try {
        // Get driver's vehicle info for truck plate
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('plate_number, plate_province')
          .eq('driver_id', payload.contractor_id)
          .limit(1)
          .single();

        const truckPlate = vehicle
          ? [vehicle.plate_province, vehicle.plate_number].filter(Boolean).join(' ').trim()
          : payload.contractor_id; // fallback to driver ID if no vehicle

        const trackingApiKey = Deno.env.get('TRACKING_API_KEY');
        if (trackingApiKey) {
          const trackingBody = {
            truck_plate: truckPlate,
            order_code: payload.ticket_id,
            origin_lat: 0,
            origin_lng: 0,
            destination_lat: 0,
            destination_lng: 0,
            current_lat: 0,
            current_lng: 0,
          };

          console.log('Creating tracking room for bid job:', JSON.stringify(trackingBody));

          await writeAuditLog({
            function_name: 'receive-freelance-selected:create-tracking-room:attempt',
            driver_id: payload.contractor_id,
            order_number: payload.ticket_id,
            request_payload: trackingBody,
            success: true,
          });

          const trackingStartedAt = Date.now();
          const trackingResponse = await fetch(
            'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/create-tracking-room',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': trackingApiKey,
              },
              body: JSON.stringify(trackingBody),
            }
          );

          const trackingResult = await trackingResponse.text();
          console.log('Tracking room response:', trackingResponse.status, trackingResult);

          let trackingData: unknown = trackingResult;
          try { trackingData = JSON.parse(trackingResult); } catch { /* keep raw */ }

          await writeAuditLog({
            function_name: `receive-freelance-selected:create-tracking-room:${trackingResponse.ok ? 'success' : 'error'}`,
            driver_id: payload.contractor_id,
            order_number: payload.ticket_id,
            request_payload: trackingBody,
            response_status: trackingResponse.status,
            response_body: trackingData,
            success: trackingResponse.ok,
            error_message: trackingResponse.ok ? null : `HTTP ${trackingResponse.status}`,
            duration_ms: Date.now() - trackingStartedAt,
          });
        } else {
          console.warn('TRACKING_API_KEY not configured, skipping tracking room creation');
          await writeAuditLog({
            function_name: 'receive-freelance-selected:create-tracking-room:skipped',
            driver_id: payload.contractor_id,
            order_number: payload.ticket_id,
            success: false,
            error_message: 'TRACKING_API_KEY not configured',
          });
        }
      } catch (trackingError) {
        console.error('Error creating tracking room for bid job:', trackingError);
        await writeAuditLog({
          function_name: 'receive-freelance-selected:create-tracking-room:error',
          driver_id: payload.contractor_id,
          order_number: payload.ticket_id,
          success: false,
          error_message: trackingError instanceof Error ? trackingError.message : String(trackingError),
        });
        // Don't fail the webhook because of tracking room error
      }

    }

    console.log('Webhook processed successfully');
    console.log('==========================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Freelance selection processed',
        bid_status: bidStatus
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
