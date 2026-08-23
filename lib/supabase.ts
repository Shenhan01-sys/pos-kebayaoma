import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseReady = !!url && !!anonKey;

if (!isSupabaseReady) {
  // Allow build/dev to proceed; the warning surfaces at runtime if used.
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set. Salin .env.local.example -> .env.local"
  );
}

// Browser client (anon key). RLS scopes all rows to the default store.
export const supabase: SupabaseClient = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? "";
