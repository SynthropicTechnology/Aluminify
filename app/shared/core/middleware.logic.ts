import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "./supabase-public-env";
import {
  resolveTenantContext,
  extractTenantFromPath,
} from "@/app/shared/core/services/tenant-resolution.service";
import {
  compressCookieValue,
  decompressCookieValue,
  shouldCompressCookie,
  isCompressedCookie,
  buildCookieHeader,
} from "@/app/shared/core/cookie-compression";

// --- LOGGING CONFIGURATION ---
type LogLevel = "debug" | "info" | "warn" | "error" | "none";
const LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === "development" ? "info" : "warn");

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL];
}

function logDebug(message: string, ...args: unknown[]) {
  if (shouldLog("debug")) {
    console.log(`[MW:debug] ${message}`, ...args);
  }
}

function logInfo(message: string) {
  if (shouldLog("info")) {
    console.log(`[MW] ${message}`);
  }
}

function logWarn(message: string) {
  if (shouldLog("warn")) {
    console.warn(`[MW] ${message}`);
  }
}

function getSupabaseProjectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // ex: https://wtqgfmtucqmpheghcvxo.supabase.co
    const host = u.host.toLowerCase();
    const suffix = ".supabase.co";
    if (host.endsWith(suffix)) {
      const ref = host.slice(0, -suffix.length);
      return ref || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") || "";

  const isNextInternalPath =
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname.startsWith("/icon?") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json";
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");
  // Next.js App Router signals
  const isServerAction =
    request.method === "POST" && !!request.headers.get("next-action");

  // Debug Logging (Controlled) - cookies removidos por segurança
  logDebug(`${request.method} ${pathname} host:${host}`);

  // --- 1. EARLY EXIT FOR PUBLIC / STATIC ASSETS ---
  // Avoid any processing for internal Next.js paths
  if (isNextInternalPath) {
    return NextResponse.next();
  }

  // Health check must bypass all Supabase/auth logic — env vars may not be
  // available when Turbopack inlined NEXT_PUBLIC_* at build time.
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // List of public paths that don't need authentication
  // We define this early to allow skipping heavy logic
  const basePublicPaths = [
    "/login",
    "/auth",
    "/auth/login",
    "/auth/sign-up",
    "/api/auth/signup-with-empresa",
    "/api/tobias/chat/attachments", // TOBIAS-LEGACY: Remover quando TobIAs for deletado
    "/api/health",
    "/api/webhooks",
    "/",
    "/signup",
    // Landing page routes (route group: (landing-page))
    "/features",
    "/pricing",
    "/docs",
    "/opensource",
    "/roadmap",
    "/changelog",
    "/status",
    "/manifesto",
    "/contato",
    // Sentry tunnel route (next.config.ts tunnelRoute: "/monitoring")
    "/monitoring",
    // Superadmin — auth handled at app layer (requireSuperadmin / requireSuperadminForAPI)
    "/superadmin",
    "/api/superadmin",
  ];

  // Check if it matches a known public base path
  const isBasePublicPath = basePublicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  // Check if it matches a tenant public path pattern (e.g. /slug/auth/...)
  // We do this via regex/pattern extraction to avoid needing DB resolution first.
  let isTenantPublicPattern = false;
  const pathSlug = extractTenantFromPath(pathname);
  if (pathSlug) {
    const tenantPublicPrefixes = [`/${pathSlug}/auth`];
    isTenantPublicPattern = tenantPublicPrefixes.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }

  // Check for public branding API
  // Pattern: /api/empresa/personalizacao/[empresaId]/public
  const isPublicBrandingApi =
    pathname.startsWith("/api/empresa/personalizacao/") &&
    pathname.endsWith("/public");

  const isLikelyPublic =
    isBasePublicPath || isTenantPublicPattern || isPublicBrandingApi;

  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getPublicSupabaseConfig();

  // Cookie cleaning logic (Cross-project safety)
  const projectRef = getSupabaseProjectRefFromUrl(url);

  // Descompressão transparente: browser → middleware (para consumo do Supabase/server)
  // Isso reduz tamanho de headers trafegados para o Nginx sem quebrar o SDK.
  let didDecompressRequestCookies = false;
  for (const c of request.cookies.getAll()) {
    if (isCompressedCookie(c.value)) {
      const inflated = decompressCookieValue(c.value);
      request.cookies.set(c.name, inflated);
      didDecompressRequestCookies = true;
    }
  }
  let cookiesModified = didDecompressRequestCookies;
  if (projectRef) {
    const expectedPrefix = `sb-${projectRef}-auth-token`;
    const allCookies = request.cookies.getAll();
    const foreignCookies = allCookies.filter(
      (c) =>
        c.name.startsWith("sb-") &&
        c.name.includes("-auth-token") &&
        !c.name.startsWith(expectedPrefix),
    );

    if (foreignCookies.length > 0) {
      logDebug("removendo cookies Supabase de outro projeto", {
        expectedPrefix,
        foreign: foreignCookies.map((c) => c.name),
      });
      cookiesModified = true;

      for (const c of foreignCookies) {
        request.cookies.delete(c.name);
        supabaseResponse.cookies.set(c.name, "", { path: "/", maxAge: 0 });
      }
    }
  }

  // Create lightweight client
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((c) => {
          if (isCompressedCookie(c.value)) {
            return { ...c, value: decompressCookieValue(c.value) };
          }
          return c;
        });
      },
      setAll(cookiesToSet) {
        // Diagnóstico: saber quando o proxy realmente define cookies na resposta
        if (shouldLog("debug")) {
          logDebug("setAll called", {
            pathname,
            count: cookiesToSet.length,
            names: cookiesToSet.map((c) => c.name),
          });
        }

        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieValue =
            typeof value === "string" && shouldCompressCookie(name, value)
              ? compressCookieValue(value)
              : value;
          supabaseResponse.cookies.set(name, cookieValue, options);
        });
      },
    },
  });

  // --- 2. TENANT RESOLUTION (VIA SERVICE) ---
  const referer = request.headers.get("referer");
  const tenantContext = await resolveTenantContext(
    supabase,
    host,
    pathname,
    isLikelyPublic,
    { referer },
  );

  if (tenantContext.empresaId) {
    logDebug(
      `tenant resolved: ${tenantContext.empresaSlug} (${tenantContext.resolutionType})`,
    );
  }

  // Helper to sync cookies/headers
  type CookieLike = {
    name: string;
    value: string;
    path?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none" | boolean;
    domain?: string;
    priority?: "low" | "medium" | "high";
  };

  const setCookiePreservingOptions = (res: NextResponse, cookie: CookieLike) => {
    // Importante: não passar `name`/`value` dentro de options.
    // Se `path` não vier, forçamos "/" para evitar cookies "duplicados" com path do request atual.
    // httpOnly DEVE ser false para cookies de auth — o browser client precisa ler via document.cookie.
    // Se httpOnly for undefined (parseSetCookie do Next.js remove propriedades falsy via compact()),
    // forçamos false explicitamente para não depender do default do framework.
    const isAuthCookie =
      cookie.name.startsWith("sb-") && cookie.name.includes("auth-token");
    const options = {
      path: cookie.path ?? "/",
      ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
      ...(cookie.expires !== undefined ? { expires: cookie.expires } : {}),
      httpOnly: isAuthCookie ? false : (cookie.httpOnly ?? false),
      ...(cookie.secure !== undefined ? { secure: cookie.secure } : {}),
      ...(cookie.sameSite !== undefined ? { sameSite: cookie.sameSite } : {}),
      ...(cookie.domain !== undefined ? { domain: cookie.domain } : {}),
      ...(cookie.priority !== undefined ? { priority: cookie.priority } : {}),
    };
    res.cookies.set(cookie.name, cookie.value, options);
  };

  const copyCookiesAndHeaders = (target: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      setCookiePreservingOptions(target, cookie as unknown as CookieLike);
    });
    if (tenantContext.empresaId) {
      target.headers.set("x-tenant-id", tenantContext.empresaId);
    }
    if (tenantContext.empresaSlug) {
      target.headers.set("x-tenant-slug", tenantContext.empresaSlug);
    }
    return target;
  };

  // --- 3. PUBLIC PATH CHECK ---
  // Re-verify public path status with resolved tenant context (if any)
  // This allows logic like `/${tenant}/auth` to be correctly whitelistd even if strict per-tenant check matches.

  const publicPaths = [...basePublicPaths];
  if (tenantContext.empresaSlug) {
    publicPaths.push(`/${tenantContext.empresaSlug}/auth`);
    publicPaths.push(`/${tenantContext.empresaSlug}/auth/login`);
    publicPaths.push(`/${tenantContext.empresaSlug}/auth/sign-up`);
  }

  const isPublicPath =
    publicPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    isTenantPublicPattern ||
    isPublicBrandingApi;

  // --- 4. AUTHENTICATION (PROTECTED ROUTES ONLY) ---
  let user = null;
  let error = null;
  let authSignal_hasBearer = false;
  let authSignal_cookieHeaderLen = 0;
  let authSignal_hasAuthCookies: boolean | null = null;
  let authSignal_authCookieCount: number | null = null;
  let authSignal_totalCookieCount: number | null = null;
  let authSignal_compressedCookieCount: number | null = null;

  if (!isPublicPath) {
    // Suporte a Bearer token (ex.: fetch client-side com Authorization) —
    // o middleware não pode depender exclusivamente de cookies, senão APIs
    // autenticadas por header acabam recebendo 401 indevidamente.
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken =
      authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    authSignal_hasBearer = !!bearerToken;

    // Verificar se existem cookies de auth do Supabase antes de chamar getUser().
    // Sem cookies, o SDK tentaria refresh e falharia com "refresh_token_not_found",
    // logando Error [AuthApiError] desnecessariamente no console do servidor.
    const authCookiePrefix = projectRef ? `sb-${projectRef}-auth-token` : null;
    const allRequestCookies = request.cookies.getAll();
    const hasAuthCookies = authCookiePrefix
      ? allRequestCookies.some((c) => c.name.startsWith(authCookiePrefix))
      : true; // Se não conseguimos determinar o prefixo, prosseguir normalmente
    authSignal_cookieHeaderLen = request.headers.get("cookie")?.length ?? 0;
    authSignal_hasAuthCookies = hasAuthCookies;
    authSignal_totalCookieCount = allRequestCookies.length;
    authSignal_authCookieCount = authCookiePrefix
      ? allRequestCookies.filter((c) => c.name.startsWith(authCookiePrefix)).length
      : null;
    authSignal_compressedCookieCount = allRequestCookies.filter((c) =>
      isCompressedCookie(c.value),
    ).length;

    // Observabilidade: ajuda a diagnosticar "logout ao navegar" sem expor valores.
    // Sinais úteis:
    // - Bearer presente mas cookie ausente (client fetch)
    // - Cookie header muito grande (proxy pode truncar/derrubar)
    // - Cookies comprimidos presentes (pako:) mas ausentes do prefixo esperado
    if (shouldLog("debug")) {
      const cookieHeaderLen = request.headers.get("cookie")?.length ?? 0;
      const authCookieCount = authCookiePrefix
        ? allRequestCookies.filter((c) => c.name.startsWith(authCookiePrefix))
            .length
        : 0;
      const compressedCount = allRequestCookies.filter((c) =>
        isCompressedCookie(c.value),
      ).length;
      logDebug("auth signals", {
        pathname,
        isApiRoute,
        hasBearer: !!bearerToken,
        hasAuthCookies,
        authCookiePrefix: authCookiePrefix ?? null,
        authCookieCount,
        totalCookieCount: allRequestCookies.length,
        compressedCookieCount: compressedCount,
        cookieHeaderLen,
        tenant: tenantContext.empresaSlug ?? null,
        tenantResolutionType: tenantContext.resolutionType ?? null,
      });
    }

    if (hasAuthCookies) {
      const result = await supabase.auth.getUser();
      // Se o erro for refresh_token_not_found, trata como usuário não autenticado (não é erro fatal)
      if (
        result.error &&
        (result.error.code === "refresh_token_not_found" ||
          result.error.message
            ?.toLowerCase()
            .includes("refresh token not found"))
      ) {
        user = null;
        error = null;
      } else {
        user = result.data.user;
        error = result.error;
      }
    }

    // Fallback: se não achamos user via cookie (ou não havia cookies),
    // tentamos via Authorization: Bearer <jwt>.
    // Importante: fazemos isso só quando necessário para não pagar custo em toda request.
    if ((!user || error) && bearerToken) {
      const result = await supabase.auth.getUser(bearerToken);
      if (!result.error && result.data.user) {
        user = result.data.user;
        error = null;
      } else {
        // Se o Bearer também falhar, mantemos o estado (user null / error existente)
        // para o fluxo de 401/redirect abaixo.
        // Não logamos o token por segurança.
      }
    }
  }

  // --- 5. REDIRECTS & REWRITES ---

  // Handle tenant-specific login redirects
  if (tenantContext.empresaId && tenantContext.resolutionType !== "slug") {
    if (pathname === "/auth" || pathname === "/auth/login") {
      const url = request.nextUrl.clone();
      url.pathname = `/${tenantContext.empresaSlug}/auth/login`;
      logInfo(`rewrite /auth → ${url.pathname}`);

      const response = NextResponse.rewrite(url);
      if (tenantContext.empresaId) {
        response.headers.set("x-tenant-id", tenantContext.empresaId);
      }
      if (tenantContext.empresaSlug) {
        response.headers.set("x-tenant-slug", tenantContext.empresaSlug);
      }

      supabaseResponse.cookies.getAll().forEach((cookie) => {
        setCookiePreservingOptions(response, cookie as unknown as CookieLike);
      });

      return response;
    }
  }

  // Handle Unauthenticated
  if ((!user || error) && !isPublicPath) {
    if (isNextInternalPath) return supabaseResponse;

    // APIs should receive 401 JSON. Page navigations (including RSC/NextData)
    // should redirect to login so the Next.js client can recover gracefully.
    if (isApiRoute || request.method !== "GET" || isServerAction) {
      logWarn(
        `${request.method} ${pathname} → 401 unauthorized (hasBearer=${authSignal_hasBearer} cookieHeaderLen=${authSignal_cookieHeaderLen} hasAuthCookies=${String(authSignal_hasAuthCookies)} authCookieCount=${String(authSignal_authCookieCount)} totalCookies=${String(authSignal_totalCookieCount)} compressedCookies=${String(authSignal_compressedCookieCount)})`,
      );
      if (shouldLog("debug")) {
        logDebug("unauthorized details", {
          pathname,
          isApiRoute,
          method: request.method,
          // Evitar logar error completo (pode conter detalhes do Supabase)
          hasUser: !!user,
          hasError: !!error,
          tenant: tenantContext.empresaSlug ?? null,
        });
      }
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      response.headers.set("cache-control", "no-store");
      return copyCookiesAndHeaders(response);
    }

    // === DIAGNÓSTICO TEMPORÁRIO: entender logout ao navegar ===
    console.warn("[MW] AUTH REDIRECT DEBUG:", {
      pathname,
      hasUser: !!user,
      hasError: !!error,
      errorMsg: error?.message ?? null,
      hasAuthCookies: authSignal_hasAuthCookies,
      authCookieCount: authSignal_authCookieCount,
      totalCookies: authSignal_totalCookieCount,
      compressedCookies: authSignal_compressedCookieCount,
      cookieHeaderLen: authSignal_cookieHeaderLen,
      tenant: tenantContext.empresaSlug ?? null,
    });
    // === FIM DIAGNÓSTICO ===

    const url = request.nextUrl.clone();
    if (tenantContext.empresaSlug) {
      url.pathname = `/${tenantContext.empresaSlug}/auth/login`;
    } else {
      url.pathname = "/auth";
    }
    logInfo(`${request.method} ${pathname} → 302 redirect (no auth)`);
    return copyCookiesAndHeaders(NextResponse.redirect(url));
  }

  // Add headers
  if (tenantContext.empresaId) {
    supabaseResponse.headers.set("x-tenant-id", tenantContext.empresaId);
  }
  if (tenantContext.empresaSlug) {
    supabaseResponse.headers.set("x-tenant-slug", tenantContext.empresaSlug);
  }

  // --- 6. FINALIZE RESPONSE ---
  // We must create a new response that includes the request headers we want to pass to Server Components.
  // The original 'supabaseResponse' has the cookies set by createServerClient, so we must copy them.

  const requestHeaders = new Headers(request.headers);
  // Importante: mudanças em `request.cookies.set(...)` não garantem que o header
  // `cookie` repassado para Server Components seja atualizado. Reconstituímos aqui.
  if (cookiesModified) {
    requestHeaders.set(
      "cookie",
      buildCookieHeader(
        request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      ),
    );
  }
  if (tenantContext.empresaId) {
    requestHeaders.set("x-tenant-id", tenantContext.empresaId);
  }
  if (tenantContext.empresaSlug) {
    requestHeaders.set("x-tenant-slug", tenantContext.empresaSlug);
  }

  const finalResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Copy cookies from supabaseResponse (which has auth updates) to finalResponse
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    setCookiePreservingOptions(finalResponse, cookie as unknown as CookieLike);
  });

  // Copy output headers (x-tenant-id, x-tenant-slug, etc.) from supabaseResponse
  supabaseResponse.headers.forEach((value, key) => {
    finalResponse.headers.set(key, value);
  });

  // --- 7. MONITORAMENTO: TAMANHO DOS HEADERS ---
  const headerSize =
    JSON.stringify(Object.fromEntries(finalResponse.headers)).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__headerSizeTotalBytes =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).__headerSizeTotalBytes ?? 0) + headerSize;
  if (headerSize > 8192) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__headerSizeWarnings =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((globalThis as any).__headerSizeWarnings ?? 0) + 1;
  }
  if (process.env.NODE_ENV === "development") {
    console.log(`[MW] Header size: ${headerSize} bytes`);
    if (headerSize > 8192) {
      console.warn(`[MW] WARNING: Headers exceeding 8KB (${headerSize} bytes)`);
    }
  }

  return finalResponse;
}
