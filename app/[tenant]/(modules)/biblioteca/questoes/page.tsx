import type { Metadata } from "next"
import { requireUser } from "@/app/shared/core/auth"
import { redirect } from "next/navigation"
import BancoQuestoesClient from "./banco-questoes-client"

export const metadata: Metadata = {
  title: "Banco de Questões",
}

export default async function BancoQuestoesPage() {
  const user = await requireUser()
  if (user.role === "aluno") {
    redirect(`/${user.empresaSlug}/biblioteca`)
  }
  return <BancoQuestoesClient />
}
