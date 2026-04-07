'use client'

import { GraduationCap } from 'lucide-react'
import { RankingList, type RankingItem } from '@/app/[tenant]/(modules)/dashboard/components/shared/ranking-list'
import type { ProfessorRankingItem } from '@/app/[tenant]/(modules)/dashboard/types'

interface ProfessorRankingListProps {
  professors: ProfessorRankingItem[]
}

export function ProfessorRankingList({ professors }: ProfessorRankingListProps) {
  const items: RankingItem[] = professors.map((professor) => ({
    id: professor.id,
    name: professor.name,
    avatarUrl: professor.avatarUrl,
    primaryValue: `${professor.alunosAtendidos} alunos`,
    secondaryValue: `${professor.agendamentosRealizados} agendamentos`,
  }))

  return (
    <RankingList
      title="Top Professores"
      items={items}
      emptyMessage="Nenhum professor com atendimentos registrados"
      className="h-full"
      accentFrom="from-violet-400"
      accentTo="to-fuchsia-500"
      iconGradient="from-violet-500 to-fuchsia-500"
      icon={<GraduationCap className="h-5 w-5 text-white" />}
      tooltipParagraphs={[
        'Ranking dos professores da instituição ordenados pelo número de alunos distintos atendidos no período selecionado.',
        'Considera todos os agendamentos criados (confirmados, concluídos ou pendentes). O segundo número mostra a quantidade total de agendamentos realizados.',
      ]}
    />
  )
}
