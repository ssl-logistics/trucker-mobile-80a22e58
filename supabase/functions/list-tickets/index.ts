import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Include x-api-key so browsers can send it if needed
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const EXTERNAL_API_URL = "https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1/list-tickets";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LIST_TICKETS_API_KEY');
    
    if (!apiKey) {
      console.error('LIST_TICKETS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters from request (and optional JSON body for POST callers)
    const url = new URL(req.url);

    let body: Record<string, unknown> | null = null;
    const contentType = req.headers.get('content-type') || '';
    if (req.method !== 'GET' && contentType.includes('application/json')) {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }

    // Get parameters - don't default status if bids_status is provided
    const bidsStatus = (body?.bids_status as string | undefined) ?? url.searchParams.get('bids_status') ?? undefined;
    const statusParam = (body?.status as string | undefined) ?? url.searchParams.get('status');
    const limit = (body?.limit as string | undefined) ?? url.searchParams.get('limit') ?? '10';
    const createdByRole = (body?.created_by_role as string | undefined) ?? url.searchParams.get('created_by_role') ?? 'trucking_company';
    
    // Only default to 'active' if no bids_status filter is provided
    const status = statusParam ?? (bidsStatus ? undefined : 'active');

    console.log(
      `Fetching tickets from external API with status=${status || 'not specified'}, limit=${limit}, bids_status=${bidsStatus || 'none'}, created_by_role=${createdByRole}`,
    );

    // Build external API URL with query params
    const externalUrl = new URL(EXTERNAL_API_URL);
    
    // Only set status if explicitly provided or defaulted
    if (status) {
      externalUrl.searchParams.set('status', status);
    }
    externalUrl.searchParams.set('limit', limit);
    
    // Add created_by_role parameter (default to trucking_company for bidding jobs)
    if (createdByRole) {
      externalUrl.searchParams.set('created_by_role', createdByRole);
    }
    
    // Add bids_status if provided
    if (bidsStatus) {
      externalUrl.searchParams.set('bids_status', bidsStatus);
    }

    // Forward request to external API
    // NOTE: Some Supabase gateways require `apikey`/`Authorization` (anon key JWT).
    // Our external system may also require a custom `x-api-key`.
    // We support both by conditionally attaching apikey/auth when the key looks like a JWT.
    const outboundHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };

    if (apiKey.startsWith('eyJ')) {
      outboundHeaders.apikey = apiKey;
      outboundHeaders.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(externalUrl.toString(), {
      method: 'GET',
      headers: outboundHeaders,
    });

    const responseText = await response.text();
    console.log('External API response status:', response.status);
    console.log('External API response preview:', responseText.substring(0, 2000));

    // Log full first ticket for debugging field mapping
    try {
      const parsed = JSON.parse(responseText);
      if (parsed?.data?.[0]) {
        console.log('FULL FIRST TICKET:', JSON.stringify(parsed.data[0]));
      }
    } catch { /* ignore */ }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in list-tickets function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
