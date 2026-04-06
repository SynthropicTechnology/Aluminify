/**
 * Suite de testes: Core - Roles & Permissions (RBAC)
 *
 * Testa o sistema de papéis e permissões simplificado:
 * - resolvePermissions: resolução de permissões efetivas
 * - hasPermission / canView / canCreate / canEdit / canDelete: checagem de permissões
 * - isTeachingRole: verificação de papel de professor
 * - canImpersonateUser: verificação de permissão de impersonação
 * - getDefaultRouteForRole: rota padrão por papel
 * - getViewableResources: recursos visíveis por permissão
 * - Funções legadas (deprecated)
 */

import {
  resolvePermissions,
  hasPermission,
  canView,
  canCreate,
  canEdit,
  canDelete,
  isTeachingRole,
  canImpersonateUser,
  getDefaultRouteForRole,
  getViewableResources,
  isTeachingRoleTipo,
  isAdminRoleTipo,
  canImpersonate,
} from "@/app/shared/core/roles";

import {
  ADMIN_PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_PAPEL_BASE,
} from "@/app/shared/types/entities/papel";
import type {
  PapelBase,
  RolePermissions,
} from "@/app/shared/types/entities/papel";

// =============================================================================
// resolvePermissions
// =============================================================================

describe("resolvePermissions", () => {
  describe("quando isAdmin é true", () => {
    it("deve retornar ADMIN_PERMISSIONS independentemente do papel", () => {
      const roles: PapelBase[] = ["aluno", "professor", "usuario"];

      for (const role of roles) {
        const result = resolvePermissions(role, true);
        expect(result).toEqual(ADMIN_PERMISSIONS);
      }
    });

    it("deve retornar ADMIN_PERMISSIONS mesmo com customPermissions", () => {
      const customPerms: RolePermissions = {
        ...DEFAULT_PERMISSIONS_BY_PAPEL_BASE.usuario,
        cursos: { view: true, create: true, edit: false, delete: false },
      };

      const result = resolvePermissions("usuario", true, customPerms);
      expect(result).toEqual(ADMIN_PERMISSIONS);
    });
  });

  describe("quando isAdmin é false", () => {
    it("deve retornar permissões padrão para aluno", () => {
      const result = resolvePermissions("aluno", false);
      expect(result).toEqual(DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno);
    });

    it("deve retornar permissões padrão para professor", () => {
      const result = resolvePermissions("professor", false);
      expect(result).toEqual(DEFAULT_PERMISSIONS_BY_PAPEL_BASE.professor);
    });

    it("deve retornar permissões padrão para usuario sem customPermissions", () => {
      const result = resolvePermissions("usuario", false);
      expect(result).toEqual(DEFAULT_PERMISSIONS_BY_PAPEL_BASE.usuario);
    });

    it("deve retornar customPermissions para usuario com papel customizado", () => {
      const customPerms: RolePermissions = {
        dashboard: { view: true },
        cursos: { view: true, create: true, edit: true, delete: false },
        disciplinas: { view: true, create: false, edit: false, delete: false },
        alunos: { view: true, create: true, edit: true, delete: true },
        usuarios: { view: false, create: false, edit: false, delete: false },
        agendamentos: { view: true, create: true, edit: true, delete: false },
        flashcards: { view: true, create: false, edit: false, delete: false },
        materiais: { view: true, create: true, edit: false, delete: false },
        configuracoes: { view: true, edit: false },
        branding: { view: false, edit: false },
        relatorios: { view: true },
      };

      const result = resolvePermissions("usuario", false, customPerms);
      expect(result).toEqual(customPerms);
    });

    it("deve ignorar customPermissions para papel aluno", () => {
      const customPerms: RolePermissions = {
        ...ADMIN_PERMISSIONS,
      };

      const result = resolvePermissions("aluno", false, customPerms);
      expect(result).toEqual(DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno);
    });

    it("deve ignorar customPermissions para papel professor", () => {
      const customPerms: RolePermissions = {
        ...ADMIN_PERMISSIONS,
      };

      const result = resolvePermissions("professor", false, customPerms);
      expect(result).toEqual(DEFAULT_PERMISSIONS_BY_PAPEL_BASE.professor);
    });
  });
});

// =============================================================================
// hasPermission
// =============================================================================

describe("hasPermission", () => {
  it("deve retornar true quando o usuário tem a permissão", () => {
    const perms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.professor;
    expect(hasPermission(perms, "flashcards", "create")).toBe(true);
    expect(hasPermission(perms, "flashcards", "view")).toBe(true);
    expect(hasPermission(perms, "materiais", "edit")).toBe(true);
  });

  it("deve retornar false quando o usuário não tem a permissão", () => {
    const perms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno;
    expect(hasPermission(perms, "cursos", "create")).toBe(false);
    expect(hasPermission(perms, "configuracoes", "view")).toBe(false);
    expect(hasPermission(perms, "alunos", "view")).toBe(false);
  });

  it("deve retornar false quando permissions é undefined", () => {
    expect(hasPermission(undefined, "cursos", "view")).toBe(false);
  });

  it("deve retornar false para recurso inexistente", () => {
    const perms = ADMIN_PERMISSIONS;
    expect(
      hasPermission(perms, "recurso_invalido" as keyof RolePermissions, "view"),
    ).toBe(false);
  });

  it("deve retornar false para ação inexistente no recurso", () => {
    const perms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno;
    // dashboard só tem view, não tem create/edit/delete
    expect(hasPermission(perms, "dashboard", "create")).toBe(false);
    expect(hasPermission(perms, "dashboard", "delete")).toBe(false);
  });

  it("admin deve ter todas as permissões", () => {
    const perms = ADMIN_PERMISSIONS;
    const resources: (keyof RolePermissions)[] = [
      "cursos",
      "disciplinas",
      "alunos",
      "usuarios",
      "agendamentos",
      "flashcards",
      "materiais",
    ];
    const actions: ("view" | "create" | "edit" | "delete")[] = [
      "view",
      "create",
      "edit",
      "delete",
    ];

    for (const resource of resources) {
      for (const action of actions) {
        expect(hasPermission(perms, resource, action)).toBe(true);
      }
    }
  });
});

// =============================================================================
// canView / canCreate / canEdit / canDelete (convenience helpers)
// =============================================================================

describe("convenience permission helpers", () => {
  const alunoPerms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno;
  const professorPerms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.professor;
  const adminPerms = ADMIN_PERMISSIONS;

  describe("canView", () => {
    it("aluno pode ver cursos e dashboard", () => {
      expect(canView(alunoPerms, "cursos")).toBe(true);
      expect(canView(alunoPerms, "dashboard")).toBe(true);
    });

    it("aluno não pode ver configuracoes", () => {
      expect(canView(alunoPerms, "configuracoes")).toBe(false);
    });

    it("retorna false com undefined", () => {
      expect(canView(undefined, "cursos")).toBe(false);
    });
  });

  describe("canCreate", () => {
    it("professor pode criar flashcards e materiais", () => {
      expect(canCreate(professorPerms, "flashcards")).toBe(true);
      expect(canCreate(professorPerms, "materiais")).toBe(true);
    });

    it("aluno não pode criar cursos", () => {
      expect(canCreate(alunoPerms, "cursos")).toBe(false);
    });
  });

  describe("canEdit", () => {
    it("admin pode editar tudo", () => {
      expect(canEdit(adminPerms, "cursos")).toBe(true);
      expect(canEdit(adminPerms, "configuracoes")).toBe(true);
      expect(canEdit(adminPerms, "branding")).toBe(true);
    });

    it("aluno não pode editar cursos", () => {
      expect(canEdit(alunoPerms, "cursos")).toBe(false);
    });
  });

  describe("canDelete", () => {
    it("admin pode deletar alunos", () => {
      expect(canDelete(adminPerms, "alunos")).toBe(true);
    });

    it("usuario padrão não pode deletar alunos", () => {
      const usuarioPerms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.usuario;
      expect(canDelete(usuarioPerms, "alunos")).toBe(false);
    });

    it("aluno pode deletar agendamentos (seus próprios)", () => {
      expect(canDelete(alunoPerms, "agendamentos")).toBe(true);
    });
  });
});

// =============================================================================
// isTeachingRole
// =============================================================================

describe("isTeachingRole", () => {
  it("deve retornar true para professor", () => {
    expect(isTeachingRole("professor")).toBe(true);
  });

  it("deve retornar false para aluno", () => {
    expect(isTeachingRole("aluno")).toBe(false);
  });

  it("deve retornar false para usuario", () => {
    expect(isTeachingRole("usuario")).toBe(false);
  });
});

// =============================================================================
// canImpersonateUser
// =============================================================================

describe("canImpersonateUser", () => {
  it("deve retornar true quando isAdmin é true", () => {
    expect(canImpersonateUser(true)).toBe(true);
  });

  it("deve retornar false quando isAdmin é false", () => {
    expect(canImpersonateUser(false)).toBe(false);
  });
});

// =============================================================================
// getDefaultRouteForRole
// =============================================================================

describe("getDefaultRouteForRole", () => {
  it("deve retornar /dashboard para aluno", () => {
    expect(getDefaultRouteForRole("aluno")).toBe("/dashboard");
  });

  it("deve retornar /dashboard para professor", () => {
    expect(getDefaultRouteForRole("professor")).toBe("/dashboard");
  });

  it("deve retornar /dashboard para usuario", () => {
    expect(getDefaultRouteForRole("usuario")).toBe("/dashboard");
  });

  it("deve retornar /dashboard como fallback para papel desconhecido", () => {
    expect(getDefaultRouteForRole("desconhecido" as PapelBase)).toBe(
      "/dashboard",
    );
  });
});

// =============================================================================
// getViewableResources
// =============================================================================

describe("getViewableResources", () => {
  it("deve retornar todos os recursos para admin", () => {
    const resources = getViewableResources(ADMIN_PERMISSIONS);
    expect(resources).toContain("dashboard");
    expect(resources).toContain("cursos");
    expect(resources).toContain("disciplinas");
    expect(resources).toContain("alunos");
    expect(resources).toContain("usuarios");
    expect(resources).toContain("configuracoes");
    expect(resources).toContain("branding");
    expect(resources).toContain("relatorios");
  });

  it("deve retornar recursos limitados para aluno", () => {
    const resources = getViewableResources(
      DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno,
    );
    expect(resources).toContain("dashboard");
    expect(resources).toContain("cursos");
    expect(resources).toContain("agendamentos");
    expect(resources).toContain("flashcards");
    expect(resources).toContain("materiais");
    expect(resources).not.toContain("configuracoes");
    expect(resources).not.toContain("branding");
    expect(resources).not.toContain("alunos");
    expect(resources).not.toContain("relatorios");
  });

  it("deve retornar recursos de professor", () => {
    const resources = getViewableResources(
      DEFAULT_PERMISSIONS_BY_PAPEL_BASE.professor,
    );
    expect(resources).toContain("alunos");
    expect(resources).toContain("flashcards");
    expect(resources).toContain("materiais");
    expect(resources).not.toContain("configuracoes");
    expect(resources).not.toContain("relatorios");
  });

  it("deve incluir relatorios para usuario", () => {
    const resources = getViewableResources(
      DEFAULT_PERMISSIONS_BY_PAPEL_BASE.usuario,
    );
    expect(resources).toContain("relatorios");
  });
});

// =============================================================================
// Funções legadas (deprecated)
// =============================================================================

describe("funções legadas (deprecated)", () => {
  describe("isTeachingRoleTipo", () => {
    it("deve retornar true para professor", () => {
      expect(isTeachingRoleTipo("professor")).toBe(true);
    });

    it("deve retornar true para professor_admin", () => {
      expect(isTeachingRoleTipo("professor_admin")).toBe(true);
    });

    it("deve retornar true para monitor", () => {
      expect(isTeachingRoleTipo("monitor")).toBe(true);
    });

    it("deve retornar false para staff", () => {
      expect(isTeachingRoleTipo("staff")).toBe(false);
    });

    it("deve retornar false para admin", () => {
      expect(isTeachingRoleTipo("admin")).toBe(false);
    });
  });

  describe("isAdminRoleTipo", () => {
    it("deve retornar true para admin", () => {
      expect(isAdminRoleTipo("admin")).toBe(true);
    });

    it("deve retornar true para professor_admin", () => {
      expect(isAdminRoleTipo("professor_admin")).toBe(true);
    });

    it("deve retornar false para professor", () => {
      expect(isAdminRoleTipo("professor")).toBe(false);
    });

    it("deve retornar false para staff", () => {
      expect(isAdminRoleTipo("staff")).toBe(false);
    });

    it("deve retornar false para monitor", () => {
      expect(isAdminRoleTipo("monitor")).toBe(false);
    });
  });

  describe("canImpersonate (legacy)", () => {
    it("deve retornar true para role com tipo admin", () => {
      expect(canImpersonate("usuario", "admin")).toBe(true);
    });

    it("deve retornar true para role com tipo professor_admin", () => {
      expect(canImpersonate("professor", "professor_admin")).toBe(true);
    });

    it("deve retornar false para role sem tipo admin", () => {
      expect(canImpersonate("professor", "professor")).toBe(false);
    });

    it("deve retornar false sem roleType", () => {
      expect(canImpersonate("aluno")).toBe(false);
    });
  });
});

// =============================================================================
// Verificação de integridade das permissões padrão
// =============================================================================

describe("integridade das permissões padrão", () => {
  const allResources: (keyof RolePermissions)[] = [
    "dashboard",
    "cursos",
    "disciplinas",
    "alunos",
    "usuarios",
    "agendamentos",
    "flashcards",
    "materiais",
    "configuracoes",
    "branding",
    "relatorios",
  ];

  it("ADMIN_PERMISSIONS deve ter todos os recursos", () => {
    for (const resource of allResources) {
      expect(ADMIN_PERMISSIONS[resource]).toBeDefined();
    }
  });

  it("todas as permissões padrão devem ter view em cada recurso", () => {
    const roles: PapelBase[] = ["aluno", "professor", "usuario"];

    for (const role of roles) {
      const perms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE[role];
      for (const resource of allResources) {
        expect(perms[resource]).toBeDefined();
        expect("view" in perms[resource]).toBe(true);
      }
    }
  });

  it("ADMIN_PERMISSIONS deve ter view: true em todos os recursos", () => {
    for (const resource of allResources) {
      expect(
        (ADMIN_PERMISSIONS[resource] as { view: boolean }).view,
      ).toBe(true);
    }
  });

  it("aluno não deve ter acesso de criação/edição/exclusão em recursos administrativos", () => {
    const alunoPerms = DEFAULT_PERMISSIONS_BY_PAPEL_BASE.aluno;
    const adminResources: (keyof RolePermissions)[] = [
      "cursos",
      "disciplinas",
      "alunos",
      "usuarios",
    ];

    for (const resource of adminResources) {
      expect(canCreate(alunoPerms, resource)).toBe(false);
      expect(canEdit(alunoPerms, resource)).toBe(false);
      expect(canDelete(alunoPerms, resource)).toBe(false);
    }
  });
});
