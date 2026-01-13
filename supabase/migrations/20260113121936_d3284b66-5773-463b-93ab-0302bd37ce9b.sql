-- Create notifications table
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    title_th TEXT NOT NULL,
    title_en TEXT,
    title_ko TEXT,
    title_zh TEXT,
    description_th TEXT,
    description_en TEXT,
    description_ko TEXT,
    description_zh TEXT,
    notification_type TEXT DEFAULT 'job',
    reference_id TEXT,
    reference_type TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own notifications OR broadcast notifications (user_id is null)
CREATE POLICY "Users can read their own and broadcast notifications"
ON public.notifications
FOR SELECT
USING (user_id IS NULL OR auth.uid() = user_id);

-- Create policy for users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id IS NULL OR auth.uid() = user_id);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);