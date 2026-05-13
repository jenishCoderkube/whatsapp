"use client";

import { createClient } from "@supabase/supabase-js";

// Load backend credentials from environment variables.
// Fallback demo strings are supported to keep client code compilable and functional
// during local configuration setups.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo-project.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-placeholder-anon-key";

// Instantiate robust, highly optimized single client instance.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20, // rate limitation support preventing connection throttling
    },
  },
});
