import type { Metadata } from "next"
import { requireUser } from "@/app/shared/core/auth"
import ResolverListaClient from "./resolver-lista-client"

export const metadata: Metadata = {
  title: "Resolver Lista",
}

export default async function ResolverListaPage() {
  await requireUser()
  return <ResolverListaClient />
}
