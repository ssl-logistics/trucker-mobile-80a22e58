
CREATE TABLE public.edge_function_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  driver_id TEXT,
  order_number TEXT,
  room_code TEXT,
  request_payload JSONB,
  external_request_payload JSONB,
  response_status INT,
  response_body JSONB,
  success BOOLEAN,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.edge_function_audit_logs TO authenticated;
GRANT ALL ON public.edge_function_audit_logs TO service_role;

ALTER TABLE public.edge_function_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access"
  ON public.edge_function_audit_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "drivers read own logs"
  ON public.edge_function_audit_logs FOR SELECT
  TO authenticated USING (driver_id = auth.uid()::text);

CREATE INDEX idx_efal_function_created ON public.edge_function_audit_logs (function_name, created_at DESC);
CREATE INDEX idx_efal_driver_created ON public.edge_function_audit_logs (driver_id, created_at DESC);
CREATE INDEX idx_efal_order ON public.edge_function_audit_logs (order_number);
