import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getPublicSupabaseConfig } from "./supabase-public-env";
import {
  compressCookieValue,
  decompressCookieValue,
  isCompressedCookie,
  shouldCompressCookie,
} from "@/app/shared/core/cookie-compression";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

// Proteção contra deleção acidental de cookies de auth pelo auth-js.
// O auth-js (GoTrueClient) chama _removeSession() internamente durante
// _recoverAndRefresh() ou __loadSession() quando interpreta a sessão como
// inválida. Isso apaga os cookies do browser e causa "logout" inesperado
// na próxima navegação (server não encontra cookies → redirect login).
// Só permitimos a deleção quando explicitamente habilitada (antes de signOut).
let _allowAuthCookieDeletion = false;

/**
 * Permite que a próxima chamada de setAll delete cookies de auth.
 * Chamar ANTES de supabase.auth.signOut() no logout.
 */
export function enableAuthCookieDeletion() {
  _allowAuthCookieDeletion = true;
}

// Evita flood no console quando o auth-js tenta refresh/retry.
const SUPABASE_FETCH_LOG_THROTTLE_MS = 5_000;
const supabaseFetchLogLastAt = new Map<string, number>();

/**
 * Lê todos os cookies do navegador (document.cookie) e retorna como array.
 * Descomprime valores com prefixo "pako:" automaticamente.
 */
function getAllBrowserCookies(): Array<{ name: string; value: string }> {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split(";").map((pair) => {
    const trimmed = pair.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) return { name: trimmed, value: "" };
    const name = trimmed.slice(0, eqIdx);
    let rawValue = trimmed.slice(eqIdx + 1);
    // URL-decode: o proxy (ResponseCookies.set) usa encodeURIComponent ao definir
    // Set-Cookie headers, transformando "pako:..." em "pako%3A...". Sem o decode,
    // isCompressedCookie() não reconhece o valor e o auth-js interpreta como sessão
    // inválida, chamando _removeSession() e apagando todos os cookies de auth.
    try {
      rawValue = decodeURIComponent(rawValue);
    } catch {
      // Se o valor não for válido para decode (improvável), mantém o original
    }
    // Descomprime cookies de auth que foram comprimidos pelo middleware/server
    const value = isCompressedCookie(rawValue)
      ? decompressCookieValue(rawValue)
      : rawValue;
    return { name, value };
  });
}

/**
 * Grava um cookie no navegador via document.cookie, comprimindo se necessário.
 */
function setBrowserCookie(
  name: string,
  value: string,
  options?: Record<string, unknown>,
): void {
  if (typeof document === "undefined") return;
  const cookieValue = shouldCompressCookie(name, value)
    ? compressCookieValue(value)
    : value;
  let str = `${name}=${cookieValue}`;
  // Importante: default para "/" para evitar cookies presos ao path atual
  // (ex.: /[tenant]/auth/login) e que não são enviados para /api/*,
  // causando 401 e "logout" em navegações.
  str += `; path=${String(options?.path ?? "/")}`;
  if (options?.maxAge !== undefined) str += `; max-age=${options.maxAge}`;
  if (options?.domain) str += `; domain=${String(options.domain)}`;
  const isHttps =
    typeof window !== "undefined" && window.location?.protocol === "https:";

  // SameSite=None exige Secure em navegadores modernos.
  // Em HTTP (localhost/dev), isso faria o cookie ser rejeitado silenciosamente.
  // Então, quando não é HTTPS, rebaixamos None → Lax.
  const rawSameSite = options?.sameSite;
  const normalizedSameSite =
    rawSameSite === undefined || rawSameSite === null
      ? null
      : String(rawSameSite).toLowerCase();
  const sameSiteToUse =
    !isHttps && normalizedSameSite === "none" ? "lax" : normalizedSameSite;
  if (sameSiteToUse) {
    str += `; samesite=${sameSiteToUse}`;
  }

  // Em ambiente HTTP (ex.: localhost), cookies com `secure` não são enviados.
  // Só aplicamos `secure` quando estamos em HTTPS.
  if (options?.secure && isHttps) str += `; secure`;
  document.cookie = str;
}

export function createClient() {
  // No browser, reutilize um único client para evitar múltiplos auto-refresh concorrendo.
  if (typeof window !== "undefined" && browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getPublicSupabaseConfig();

  const wrappedFetch: typeof fetch = async (...args) => {
    try {
      return await fetch(...args);
    } catch (error) {
      // Ajuda a debugar "Failed to fetch" (DNS/CORS/bloqueio de extensão/proxy)
      const input = args[0] as unknown;
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : typeof input === "object" && input && "url" in input
              ? String((input as { url: string }).url)
              : undefined;

      const pageOrigin =
        typeof window !== "undefined" && typeof window.location !== "undefined"
          ? window.location.origin
          : undefined;

      const online =
        typeof navigator !== "undefined" &&
        typeof navigator.onLine === "boolean"
          ? navigator.onLine
          : undefined;

      const supabaseOrigin = (() => {
        try {
          const u = new URL(url);
          return `${u.protocol}//${u.host}`;
        } catch {
          return url;
        }
      })();

      const hints: string[] = [];
      try {
        if (requestUrl) {
          const req = new URL(requestUrl, pageOrigin ?? undefined);
          if (
            pageOrigin &&
            req.protocol === "http:" &&
            pageOrigin.startsWith("https:")
          ) {
            hints.push("mixed-content (página https chamando recurso http)");
          }
        }
      } catch {
        // Ignore: requestUrl pode ser relativo/estranho; não queremos falhar o log
      }
      if (online === false) hints.push("navegador offline");
      if (!hints.length) {
        hints.push(
          "possível bloqueio por extensão/proxy/firewall/DNS, ou erro de CORS/CSP",
        );
      }

      // Evitar logar headers/sensíveis. Só URL + erro.
      const message = [
        "[Supabase] fetch falhou no navegador.",
        requestUrl ? `requestUrl=${requestUrl}` : "requestUrl=(indisponível)",
        pageOrigin ? `pageOrigin=${pageOrigin}` : "pageOrigin=(indisponível)",
        `supabaseOrigin=${supabaseOrigin}`,
        typeof online === "boolean"
          ? `online=${online}`
          : "online=(indisponível)",
        `hints=${hints.join(" | ")}`,
        `error=${error instanceof Error ? error.message : String(error)}`,
      ].join(" ");

      const key = `${requestUrl ?? "requestUrl=(indisponível)"}|${error instanceof Error ? error.message : String(error)}`;
      const now = Date.now();
      const last = supabaseFetchLogLastAt.get(key) ?? 0;
      const shouldLog = now - last >= SUPABASE_FETCH_LOG_THROTTLE_MS;
      if (shouldLog) {
        supabaseFetchLogLastAt.set(key, now);
        // Se o navegador estiver offline, isso é esperado — não tratar como erro “alto”.
        if (online === false) {
          console.warn(message);
        } else {
          console.error(message);
          // Mantém o erro original no console (stack/causa), sem vazar headers/chaves.
          console.error(error);
        }
      }

      // Evitar "TypeError: Failed to fetch" estourando como exceção não tratada.
      // Em vez de lançar, retornamos uma Response 503 para que o Supabase consiga
      // tratar como erro HTTP (mais fácil de capturar/mostrar no UI).
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          requestUrl: requestUrl ?? null,
          online: typeof online === "boolean" ? online : null,
        }),
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  };

  const client = createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return getAllBrowserCookies();
      },
      setAll(cookiesToSet) {
        // Detectar se é uma deleção pura de cookies de auth (sem novos valores).
        // Isso acontece quando auth-js chama _removeSession() internamente.
        // Em caso de token refresh, o setAll inclui AMBOS: remoções de chunks
        // antigos + novos cookies — isso é legítimo e não bloqueamos.
        const isAuthCookie = (c: { name: string }) =>
          c.name.startsWith("sb-") && c.name.includes("auth-token");
        const isDeletion = (c: { value: string; options?: Record<string, unknown> }) =>
          !c.value ||
          (c.options &&
            typeof c.options === "object" &&
            "maxAge" in c.options &&
            c.options.maxAge === 0);

        const authDeletions = cookiesToSet.filter(
          (c) => isAuthCookie(c) && isDeletion(c),
        );
        const authSets = cookiesToSet.filter(
          (c) => isAuthCookie(c) && !isDeletion(c),
        );

        if (
          authDeletions.length > 0 &&
          authSets.length === 0 &&
          !_allowAuthCookieDeletion
        ) {
          // Bloqueamos deleção acidental. Processamos apenas cookies não-auth.
          cookiesToSet
            .filter((c) => !isAuthCookie(c))
            .forEach(({ name, value, options }) => {
              setBrowserCookie(name, value, options);
            });
          return;
        }

        // Reset do flag após uso (permite apenas uma deleção intencional).
        if (_allowAuthCookieDeletion && authDeletions.length > 0) {
          _allowAuthCookieDeletion = false;
        }

        cookiesToSet.forEach(({ name, value, options }) => {
          setBrowserCookie(name, value, options);
        });
      },
    },
    auth: {
      autoRefreshToken:
        typeof window !== "undefined" &&
        // Em dev local, desabilitamos auto-refresh para evitar avalanche de /token
        // quando houver sessão corrompida/refresh token inválido.
        !["localhost", "127.0.0.1"].includes(window.location.hostname) &&
        !window.location.pathname.includes("/auth/"),
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: wrappedFetch,
    },
  });

  if (typeof window !== "undefined") {
    browserClient = client;
  }

  return client;
}
