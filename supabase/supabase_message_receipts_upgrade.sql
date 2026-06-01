-- ============================================================================
-- MESSAGE RECEIPTS AND TIMESTAMPS UPGRADE MIGRATION
-- ============================================================================
-- Adds fields to track delivery and seen times per user for message info.
-- ============================================================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receipts JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ DEFAULT NULL;

-- Recreate or update update_message_status function to populate receipts JSON
CREATE OR REPLACE FUNCTION public.update_message_status(
    p_message_id UUID,
    p_status TEXT,
    p_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_current_receipts JSONB;
    v_delivered JSONB;
    v_read JSONB;
    v_now JSONB;
    v_conversation_id UUID;
    v_sender_id UUID;
    v_is_group BOOLEAN;
    v_total_members INT;
    v_other_members INT;
    v_delivered_count INT;
    v_read_count INT;
    v_required_majority INT;
    v_final_status TEXT;
BEGIN
    v_now := to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    
    -- Get current message properties
    SELECT conversation_id, sender_id, COALESCE(receipts, '{}'::jsonb) 
    INTO v_conversation_id, v_sender_id, v_current_receipts
    FROM public.messages
    WHERE id = p_message_id;
    
    IF v_conversation_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Check if group
    SELECT is_group INTO v_is_group
    FROM public.conversations
    WHERE id = v_conversation_id;
    
    v_delivered := COALESCE(v_current_receipts->'delivered', '{}'::jsonb);
    v_read := COALESCE(v_current_receipts->'read', '{}'::jsonb);
    
    IF p_status = 'delivered' THEN
        IF NOT (v_delivered ? p_user_id::text) THEN
            v_delivered := jsonb_set(v_delivered, ARRAY[p_user_id::text], v_now);
        END IF;
    ELSIF p_status = 'read' THEN
        IF NOT (v_read ? p_user_id::text) THEN
            v_read := jsonb_set(v_read, ARRAY[p_user_id::text], v_now);
        END IF;
        IF NOT (v_delivered ? p_user_id::text) THEN
            v_delivered := jsonb_set(v_delivered, ARRAY[p_user_id::text], v_now);
        END IF;
    END IF;
    
    v_current_receipts := jsonb_set(v_current_receipts, '{delivered}', v_delivered);
    v_current_receipts := jsonb_set(v_current_receipts, '{read}', v_read);
    
    IF v_is_group THEN
        -- Count total members in the group (excluding sender)
        SELECT COUNT(*) INTO v_total_members
        FROM public.conversation_members
        WHERE conversation_id = v_conversation_id AND is_left = false;
        
        v_other_members := v_total_members - 1;
        
        -- Count delivered/read keys excluding sender_id
        SELECT COUNT(distinct key) INTO v_read_count
        FROM jsonb_each_text(v_read)
        WHERE key <> v_sender_id::text;
        
        -- Delivered count includes both read and delivered
        SELECT COUNT(distinct key) INTO v_delivered_count
        FROM (
            SELECT key FROM jsonb_each_text(v_delivered)
            UNION
            SELECT key FROM jsonb_each_text(v_read)
        ) s
        WHERE key <> v_sender_id::text;
        
        IF v_other_members <= 0 THEN
            v_final_status := 'sent';
        ELSIF v_read_count >= v_other_members THEN
            v_final_status := 'read';
        ELSE
            -- Threshold formula: Math.max(1, Math.floor(v_other_members / 2))
            v_required_majority := v_other_members / 2;
            IF v_required_majority < 1 THEN
                v_required_majority := 1;
            END IF;
            
            IF v_delivered_count >= v_required_majority THEN
                v_final_status := 'delivered';
            ELSE
                v_final_status := 'sent';
            END IF;
        END IF;
    ELSE
        -- 1-to-1 conversation
        IF v_read ? (SELECT user_id::text FROM public.conversation_members WHERE conversation_id = v_conversation_id AND user_id <> v_sender_id LIMIT 1) THEN
            v_final_status := 'read';
        ELSIF v_delivered ? (SELECT user_id::text FROM public.conversation_members WHERE conversation_id = v_conversation_id AND user_id <> v_sender_id LIMIT 1) THEN
            v_final_status := 'delivered';
        ELSE
            v_final_status := 'sent';
        END IF;
    END IF;
    
    UPDATE public.messages
    SET 
        receipts = v_current_receipts,
        status = v_final_status,
        delivered_at = COALESCE(delivered_at, CASE WHEN v_final_status = 'delivered' OR v_final_status = 'read' THEN now() ELSE NULL END),
        seen_at = COALESCE(seen_at, CASE WHEN v_final_status = 'read' THEN now() ELSE NULL END)
    WHERE id = p_message_id;
    
    -- Also update conversation's last_message_status if this is the last message
    UPDATE public.conversations
    SET last_message_status = v_final_status
    WHERE id = v_conversation_id AND last_message_timestamp IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
