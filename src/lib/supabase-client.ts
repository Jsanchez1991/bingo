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

// Límite de tiempo por llamada HTTP a Supabase: 4.5s para evitar que cualquier endpoint en Vercel caiga en 504
const SUPABASE_FETCH_TIMEOUT_MS = 4500;

const fetchWithTimeout: typeof fetch = (input, init) => {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    const timeoutSignal = AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS);
    const signal =
      init?.signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([init.signal, timeoutSignal])
        : init?.signal || timeoutSignal;
    return fetch(input, { ...init, signal });
  }
  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
