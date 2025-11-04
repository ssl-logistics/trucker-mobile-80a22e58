-- Add fields for international transport jobs
ALTER TABLE public.jobs
ADD COLUMN container_checkpoint TEXT,
ADD COLUMN container_checkpoint_code TEXT,
ADD COLUMN empty_container_date DATE,
ADD COLUMN container_number TEXT,
ADD COLUMN seal_number TEXT,
ADD COLUMN origin_contact_person TEXT,
ADD COLUMN origin_contact_role TEXT,
ADD COLUMN origin_bill_of_lading TEXT,
ADD COLUMN origin_goods_type TEXT,
ADD COLUMN origin_goods_quantity TEXT,
ADD COLUMN origin_remarks TEXT,
ADD COLUMN destination_contact_person TEXT,
ADD COLUMN destination_bill_of_lading TEXT,
ADD COLUMN destination_goods_type TEXT,
ADD COLUMN destination_goods_quantity TEXT,
ADD COLUMN destination_time TIME WITHOUT TIME ZONE,
ADD COLUMN destination_remarks TEXT;