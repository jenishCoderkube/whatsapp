-- ============================================================================
-- HIGHLY SCALABLE STATUS/STORIES SYSTEM RPC MIGRATION
-- ============================================================================
-- Run this script in your Supabase SQL editor to create the high-performance
-- get_visible_statuses function.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_visible_statuses(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    type TEXT,
    media_url TEXT,
    caption TEXT,
    text_content TEXT,
    bg_color TEXT,
    text_style TEXT,
    privacy TEXT,
    privacy_list UUID[],
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    profiles JSONB,
    views JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH contact_ids AS (
        -- Get contacts (people sharing any conversation with p_user_id)
        SELECT DISTINCT cm2.user_id AS contact_id
        FROM public.conversation_members cm1
        JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
        WHERE cm1.user_id = p_user_id AND cm2.user_id <> p_user_id
    ),
    allowed_users AS (
        -- User can view own statuses and contacts' statuses
        SELECT p_user_id AS allowed_id
        UNION
        SELECT contact_id FROM contact_ids
    ),
    filtered_statuses AS (
        -- Filter statuses based on expiration and privacy logic
        SELECT s.*
        FROM public.statuses s
        JOIN allowed_users au ON s.user_id = au.allowed_id
        WHERE s.expires_at > now()
          AND (
            s.user_id = p_user_id
            OR s.privacy = 'everyone'
            OR (
                s.privacy = 'contacts'
                AND EXISTS (SELECT 1 FROM contact_ids WHERE contact_id = s.user_id)
            )
            OR (s.privacy = 'selected' AND p_user_id = ANY(s.privacy_list))
            OR (
                s.privacy = 'hide'
                AND NOT (p_user_id = ANY(s.privacy_list))
                AND EXISTS (SELECT 1 FROM contact_ids WHERE contact_id = s.user_id)
            )
          )
    ),
    status_views_agg AS (
        -- Aggregate status views on database side to save network traffic
        SELECT 
            sv.status_id,
            jsonb_agg(
                jsonb_build_object(
                    'viewerId', sv.viewer_id,
                    'name', p.name,
                    'avatar', p.avatar,
                    'reaction', sv.reaction,
                    'replyText', 
                        CASE 
                            WHEN sv.reply_text LIKE '|||VOTE:%' THEN NULL
                            WHEN sv.reply_text LIKE '|||ANSWER:%' THEN NULL
                            ELSE sv.reply_text
                        END,
                    'voteOptionId', 
                        CASE 
                            WHEN sv.reply_text LIKE '|||VOTE:%' THEN substring(sv.reply_text from 9)
                            ELSE NULL
                        END,
                    'questionAnswer', 
                        CASE 
                            WHEN sv.reply_text LIKE '|||ANSWER:%' THEN substring(sv.reply_text from 11)
                            ELSE NULL
                        END,
                    'createdAt', sv.created_at
                )
            ) AS views_list
        FROM public.status_views sv
        JOIN public.profiles p ON sv.viewer_id = p.id
        WHERE sv.status_id IN (SELECT fs.id FROM filtered_statuses fs)
        GROUP BY sv.status_id
    )
    SELECT 
        fs.id,
        fs.user_id,
        fs.type,
        fs.media_url,
        fs.caption,
        fs.text_content,
        fs.bg_color,
        fs.text_style,
        fs.privacy,
        fs.privacy_list,
        fs.created_at,
        fs.expires_at,
        jsonb_build_object('id', p.id, 'name', p.name, 'avatar', p.avatar) AS profiles,
        coalesce(sva.views_list, '[]'::jsonb) AS views
    FROM filtered_statuses fs
    JOIN public.profiles p ON fs.user_id = p.id
    LEFT JOIN status_views_agg sva ON fs.id = sva.status_id;
END;
$$;
