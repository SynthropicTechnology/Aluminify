/**
 * Suite de testes: Core - Route Guards
 *
 * Testa os guards de rota do sistema:
 * - routeAllowsImpersonation: verificação de rota que permite impersonação
 *
 * Nota: requireAlunoRoute, requireProfessorRoute, requireUsuarioRoute e
 * allowImpersonation dependem de requireUser (que usa React cache + redirect),
 * portanto são testados aqui como funções puras onde possível,
 * e com mocks para as funções assíncronas.
 */

// Mock next/navigation antes de importar o módulo
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Mock do auth
jest.mock("@/app/shared/core/auth", () => ({
  requireUser: jest.fn(),
}));

// Mock do auth-impersonate
jest.mock("@/app/shared/core/auth-impersonate", () => ({
  getImpersonationContext: jest.fn(),
}));

import { redirect } from "next/navigation";
import { requireUser } from "@/app/shared/core/auth";
import { getImpersonationContext } from "@/app/shared/core/auth-impersonate";
import {
  requireAlunoRoute,
  requireProfessorRoute,
  requireUsuarioRoute,
  allowImpersonation,
  routeAllowsImpersonation,
} from "@/app/shared/core/route-guards";

const mockRequireUser = requireUser as jest.MockedFunction<typeof requireUser>;
const mockGetImpersonationContext =
  getImpersonationContext as jest.MockedFunction<
    typeof getImpersonationContext
  >;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// routeAllowsImpersonation (função pura)
// =============================================================================

describe("routeAllowsImpersonation", () => {
  it("deve retornar true para rotas de aluno", () => {
    expect(routeAllowsImpersonation("/aluno/dashboard")).toBe(true);
    expect(routeAllowsImpersonation("/aluno/curso/1")).toBe(true);
    expect(routeAllowsImpersonation("/aluno/")).toBe(true);
  });

  it("deve retornar false para rotas que não são de aluno", () => {
    expect(routeAllowsImpersonation("/professor/dashboard")).toBe(false);
    expect(routeAllowsImpersonation("/admin/users")).toBe(false);
    expect(routeAllowsImpersonation("/dashboard")).toBe(false);
    expect(routeAllowsImpersonation("/api/health")).toBe(false);
  });

  it("deve retornar false para path raiz", () => {
    expect(routeAllowsImpersonation("/")).toBe(false);
  });
});

// =============================================================================
// requireAlunoRoute
// =============================================================================

describe("requireAlunoRoute", () => {
  it("deve permitir acesso para aluno real", async () => {
    const alunoUser = {
      id: "user-1",
      email: "aluno@test.com",
      role: "aluno" as const,
      permissions: {} as any,
      isAdmin: false,
      isOwner: false,
      mustChangePassword: false,
    };

    mockRequireUser.mockResolvedValue(alunoUser);
    mockGetImpersonationContext.mockResolvedValue(null);

    const result = await requireAlunoRoute();
    expect(result).toEqual(alunoUser);
  });

  it("deve permitir acesso quando impersonando aluno", async () => {
    const adminUser = {
      id: "admin-1",
      email: "admin@test.com",
      role: "usuario" as const,
      permissions: {} as any,
      isAdmin: true,
      isOwner: false,
      mustChangePassword: false,
      empresaSlug: "escola",
    };

    mockRequireUser.mockResolvedValue(adminUser);
    mockGetImpersonationContext.mockResolvedValue({
      realUserId: "admin-1",
      impersonatedUserId: "aluno-1",
      impersonatedUserRole: "aluno",
      empresaId: "emp-1",
    });

    const result = await requireAlunoRoute();
    expect(result).toEqual(adminUser);
  });

  it("deve redirecionar professor para rota padrão", async () => {
    const professorUser = {
      id: "prof-1",
      email: "prof@test.com",
      role: "professor" as const,
      permissions: {} as any,
      isAdmin: false,
      isOwner: false,
      mustChangePassword: false,
      empresaSlug: "escola",
    };

    mockRequireUser.mockResolvedValue(professorUser);
    mockGetImpersonationContext.mockResolvedValue(null);

    await expect(requireAlunoRoute()).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith("/escola/dashboard");
  });

  it("deve redirecionar usuario sem empresaSlug para /dashboard", async () => {
    const usuarioUser = {
      id: "usr-1",
      email: "usr@test.com",
      role: "usuario" as const,
      permissions: {} as any,
      isAdmin: false,
      isOwner: false,
      mustChangePassword: false,
    };

    mockRequireUser.mockResolvedValue(usuarioUser);
    mockGetImpersonationContext.mockResolvedValue(null);

    await expect(requireAlunoRoute()).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});

// =============================================================================
// requireProfessorRoute
// =============================================================================

describe("requireProfessorRoute", () => {
  it("deve chamar requireUser com allowedRoles professor", async () => {
    const professorUser = {
      id: "prof-1",
      email: "prof@test.com",
      role: "professor" as const,
      permissions: {} as any,
      isAdmin: false,
      isOwner: false,
      mustChangePassword: false,
    };

    mockRequireUser.mockResolvedValue(professorUser);

    const result = await requireProfessorRoute();
    expect(result).toEqual(professorUser);
    expect(mockRequireUser).toHaveBeenCalledWith({
      allowedRoles: ["professor"],
    });
  });
});

// =============================================================================
// requireUsuarioRoute
// =============================================================================

describe("requireUsuarioRoute", () => {
  it("deve chamar requireUser com allowedRoles usuario", async () => {
    const usuarioUser = {
      id: "usr-1",
      email: "usr@test.com",
      role: "usuario" as const,
      permissions: {} as any,
      isAdmin: false,
      isOwner: false,
      mustChangePassword: false,
    };

    mockRequireUser.mockResolvedValue(usuarioUser);

    const result = await requireUsuarioRoute();
    expect(result).toEqual(usuarioUser);
    expect(mockRequireUser).toHaveBeenCalledWith({
      allowedRoles: ["usuario"],
    });
  });
});

// =============================================================================
// allowImpersonation
// =============================================================================

describe("allowImpersonation", () => {
  it("deve permitir quando contexto de impersonação existe", async () => {
    const adminUser = {
      id: "admin-1",
      email: "admin@test.com",
      role: "usuario" as const,
      permissions: {} as any,
      isAdmin: true,
      isOwner: false,
      mustChangePassword: false,
    };

    mockRequireUser.mockResolvedValue(adminUser);
    mockGetImpersonationContext.mockResolvedValue({
      realUserId: "admin-1",
      impersonatedUserId: "aluno-1",
      impersonatedUserRole: "aluno",
      empresaId: "emp-1",
    });

    const result = await allowImpersonation();
    expect(result).toEqual(adminUser);
  });

  it("deve redirecionar quando não tem permissão de impersonação e não está impersonando", async () => {
    const alunoUser = {
      id: "aluno-1",
      email: "aluno@test.com",
      role: "aluno" as const,
      permissions: {} as any,
      isAdmin: false,
      isOwner: false,
      mustChangePassword: false,
      empresaSlug: "escola",
    };

    mockRequireUser.mockResolvedValue(alunoUser);
    mockGetImpersonationContext.mockResolvedValue(null);

    await expect(allowImpersonation()).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith("/escola/dashboard");
  });
});
