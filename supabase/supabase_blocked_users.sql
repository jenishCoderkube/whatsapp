-- ============================================================================
-- SQL SCHEMA FOR WHATSAPP BLOCK/UNBLOCK USER SYSTEM
-- ============================================================================

-- 1. Create Blocked Users Table
CREATE TABLE IF NOT EXISTS public.blocked_users (
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any to prevent duplicate errors
DROP POLICY IF EXISTS "Users can view their block relationships" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can block other users" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can unblock other users" ON public.blocked_users;

-- 4. Create RLS Policies
-- Users can read block rows where they are the blocker or the blocked.
CREATE POLICY "Users can view their block relationships" 
    ON public.blocked_users FOR SELECT 
    USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

-- Users can block other users (only inserting themselves as blocker).
CREATE POLICY "Users can block other users" 
    ON public.blocked_users FOR INSERT 
    WITH CHECK (blocker_id = auth.uid());

-- Users can unblock other users (only deleting records they created).
CREATE POLICY "Users can unblock other users" 
    ON public.blocked_users FOR DELETE 
    USING (blocker_id = auth.uid());

-- 5. Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- 6. Trigger to Prevent Blocked Message Inserts (Set is_blocked_message true if recipient blocked sender)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_blocked_message BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_blocked_message()
RETURNS TRIGGER AS $$
DECLARE
    other_member_id UUID;
    is_grp BOOLEAN;
BEGIN
    -- Check if conversation is a group chat
    SELECT is_group INTO is_grp FROM public.conversations WHERE id = NEW.conversation_id;
    
    IF is_grp = false THEN
        -- Find the other member in the 1-to-1 conversation
        SELECT user_id INTO other_member_id 
        FROM public.conversation_members 
        WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
        LIMIT 1;
        
        IF other_member_id IS NOT NULL THEN
            -- Check if the other member has blocked the sender (recipient blocked sender)
            IF EXISTS (
                SELECT 1 FROM public.blocked_users 
                WHERE blocker_id = other_member_id AND blocked_id = NEW.sender_id
            ) THEN
                -- Set the is_blocked_message flag to true so only the sender can see it
                NEW.is_blocked_message := true;
            END IF;
            
            -- Check if the sender has blocked the other member (sender blocked recipient)
            IF EXISTS (
                SELECT 1 FROM public.blocked_users 
                WHERE blocker_id = NEW.sender_id AND blocked_id = other_member_id
            ) THEN
                RAISE EXCEPTION 'Cannot send message: Unblock the user first';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger BEFORE INSERT on public.messages
DROP TRIGGER IF EXISTS on_message_insert_check_block ON public.messages;
CREATE TRIGGER on_message_insert_check_block
    BEFORE INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.check_blocked_message();

-- Update select policy on messages to hide blocked messages from the recipient
DROP POLICY IF EXISTS "Users can fetch messages in their linked rooms" ON public.messages;
CREATE POLICY "Users can fetch messages in their linked rooms" 
    ON public.messages FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm 
            WHERE cm.conversation_id = public.messages.conversation_id 
            AND cm.user_id = auth.uid()
        )
        AND (
            is_blocked_message = false 
            OR sender_id = auth.uid()
        )
    );

-- 7. Add to Realtime Publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
EXCEPTION WHEN OTHERS THEN
    -- Suppress duplicate table or publication errors safely
END;
$$;
