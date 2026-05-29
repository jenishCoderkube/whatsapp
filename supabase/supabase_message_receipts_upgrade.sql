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
BEGIN
    v_now := to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    
    -- Get current receipts
    SELECT COALESCE(receipts, '{}'::jsonb) INTO v_current_receipts
    FROM public.messages
    WHERE id = p_message_id;
    
    v_delivered := COALESCE(v_current_receipts->'delivered', '{}'::jsonb);
    v_read := COALESCE(v_current_receipts->'read', '{}'::jsonb);
    
    IF p_status = 'delivered' THEN
        -- Add user delivery timestamp if not present
        IF NOT (v_delivered ? p_user_id::text) THEN
            v_delivered := jsonb_set(v_delivered, ARRAY[p_user_id::text], v_now);
        END IF;
    ELSIF p_status = 'read' THEN
        -- Add user read timestamp if not present
        IF NOT (v_read ? p_user_id::text) THEN
            v_read := jsonb_set(v_read, ARRAY[p_user_id::text], v_now);
        END IF;
        -- Also ensure user delivery timestamp is marked
        IF NOT (v_delivered ? p_user_id::text) THEN
            v_delivered := jsonb_set(v_delivered, ARRAY[p_user_id::text], v_now);
        END IF;
    END IF;
    
    -- Reconstruct receipts JSON
    v_current_receipts := jsonb_set(v_current_receipts, '{delivered}', v_delivered);
    v_current_receipts := jsonb_set(v_current_receipts, '{read}', v_read);
    
    -- Update message with new receipts and overall status
    UPDATE public.messages
    SET 
        receipts = v_current_receipts,
        status = CASE 
            WHEN status = 'read' THEN 'read'
            ELSE p_status
        END,
        delivered_at = COALESCE(delivered_at, CASE WHEN p_status = 'delivered' THEN now() ELSE NULL END),
        seen_at = COALESCE(seen_at, CASE WHEN p_status = 'read' THEN now() ELSE NULL END)
    WHERE id = p_message_id;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
