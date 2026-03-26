'use client'

import { useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/shared/library/utils'
import { TenantLogo } from '@/components/ui/tenant-logo'
import { useStudentOrganizations } from '@/components/providers/student-organizations-provider'
import { useCurrentUser } from '@/components/providers/user-provider'
import { useOptionalTenantContext } from '@/app/[tenant]/tenant-context'
import { prefetchTenantBranding } from '@/app/[tenant]/(modules)/settings/personalizacao/services/branding-prefetch-cache'
import type { StudentOrganization } from '@/components/providers/student-organizations-provider'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/app/shared/components/overlay/sheet'

export function MobileOrgSwitcher() {
  const [open, setOpen] = useState(false)
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

  // Só renderiza para alunos multi-org que já carregaram
  const isInteractive = user.role === 'aluno' && isMultiOrg && !loading

  const activeDisplayName = useMemo(() => {
    if (user.role === 'aluno' && activeOrganization) {
      return activeOrganization.nome
    }
    return tenantContext?.empresaNome || user.empresaNome || 'Workspace'
  }, [user.role, user.empresaNome, activeOrganization, tenantContext?.empresaNome])

  const activeEmpresaId = useMemo(() => {
    if (user.role === 'aluno' && activeOrganization) {
      return activeOrganization.id
    }
    return tenantContext?.empresaId || user.empresaId || ''
  }, [user.role, user.empresaId, activeOrganization, tenantContext?.empresaId])

  const prefetchCandidates = useCallback((candidates: StudentOrganization[]) => {
    candidates
      .filter((org) => org.slug !== tenantSlug)
      .slice(0, 2)
      .forEach((org) => {
        void prefetchTenantBranding(org.id)
      })
  }, [tenantSlug])

  const handleSelect = useCallback((org: StudentOrganization) => {
    if (org.slug === tenantSlug) {
      setOpen(false)
      return
    }

    // Conservative warm-up, non-blocking.
    void prefetchTenantBranding(org.id, { force: true })

    window.location.assign(`/${org.slug}/dashboard`)
  }, [tenantSlug])

  if (!isInteractive) return null

  return (
    <>
      <button
        onClick={() => {
          prefetchCandidates(organizations)
          setOpen(true)
        }}
        className={cn(
          'md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-md',
          'border border-border/50 hover:bg-accent/50 transition-colors',
          'touch-manipulation max-w-35'
        )}
        aria-label="Trocar organização"
      >
        <div className="flex size-5 items-center justify-center rounded overflow-hidden shrink-0">
          <TenantLogo
            logoType="sidebar"
            empresaId={activeEmpresaId}
            width={20}
            height={20}
            fallbackText={activeDisplayName.charAt(0).toUpperCase()}
          />
        </div>
        <span className="text-xs font-medium truncate">{activeDisplayName}</span>
        <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Suas escolas</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 py-2">
            {organizations.map((org) => {
              const isActive = activeOrganization?.id === org.id ||
                (!activeOrganization && org.slug === tenantSlug)
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org)}
                  onPointerEnter={() => {
                    void prefetchTenantBranding(org.id)
                  }}
                  onFocus={() => {
                    void prefetchTenantBranding(org.id)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left',
                    'touch-manipulation transition-colors',
                    'hover:bg-accent'
                  )}
                >
                  <div className="flex size-8 items-center justify-center rounded-md border overflow-hidden shrink-0">
                    {org.logoUrl ? (
                      <Image
                        src={org.logoUrl}
                        alt={org.nome}
                        width={24}
                        height={24}
                        className="size-6 object-contain"
                      />
                    ) : (
                      <span className="text-xs font-medium">
                        {org.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate flex-1">{org.nome}</span>
                  {isActive && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
