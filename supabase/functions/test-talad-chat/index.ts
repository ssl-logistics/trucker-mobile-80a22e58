import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key, x-app-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const TALAD_CHAT_URL =
  'https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-chat';

const DEFAULT_JOB_ID = '784faba3-fd15-49d1-9173-779b6ca8ce01';
const DEFAULT_MESSAGE_ID = '943fb9a4-2431-4f9c-b9ff-a5269df9d242';

interface TestBody {
  job_id?: string;
  message_id?: string;
  limit?: number;
  page?: number;
  dry_run?: boolean;
  mode?: 'pull' | 'push' | 'both';
}

async function callTalad(apiKey: string, payload: Record<string, unknown>) {
  const started = Date.now();
  const res = await fetch(TALAD_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    status: res.status,
    ok: res.ok,
    duration_ms: Date.now() - started,
    json,
    raw_snippet: text.slice(0, 800),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const errors: string[] = [];

  try {
    // Chat endpoint uses its own key (ttpc_...); fall back to the job key.
    const apiKey =
      Deno.env.get('TALAD_CHAT_API_KEY') ?? Deno.env.get('TALAD_API_KEY') ?? '';
    if (!apiKey) {
      console.error('[test-talad-chat] TALAD_API_KEY is not configured');
      return new Response(
        JSON.stringify({
          ok: false,
          api_key_configured: false,
          errors: ['TALAD_API_KEY not configured'],
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: TestBody = {};
    if (req.method === 'POST') {
      try {
        body = (await req.json()) as TestBody;
      } catch {
        body = {};
      }
    } else {
      const url = new URL(req.url);
      body = {
        job_id: url.searchParams.get('job_id') ?? undefined,
        message_id: url.searchParams.get('message_id') ?? undefined,
        limit: url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined,
        page: url.searchParams.get('page')
          ? Number(url.searchParams.get('page'))
          : undefined,
        dry_run: url.searchParams.get('dry_run') !== 'false',
        mode: (url.searchParams.get('mode') as TestBody['mode']) ?? undefined,
      };
    }

    const jobId = body.job_id ?? DEFAULT_JOB_ID;
    const messageId = body.message_id;
    const limit = body.limit ?? 50;
    const page = body.page ?? 1;
    const dryRun = body.dry_run !== false;
    const mode = body.mode ?? 'both';

    console.log('[test-talad-chat] start', JSON.stringify({ jobId, messageId, limit, page, dryRun, mode }));

    let pull: unknown = null;
    let push: unknown = null;

    // ---------- PULL ----------
    if (mode === 'pull' || mode === 'both') {
      const pullPayload: Record<string, unknown> = messageId
        ? { message_id: messageId, dry_run: dryRun }
        : { job_id: jobId, limit, page, event: 'chat.message_created', dry_run: dryRun };

      try {
        const result = await callTalad(apiKey, pullPayload);
        const messages =
          (Array.isArray(result.json?.messages) && result.json.messages) ||
          (Array.isArray(result.json?.data) && result.json.data) ||
          [];

        console.log(
          `[test-talad-chat] pull status=${result.status} count=${messages.length} duration=${result.duration_ms}ms`,
        );
        if (!result.ok) {
          console.error('[test-talad-chat] pull error body:', result.raw_snippet);
          errors.push(`pull failed with status ${result.status}`);
        }

        pull = {
          status: result.status,
          ok: result.ok,
          duration_ms: result.duration_ms,
          request: pullPayload,
          count: result.json?.count ?? messages.length,
          sample: messages[0] ?? null,
          raw_snippet: result.raw_snippet,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown pull error';
        console.error('[test-talad-chat] pull exception:', msg);
        errors.push(`pull exception: ${msg}`);
        pull = { ok: false, error: msg };
      }
    }

    // ---------- PUSH ----------
    if (mode === 'push' || mode === 'both') {
      const pushPayload = {
        source: 'trucker-mobile',
        event: 'chat.message_created',
        sent_at: new Date().toISOString(),
        count: 1,
        dry_run: dryRun,
        messages: [
          {
            message_id: messageId ?? DEFAULT_MESSAGE_ID,
            job_id: jobId,
            direction: 'to_marketplace',
            message: '[TEST] ทดสอบการเชื่อมต่อแชทจากแอป Trucker Mobile',
            image_url: null,
            sender: {
              user_id: '00000000-0000-0000-0000-000000000000',
              name: 'Trucker Mobile Test',
              account_type: 'driver',
            },
            metadata: { test: true },
            created_at: new Date().toISOString(),
          },
        ],
      };

      try {
        const result = await callTalad(apiKey, pushPayload);
        console.log(
          `[test-talad-chat] push status=${result.status} duration=${result.duration_ms}ms`,
        );
        if (!result.ok) {
          console.error('[test-talad-chat] push error body:', result.raw_snippet);
          errors.push(`push failed with status ${result.status}`);
        }

        push = {
          status: result.status,
          ok: result.ok,
          duration_ms: result.duration_ms,
          request: pushPayload,
          response: result.json,
          raw_snippet: result.raw_snippet,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown push error';
        console.error('[test-talad-chat] push exception:', msg);
        errors.push(`push exception: ${msg}`);
        push = { ok: false, error: msg };
      }
    }

    const summary = {
      ok: errors.length === 0,
      api_key_configured: true,
      mode,
      dry_run: dryRun,
      job_id: jobId,
      pull,
      push,
      errors,
    };

    console.log('[test-talad-chat] done', JSON.stringify({ ok: summary.ok, errors }));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[test-talad-chat] fatal:', message);
    return new Response(
      JSON.stringify({ ok: false, errors: [...errors, message] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
