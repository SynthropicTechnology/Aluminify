import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AuthenticatedRequest } from "@/app/[tenant]/auth/middleware";
import type { Database } from "@/lib/database.types";
import { env } from "@/app/shared/core/env";
import { getDatabaseClientAsUser } from "./database";
import { createClient as createServerClient } from "../server";

let cachedClient: SupabaseClient<Database> | null = null;
let cachedServiceClient: SupabaseClient<Database> | null = null;

function getDatabaseCredentials() {
  const DATABASE_URL = env.SUPABASE_URL;
  /**
   * Para o client "normal" (user-scoped/RLS), preferimos anon/publishable.
   * Ainda assim, mantemos fallback para chaves server-side por compatibilidade,
   * mas o caminho admin deve SEMPRE usar getServiceRoleClient().
   */
  const DATABASE_KEY =
    env.SUPABASE_ANON_KEY ??
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ??
    env.SUPABASE_SERVICE_ROLE_KEY ??
    env.SUPABASE_SECRET_KEY;

  if (!DATABASE_KEY) {
    throw new Error(
      "Database credentials are not configured. Configure anon/publishable key for user-scoped operations.",
    );
  }

  return { DATABASE_URL, DATABASE_KEY };
}

function getServiceRoleKey() {
  return env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
}

function assertLooksLikeSupabaseApiKey(key: string): void {
  const trimmed = key.trim();
  // Aceitar formatos novos (sb_...) e formatos antigos (JWT com 3 partes).
  const looksLikeSbKey = trimmed.startsWith("sb_");
  const looksLikeJwt = trimmed.split(".").length === 3;
  if (!looksLikeSbKey && !looksLikeJwt) {
    throw new Error(
      "Chave server-side inválida para Supabase. Configure SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY no formato sb_secret_.../JWT).",
    );
  }
}

export function getDatabaseClient(): SupabaseClient<Database> {
  if (!cachedClient) {
    const { DATABASE_URL, DATABASE_KEY } = getDatabaseCredentials();
    cachedClient = createClient<Database>(DATABASE_URL, DATABASE_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }
  return cachedClient;
}

export function getServiceRoleClient(): SupabaseClient<Database> {
  const SERVICE_ROLE_KEY = getServiceRoleKey();
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "Service role key is required. Configure SUPABASE_SERVICE_ROLE_KEY (server-side).",
    );
  }
  assertLooksLikeSupabaseApiKey(SERVICE_ROLE_KEY);

  if (!cachedServiceClient) {
    const { DATABASE_URL } = getDatabaseCredentials();
    cachedServiceClient = createClient<Database>(DATABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }
  return cachedServiceClient;
}

/**
 * Retorna o cliente do Supabase apropriado baseado no tipo de autenticação
 * - Se for autenticação via API Key, usa o service role client (bypass RLS)
 * - Se for autenticação via JWT Bearer, usa getDatabaseClientAsUser (respeita RLS)
 * - Se for autenticação via Cookie, usa createClient (respeita RLS)
 */
export async function getAuthenticatedClient(
  request: AuthenticatedRequest,
): Promise<SupabaseClient<Database>> {
  // Se for autenticação via API Key, usar service role para bypass RLS
  if (request.apiKey) {
    return getServiceRoleClient();
  }

  // Se for autenticação via JWT (Bearer token), usar cliente específico com o token
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    return getDatabaseClientAsUser(token);
  }

  // Fallback para autenticação via cookie (SSR)
  return createServerClient();
}

