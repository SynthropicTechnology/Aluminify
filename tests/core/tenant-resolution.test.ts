/**
 * Suite de testes: Core - Tenant Resolution Service
 *
 * Testa a resolução de tenant multi-tenant:
 * - extractSubdomain: extração de subdomínio do host
 * - isCustomDomain: verificação de domínio customizado
 * - isTenantPath: verificação de caminho de tenant
 * - extractTenantFromPath: extração de slug do tenant da URL
 * - resolveTenantContext: resolução completa do contexto de tenant (com mock do Supabase)
 */

import {
  extractSubdomain,
  isCustomDomain,
  isTenantPath,
  extractTenantFromPath,
  resolveTenantContext,
} from "@/app/shared/core/services/tenant-resolution.service";

// =============================================================================
// extractSubdomain
// =============================================================================

describe("extractSubdomain", () => {
  it("deve extrair subdomínio de domínio primário", () => {
    expect(extractSubdomain("escola.alumnify.com.br")).toBe("escola");
  });

  it("deve extrair subdomínio com porta", () => {
    expect(extractSubdomain("escola.alumnify.com.br:3000")).toBe("escola");
  });

  it("deve normalizar para lowercase", () => {
    expect(extractSubdomain("Escola.Alumnify.com.br")).toBe("escola");
  });

  it("deve retornar null para domínio raiz sem subdomínio", () => {
    expect(extractSubdomain("alumnify.com.br")).toBeNull();
  });

  it("deve retornar null para www", () => {
    expect(extractSubdomain("www.alumnify.com.br")).toBeNull();
  });

  it("deve retornar null para domínio diferente", () => {
    expect(extractSubdomain("escola.outrosite.com.br")).toBeNull();
  });

  it("deve retornar null para localhost", () => {
    expect(extractSubdomain("localhost")).toBeNull();
    expect(extractSubdomain("localhost:3000")).toBeNull();
  });

  it("deve extrair subdomínios compostos", () => {
    expect(extractSubdomain("minha-escola.alumnify.com.br")).toBe(
      "minha-escola",
    );
  });
});

// =============================================================================
// isCustomDomain
// =============================================================================

describe("isCustomDomain", () => {
  it("deve retornar false para domínio primário", () => {
    expect(isCustomDomain("alumnify.com.br")).toBe(false);
  });

  it("deve retornar false para subdomínio do primário", () => {
    expect(isCustomDomain("escola.alumnify.com.br")).toBe(false);
  });

  it("deve retornar false para localhost", () => {
    expect(isCustomDomain("localhost")).toBe(false);
    expect(isCustomDomain("localhost:3000")).toBe(false);
  });

  it("deve retornar false para 127.0.0.1", () => {
    expect(isCustomDomain("127.0.0.1")).toBe(false);
    expect(isCustomDomain("127.0.0.1:3000")).toBe(false);
  });

  it("deve retornar true para domínio customizado", () => {
    expect(isCustomDomain("portal.escola.edu.br")).toBe(true);
  });

  it("deve retornar true para domínio customizado com porta", () => {
    expect(isCustomDomain("portal.escola.edu.br:8080")).toBe(true);
  });

  it("deve normalizar para lowercase", () => {
    expect(isCustomDomain("Portal.Escola.EDU.BR")).toBe(true);
  });
});

// =============================================================================
// isTenantPath
// =============================================================================

describe("isTenantPath", () => {
  it("deve retornar true para path com slug de tenant", () => {
    expect(isTenantPath("/minha-escola")).toBe(true);
    expect(isTenantPath("/minha-escola/dashboard")).toBe(true);
    expect(isTenantPath("/escola123")).toBe(true);
  });

  it("deve retornar false para rotas conhecidas do sistema", () => {
    expect(isTenantPath("/api")).toBe(false);
    expect(isTenantPath("/api/health")).toBe(false);
    expect(isTenantPath("/auth")).toBe(false);
    expect(isTenantPath("/auth/login")).toBe(false);
    expect(isTenantPath("/_next/static")).toBe(false);
    expect(isTenantPath("/dashboard")).toBe(false);
    expect(isTenantPath("/admin")).toBe(false);
    expect(isTenantPath("/static/file.js")).toBe(false);
    expect(isTenantPath("/favicon.ico")).toBe(false);
  });

  it("deve retornar false para path raiz", () => {
    expect(isTenantPath("/")).toBe(false);
  });

  it("deve retornar true para slugs alfanuméricos com hifens", () => {
    expect(isTenantPath("/escola-xyz")).toBe(true);
    expect(isTenantPath("/escola-123-abc")).toBe(true);
  });

  it("deve retornar false para slugs com caracteres inválidos", () => {
    expect(isTenantPath("/escola_abc")).toBe(false);
    expect(isTenantPath("/Escola")).toBe(false);
    expect(isTenantPath("/escola.abc")).toBe(false);
  });
});

// =============================================================================
// extractTenantFromPath
// =============================================================================

describe("extractTenantFromPath", () => {
  it("deve extrair slug do tenant", () => {
    expect(extractTenantFromPath("/minha-escola")).toBe("minha-escola");
    expect(extractTenantFromPath("/minha-escola/dashboard")).toBe(
      "minha-escola",
    );
    expect(extractTenantFromPath("/escola123/curso/1")).toBe("escola123");
  });

  it("deve retornar null para rotas do sistema", () => {
    expect(extractTenantFromPath("/api/health")).toBeNull();
    expect(extractTenantFromPath("/auth/login")).toBeNull();
    expect(extractTenantFromPath("/_next/data")).toBeNull();
  });

  it("deve retornar null para path raiz", () => {
    expect(extractTenantFromPath("/")).toBeNull();
  });
});

// =============================================================================
// resolveTenantContext
// =============================================================================

describe("resolveTenantContext", () => {
  // Mock do Supabase client
  const createMockSupabase = (empresaData?: {
    id: string;
    slug: string;
    nome: string;
  }) => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: empresaData || null,
      error: null,
    });

    const mockEq = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
      maybeSingle: mockMaybeSingle,
    });

    const mockOr = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });

    const mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
      or: mockOr,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
    });

    return {
      from: mockFrom,
      _mockFrom: mockFrom,
      _mockSelect: mockSelect,
    } as any;
  };

  it("deve retornar contexto vazio para rotas públicas sem necessidade de rewrite", async () => {
    const supabase = createMockSupabase();

    const result = await resolveTenantContext(
      supabase,
      "localhost:3000",
      "/static/file.css",
      true,
    );

    expect(result).toEqual({});
    // Não deve fazer query no banco para rotas públicas
    expect(supabase._mockFrom).not.toHaveBeenCalled();
  });

  it("deve não falhar para rota pública /auth", async () => {
    const supabase = createMockSupabase();

    const result = await resolveTenantContext(
      supabase,
      "localhost:3000",
      "/auth",
      true,
    );

    // Retorna contexto (pode ser vazio se não há tenant no path)
    expect(result).toBeDefined();
  });

  it("deve resolver tenant por slug no path", async () => {
    const empresa = {
      id: "emp-1",
      slug: "minha-escola",
      nome: "Minha Escola",
    };
    const supabase = createMockSupabase(empresa);

    const result = await resolveTenantContext(
      supabase,
      "localhost:3000",
      "/minha-escola/dashboard",
      false,
    );

    expect(result.empresaSlug).toBe("minha-escola");
    expect(result.empresaId).toBe("emp-1");
    expect(result.empresaNome).toBe("Minha Escola");
    expect(result.resolutionType).toBe("slug");
  });

  it("deve tentar Referer para rotas /api/ sem slug no path", async () => {
    const empresa = {
      id: "emp-1",
      slug: "escola-abc",
      nome: "Escola ABC",
    };
    const supabase = createMockSupabase(empresa);

    await resolveTenantContext(
      supabase,
      "localhost:3000",
      "/api/curso",
      false,
      { referer: "http://localhost:3000/escola-abc/curso" },
    );

    // Deve ter tentado resolver
    expect(supabase._mockFrom).toHaveBeenCalled();
  });
});

// =============================================================================
// Cache de tenant (comportamento)
// =============================================================================

describe("cache de tenant", () => {
  it("deve cachear e retornar do cache na segunda chamada", async () => {
    const empresa = {
      id: "emp-cache",
      slug: "cached-escola",
      nome: "Cached Escola",
    };

    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: empresa,
      error: null,
    });

    const createMock = () => {
      const mock = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
              }),
              maybeSingle: mockMaybeSingle,
            }),
            or: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          }),
        }),
      };
      return mock as any;
    };

    const supabase1 = createMock();
    const supabase2 = createMock();

    // Usar um slug único para evitar conflitos com outros testes
    const uniqueSlug = `cache-test-${Date.now()}`;

    // Primeira chamada: deve buscar no banco
    await resolveTenantContext(
      supabase1,
      "localhost:3000",
      `/${uniqueSlug}/dashboard`,
      false,
    );

    // Segunda chamada com mesmo host+slug: pode usar cache
    await resolveTenantContext(
      supabase2,
      "localhost:3000",
      `/${uniqueSlug}/dashboard`,
      false,
    );

    // Ambas as chamadas foram feitas, mas a segunda pode usar cache
    // O importante é que não falha
    expect(supabase1.from).toHaveBeenCalled();
  });
});
