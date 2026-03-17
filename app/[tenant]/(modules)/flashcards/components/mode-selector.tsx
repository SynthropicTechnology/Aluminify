'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
    Flame,
    BookOpen,
    Brain,
    HeartPulse,
    Target,
    Info,
    SlidersHorizontal,
    type LucideIcon,
} from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import { MODOS, type ModoConfig } from '../types'
import { cn } from '@/lib/utils'

const iconMap: Record<ModoConfig['icon'], LucideIcon> = {
    flame: Flame,
    'book-open': BookOpen,
    brain: Brain,
    'heart-pulse': HeartPulse,
    target: Target,
}

interface ModeSelectorProps {
    modo?: string | null
    scope: 'all' | 'completed'
    onSelectMode: (modeId: string) => void
    onScopeChange: (scope: 'all' | 'completed') => void
    isLoading?: boolean
}

function ModeCard({
    mode,
    isSelected,
    onSelect,
    isHighlighted = false,
}: {
    mode: ModoConfig
    isSelected: boolean
    onSelect: () => void
    isHighlighted?: boolean
}) {
    const Icon = iconMap[mode.icon]

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={onSelect}
                    className={cn(
                        'group relative cursor-pointer overflow-hidden rounded-xl text-left transition-colors duration-200 motion-reduce:transition-none',
                        'border-2 bg-card/50',
                        mode.accent,
                        isSelected
                            ? 'ring-2 ring-primary/20 shadow-md'
                            : 'hover:shadow-md',
                        isHighlighted && 'md:col-span-2'
                    )}
                >
                    {/* Gradient Background */}
                    <div
                        className={cn(
                            'absolute inset-0 bg-linear-to-br opacity-60 transition-opacity group-hover:opacity-100',
                            mode.gradient
                        )}
                    />

                    <div className={cn(
                        'relative flex items-center gap-3 p-3.5',
                        isHighlighted && 'justify-center'
                    )}>
                        {/* Icon Container */}
                        <div
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 motion-reduce:transition-none',
                                mode.iconBg
                            )}
                        >
                            <Icon className="h-4 w-4" strokeWidth={2} />
                        </div>

                        <div className={cn('min-w-0', isHighlighted && 'text-center')}>
                            <div className="flex items-center gap-1.5 text-sm font-semibold">
                                {mode.title}
                                <Info className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                {mode.desc}
                            </p>
                        </div>
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                        <div className="absolute right-2.5 top-2.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" className="max-w-xs p-3">
                <div className="space-y-2 text-sm">
                    {mode.tooltip.map((t, i) => (
                        <p key={i}>{t}</p>
                    ))}
                </div>
            </TooltipContent>
        </Tooltip>
    )
}

export function ModeSelector({
    modo,
    scope,
    onSelectMode,
    onScopeChange,
    isLoading = false,
}: ModeSelectorProps) {
    // Separate UTI mode (highlighted) from others
    const utiMode = MODOS.find((m) => m.id === 'mais_errados')
    const otherModes = MODOS.filter((m) => m.id !== 'mais_errados')

    return (
        <div className="space-y-4 md:space-y-5">
            {/* Scope Selection Card */}
            <Card className="overflow-hidden">
                <CardContent className="p-4 md:p-5 space-y-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold">Fonte dos flashcards</h2>
                            <p className="text-xs text-muted-foreground">
                                Escolha se a revisão considera todos os módulos ou apenas os concluídos
                            </p>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Concluídos usa progresso por aulas do calendário, com fallback para atividades concluídas.
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onScopeChange('all')}
                            disabled={isLoading || modo === 'personalizado'}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                scope === 'all'
                                    ? 'border-primary/50 bg-primary/5 text-foreground font-medium ring-1 ring-primary/20'
                                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            )}
                        >
                            <div className={cn(
                                'h-3 w-3 rounded-full border-2 transition-colors',
                                scope === 'all' ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                            )} />
                            Todos os módulos
                        </button>

                        <button
                            type="button"
                            onClick={() => onScopeChange('completed')}
                            disabled={isLoading || modo === 'personalizado'}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                scope === 'completed'
                                    ? 'border-primary/50 bg-primary/5 text-foreground font-medium ring-1 ring-primary/20'
                                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            )}
                        >
                            <div className={cn(
                                'h-3 w-3 rounded-full border-2 transition-colors',
                                scope === 'completed' ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                            )} />
                            Apenas concluídos
                        </button>
                    </div>

                    {modo === 'personalizado' && (
                        <p className="text-xs text-muted-foreground border-t pt-3">
                            No modo <strong>Personalizado</strong>, você escolhe um módulo específico.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Mode Selection Grid */}
            <div className="space-y-3">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-0.5">
                    Escolha seu modo de estudo
                </h2>

                <TooltipProvider delayDuration={300}>
                    <div className="grid gap-3 md:grid-cols-2">
                        {/* UTI Mode - Highlighted */}
                        {utiMode && (
                            <ModeCard
                                mode={utiMode}
                                isSelected={modo === utiMode.id}
                                onSelect={() => onSelectMode(utiMode.id)}
                                isHighlighted
                            />
                        )}

                        {/* Other Modes */}
                        {otherModes.map((m) => (
                            <ModeCard
                                key={m.id}
                                mode={m}
                                isSelected={modo === m.id}
                                onSelect={() => onSelectMode(m.id)}
                            />
                        ))}
                    </div>
                </TooltipProvider>
            </div>
        </div>
    )
}
