import { verifyAppSecret } from '../_shared/appAuth.ts'
import { writeAuditLog } from '../_shared/auditLog.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
}
const BASE = 'https://xaadsdapeakbcsxfpmtx.supabase.co/functions/v1/external-queue-api'
const ALLOWED_STATUS = new Set(['processing', 'completed'])
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const authError = verifyAppSecret(req)
  if (authError) return json({ error: 'Unauthorized' }, 401)

  const started = Date.now()
  let orderNumber: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const { order_number, status } = body ?? {}
    orderNumber = typeof order_number === 'string' ? order_number : null

    if (!orderNumber || orderNumber.length > 100) {
      return json({ error: 'order_number is required' }, 400)
    }
    if (!ALLOWED_STATUS.has(status)) {
      return json({ error: 'status must be processing or completed' }, 400)
    }

    const key = Deno.env.get('QTRUCK_API_KEY')
    if (!key) return json({ error: 'QTRUCK_API_KEY not configured' }, 500)
    const headers = { 'x-api-key': key, 'Content-Type': 'application/json' }

    // Resolve the active queue for this order
    const listRes = await fetch(`${BASE}/queues?external_ref=${encodeURIComponent(orderNumber)}`, { headers })
    const listText = await listRes.text()
    if (!listRes.ok) {
      console.error('QTruck list failed', listRes.status, listText)
      await writeAuditLog({
        function_name: 'update-qtruck-queue-status',
        order_number: orderNumber,
        request_payload: { order_number, status },
        response_status: listRes.status,
        response_body: listText,
        success: false,
        error_message: 'queue list lookup failed',
        duration_ms: Date.now() - started,
      })
      return json({ success: false, reason: 'queue_list_failed' })
    }

    const list = JSON.parse(listText)
    const queues: any[] = Array.isArray(list?.data) ? list.data : []
    const active = queues.find((q) => !['completed', 'cancelled'].includes(q.status))

    if (!active) {
      // No active queue for this order — quiet no-op so the main flow is unaffected
      await writeAuditLog({
        function_name: 'update-qtruck-queue-status',
        order_number: orderNumber,
        request_payload: { order_number, status },
        success: false,
        error_message: 'no_active_queue',
        duration_ms: Date.now() - started,
      })
      return json({ success: false, reason: 'no_active_queue' })
    }

    const patchRes = await fetch(`${BASE}/queues/${encodeURIComponent(active.id)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    })
    const patchText = await patchRes.text()

    await writeAuditLog({
      function_name: 'update-qtruck-queue-status',
      order_number: orderNumber,
      request_payload: { order_number, status },
      external_request_payload: { queue_id: active.id, status },
      response_status: patchRes.status,
      response_body: patchText,
      success: patchRes.ok,
      error_message: patchRes.ok ? null : 'patch_failed',
      duration_ms: Date.now() - started,
    })

    if (!patchRes.ok) {
      console.error('QTruck status patch failed', patchRes.status, patchText)
      return json({ success: false, reason: 'patch_failed', status: patchRes.status })
    }

    console.log(`[QTruck] queue ${active.id} (${orderNumber}) -> ${status}`)
    return json({ success: true, queue_id: active.id, status })
  } catch (e) {
    console.error(e)
    await writeAuditLog({
      function_name: 'update-qtruck-queue-status',
      order_number: orderNumber,
      success: false,
      error_message: (e as Error).message,
      duration_ms: Date.now() - started,
    })
    return json({ success: false, error: (e as Error).message }, 500)
  }
})
