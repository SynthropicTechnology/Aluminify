"use client"

import { useCallback, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Check, ChevronsUpDown } from "lucide-react"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/shared/components/overlay/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { TenantLogo } from "@/components/ui/tenant-logo"
import { useStudentOrganizations } from "@/components/providers/student-organizations-provider"
import { useCurrentUser } from "@/components/providers/user-provider"
import { useOptionalTenantContext } from "@/app/[tenant]/tenant-context"
import { prefetchTenantBranding } from "@/app/[tenant]/(modules)/settings/personalizacao/services/branding-prefetch-cache"
import type { StudentOrganization } from "@/components/providers/student-organizations-provider"

/**
 * WorkspaceSwitcher — sidebar header component that allows users
 * enrolled in multiple tenants to switch between workspaces.
 *
 * For students: uses the StudentOrganizationsProvider data.
 * For staff: shows the current tenant (single workspace, future-proof
 * for when the unified user model enables multi-tenant staff).
 */
export function WorkspaceSwitcher() {
  const { isMobile } = useSidebar()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const user = useCurrentUser()
  const tenantContext = useOptionalTenantContext()
  const {
    organizations,
    activeOrganization,
    isMultiOrg,
    loading,
  } = useStudentOrganizations()

  // Current workspace info (from tenant context or user)
  const currentWorkspace = useMemo(() => ({
    id: tenantContext?.empresaId || user.empresaId || "",
    nome: tenantContext?.empresaNome || user.empresaNome || "Workspace",
    slug: tenantSlug || "",
  }), [tenantContext, user, tenantSlug])

  const fallbackLetter = currentWorkspace.nome.charAt(0).toUpperCase()
  const empresaIdForLogo = currentWorkspace.id

  // Determine if the switcher should be interactive (multiple workspaces)
  const isInteractive = user.role === "aluno" && isMultiOrg && !loading

  const prefetchCandidates = useCallback((candidates: StudentOrganization[]) => {
    candidates
      .filter((org) => org.slug !== tenantSlug)
      .slice(0, 2)
      .forEach((org) => {
        void prefetchTenantBranding(org.id)
      })
  }, [tenantSlug])

  const handleSelectWorkspace = useCallback((org: StudentOrganization) => {
    if (org.slug === tenantSlug) return

    // Conservative warm-up, non-blocking.
    void prefetchTenantBranding(org.id, { force: true })

    const nextPrefix = `/${org.slug}`
    // Sempre redirecionar para o dashboard da nova organização e fazer refresh
    // para que os dados do backend sejam atualizados e filtrados pelo novo tenant.
    const nextPath = `${nextPrefix}/dashboard`

    // Full page reload garante que todos os dados do back-end sejam atualizados
    // para o novo tenant (dashboard, sidebar, cronograma, calendário, etc.)
    window.location.assign(nextPath)
  }, [tenantSlug])

  // Active workspace display name (from selected org or tenant context)
  const activeDisplayName = useMemo(() => {
    if (user.role === "aluno" && activeOrganization) {
      return activeOrganization.nome
    }
    return currentWorkspace.nome
  }, [user.role, activeOrganization, currentWorkspace.nome])

  const activeEmpresaId = useMemo(() => {
    if (user.role === "aluno" && activeOrganization) {
      return activeOrganization.id
    }
    return empresaIdForLogo
  }, [user.role, activeOrganization, empresaIdForLogo])

  // Non-interactive: just show the current workspace (link to home)
  if (!isInteractive) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            asChild
            className="hover:bg-sidebar-accent/60 transition-colors duration-200"
          >
            <Link href={tenantSlug ? `/${tenantSlug}/dashboard` : "/dashboard"}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden ">
                <TenantLogo
                  logoType="sidebar"
                  empresaId={empresaIdForLogo}
                  width={32}
                  height={32}
                  fallbackText={fallbackLetter}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeDisplayName}</span>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Interactive: dropdown with workspace list
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) {
              prefetchCandidates(organizations)
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="group/ws data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors duration-200"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden ">
                <TenantLogo
                  logoType="sidebar"
                  empresaId={activeEmpresaId}
                  width={32}
                  height={32}
                  fallbackText={activeDisplayName.charAt(0).toUpperCase()}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeDisplayName}</span>
                <span className="truncate text-xs text-sidebar-foreground/50">Trocar curso/escola</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/40 group-hover/ws:text-sidebar-foreground/60 transition-colors duration-200" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Suas escolas
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSelectWorkspace(org)}
                onPointerEnter={() => {
                  void prefetchTenantBranding(org.id)
                }}
                onFocus={() => {
                  void prefetchTenantBranding(org.id)
                }}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden">
                  {org.logoUrl ? (
                    <Image
                      src={org.logoUrl}
                      alt={org.nome}
                      width={16}
                      height={16}
                      className="size-4 object-contain shrink-0"
                    />
                  ) : (
                    <span className="text-xs font-medium">
                      {org.nome.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="truncate">{org.nome}</span>
                {(activeOrganization?.id === org.id ||
                  (!activeOrganization && org.slug === tenantSlug)) && (
                    <Check className="ml-auto size-4 shrink-0" />
                  )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
