import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchExternalUsersRequest {
  external_project_id: string;
  query: string;
  limit?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: SearchExternalUsersRequest = await req.json();
    console.log('Search external users request:', payload);

    if (!payload.external_project_id || !payload.query) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'External project ID and query are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get external project configuration
    const { data: externalConfig, error: configError } = await supabase
      .from('external_chat_config')
      .select('*')
      .eq('id', payload.external_project_id)
      .single();

    if (configError || !externalConfig) {
      console.error('External project config not found:', configError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'External project configuration not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!externalConfig.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'External project is not active' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the search endpoint URL
    const baseUrl = externalConfig.target_url.replace('/receive-chat-message', '');
    const searchUrl = `${baseUrl}/search-users`;

    // Call external project's search-users function
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (externalConfig.api_key) {
      headers['Authorization'] = `Bearer ${externalConfig.api_key}`;
    }

    const limit = payload.limit || 10;
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: payload.query,
        limit
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to search external users:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to search users: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log(`Found ${result.users?.length || 0} external users`);

    return new Response(
      JSON.stringify({ 
        success: true,
        users: result.users || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-external-users:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
