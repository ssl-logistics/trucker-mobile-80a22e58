import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAppSecret } from '../_shared/appAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authError = verifyAppSecret(req);
  if (authError) {
    return new Response(await authError.text(), { status: authError.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, user_id, notification_id } = body

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch notifications for user
    if (action === 'list') {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark notification as read
    if (action === 'mark_read' && notification_id) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification_id)
        .eq('user_id', user_id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Count unread
    if (action === 'unread_count') {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user_id)
        .eq('is_read', false)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, count: data?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark all notifications as read
    if (action === 'mark_all_read') {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user_id)
        .eq('is_read', false)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create status change notification (called from client when job status changes)
    if (action === 'create_status_notification') {
      const { title_th, title_en, description_th, description_en, notification_type, reference_type, order_code, status: jobStatus } = body

      // Insert notification into database
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id,
          title_th,
          title_en,
          description_th,
          description_en,
          notification_type: notification_type || 'job_status',
          reference_type: reference_type || 'job',
          reference_id: order_code || null,
          is_read: false,
        })

      if (insertError) {
        console.error('Failed to insert notification:', insertError)
        throw insertError
      }

      // Send push notification
      try {
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id,
            title: title_th,
            body: description_th,
            url: order_code ? `/job/${order_code}` : '/notifications',
            tag: `job-status-${order_code}-${jobStatus}`,
          },
        })

        if (pushError) {
          console.error('Failed to send push notification:', pushError)
        }
      } catch (pushErr) {
        console.error('Push notification error (non-blocking):', pushErr)
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})