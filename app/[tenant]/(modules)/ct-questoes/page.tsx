import type { Metadata } from "next"
import { requireUser } from "@/app/shared/core/auth"
import CtQuestoesClient from "./ct-questoes-client"

export const metadata: Metadata = {
  title: "CT de Questões",
}

export default async function CtQuestoesPage() {
  await requireUser()
  return <CtQuestoesClient />
}
