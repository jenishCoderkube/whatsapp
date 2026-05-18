-- ============================================================================
-- ADVANCED WHATSAPP FEATURES UPGRADE MIGRATION
-- ============================================================================
-- Run this script in your Supabase SQL editor to enable database persistence for:
-- 1. Pin/Archive states (per-user in conversation_members)
-- 2. Message Replies and Forwards (metadata / reply_to on messages)
-- ============================================================================

-- 1. Update conversation_members to track user-specific Pin/Archive preferences
ALTER TABLE public.conversation_members
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT now();

-- 2. Update messages to track replies and forwards natively
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT false;

-- Create indexes for performance on large databases
CREATE INDEX IF NOT EXISTS idx_conv_members_pin ON public.conversation_members(user_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_conv_members_archive ON public.conversation_members(user_id, is_archived);
