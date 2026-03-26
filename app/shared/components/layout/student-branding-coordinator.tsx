"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useStudentOrganizations } from "@/components/providers/student-organizations-provider";
import { useTenantBranding } from "@/app/shared/hooks/use-tenant-branding";

/**
 * Coordinates branding changes for multi-org students.
 *
 * This component listens to the StudentOrganizationsProvider and
 * updates the TenantBrandingProvider when the active organization changes.
 *
 * - When a specific organization is selected: loads that org's branding
 * - When "All Organizations" is selected (null): resets to default theme
 */
export function StudentBrandingCoordinator() {
  const params = useParams<{ tenant?: string | string[] }>();
  const tenantSlugRaw = params?.tenant;
  const tenantSlug = Array.isArray(tenantSlugRaw)
    ? (tenantSlugRaw[0] ?? "")
    : (tenantSlugRaw ?? "");

  const { organizations, isMultiOrg, loading } = useStudentOrganizations();
  const { loadBrandingForEmpresa } = useTenantBranding();

  // Track the previous active organization to avoid unnecessary updates
  const previousOrgId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Only coordinate branding for multi-org students
    if (!isMultiOrg || loading) {
      return;
    }

    if (!tenantSlug) {
      return;
    }

    // Always prioritize the organization that matches the current tenant slug.
    // This avoids applying stale branding restored from localStorage.
    const currentOrgId =
      organizations.find((org) => org.slug === tenantSlug)?.id ?? null;

    // Skip if the organization hasn't changed
    if (previousOrgId.current === currentOrgId) {
      return;
    }

    previousOrgId.current = currentOrgId;

    // Load branding for the selected organization (or reset to defaults if null)
    loadBrandingForEmpresa(currentOrgId);
  }, [isMultiOrg, loading, organizations, tenantSlug, loadBrandingForEmpresa]);

  // This component doesn't render anything - it's purely for coordination
  return null;
}
