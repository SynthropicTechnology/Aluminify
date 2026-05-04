import type { Metadata } from "next"
import { requireUser } from "@/app/shared/core/auth"
import { redirect } from "next/navigation"
import ListasAdminClient from "./listas-admin-client"

export const metadata: Metadata = {
  title: "Listas de Exercícios",
}

export default async function ListasPage() {
  const user = await requireUser()
  if (user.role === "aluno") {
    redirect(`/${user.empresaSlug}/biblioteca`)
  }
  return <ListasAdminClient />
}
