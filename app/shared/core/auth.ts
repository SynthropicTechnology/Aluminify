/**
 * Authentication Module
 *
 * Provides authentication utilities for the application including user retrieval,
 * role-based access control, and impersonation support.
 *
 * Key Functions:
 * - getAuthenticatedUser(): Get the current authenticated user with full context
 * - requireUser(): Enforce authentication and optionally check roles
 *
 * Type Safety Notes:
 * - This file uses type assertions for Supabase join queries (see inline comments)
 * - Nullable fields are handled with optional chaining (?.) and nullish coalescing (??)
 *
 * For detailed TypeScript patterns, see: docs/TYPESCRIPT_SUPABASE_GUIDE.md
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";

import { createClient } from "@/app/shared/core/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import type { AppUser, PapelBase } from "@/app/shared/types";
import type {
  RoleTipo,
  RolePermissions,
} from "@/app/shared/types/entities/papel";
import { getImpersonationContext } from "@/app/shared/core/auth-impersonate";
import {
  getDefaultRouteForRole,
  resolvePermissions,
} from "@/app/shared/core/roles";
import { cacheService } from "@/app/shared/core/services/cache/cache.service";
import { verificarAceiteVigenteEmpresa } from "@/app/shared/core/services/termos/termos.service";

const AUTH_SESSION_CACHE_TTL = 1800; // 30 minutos

type EssentialAuthSessionData = Pick<
  AppUser,
  "id" | "email" | "role" | "roleType" | "permissions" | "isAdmin" | "isOwner" | "fullName" | "avatarUrl" | "empresaId" | "empresaSlug" | "empresaNome" | "mustChangePassword"
>;

/**
 * Invalida o cache de sessão de um usuário.
 * Chamar quando: logout, troca de senha, alteração de papel/permissões, impersonação.
 */
export async function invalidateAuthSessionCache(
  userId: string,
): Promise<void> {
  await cacheService.del(`auth:session:${userId}`);
}

async function fetchUserFromSupabase(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }
  return user;
}

type ImpersonationStatus = {
  isImpersonating: boolean;
  targetUserId: string;
  context: Awaited<ReturnType<typeof getImpersonationContext>>;
};

async function getImpersonationStatus(
  authenticatedUser: User,
): Promise<ImpersonationStatus> {
  const context = await getImpersonationContext();
  const isImpersonating =
    context !== null && context.realUserId === authenticatedUser.id;

  let targetUserId = authenticatedUser.id;
  if (isImpersonating && context) {
    targetUserId = context.impersonatedUserId;
  }

  return { isImpersonating, targetUserId, context };
}

async function hydrateUserProfile(
  user: User,
  impersonation: ImpersonationStatus,
): Promise<
  AppUser & { _impersonationContext?: ImpersonationStatus["context"] }
> {
  // 1. Determine base role and initial metadata
  const { isImpersonating, context, targetUserId } = impersonation;

  const metadataRole =
    isImpersonating && context
      ? context.impersonatedUserRole
      : (user.user_metadata?.role as PapelBase) || "aluno";

  let role: PapelBase = metadataRole;

  let mustChangePassword = Boolean(user.user_metadata?.must_change_password);
  let roleType: RoleTipo | undefined;
  let customPermissions: RolePermissions | undefined;
  let isAdmin = false;
  let isOwner = false;
  let empresaId: string | undefined;
  let empresaNome: string | undefined;
  let empresaSlug: string | undefined;

  const supabase = await createClient();
  const adminClient = getDatabaseClient();

  // 2. Handle Impersonation Specifics (Fetch impersonated user data)
  if (isImpersonating && context) {
    const { data: alunoData } = await supabase
      .from("usuarios")
      .select("must_change_password, nome_completo, email, empresa_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (alunoData) {
      if (alunoData.empresa_id) {
        const { data: empresaRow } = await adminClient
          .from("empresas")
          .select("id, nome, slug")
          .eq("id", alunoData.empresa_id)
          .maybeSingle();

        if (empresaRow) {
          empresaId = empresaRow.id;
          empresaNome = empresaRow.nome ?? undefined;
          empresaSlug = empresaRow.slug ?? undefined;
        }
      }

      // Impersonated users are always alunos with default permissions
      return {
        id: targetUserId,
        email: alunoData.email || "",
        role: "aluno" as PapelBase,
        permissions: resolvePermissions("aluno", false),
        isAdmin: false,
        isOwner: false,
        fullName: alunoData.nome_completo || undefined,
        mustChangePassword: false, // Usually false during impersonation
        empresaId,
        empresaNome,
        empresaSlug,
        _impersonationContext: context,
      };
    }
  }

  // 3. Handle 'usuario' (Staff/Admin) Context
  if (role === "usuario") {
    const { data: usuarioRow, error: usuarioError } = await adminClient
      .from("usuarios")
      .select("empresa_id, nome_completo, papel_id")
      .eq("id", user.id)
      .eq("ativo", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (!usuarioError && usuarioRow) {
      role = "usuario";
      empresaId = usuarioRow.empresa_id;

      // Fetch admin flags from usuarios_empresas
      if (usuarioRow.empresa_id) {
        const { data: vinculoRow } = await adminClient
          .from("usuarios_empresas")
          .select("is_admin, is_owner")
          .eq("usuario_id", user.id)
          .eq("empresa_id", usuarioRow.empresa_id)
          .eq("ativo", true)
          .maybeSingle();

        if (vinculoRow) {
          isAdmin = vinculoRow.is_admin ?? false;
          isOwner = vinculoRow.is_owner ?? false;
        }
      }

      // Fetch Role/Permissions from papel (for custom permissions)
      if (usuarioRow.papel_id) {
        const { data: papelRow } = await adminClient
          .from("papeis")
          .select("tipo, permissoes")
          .eq("id", usuarioRow.papel_id)
          .maybeSingle();

        if (papelRow) {
          roleType = papelRow.tipo as RoleTipo;
          customPermissions = papelRow.permissoes as unknown as RolePermissions;
        }
      }

      // Fetch Empresa
      if (usuarioRow.empresa_id) {
        const { data: empresaRow } = await adminClient
          .from("empresas")
          .select("nome, slug")
          .eq("id", usuarioRow.empresa_id)
          .maybeSingle();

        if (empresaRow) {
          empresaNome = empresaRow.nome ?? undefined;
          empresaSlug = empresaRow.slug ?? undefined;
        }
      }

      if (usuarioRow.nome_completo) {
        // Update user metadata object (local reference only)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (user.user_metadata as any) = {
          ...(user.user_metadata || {}),
          full_name: usuarioRow.nome_completo,
        };
      }
    }
  }

  // 4. Handle 'aluno' Context
  if (role === "aluno") {
    const { data: alunoData } = await supabase
      .from("usuarios")
      .select("must_change_password, empresa_id")
      .eq("id", user.id)
      .maybeSingle();

    if (alunoData?.must_change_password !== undefined) {
      mustChangePassword = alunoData.must_change_password;
    }

    const alunoEmpresaId =
      alunoData?.empresa_id || user.user_metadata?.empresa_id;

    if (alunoEmpresaId && !empresaSlug) {
      const { data: empresaRow } = await adminClient
        .from("empresas")
        .select("id, nome, slug")
        .eq("id", alunoEmpresaId)
        .maybeSingle();

      if (empresaRow) {
        empresaId = empresaRow.id;
        empresaNome = empresaRow.nome ?? undefined;
        empresaSlug = empresaRow.slug ?? undefined;
      }
    }
  }

  // 5. Handle 'professor' Context - fetch admin flags
  if (role === "professor" && empresaId) {
    const { data: vinculoRow } = await adminClient
      .from("usuarios_empresas")
      .select("is_admin, is_owner")
      .eq("usuario_id", user.id)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();

    if (vinculoRow) {
      isAdmin = vinculoRow.is_admin ?? false;
      isOwner = vinculoRow.is_owner ?? false;
    }
  }

  // Resolve effective permissions using the new model
  const permissions = resolvePermissions(role, isAdmin, customPermissions);

  return {
    id: targetUserId,
    email: user.email || "",
    role,
    roleType,
    permissions,
    isAdmin,
    isOwner,
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0],
    avatarUrl: user.user_metadata?.avatar_url,
    mustChangePassword,
    empresaId,
    empresaSlug,
    empresaNome,
    ...(isImpersonating && context ? { _impersonationContext: context } : {}),
  };
}

async function _getAuthenticatedUser(): Promise<AppUser | null> {
  // 1. Validação JWT (sempre — segurança)
  const user = await fetchUserFromSupabase();
  if (!user) return null;

  // 2. Verificar status de impersonação
  const impersonationStatus = await getImpersonationStatus(user);
  const { isImpersonating, context } = impersonationStatus;

  // 3. Checar cache de sessão (Redis)
  const cacheKey =
    isImpersonating && context
      ? `auth:session:${user.id}:imp:${context.impersonatedUserId}`
      : `auth:session:${user.id}`;

  const cached = await cacheService.get<EssentialAuthSessionData>(cacheKey);
  if (cached) {
    if (process.env.NODE_ENV === "development") {
      console.log("[AUTH DEBUG] getAuthenticatedUser: session cache hit", {
        userId: user.id,
        mustChangePassword: cached.mustChangePassword,
      });
    }
    return cached;
  }

  // 4. Cache miss — buscar dados no banco
  if (process.env.NODE_ENV === "development") {
    console.log(
      "[AUTH DEBUG] getAuthenticatedUser: session cache miss, fetching from DB",
    );
  }

  const appUser = await hydrateUserProfile(user, impersonationStatus);

  // 5. Cachear e retornar
  if (process.env.NODE_ENV === "development") {
    console.log("[AUTH DEBUG] getAuthenticatedUser: caching user", {
      userId: user.id,
      mustChangePassword: appUser.mustChangePassword,
    });
  }

  const essentialData: EssentialAuthSessionData = {
    id: appUser.id,
    email: appUser.email,
    role: appUser.role,
    roleType: appUser.roleType,
    permissions: appUser.permissions,
    isAdmin: appUser.isAdmin,
    isOwner: appUser.isOwner,
    fullName: appUser.fullName,
    avatarUrl: appUser.avatarUrl,
    empresaId: appUser.empresaId,
    empresaSlug: appUser.empresaSlug,
    empresaNome: appUser.empresaNome,
    mustChangePassword: appUser.mustChangePassword,
  };

  await cacheService.set(cacheKey, essentialData, AUTH_SESSION_CACHE_TTL);
  return appUser;
}

export const getAuthenticatedUser = cache(_getAuthenticatedUser);

type RequireUserOptions = {
  allowedRoles?: PapelBase[];
  ignorePasswordRequirement?: boolean;
  ignoreTermsRequirement?: boolean;
};

export async function requireUser(
  options?: RequireUserOptions,
): Promise<AppUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/auth");
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    const allowedSet = new Set<PapelBase>(options.allowedRoles);

    if (!allowedSet.has(user.role)) {
      const defaultRoute = getDefaultRouteForRole(user.role);
      const redirectUrl = user.empresaSlug
        ? `/${user.empresaSlug}${defaultRoute}`
        : defaultRoute;
      redirect(redirectUrl);
    }
  }

  if (!options?.ignorePasswordRequirement && user.mustChangePassword) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[AUTH DEBUG] requireUser redirect /primeiro-acesso " +
          JSON.stringify({
            userId: user.id,
            email: user.email,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          }),
      );
    }
    redirect("/primeiro-acesso");
  }

  // Verificar aceite de termos vigentes para admins/owners
  if (
    !options?.ignoreTermsRequirement &&
    (user.isAdmin || user.isOwner) &&
    user.empresaId &&
    user.empresaSlug
  ) {
    const aceitouTermos = await verificarAceiteVigenteEmpresa(
      user.empresaId,
    );

    if (!aceitouTermos) {
      redirect(`/${user.empresaSlug}/aceite-termos`);
    }
  }

  return user;
}
