import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://chmkdhdihafegzhdihnm.supabase.co"
).replace(/\/$/, "");

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "sb_publishable_RGg6IQZyuGEsJ-gUQykXHQ_ppOGWDr6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
