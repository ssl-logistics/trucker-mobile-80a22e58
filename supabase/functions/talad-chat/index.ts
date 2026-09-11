import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key, x-app-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const TALAD_CHAT_URL =
  'https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-chat';

interface NormalizedMessage {
  id: string;
  job_id: string;
  direction: string;
  message: string;
  image_url: string | null;
  sender_name: string;
  sender_id: string | null;
  created_at: string;
  job_title?: string | null;
  pending?: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

async function callTalad(apiKey: string, payload: Record<string, unknown>) {
  const started = Date.now();
  const res = await fetch(TALAD_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  console.log(
    `[talad-chat] upstream status=${res.status} duration=${Date.now() - started}ms`,
  );
  if (!res.ok) console.error('[talad-chat] upstream body:', text.slice(0, 500));
  return { status: res.status, ok: res.ok, json: parsed, raw: text.slice(0, 500) };
}

function normalize(raw: any): NormalizedMessage | null {
  if (!raw) return null;
  const id = raw.message_id ?? raw.id;
  const jobId = raw.job_id ?? raw.job?.job_id;
  if (!id || !jobId) return null;
  return {
    id: String(id),
    job_id: String(jobId),
    direction: String(raw.direction ?? 'from_marketplace'),
    message: String(raw.message ?? ''),
    image_url: raw.image_url ?? null,
    sender_name: raw.sender?.company_name || raw.sender?.name || 'ตลาด',
    sender_id: raw.sender?.user_id ?? null,
    created_at: raw.created_at ?? new Date().toISOString(),
    job_title: raw.job?.title ?? null,
  };
}

async function pullMessages(apiKey: string, jobId: string, limit: number, page: number) {
  const result = await callTalad(apiKey, {
    job_id: jobId,
    limit,
    page,
    event: 'chat.message_created',
    dry_run: true,
  });
  const list: any[] =
    (Array.isArray(result.json?.messages) && result.json.messages) ||
    (Array.isArray(result.json?.data) && result.json.data) ||
    [];
  const messages = list
    .map(normalize)
    .filter((m): m is NormalizedMessage => m !== null);
  return { ok: result.ok, status: result.status, messages, raw: result.raw };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey =
    Deno.env.get('TALAD_CHAT_API_KEY') ?? Deno.env.get('TALAD_API_KEY') ?? '';
  if (!apiKey) {
    console.error('[talad-chat] missing TALAD_CHAT_API_KEY');
    return json({ ok: false, error: 'TALAD_CHAT_API_KEY not configured' }, 500);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action ?? 'messages');
  const driverId = body.driver_id ? String(body.driver_id) : null;
  const supabase = admin();

  try {
    // ---------- THREADS: latest message + unread per job ----------
    if (action === 'threads') {
      const jobIds: string[] = Array.isArray(body.job_ids)
        ? body.job_ids.map((j: unknown) => String(j)).filter(Boolean).slice(0, 30)
        : [];
      if (jobIds.length === 0) return json({ ok: true, threads: [] });

      let reads: Record<string, string> = {};
      if (driverId) {
        const { data } = await supabase
          .from('talad_chat_reads')
          .select('job_id, last_read_at')
          .eq('driver_id', driverId)
          .in('job_id', jobIds);
        for (const r of data ?? []) reads[r.job_id] = r.last_read_at;
      }

      const threads = await Promise.all(
        jobIds.map(async (jobId) => {
          try {
            const { messages } = await pullMessages(apiKey, jobId, 30, 1);
            const local = driverId
              ? (
                  await supabase
                    .from('talad_chat_messages')
                    .select('*')
                    .eq('job_id', jobId)
                    .eq('driver_id', driverId)
                    .order('created_at', { ascending: false })
                    .limit(10)
                ).data ?? []
              : [];
            const localNorm: NormalizedMessage[] = local.map((m: any) => ({
              id: m.external_message_id ?? m.id,
              job_id: m.job_id,
              direction: m.direction,
              message: m.message ?? '',
              image_url: m.image_url,
              sender_name: m.sender_name ?? 'คุณ',
              sender_id: null,
              created_at: m.created_at,
              pending: true,
            }));
            const all = [...messages, ...localNorm]
              .filter(
                (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
              )
              .sort(
                (a, b) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            const last = all[all.length - 1] ?? null;
            const lastRead = reads[jobId] ? new Date(reads[jobId]).getTime() : 0;
            const isMine = (m: NormalizedMessage) =>
              m.direction === 'to_marketplace' ||
              m.direction === 'from_partner' ||
              (driverId ? m.sender_id === driverId : false);
            const unread = all.filter(
              (m) => !isMine(m) && new Date(m.created_at).getTime() > lastRead,
            ).length;
            return {
              job_id: jobId,
              job_title: messages.find((m) => m.job_title)?.job_title ?? null,
              last_message: last,
              unread,
              message_count: all.length,
            };
          } catch (e) {
            console.error('[talad-chat] thread error', jobId, e);
            return { job_id: jobId, job_title: null, last_message: null, unread: 0, message_count: 0 };
          }
        }),
      );

      return json({ ok: true, threads });
    }

    // ---------- MESSAGES: full thread for one job ----------
    if (action === 'messages') {
      const jobId = body.job_id ? String(body.job_id) : '';
      if (!jobId) return json({ ok: false, error: 'job_id is required' }, 400);
      const limit = Number(body.limit) > 0 ? Math.min(Number(body.limit), 100) : 50;
      const page = Number(body.page) > 0 ? Number(body.page) : 1;

      const pulled = await pullMessages(apiKey, jobId, limit, page);

      let local: NormalizedMessage[] = [];
      if (driverId) {
        const { data } = await supabase
          .from('talad_chat_messages')
          .select('*')
          .eq('job_id', jobId)
          .eq('driver_id', driverId)
          .order('created_at', { ascending: true })
          .limit(100);
        local = (data ?? []).map((m: any) => ({
          id: m.external_message_id ?? m.id,
          job_id: m.job_id,
          direction: m.direction,
          message: m.message ?? '',
          image_url: m.image_url,
          sender_name: m.sender_name ?? 'คุณ',
          sender_id: null,
          created_at: m.created_at,
          pending: true,
        }));
      }

      const messages = [...pulled.messages, ...local]
        .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

      if (driverId) {
        await supabase
          .from('talad_chat_reads')
          .upsert(
            { driver_id: driverId, job_id: jobId, last_read_at: new Date().toISOString() },
            { onConflict: 'driver_id,job_id' },
          );
      }

      console.log(`[talad-chat] messages job=${jobId} count=${messages.length}`);
      return json({ ok: pulled.ok, status: pulled.status, messages });
    }

    // ---------- SEND ----------
    if (action === 'send') {
      const jobId = body.job_id ? String(body.job_id) : '';
      const text = String(body.message ?? '').trim();
      if (!jobId) return json({ ok: false, error: 'job_id is required' }, 400);
      if (!text) return json({ ok: false, error: 'message is required' }, 400);
      if (text.length > 2000) return json({ ok: false, error: 'message too long' }, 400);

      const messageId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const senderName = String(body.sender_name ?? 'คนขับ');

      const payload = {
        source: 'trucker-mobile',
        event: 'chat.message_created',
        sent_at: createdAt,
        count: 1,
        dry_run: false,
        messages: [
          {
            message_id: messageId,
            job_id: jobId,
            direction: 'to_marketplace',
            message: text,
            image_url: body.image_url ?? null,
            sender: {
              user_id: driverId ?? '00000000-0000-0000-0000-000000000000',
              name: senderName,
              account_type: 'driver',
            },
            metadata: {},
            created_at: createdAt,
          },
        ],
      };

      const result = await callTalad(apiKey, payload);

      // Always keep a local copy so the driver sees what they sent
      const { error: insertError } = await supabase.from('talad_chat_messages').insert({
        job_id: jobId,
        external_message_id: messageId,
        driver_id: driverId,
        direction: 'to_marketplace',
        message: text,
        image_url: body.image_url ?? null,
        sender_name: senderName,
        created_at: createdAt,
      });
      if (insertError) console.error('[talad-chat] local insert error', insertError);

      console.log(`[talad-chat] send job=${jobId} status=${result.status}`);
      return json({
        ok: true,
        delivered: result.ok,
        upstream_status: result.status,
        upstream_reason: result.json?.reason ?? null,
        message: {
          id: messageId,
          job_id: jobId,
          direction: 'to_marketplace',
          message: text,
          image_url: body.image_url ?? null,
          sender_name: senderName,
          sender_id: driverId,
          created_at: createdAt,
          pending: true,
        },
      });
    }

    return json({ ok: false, error: `unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[talad-chat] error', msg);
    return json({ ok: false, error: msg }, 500);
  }
});
