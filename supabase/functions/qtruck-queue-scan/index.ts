import { verifyAppSecret } from '../_shared/appAuth.ts'
import { writeAuditLog } from '../_shared/auditLog.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
}
const BASE = 'https://xaadsdapeakbcsxfpmtx.supabase.co/functions/v1/external-queue-api'
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
    const { order_number, station_token } = body ?? {}
    orderNumber = typeof order_number === 'string' ? order_number : null

    if (!orderNumber || orderNumber.length > 100) {
      return json({ error: 'order_number is required' }, 400)
    }
    if (!station_token || typeof station_token !== 'string' || station_token.length > 500) {
      return json({ error: 'station_token is required' }, 400)
    }

    const key = Deno.env.get('QTRUCK_API_KEY')
    if (!key) return json({ error: 'QTRUCK_API_KEY not configured' }, 500)

    const url = `${BASE}/queues/scan?external_ref=${encodeURIComponent(orderNumber)}&station_token=${encodeURIComponent(station_token)}&key=${encodeURIComponent(key)}`
    const scanRes = await fetch(url)
    const scanText = await scanRes.text()

    await writeAuditLog({
      function_name: 'qtruck-queue-scan',
      order_number: orderNumber,
      request_payload: { order_number: orderNumber, station_token },
      response_status: scanRes.status,
      response_body: scanText,
      success: scanRes.ok,
      error_message: scanRes.ok ? null : 'scan_failed',
      duration_ms: Date.now() - started,
    })

    if (!scanRes.ok) {
      console.error('QTruck scan failed', scanRes.status, scanText)
      return json({ success: false, reason: 'scan_failed', status: scanRes.status })
    }

    console.log(`[QTruck] scan ${orderNumber} OK`)
    return json({ success: true })
  } catch (e) {
    console.error(e)
    await writeAuditLog({
      function_name: 'qtruck-queue-scan',
      order_number: orderNumber,
      success: false,
      error_message: (e as Error).message,
      duration_ms: Date.now() - started,
    })
    return json({ success: false, error: (e as Error).message }, 500)
  }
})
