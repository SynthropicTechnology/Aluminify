import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Resolve Supabase URL (same as rest of app). */
function getSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Supabase URL not configured. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL."
    );
  }
  return url;
}

/** Resolve anon/publishable key (same names as env validation). */
function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Supabase anon key not configured. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY (or SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY)."
    );
  }
  return key;
}

export async function createAuthenticatedClient() {
  const cookieStore = await cookies();

  // Create a server client that can access cookies
  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
