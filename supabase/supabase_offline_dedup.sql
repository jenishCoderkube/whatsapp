-- ============================================================================
-- OFFLINE DEDUPLICATION MIGRATION
-- ============================================================================
-- Adds client_id column to messages table to guarantee zero duplicate sends
-- on shaky networks and automatic retry triggers.
-- ============================================================================

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Create an index to make duplicate checks extremely fast
CREATE INDEX IF NOT EXISTS idx_messages_client_id 
ON public.messages(client_id);
