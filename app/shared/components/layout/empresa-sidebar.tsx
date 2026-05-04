"use client"

import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  FolderOpen,
  DollarSign,
  Settings,
  GraduationCap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { usePathname, useParams } from "next/navigation"

import { NavMain } from "@/components/layout/nav-main"
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  items?: {
    title: string
    url: string
  }[]
}

const empresaNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Alunos",
    url: "/usuario/alunos",
    icon: GraduationCap,
  },
  {
    title: "Cursos",
    url: "/curso/admin",
    icon: BookOpen,
    items: [
      { title: "Todos os Cursos", url: "/curso/admin" },
      { title: "Disciplinas", url: "/curso/disciplinas" },
      { title: "Segmentos", url: "/curso/segmentos" },
      { title: "Conteúdo Programático", url: "/curso/conteudos" },
      { title: "Cotas de Atendimento", url: "/curso/cotas" },
      { title: "Relatórios", url: "/curso/relatorios" },
    ],
  },
  {
    title: "Biblioteca",
    url: "/biblioteca",
    icon: FolderOpen,
    items: [
      { title: "Materiais", url: "/biblioteca/materiais" },
      { title: "Flashcards", url: "/flashcards" },
      { title: "Banco de Questões", url: "/biblioteca/questoes" },
      { title: "Listas de Exercícios", url: "/biblioteca/listas" },
    ],
  },
  {
    title: "Agendamentos",
    url: "/agendamentos",
    icon: Calendar,
    items: [
      { title: "Meus Agendamentos", url: "/agendamentos/meus" },
      { title: "Disponibilidade", url: "/agendamentos/disponibilidade" },
      { title: "Bloqueios", url: "/agendamentos/bloqueios" },
      { title: "Configurações", url: "/agendamentos/configuracoes" },
      { title: "Estatísticas", url: "/agendamentos/stats" },
    ],
  },
  {
    title: "Financeiro",
    url: "/financeiro",
    icon: DollarSign,
    items: [
      { title: "Dashboard", url: "/financeiro" },
      { title: "Transações", url: "/financeiro/transacoes" },
      { title: "Produtos", url: "/financeiro/produtos" },
      { title: "Cupons", url: "/financeiro/cupons" },
    ],
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
  },
]

export function EmpresaSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  // Dynamic nav items based on tenant
  const navItems = empresaNavItems.map(item => ({
    ...item,
    url: tenantSlug ? `/${tenantSlug}${item.url}` : item.url,
    items: item.items?.map(subItem => ({
      ...subItem,
      url: tenantSlug ? `/${tenantSlug}${subItem.url}` : subItem.url,
    })),
  }))

  const navMainWithActive = navItems.map((item) => ({
    ...item,
    isActive: pathname === item.url || pathname?.startsWith(item.url + "/"),
  }))

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="sticky top-0 z-10 bg-sidebar/70 backdrop-blur-xl">
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainWithActive} />
      </SidebarContent>
    </Sidebar>
  )
}



