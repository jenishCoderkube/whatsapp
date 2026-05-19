-- Migration to support WhatsApp-style Disappearing Messages

-- 1. Add disappearing_duration column to conversations table (0 = Off/Never, 86400 = 24h, 604800 = 7d, 7776000 = 90d)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS disappearing_duration INTEGER DEFAULT 0;

-- 2. Create the cleanup function to delete expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages m
  USING public.conversations c
  WHERE m.conversation_id = c.id
    AND c.disappearing_duration > 0
    AND m.created_at < (NOW() - (c.disappearing_duration || ' seconds')::interval);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
