import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Turbopack replaces `process.env.NEXT_PUBLIC_*` at build time; dynamic key
// access prevents static replacement so values are resolved at runtime.
function runtimeEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

/** Resolve Supabase URL (same as rest of app). */
function getSupabaseUrl(): string {
  const url =
    runtimeEnv("NEXT_PUBLIC_SUPABASE_URL") || runtimeEnv("SUPABASE_URL");
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
    runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY") ||
    runtimeEnv("SUPABASE_ANON_KEY") ||
    runtimeEnv("SUPABASE_PUBLISHABLE_KEY");
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
