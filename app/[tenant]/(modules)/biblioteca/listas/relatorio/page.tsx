import type { Metadata } from "next"
import { requireUser } from "@/app/shared/core/auth"
import { redirect } from "next/navigation"
import RelatorioListasClient from "./relatorio-listas-client"

export const metadata: Metadata = {
  title: "Relatório de Listas",
}

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function RelatorioListasPage({ params }: Props) {
  const { tenant } = await params
  const user = await requireUser()
  if (user.role === "aluno") {
    redirect(`/${tenant}/biblioteca`)
  }
  return <RelatorioListasClient />
}
