-- Create live_locations table to track active coordinates of users sharing location
CREATE TABLE IF NOT EXISTS public.live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- Policies for live_locations
DROP POLICY IF EXISTS "Allow authenticated full access to live_locations" ON public.live_locations;
CREATE POLICY "Allow authenticated full access to live_locations" ON public.live_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Supabase Realtime tracking for live_locations updates
ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
