'use client'

import { Badge } from '@/app/shared/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StudentEngagementStatus } from '@/app/[tenant]/(modules)/dashboard/types'

const STATUS_CLASSES: Record<StudentEngagementStatus, string> = {
  sem_acesso: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  acessou_sem_estudo: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  sem_cronograma: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  baixo_engajamento: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  sem_conclusao: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  engajado: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
}

interface EngagementStatusBadgeProps {
  status: StudentEngagementStatus
  label: string
  className?: string
}

export function EngagementStatusBadge({
  status,
  label,
  className,
}: EngagementStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap text-xs', STATUS_CLASSES[status], className)}
    >
      {label}
    </Badge>
  )
}
