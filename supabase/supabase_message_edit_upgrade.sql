-- ============================================================================
-- WHATSAPP MESSAGE EDIT SYSTEM UPGRADE MIGRATION
-- ============================================================================
-- Run this script in your Supabase SQL editor to enable database persistence for:
-- 1. Message Edit timestamps (edited_at column)
-- 2. Message Edit history (edit_history JSONB column)
-- ============================================================================

-- 1. Update public.messages to support editing and edit history tracking
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;
