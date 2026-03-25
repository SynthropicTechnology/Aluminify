import type { Metadata } from 'next'
import { requireUser } from '@/app/shared/core/auth'
import { CotasTable } from './components/cotas-table'

export const metadata: Metadata = {
  title: 'Cotas de Atendimento',
}

export default async function CotasPage() {
  await requireUser({ allowedRoles: ['usuario'] })

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-4 pb-10 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 h-full min-h-150">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="page-title">Cotas de Atendimento</h1>
            <p className="page-subtitle">
              Defina a quantidade de atendimentos que cada aluno pode agendar por mês, por curso.
            </p>
          </div>
        </header>

        <CotasTable />
      </section>
    </div>
  )
}
