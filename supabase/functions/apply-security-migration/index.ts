import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SQL = `
DROP POLICY IF EXISTS "Service role can manage bank accounts" ON public.bank_accounts;

DROP POLICY IF EXISTS "Allow select expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow delete expenses" ON public.expenses;

DROP POLICY IF EXISTS "Service role manages expenses" ON public.expenses;
CREATE POLICY "Service role manages expenses"
  ON public.expenses FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role updates notifications" ON public.notifications;
CREATE POLICY "Service role updates notifications"
  ON public.notifications FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_timestamp() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

DROP POLICY IF EXISTS "Allow view expense-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view pickup SOP photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view pickup SOP photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;

CREATE POLICY "Authenticated can view expense receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-receipts');
CREATE POLICY "Authenticated can view chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');
CREATE POLICY "Authenticated can view pickup SOP photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pickup_sop_photos');
CREATE POLICY "Authenticated can view POD documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = 'pod-documents');
CREATE POLICY "Authenticated can view avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
`;

serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) return new Response("no db url", { status: 500 });
  const client = new Client(url);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  } finally {
    try { await client.end(); } catch (_) { /* noop */ }
  }
});
