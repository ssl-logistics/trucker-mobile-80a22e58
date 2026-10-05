import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { writeAuditLog } from '../_shared/auditLog.ts'

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

const STATUS_TH: Record<string, string> = { moved: 'คิวถูกย้าย', cancelled: 'คิวถูกยกเลิก', completed: 'คิวเสร็จสิ้น', processing: 'กำลังขึ้น/ลงสินค้า' }
const STATUS_EN: Record<string, string> = { moved: 'Queue moved', cancelled: 'Queue cancelled', completed: 'Queue completed', processing: 'Loading/unloading in progress' }
const STATUS_KO: Record<string, string> = { moved: '대기열이 이동되었습니다', cancelled: '대기열이 취소되었습니다', completed: '대기열 완료', processing: '상/하차 진행 중' }
const STATUS_ZH: Record<string, string> = { moved: '队列已移动', cancelled: '队列已取消', completed: '队列已完成', processing: '正在装/卸货' }

Deno.serve(async (req) => {
  const startedAt = Date.now()
  const durationMs = () => Date.now() - startedAt

  if (req.method !== 'POST') {
    console.log('[qtruck-webhook] rejected: method not allowed', req.method)
    return json({ error: 'Method not allowed' }, 405)
  }

  // QTruck doc specifies TRUCKER_API_KEY; earlier setup used QTRUCK_API_KEY — accept either.
  const sentKey = req.headers.get('x-api-key')
  const allowed = [Deno.env.get('QTRUCK_API_KEY'), Deno.env.get('TRUCKER_API_KEY')].filter(Boolean)
  if (!sentKey || !allowed.includes(sentKey)) {
    console.warn('[qtruck-webhook] rejected: invalid x-api-key (key not logged)')
    await writeAuditLog({
      function_name: 'qtruck-webhook',
      success: false,
      error_message: 'unauthorized: invalid x-api-key',
      response_status: 401,
      duration_ms: durationMs(),
    })
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = await req.json()
    const eventType = req.headers.get('x-event-type') || body?.event || ''
    const eventId = req.headers.get('x-event-id') || `${eventType}-${body?.queue?.id}-${body?.occurred_at}-${body?.threshold_minutes ?? ''}`
    const q = body?.queue ?? {}
    const orderNumber: string | null = q.external_ref ?? body?.external_ref ?? null

    console.log('[qtruck-webhook] incoming:', JSON.stringify({
      event_type: eventType,
      event_id: eventId,
      external_ref: orderNumber,
      queue_number: q.queue_number ?? null,
      queue_status: q.status ?? null,
    }))

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { error: dupErr } = await supabase.from('qtruck_webhook_events').insert({
      event_id: eventId, event_type: eventType, external_ref: orderNumber, payload: body,
    })
    if (dupErr) {
      if (dupErr.code === '23505') {
        console.log('[qtruck-webhook] duplicate event, skipped:', eventId)
        await writeAuditLog({
          function_name: 'qtruck-webhook',
          order_number: orderNumber,
          request_payload: body,
          response_body: { result: 'duplicate', event_id: eventId, event_type: eventType },
          success: true,
          duration_ms: durationMs(),
        })
        return json({ success: true, duplicate: true })
      }
      console.error('[qtruck-webhook] event insert error', dupErr)
    }

    // Decide whether to notify
    let titleTh = '', titleEn = '', titleKo = '', titleZh = ''
    let descTh = '', descEn = '', descKo = '', descZh = ''
    const gate = body?.gate?.name ?? body?.gate?.gate_number ?? '-'
    const qn = q.queue_number ?? '-'
    if (eventType === 'queue.upcoming') {
      const m = body?.threshold_minutes ?? ''
      const ahead = body?.queues_ahead
      const aheadTh = typeof ahead === 'number' ? ` เหลืออีก ${ahead} คิวข้างหน้า` : ''
      const aheadEn = typeof ahead === 'number' ? ` (${ahead} queue${ahead === 1 ? '' : 's'} ahead)` : ''
      const aheadKo = typeof ahead === 'number' ? ` (앞에 ${ahead}개 대기열)` : ''
      const aheadZh = typeof ahead === 'number' ? `（前方还有 ${ahead} 个队列）` : ''
      titleTh = 'ใกล้ถึงคิวแล้ว'; titleEn = 'Your queue is coming up'
      titleKo = '대기열이 가까워졌습니다'; titleZh = '即将轮到您的队列'
      descTh = `อีก ${m} นาทีถึงคิว ${qn} (ประตู ${gate})${aheadTh}`
      descEn = `${m} minutes until queue ${qn} (Gate ${gate})${aheadEn}`
      descKo = `${m}분 후 대기열 ${qn} (게이트 ${gate})${aheadKo}`
      descZh = `${m} 分钟后轮到队列 ${qn}（闸口 ${gate}）${aheadZh}`
    } else if (eventType === 'queue.called') {
      titleTh = 'ถึงคิวแล้ว!'; titleEn = "It's your turn!"
      titleKo = '대기열 차례입니다!'; titleZh = '轮到您了！'
      descTh = `คิว ${qn} เชิญเข้าประตู ${gate}`
      descEn = `Queue ${qn}, please proceed to Gate ${gate}`
      descKo = `대기열 ${qn}, 게이트 ${gate}로 진입해 주세요`
      descZh = `队列 ${qn}，请前往闸口 ${gate}`
    } else if (eventType === 'queue.status_changed' && STATUS_TH[q.status]) {
      titleTh = STATUS_TH[q.status]; titleEn = STATUS_EN[q.status]
      titleKo = STATUS_KO[q.status]; titleZh = STATUS_ZH[q.status]
      if (q.status === 'moved') {
        descTh = `คิว ${qn} ย้ายไปประตู ${gate}`; descEn = `Queue ${qn} moved to Gate ${gate}`
        descKo = `대기열 ${qn}이 게이트 ${gate}로 이동되었습니다`; descZh = `队列 ${qn} 已移至闸口 ${gate}`
      } else if (q.status === 'completed') {
        descTh = `คิว ${qn} ที่ประตู ${gate} เสร็จเรียบร้อยแล้ว`; descEn = `Queue ${qn} at Gate ${gate} is completed`
        descKo = `게이트 ${gate}의 대기열 ${qn}이 완료되었습니다`; descZh = `闸口 ${gate} 的队列 ${qn} 已完成`
      } else if (q.status === 'processing') {
        descTh = `คิว ${qn} ที่ประตู ${gate} กำลังขึ้น/ลงสินค้า`; descEn = `Queue ${qn} at Gate ${gate} is being loaded/unloaded`
        descKo = `게이트 ${gate}의 대기열 ${qn}이 상/하차 중입니다`; descZh = `闸口 ${gate} 的队列 ${qn} 正在装/卸货`
      } else {
        descTh = `คิว ${qn} ถูกยกเลิก`; descEn = `Queue ${qn} was cancelled`
        descKo = `대기열 ${qn}이 취소되었습니다`; descZh = `队列 ${qn} 已取消`
      }
    }
    if (!titleTh) {
      console.log('[qtruck-webhook] no notification needed:', JSON.stringify({
        event_type: eventType, external_ref: orderNumber, queue_status: q.status ?? null,
        reason: 'event_not_notifiable',
      }))
      await writeAuditLog({
        function_name: 'qtruck-webhook',
        order_number: orderNumber,
        request_payload: body,
        response_body: {
          result: 'no_notify', event_id: eventId, event_type: eventType,
          reason: 'event_not_notifiable',
        },
        success: true,
        duration_ms: durationMs(),
      })
      return json({ success: true, notified: false })
    }

    let driverId: string | null = null
    let driverSource: string | null = null
    if (orderNumber) {
      const { data: room } = await supabase
        .from('order_tracking_rooms').select('driver_id').eq('order_number', orderNumber).maybeSingle()
      driverId = room?.driver_id
      if (driverId) driverSource = 'tracking_room'
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
          if (driverId) driverSource = 'job_application'
        }
      }
    }
    if (!driverId) {
      // Fallback per QTruck doc: external_ref can be null for queues not booked via Trucker API.
      // Match the driver by phone number from the queue payload instead.
      const rawPhone = typeof q.driver_phone === 'string' ? q.driver_phone.replace(/\D/g, '') : ''
      if (rawPhone) {
        const noLeadingZero = rawPhone.replace(/^0+/, '')
        const variants = [...new Set([rawPhone, noLeadingZero, `0${noLeadingZero}`])]
        const { data: profile } = await supabase
          .from('profiles').select('id').in('phone_number', variants).limit(1).maybeSingle()
        driverId = profile?.id
        if (driverId) driverSource = 'driver_phone'
      }
    }
    console.log('[qtruck-webhook] driver lookup:', JSON.stringify({
      external_ref: orderNumber, found: !!driverId, source: driverSource,
    }))
    if (!driverId) {
      console.warn('[qtruck-webhook] No driver found for order', orderNumber)
      await writeAuditLog({
        function_name: 'qtruck-webhook',
        order_number: orderNumber,
        request_payload: body,
        response_body: { result: 'driver_not_found', event_id: eventId, event_type: eventType },
        success: false,
        error_message: 'driver_not_found',
        duration_ms: durationMs(),
      })
      // Return 503 so QTruck retries (every 1 min, up to 5 times per doc) — the tracking room
      // often appears seconds later when the driver starts the job. The dedup insert above was
      // rolled back conceptually: delete the event row so the retry is not skipped as duplicate.
      await supabase.from('qtruck_webhook_events').delete().eq('event_id', eventId)
      return json({ success: false, reason: 'driver_not_found' }, 503)
    }

    // Enrich description with origin factory name and the driver's truck plate.
    let factoryName: string | null =
      body?.factory?.name ?? body?.site?.name ?? q?.factory_name ?? null
    if (!factoryName && orderNumber) {
      const { data: jobRow } = await supabase
        .from('jobs').select('origin_company_name, employer_name').eq('order_code', orderNumber).maybeSingle()
      factoryName = jobRow?.origin_company_name ?? jobRow?.employer_name ?? null
    }
    let truckPlate: string | null = null
    {
      const { data: vehicle } = await supabase
        .from('vehicles').select('plate_number, plate_province')
        .eq('driver_id', driverId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (vehicle?.plate_number) {
        truckPlate = vehicle.plate_province
          ? `${vehicle.plate_number} ${vehicle.plate_province}`
          : vehicle.plate_number
      }
    }
    if (factoryName) {
      descTh += ` · โรงงาน: ${factoryName}`
      descEn += ` · Factory: ${factoryName}`
    }
    if (truckPlate) {
      descTh += ` · ทะเบียน: ${truckPlate}`
      descEn += ` · Plate: ${truckPlate}`
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
    if (nErr) console.error('[qtruck-webhook] notification insert error', nErr)
    else console.log('[qtruck-webhook] notification inserted for driver', driverId)

    let pushOk = true
    let pushError: string | null = null
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: driverId, title: titleTh, body: descTh,
          url: `/job/${orderNumber}`, tag: `qtruck-${eventId}`, requireInteraction: true,
        },
      })
      console.log('[qtruck-webhook] push invoked for driver', driverId)
    } catch (e) {
      pushOk = false
      pushError = e instanceof Error ? e.message : String(e)
      console.error('[qtruck-webhook] push error', e)
    }

    await writeAuditLog({
      function_name: 'qtruck-webhook',
      driver_id: driverId,
      order_number: orderNumber,
      request_payload: body,
      response_body: {
        result: 'notified', event_id: eventId, event_type: eventType,
        driver_source: driverSource,
        queue_status: q.status ?? null,
        gate_name: body?.gate?.name ?? null,
        slot: body?.slot ? { date: body.slot.date, start_time: body.slot.start_time, end_time: body.slot.end_time } : null,
        estimated_call_at: body?.estimated_call_at ?? null,
        queues_ahead: body?.queues_ahead ?? null,
        factory_name: factoryName,
        truck_plate: truckPlate,
        notification_inserted: !nErr,
        notification_error: nErr?.message ?? null,
        push_invoked: pushOk,
        push_error: pushError,
      },
      success: !nErr,
      error_message: nErr?.message ?? pushError,
      duration_ms: durationMs(),
    })

    return json({ success: true, notified: true })
  } catch (e) {
    console.error('[qtruck-webhook] unhandled error', e)
    await writeAuditLog({
      function_name: 'qtruck-webhook',
      success: false,
      error_message: (e as Error).message,
      duration_ms: durationMs(),
    })
    return json({ success: true, error: (e as Error).message })
  }
})
