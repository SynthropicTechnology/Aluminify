import React from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { UserProvider } from '@/components/providers/user-provider'
import { BrandingProvider } from "@/app/[tenant]/(modules)/settings/personalizacao/providers/branding-provider"
import { StudentOrganizationsProvider } from '@/components/providers/student-organizations-provider'
import { ModuleVisibilityProvider } from '@/components/providers/module-visibility-provider'
import { BottomNavigation } from '@/components/layout/bottom-navigation'
import { ImpersonationBanner } from '@/components/layout/impersonation-banner'
import {
    SidebarInset,
    SidebarProvider,
} from '@/components/ui/sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { requireUser } from '@/app/shared/core/auth'
import { StudentBrandingCoordinator } from '@/components/layout/student-branding-coordinator'
import { StudentTenantCoordinator } from '@/components/layout/student-tenant-coordinator'
import { headers } from 'next/headers'

export async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    const user = await requireUser()
    const headersList = await headers()
    const tenantEmpresaId = headersList.get('x-tenant-id') ?? user.empresaId ?? ''

    return (
        <UserProvider user={user}>
            <BrandingProvider empresaId={tenantEmpresaId}>
                <StudentOrganizationsProvider user={user}>
                    <ModuleVisibilityProvider
                        empresaId={tenantEmpresaId || null}
                        userRole={user.role}
                    >
                        <StudentBrandingCoordinator />
                        <StudentTenantCoordinator />
                        <SidebarProvider
                            className="font-sans antialiased"
                        >
                            <AppSidebar />
                            <SidebarInset>
                                <DashboardHeader />
                                <ImpersonationBanner />
                                {/* Main content - scroll nativo do body */}
                                <div className="min-w-0 p-4 pb-20 bg-background md:px-8 md:py-6 md:pb-8">
                                    {children}
                                </div>
                                <BottomNavigation />
                            </SidebarInset>
                        </SidebarProvider>
                    </ModuleVisibilityProvider>
                </StudentOrganizationsProvider>
            </BrandingProvider>
        </UserProvider>
    )
}
