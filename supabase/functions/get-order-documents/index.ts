// Must list every header the app sends. The app's fetch wrapper (src/lib/installFetchWrapper.ts)
// attaches x-app-secret to every request to our own edge functions; if it is not allowed here,
// the browser blocks the call at the CORS preflight step and the app sees "Failed to fetch".
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-app-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const EXTERNAL_BASE = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ORDER_DOC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'ORDER_DOC_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let orderNumber = ''
    if (req.method === 'GET') {
      orderNumber = new URL(req.url).searchParams.get('order_number') || ''
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => null)
      orderNumber = typeof body?.order_number === 'string' ? body.order_number : ''
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    orderNumber = orderNumber.trim()
    if (!orderNumber || orderNumber.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'ต้องระบุ order_number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const url = `${EXTERNAL_BASE}/order-documents?order_number=${encodeURIComponent(orderNumber)}`
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    })

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok || !data?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data?.error || `upstream error (${upstream.status})`,
        }),
        { status: upstream.ok ? 502 : upstream.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const result = Array.isArray(data.results) ? data.results[0] : null
    if (!result || result.found === false) {
      return new Response(
        JSON.stringify({ success: false, found: false, error: result?.error || 'ไม่พบงานขนส่ง' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_number: result.order_number,
        signatures: result.signatures ?? [],
        driver_documents: result.driver_documents ?? [],
        bl_booking: result.bl_booking ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('get-order-documents error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
