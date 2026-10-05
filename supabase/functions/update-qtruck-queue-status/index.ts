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

    const outBody = { external_ref: orderNumber, status }
    const patchRes = await fetch(`${BASE}/queues/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(outBody),
    })
    const patchText = await patchRes.text()

    await writeAuditLog({
      function_name: 'update-qtruck-queue-status',
      order_number: orderNumber,
      request_payload: { order_number, status },
      external_request_payload: outBody,
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

    console.log(`[QTruck] ${orderNumber} -> ${status}`)
    return json({ success: true, status })
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
