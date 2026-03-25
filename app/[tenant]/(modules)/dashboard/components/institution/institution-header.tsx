'use client'

import type { ReactNode } from 'react'

interface InstitutionHeaderProps {
  userName: string
  empresaNome: string
  totalAlunos: number
  totalProfessores: number
  totalCursos: number
  controls?: ReactNode
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function InstitutionHeader({
  userName,
  empresaNome,
  totalAlunos: _totalAlunos,
  totalProfessores: _totalProfessores,
  totalCursos: _totalCursos,
  controls,
}: InstitutionHeaderProps) {
  return (
    <header className="rounded-2xl border border-border/40 bg-card/50 p-4 md:p-5 dark:bg-card/40 dark:backdrop-blur-sm dark:border-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            {getGreeting()}, {userName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{empresaNome}</p>
        </div>
        {controls && <div className="flex items-center gap-2 shrink-0">{controls}</div>}
      </div>
    </header>
  )
}
