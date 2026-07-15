
CREATE TABLE public.order_tracking_rooms (
  order_number TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  truck_plate TEXT,
  driver_id TEXT,
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  destination_lat DOUBLE PRECISION,
  destination_lng DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'created',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_tracking_rooms_source_chk CHECK (source IN ('created','idempotent_409','external_lookup','recreated','server_freelance','backfill_audit'))
);

GRANT ALL ON public.order_tracking_rooms TO service_role;

ALTER TABLE public.order_tracking_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access" ON public.order_tracking_rooms
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE TRIGGER update_order_tracking_rooms_updated_at
  BEFORE UPDATE ON public.order_tracking_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_order_tracking_rooms_room_code ON public.order_tracking_rooms(room_code);
CREATE INDEX idx_order_tracking_rooms_driver_id ON public.order_tracking_rooms(driver_id);

-- Backfill from audit logs (latest room_code per order_number)
INSERT INTO public.order_tracking_rooms (order_number, room_code, driver_id, source, created_at, updated_at)
SELECT DISTINCT ON (order_number)
  order_number,
  room_code,
  driver_id,
  'backfill_audit',
  created_at,
  created_at
FROM public.edge_function_audit_logs
WHERE order_number IS NOT NULL
  AND room_code IS NOT NULL
  AND function_name IN ('create-tracking-room','create-tracking-room:received')
ORDER BY order_number, created_at DESC
ON CONFLICT (order_number) DO NOTHING;
