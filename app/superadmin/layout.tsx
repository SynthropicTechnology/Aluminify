import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Superadmin | Aluminify",
};

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Add superadmin authentication check
  // For now, this layout is accessible to anyone who knows the URL
  // In production, protect via middleware or auth check
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Aluminify Superadmin</h1>
            <p className="text-sm text-muted-foreground">
              Gestão de planos e assinaturas
            </p>
          </div>
          <nav className="flex gap-4">
            <Link
              href="/superadmin/planos"
              className="text-sm font-medium hover:text-primary"
            >
              Planos
            </Link>
            <Link
              href="/superadmin/assinaturas"
              className="text-sm font-medium hover:text-primary"
            >
              Assinaturas
            </Link>
          </nav>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
