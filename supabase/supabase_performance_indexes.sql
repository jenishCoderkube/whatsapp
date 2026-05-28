-- ============================================================================
-- SQL PERFORMANCE INDEXES AND QUERY OPTIMIZATIONS
-- ============================================================================
-- Execute this script in the Supabase SQL editor to create optimized indexes.
-- This ensures rapid message pagination, fast membership lookups, and efficient
-- status checking as the application scales.

-- 1. Index on Messages table for paginated historical queries (ordered by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at 
ON public.messages (conversation_id, created_at DESC);

-- 2. Index on Conversation Members table for quick user conversation mapping and membership checks
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_conv 
ON public.conversation_members (user_id, conversation_id);

-- 3. Index on Messages table for filtering by sender_id (useful for resolving sender association or checking user stats)
CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
ON public.messages (sender_id);

-- 4. Index on Profiles table to optimize query performance for tracking active online status and presence syncing
CREATE INDEX IF NOT EXISTS idx_profiles_online_last_seen 
ON public.profiles (online, last_seen DESC);
