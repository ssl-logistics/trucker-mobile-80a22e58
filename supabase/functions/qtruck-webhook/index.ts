import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

const STATUS_TH: Record<string, string> = { moved: 'คิวถูกย้าย', cancelled: 'คิวถูกยกเลิก', completed: 'คิวเสร็จสิ้น' }
const STATUS_EN: Record<string, string> = { moved: 'Queue moved', cancelled: 'Queue cancelled', completed: 'Queue completed' }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  // QTruck doc specifies TRUCKER_API_KEY; earlier setup used QTRUCK_API_KEY — accept either.
  const sentKey = req.headers.get('x-api-key')
  const allowed = [Deno.env.get('QTRUCK_API_KEY'), Deno.env.get('TRUCKER_API_KEY')].filter(Boolean)
  if (!sentKey || !allowed.includes(sentKey)) return json({ error: 'Unauthorized' }, 401)

  try {
    const body = await req.json()
    const eventType = req.headers.get('x-event-type') || body?.event || ''
    const eventId = req.headers.get('x-event-id') || `${eventType}-${body?.queue?.id}-${body?.occurred_at}-${body?.threshold_minutes ?? ''}`
    const q = body?.queue ?? {}
    const orderNumber: string | null = q.external_ref ?? body?.external_ref ?? null

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { error: dupErr } = await supabase.from('qtruck_webhook_events').insert({
      event_id: eventId, event_type: eventType, external_ref: orderNumber, payload: body,
    })
    if (dupErr) {
      if (dupErr.code === '23505') return json({ success: true, duplicate: true })
      console.error('event insert error', dupErr)
    }

    // Decide whether to notify
    let titleTh = '', titleEn = '', descTh = '', descEn = ''
    const gate = body?.gate?.name ?? body?.gate?.gate_number ?? '-'
    const qn = q.queue_number ?? '-'
    if (eventType === 'queue.upcoming') {
      const m = body?.threshold_minutes ?? ''
      titleTh = 'ใกล้ถึงคิวแล้ว'; titleEn = 'Your queue is coming up'
      descTh = `อีก ${m} นาทีถึงคิว ${qn} (ประตู ${gate})`
      descEn = `${m} minutes until queue ${qn} (Gate ${gate})`
    } else if (eventType === 'queue.called') {
      titleTh = 'ถึงคิวแล้ว!'; titleEn = "It's your turn!"
      descTh = `คิว ${qn} เชิญเข้าประตู ${gate}`
      descEn = `Queue ${qn}, please proceed to Gate ${gate}`
    } else if (eventType === 'queue.status_changed' && STATUS_TH[q.status]) {
      titleTh = STATUS_TH[q.status]; titleEn = STATUS_EN[q.status]
      if (q.status === 'moved') {
        descTh = `คิว ${qn} ย้ายไปประตู ${gate}`; descEn = `Queue ${qn} moved to Gate ${gate}`
      } else if (q.status === 'completed') {
        descTh = `คิว ${qn} ที่ประตู ${gate} เสร็จเรียบร้อยแล้ว`; descEn = `Queue ${qn} at Gate ${gate} is completed`
      } else {
        descTh = `คิว ${qn} ถูกยกเลิก`; descEn = `Queue ${qn} was cancelled`
      }
    }
    if (!titleTh || !orderNumber) return json({ success: true, notified: false })

    const { data: room } = await supabase
      .from('order_tracking_rooms').select('driver_id').eq('order_number', orderNumber).maybeSingle()
    let driverId = room?.driver_id
    if (!driverId) {
      // Fallback: queue events can arrive before the driver starts the job (no tracking room yet).
      // Look up the job by order_code, then the accepted driver from job_applications.
      const { data: job } = await supabase
        .from('jobs').select('id').eq('order_code', orderNumber).maybeSingle()
      if (job?.id) {
        const { data: app } = await supabase
          .from('job_applications').select('driver_id')
          .eq('job_id', job.id).in('status', ['accepted', 'won'])
          .order('applied_at', { ascending: false }).limit(1).maybeSingle()
        driverId = app?.driver_id
      }
    }
    if (!driverId) {
      console.warn('No driver found for order', orderNumber)
      return json({ success: true, notified: false, reason: 'driver_not_found' })
    }

    const { error: nErr } = await supabase.from('notifications').insert({
      user_id: driverId,
      title_th: titleTh, title_en: titleEn,
      description_th: descTh, description_en: descEn,
      notification_type: 'qtruck_queue',
      reference_type: eventType,
      reference_id: orderNumber,
      is_read: false,
    })
    if (nErr) console.error('notification insert error', nErr)

    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: driverId, title: titleTh, body: descTh,
          url: `/job/${orderNumber}`, tag: `qtruck-${eventId}`, requireInteraction: true,
        },
      })
    } catch (e) { console.error('push error', e) }

    return json({ success: true, notified: true })
  } catch (e) {
    console.error(e)
    return json({ success: true, error: (e as Error).message })
  }
})
