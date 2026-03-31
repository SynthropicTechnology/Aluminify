"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname, useParams } from "next/navigation";
import {
  Building2,
  Users,
  Shield,
  Palette,
  Layers,
  Plug,
  Bot
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const sidebarNavItems = [
  {
    title: "Detalhes",
    href: "/settings/detalhes",
    icon: Building2
  },
  {
    title: "Usuários",
    href: "/settings/equipe",
    icon: Users
  },
  {
    title: "Papéis e Permissões",
    href: "/settings/papeis",
    icon: Shield
  },
  {
    title: "Personalização",
    href: "/settings/personalizacao",
    icon: Palette
  },
  {
    title: "Módulos do Aluno",
    href: "/settings/modulos",
    icon: Layers
  },
  {
    title: "Integrações",
    href: "/settings/integracoes",
    icon: Plug
  },
  {
    title: "Agente IA",
    href: "/settings/agentes",
    icon: Bot
  }
];

export function SidebarNav() {
  const pathname = usePathname();
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  return (
    <Card className="py-0">
      <CardContent className="p-2">
        <nav className="flex flex-col space-y-0.5">
          {sidebarNavItems.map((item) => {
            const href = tenantSlug ? `/${tenantSlug}${item.href}` : item.href;
            const isActive = pathname === href || pathname?.startsWith(href + "/");

            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "hover:bg-muted justify-start",
                  isActive ? "bg-muted hover:bg-muted" : ""
                )}
                asChild>
                <Link href={href}>
                  {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                  {item.title}
                </Link>
              </Button>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
