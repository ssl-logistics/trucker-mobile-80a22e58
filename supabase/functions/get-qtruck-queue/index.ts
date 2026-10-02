import { verifyAppSecret } from '../_shared/appAuth.ts'

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

  try {
    const { order_number } = await req.json().catch(() => ({}))
    if (!order_number || typeof order_number !== 'string' || order_number.length > 100) {
      return json({ error: 'order_number is required' }, 400)
    }
    const key = Deno.env.get('QTRUCK_API_KEY')
    if (!key) return json({ error: 'QTRUCK_API_KEY not configured' }, 500)
    const headers = { 'x-api-key': key }

    const listRes = await fetch(`${BASE}/queues?external_ref=${encodeURIComponent(order_number)}`, { headers })
    const listText = await listRes.text()
    if (!listRes.ok) {
      console.error('QTruck list failed', listRes.status, listText)
      return json({ success: false, status: listRes.status, details: listText }, 200)
    }
    const list = JSON.parse(listText)
    const queues: any[] = Array.isArray(list?.data) ? list.data : []
    if (queues.length === 0) return json({ success: true, data: null })

    // Prefer an active queue
    const active = queues.find((q) => !['completed', 'cancelled'].includes(q.status)) ?? queues[0]

    let detail: any = null
    const dRes = await fetch(`${BASE}/queues/${encodeURIComponent(active.id)}`, { headers })
    if (dRes.ok) detail = (await dRes.json())?.data ?? null
    else console.error('QTruck detail failed', dRes.status, await dRes.text())

    return json({ success: true, data: { queue: detail?.queue ?? active, ...(detail ?? {}), list_item: active } })
  } catch (e) {
    console.error(e)
    return json({ success: false, error: (e as Error).message }, 500)
  }
})
