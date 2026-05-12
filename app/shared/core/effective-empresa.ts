/**
 * Effective Empresa ID
 *
 * Resolves the "active" tenant for the current request. For multi-org students,
 * the tenant comes from the URL (x-tenant-id header). For staff, it's their single empresa.
 *
 * Use getEffectiveEmpresaId() in API handlers to ensure data is filtered by the
 * tenant the user is currently viewing.
 */

import { NextRequest } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";
import type { AuthUser } from "@/app/[tenant]/auth/types";

/**
 * Checks if the user belongs to the given tenant (empresa).
 * Uses the same logic as validate-tenant route.
 */
export async function userBelongsToTenant(
  userId: string,
  empresaId: string
): Promise<boolean> {
  const client = getDatabaseClient();

  // Staff: usuarios with empresa_id
  const { data: usuarioRow } = await client
    .from("usuarios")
    .select("id")
    .eq("id", userId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (usuarioRow?.id) return true;

  const courseIds = await fetchCanonicalCourseIdsForStudent(client, userId, empresaId);
  if (courseIds.length > 0) return true;

  // usuarios_empresas (unified bindings)
  const { data: vinculoRow } = await client
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("usuario_id", userId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .limit(1);

  if (Array.isArray(vinculoRow) && vinculoRow.length > 0) return true;

  return false;
}

/**
 * Returns the effective empresa ID for the current request.
 *
 * - If x-tenant-id header is present and user belongs to that tenant: returns header value
 * - Otherwise: returns user.empresaId (from auth)
 *
 * APIs should use this to filter all tenant-scoped data.
 */
export async function getEffectiveEmpresaId(
  request: NextRequest,
  user: AuthUser
): Promise<string | undefined> {
  const headerTenantId = request.headers.get("x-tenant-id")?.trim();

  if (!headerTenantId) {
    return user.empresaId;
  }

  const belongs = await userBelongsToTenant(user.id, headerTenantId);
  if (belongs) {
    return headerTenantId;
  }

  return user.empresaId;
}
