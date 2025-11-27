-- Create external_chat_config table for storing external project configurations
CREATE TABLE public.external_chat_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  project_id TEXT,
  target_url TEXT NOT NULL,
  api_key TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create external_user_mapping table for mapping users between projects
CREATE TABLE public.external_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  external_project_id UUID REFERENCES public.external_chat_config(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  external_user_name TEXT,
  external_user_avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(external_project_id, external_user_id)
);

-- Create external_chat_messages table for storing messages from external projects
CREATE TABLE public.external_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  external_project_id UUID REFERENCES public.external_chat_config(id) ON DELETE SET NULL,
  external_message_id TEXT NOT NULL,
  sender_mapping_id UUID REFERENCES public.external_user_mapping(id) ON DELETE SET NULL,
  message_text TEXT,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(external_project_id, external_message_id)
);

-- Enable Row Level Security
ALTER TABLE public.external_chat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for external_chat_config
CREATE POLICY "Authenticated users can view external chat configs"
  ON public.external_chat_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert external chat configs"
  ON public.external_chat_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update external chat configs"
  ON public.external_chat_config FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for external_user_mapping
CREATE POLICY "Users can view their own external mappings"
  ON public.external_user_mapping FOR SELECT
  TO authenticated
  USING (auth.uid() = local_user_id);

CREATE POLICY "Authenticated users can create external mappings"
  ON public.external_user_mapping FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for external_chat_messages
CREATE POLICY "Users can view external messages in their conversations"
  ON public.external_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = external_chat_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert external messages"
  ON public.external_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_external_chat_config_updated_at
  BEFORE UPDATE ON public.external_chat_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for external_chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_chat_messages;