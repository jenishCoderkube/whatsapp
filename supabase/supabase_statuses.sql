-- ============================================================================
-- WHATSAPP WEB STATUS/STORIES SYSTEM SCHEMA
-- ============================================================================
-- Run this script in your Supabase SQL editor to create the necessary tables
-- and policies for the status/stories system.
-- ============================================================================

-- 1. STATUSES TABLE
-- Stores individual status updates (images, videos, or formatted text status)
CREATE TABLE IF NOT EXISTS public.statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video')),
    media_url TEXT,
    caption TEXT,
    text_content TEXT,
    bg_color TEXT, -- Hex code or class for text status background
    text_style TEXT DEFAULT 'sans', -- 'sans' | 'serif' | 'mono' | 'handwriting'
    privacy TEXT DEFAULT 'contacts' CHECK (privacy IN ('everyone', 'contacts', 'selected', 'hide')),
    privacy_list UUID[] DEFAULT '{}', -- User IDs linked to selective privacy settings
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours') -- Automatic 24h expiration
);

-- Enable RLS for Statuses
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Statuses
DROP POLICY IF EXISTS "Statuses are viewable by authenticated users" ON public.statuses;
CREATE POLICY "Statuses are viewable by authenticated users"
    ON public.statuses FOR SELECT
    USING (
        auth.role() = 'authenticated' 
        AND expires_at > now()
        AND (
            user_id = auth.uid()
            OR privacy = 'everyone'
            OR (privacy = 'contacts') -- In a production app, check contact relationships. Here, viewable by authenticated users.
            OR (privacy = 'selected' AND auth.uid() = ANY(privacy_list))
            OR (privacy = 'hide' AND NOT (auth.uid() = ANY(privacy_list)))
        )
    );

DROP POLICY IF EXISTS "Users can upload their own statuses" ON public.statuses;
CREATE POLICY "Users can upload their own statuses"
    ON public.statuses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own statuses" ON public.statuses;
CREATE POLICY "Users can delete their own statuses"
    ON public.statuses FOR DELETE
    USING (auth.uid() = user_id);


-- 2. STATUS VIEWS TABLE
-- Tracks which users viewed which status updates, and handles quick reactions/replies
CREATE TABLE IF NOT EXISTS public.status_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_id UUID REFERENCES public.statuses(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reaction TEXT DEFAULT NULL, -- Emoji string reaction (e.g. "❤️", "😂")
    reply_text TEXT DEFAULT NULL, -- Text string if user replied to status
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(status_id, viewer_id)
);

-- Enable RLS for Status Views
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Status Views
DROP POLICY IF EXISTS "Status views are viewable by status owner and viewer" ON public.status_views;
CREATE POLICY "Status views are viewable by status owner and viewer"
    ON public.status_views FOR SELECT
    USING (
        auth.role() = 'authenticated' 
        AND (
            viewer_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.statuses s 
                WHERE s.id = status_id AND s.user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can log their own views" ON public.status_views;
CREATE POLICY "Users can log their own views"
    ON public.status_views FOR INSERT
    WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Users can update their own reactions and replies" ON public.status_views;
CREATE POLICY "Users can update their own reactions and replies"
    ON public.status_views FOR UPDATE
    USING (auth.uid() = viewer_id);


-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_statuses_user_expires ON public.statuses(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_status_views_composite ON public.status_views(status_id, viewer_id);


-- 4. REALTIME REPLICA PUBLICATION CONFIGURATION
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.status_views;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Suppress errors if tables are already in publication
END;
$$;
