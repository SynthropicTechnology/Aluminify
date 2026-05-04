import type { Metadata } from "next"
import { requireUser } from "@/app/shared/core/auth"
import { redirect } from "next/navigation"
import AdicionarQuestoesClient from "./adicionar-questoes-client"

export const metadata: Metadata = {
  title: "Adicionar Questões à Lista",
}

interface Props {
  params: Promise<{ tenant: string; listaId: string }>
}

export default async function AdicionarQuestoesPage({ params }: Props) {
  const { tenant, listaId } = await params
  const user = await requireUser()
  if (user.role === "aluno") {
    redirect(`/${tenant}/biblioteca`)
  }
  return <AdicionarQuestoesClient listaId={listaId} />
}
