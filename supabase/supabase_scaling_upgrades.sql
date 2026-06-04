-- ====================================================================
-- WhatsApp Clone Database Scalability & Performance Upgrades
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Tighten RLS on the conversations Table
-- Prevents global conversation update broadcasts to unauthorized users.
-- Ensures that clients only receive real-time updates for their own chats.
-- --------------------------------------------------------------------

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all conversations" ON public.conversations;

-- Create a strict member-only selection policy
CREATE POLICY "Users can view conversations they are member of" 
    ON public.conversations 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm 
            WHERE cm.conversation_id = id 
            AND cm.user_id = auth.uid()
        )
    );

-- Ensure RLS is active
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. Optimize Profile Search (Trigram / GIN Indexing)
-- Eliminates sequential table scans on the profiles table for text searches.
-- --------------------------------------------------------------------

-- Enable the pg_trgm extension if not already present
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for name and email column searches
CREATE INDEX IF NOT EXISTS trgm_idx_profiles_name ON public.profiles USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_profiles_email ON public.profiles USING gin (email gin_trgm_ops);

-- --------------------------------------------------------------------
-- 3. Bulk Message Status Update Stored Procedure (RPC)
-- Eliminates the client-side N+1 sequential HTTP POST request loop.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bulk_update_message_status(
    p_message_ids UUID[],
    p_status TEXT,
    p_user_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Update status directly on messages where status is not already equal to the target status
    UPDATE public.messages
    SET 
        status = p_status,
        receipts = jsonb_set(
            COALESCE(receipts, '{}'::JSONB),
            ARRAY[p_status, p_user_id::TEXT],
            to_jsonb(EXTRACT(EPOCH FROM NOW()) * 1000)::JSONB
        )
    WHERE id = ANY(p_message_ids)
      AND sender_id <> p_user_id
      AND status <> p_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
