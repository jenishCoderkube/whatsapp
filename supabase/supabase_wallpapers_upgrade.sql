-- Migration to support WhatsApp-style Chat Wallpaper Customization
-- Adds wallpaper configuration capability at user level (global) and per-chat level (conversation-specific)

-- 1. Add wallpaper column to public.profiles table (Global/Default wallpaper for all chats)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wallpaper TEXT;

-- 2. Add wallpaper column to public.conversation_members table (Custom wallpaper per individual chat/group)
ALTER TABLE public.conversation_members
ADD COLUMN IF NOT EXISTS wallpaper TEXT;
