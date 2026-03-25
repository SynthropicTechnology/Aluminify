"use client";

import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  FileText,
  BarChart3,
  Users,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/layout/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: { title: string; url: string }[];
};

const superadminNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/superadmin",
    icon: LayoutDashboard,
  },
  {
    title: "Planos",
    url: "/superadmin/planos",
    icon: CreditCard,
  },
  {
    title: "Assinaturas",
    url: "/superadmin/assinaturas",
    icon: Receipt,
  },
  {
    title: "Faturas",
    url: "/superadmin/faturas",
    icon: FileText,
  },
  {
    title: "Métricas",
    url: "/superadmin/metricas",
    icon: BarChart3,
  },
  {
    title: "Usuários",
    url: "/superadmin/usuarios",
    icon: Users,
  },
  {
    title: "Webhooks",
    url: "/superadmin/webhooks",
    icon: Activity,
  },
];

export function SuperadminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navMainWithActive = superadminNavItems.map((item) => ({
    ...item,
    isActive:
      item.url === "/superadmin"
        ? pathname === "/superadmin"
        : pathname === item.url || pathname?.startsWith(item.url + "/"),
  }));

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="sticky top-0 z-10 bg-sidebar/70 backdrop-blur-xl">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  SA
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Aluminify</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Superadmin
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainWithActive} />
      </SidebarContent>
    </Sidebar>
  );
}
