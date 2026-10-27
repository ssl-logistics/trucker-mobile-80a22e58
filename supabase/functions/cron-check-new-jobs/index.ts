import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

// Runs every minute (pg_cron). Checks new jobs for every driver that has a push token,
// so alerts arrive even when the app is closed.
const CONCURRENCY = 20;
const DEADLINE_MS = 50_000;

Deno.serve(async () => {
  const started = Date.now();
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, key);

  const { data: subs, error: subErr } = await supabase.from('push_subscriptions').select('user_id');
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });
  const ids = [...new Set((subs || []).map((s: any) => String(s.user_id)).filter(Boolean))];
  if (ids.length === 0) return Response.json({ checked: 0 });

  const { data: profiles } = await supabase
    .from('driver_push_profiles')
    .select('driver_id, driver_type')
    .in('driver_id', ids);
  const queue = [...(profiles || [])];

  let checked = 0, notified = 0, failed = 0;
  const worker = async () => {
    while (queue.length && Date.now() - started < DEADLINE_MS) {
      const p = queue.shift()!;
      try {
        const r = await fetch(`${url}/functions/v1/check-new-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
          body: JSON.stringify({ driver_id: p.driver_id, driver_type: p.driver_type, user_id: p.driver_id, from_cron: true }),
        });
        const d = await r.json().catch(() => ({}));
        checked++;
        notified += d?.new_notifications || 0;
      } catch { failed++; }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const res = { subscribers: ids.length, with_profile: profiles?.length || 0, checked, notified, failed, skipped: queue.length, ms: Date.now() - started };
  console.log('[cron-check-new-jobs]', JSON.stringify(res));
  return Response.json(res);
});
