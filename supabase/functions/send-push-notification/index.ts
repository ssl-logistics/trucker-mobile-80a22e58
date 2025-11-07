import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  url?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const payload: NotificationPayload = await req.json();
    console.log('Sending push notification:', payload);

    // Validate required fields
    if (!payload.title || !payload.body) {
      throw new Error('Title and body are required');
    }

    // Get user IDs to send to
    const userIds = payload.user_ids || (payload.user_id ? [payload.user_id] : []);
    
    if (userIds.length === 0) {
      throw new Error('No user IDs provided');
    }

    // Get subscriptions for the users
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found for users:', userIds);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No subscriptions found',
          sent: 0 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    // VAPID keys (should be stored as secrets in production)
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || 'UUxEUzI1N0sfufQ0pZKZr4H_SqKwZ6dO6lJtfcbO3s';

    // Send notifications to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || '/',
            data: payload.data,
            tag: payload.tag,
            requireInteraction: payload.requireInteraction || false,
          });

          // Use web-push library to send notification
          // Note: In a real implementation, you would use the web-push npm package
          // For this example, we'll make a direct HTTP request
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
            },
            body: notificationPayload,
          });

          if (!response.ok) {
            throw new Error(`Failed to send notification: ${response.statusText}`);
          }

          return { success: true, user_id: sub.user_id };
        } catch (error) {
          console.error(`Failed to send notification to user ${sub.user_id}:`, error);
          return { success: false, user_id: sub.user_id, error: (error as Error).message };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`Sent ${successCount} notifications successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
