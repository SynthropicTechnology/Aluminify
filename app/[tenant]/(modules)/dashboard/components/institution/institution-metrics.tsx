'use client'

import { Users, Clock, CheckCircle2, Target } from 'lucide-react'
import { MetricCard } from '../aluno/metric-card'
import type { InstitutionSummary, InstitutionEngagement } from '@/app/[tenant]/(modules)/dashboard/types'

interface InstitutionMetricsProps {
  summary: InstitutionSummary
  engagement: InstitutionEngagement
}

export function InstitutionMetrics({ summary, engagement }: InstitutionMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <MetricCard
        label="Alunos Ativos"
        value={summary.alunosAtivos}
        subtext={`de ${summary.totalAlunos} total`}
        icon={Users}
        variant="accuracy"
        tooltip={[
          'Alunos que tiveram alguma atividade de estudo nos últimos 30 dias.',
          'Isso inclui assistir aulas, resolver questões ou revisar flashcards.',
        ]}
      />
      <MetricCard
        label="Horas de Estudo"
        value={engagement.totalHorasEstudo}
        icon={Clock}
        variant="time"
        trend={{
          value: engagement.horasEstudoDelta,
          isPositive: engagement.horasEstudoDelta.startsWith('+'),
        }}
        tooltip={[
          'Total de horas de estudo de todos os alunos no período.',
          'O valor mostra a variação em relação ao período anterior.',
        ]}
      />
      <MetricCard
        label="Atividades Concluídas"
        value={engagement.atividadesConcluidas}
        subtext="no período"
        icon={CheckCircle2}
        variant="questions"
        tooltip={[
          'Quantidade de aulas marcadas como assistidas no cronograma.',
          'Representa o progresso coletivo dos alunos.',
        ]}
      />
      <MetricCard
        label="Taxa de Conclusão"
        value={`${engagement.taxaConclusao}%`}
        variant="classTime"
        icon={Target}
        showProgressCircle={true}
        progressValue={engagement.taxaConclusao}
        tooltip={[
          'Percentual de atividades concluídas em relação ao total programado.',
          'Quanto maior, melhor o engajamento dos alunos com o cronograma.',
        ]}
      />
    </div>
  )
}
