'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    X,
    RotateCcw,
    Loader2,
    AlertTriangle,
    ChevronRight,
    XCircle,
    CircleCheck,
    CircleHelp,
    CircleMinus,
    Flame,
} from 'lucide-react'
import { Markdown } from '@/app/shared/components/ui/custom/prompt/markdown'
import { Flashcard } from '../types'
import { cn } from '@/lib/utils'

interface StudySessionProps {
    cards: Flashcard[]
    currentIndex: number
    showAnswer: boolean
    loading: boolean
    error: string | null
    feedbackError?: string | null
    isSubmittingFeedback?: boolean
    currentStreak?: number
    onReveal: () => void
    onFeedback: (value: number) => void
    onRetryFeedback?: () => void
    onReload: () => void
    onExit: () => void
}

// Frases motivacionais para estudo
const STUDY_QUOTES = [
    { text: 'A repetição é a mãe da habilidade.', author: 'Tony Robbins' },
    { text: 'O conhecimento é poder.', author: 'Francis Bacon' },
    { text: 'Quanto mais você pratica, mais sorte você tem.', author: 'Gary Player' },
    { text: 'A educação é a arma mais poderosa para mudar o mundo.', author: 'Nelson Mandela' },
    { text: 'Aprender é a única coisa que a mente nunca se cansa.', author: 'Leonardo da Vinci' },
    { text: 'O segredo de progredir é começar.', author: 'Mark Twain' },
    { text: 'Cada dia é uma nova oportunidade de aprender.', author: 'Dalai Lama' },
    { text: 'A persistência realiza o impossível.', author: 'Provérbio Chinês' },
]

/** Trigger a short haptic pulse on supported devices */
function triggerHaptic(pattern: number | number[] = 10) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern)
    }
}

export function StudySession({
    cards,
    currentIndex,
    showAnswer,
    loading,
    error,
    feedbackError = null,
    isSubmittingFeedback = false,
    currentStreak = 0,
    onReveal,
    onFeedback,
    onRetryFeedback,
    onReload,
    onExit
}: StudySessionProps) {
    const current = cards[currentIndex]
    const SESSION_SIZE = 10
    const progress = cards.length > 0 ? (currentIndex + 1) / Math.min(cards.length, SESSION_SIZE) : 0
    const isFinished = currentIndex >= cards.length

    const [currentQuote] = React.useState(() =>
        STUDY_QUOTES[Math.floor(Math.random() * STUDY_QUOTES.length)]
    )
    const [reducedMotion, setReducedMotion] = React.useState(() => {
        if (typeof window === 'undefined') return false
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    })

    // Swipe tracking
    const touchStartRef = React.useRef<{ x: number; y: number } | null>(null)

    const normalizeMathDelimiters = React.useCallback((value?: string | null) => {
        if (!value) return ""

        if (process.env.NODE_ENV === 'development') {
            console.log('[Flashcards] Texto original:', value)
        }

        let normalized = value

        normalized = normalized
            .replaceAll("\\(", "$")
            .replaceAll("\\)", "$")
            .replaceAll("\\[", "$$")
            .replaceAll("\\]", "$$")

        const isAlreadyDelimited = (text: string, index: number): boolean => {
            if (index === 0) return false
            const before = text.substring(Math.max(0, index - 2), index)
            return before.endsWith('$') || before.endsWith('$$')
        }

        const formulaMatches: Array<{ fullMatch: string; startIndex: number; endIndex: number }> = []
        let i = 0

        while (i < normalized.length) {
            const varPattern = /([A-Za-z](?:_\{[^}]+\})?(?:\^\{[^}]+\})?)\s*=\s*/
            const remainingText = normalized.substring(i)
            const varMatch = remainingText.match(varPattern)

            if (!varMatch) {
                i++
                continue
            }

            const formulaStart = i + varMatch.index! + varMatch[0].length
            let j = formulaStart
            let braceDepth = 0
            let lastValidPos = formulaStart
            let foundOnde = false

            while (j < normalized.length) {
                const char = normalized[j]
                const nextFew = normalized.substring(j, Math.min(j + 10, normalized.length))

                if (char === '{') braceDepth++
                else if (char === '}') braceDepth--

                if (braceDepth === 0) {
                    if (char.match(/[A-Za-z0-9_^+\-*/=()\{\}\s\\.]/)) {
                        lastValidPos = j + 1
                    }

                    if (nextFew.match(/^\s*,?\s*onde\b/i)) {
                        foundOnde = true
                        break
                    }
                }

                j++
            }

            if (foundOnde || (j >= normalized.length && lastValidPos > formulaStart)) {
                const formulaText = normalized.substring(i + varMatch.index!, lastValidPos).trim()

                if (formulaText.includes('\\') && !isAlreadyDelimited(normalized, i + varMatch.index!)) {
                    const cleanedFormula = formulaText.replace(/[,\s]+$/, '')

                    if (cleanedFormula.length > 3) {
                        formulaMatches.push({
                            fullMatch: cleanedFormula,
                            startIndex: i + varMatch.index!,
                            endIndex: i + varMatch.index! + cleanedFormula.length
                        })
                    }
                }
            }

            i = foundOnde ? j : (i + 1)
        }

        formulaMatches.reverse().forEach(({ fullMatch, startIndex, endIndex }) => {
            normalized = normalized.substring(0, startIndex) +
                       `$${fullMatch}$` +
                       normalized.substring(endIndex)
        })

        normalized = normalized.replace(/\$\$\$/g, '$$')
        normalized = normalized.replace(/\$\$\$\$/g, '$$')
        normalized = normalized.replace(/\$\s*$/g, '')
        normalized = normalized.replace(/\$\s+([a-záàâãéêíóôõúç])/gi, ' $1')

        if (process.env.NODE_ENV === 'development') {
            console.log('[Flashcards] Texto processado:', normalized)
        }

        return normalized
    }, [])

    // Detect reduced motion preference
    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    }, [])

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === ' ' && !showAnswer) {
                e.preventDefault()
                onReveal()
            } else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
                e.preventDefault()
                onFeedback(parseInt(e.key))
            } else if (e.key === 'Escape') {
                onExit()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showAnswer, onReveal, onFeedback, onExit])

    // Swipe handlers (only active when answer is shown)
    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        }
    }, [])

    const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || !showAnswer) return
        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
        const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y
        const THRESHOLD = 80

        // Only horizontal swipes (ignore vertical scroll)
        if (Math.abs(deltaX) > THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            triggerHaptic()
            if (deltaX < 0) {
                onFeedback(1) // Swipe left → Errei
            } else {
                onFeedback(4) // Swipe right → Acertei
            }
        }
        touchStartRef.current = null
    }, [showAnswer, onFeedback])

    const handleRevealWithHaptic = React.useCallback(() => {
        triggerHaptic()
        onReveal()
    }, [onReveal])

    const handleFeedbackWithHaptic = React.useCallback((value: number) => {
        triggerHaptic()
        onFeedback(value)
    }, [onFeedback])

    // Loading state
    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg text-muted-foreground">Preparando flashcards...</p>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-6 text-center px-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="section-title">Erro ao carregar</h2>
                        <p className="text-muted-foreground max-w-md">{error}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={onReload}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Tentar Novamente
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onExit}
                            className="text-muted-foreground"
                        >
                            Voltar
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // Empty/finished state
    if (!current || isFinished) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-6 text-center px-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        <CircleCheck className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="section-title">Sessão finalizada</h2>
                        <p className="text-muted-foreground">Não há mais flashcards para revisar.</p>
                    </div>
                    <Button
                        onClick={onExit}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        Voltar ao Início
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden bg-background"
            style={{ backgroundImage: 'none' }}
            role="dialog"
            aria-modal="true"
            aria-label="Sessão de Flashcards"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Aurora Background - subtle in light, vibrant in dark */}
            <div className="absolute inset-0 pointer-events-none">
                {!reducedMotion && (
                    <>
                        <div className="absolute inset-0 opacity-[0.06] dark:opacity-40 transition-opacity duration-1000">
                            <div
                                className="absolute w-[200%] h-[200%] -left-1/2 -top-1/2 animate-aurora-slow"
                                style={{
                                    background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.15) 40%, transparent 70%)'
                                }}
                            />
                            <div
                                className="absolute w-[200%] h-[200%] -left-1/2 -top-1/2 animate-aurora-medium"
                                style={{
                                    background: 'radial-gradient(ellipse 60% 40% at 60% 60%, rgba(168, 85, 247, 0.2) 0%, transparent 60%)'
                                }}
                            />
                            <div
                                className="absolute w-[200%] h-[200%] -left-1/2 -top-1/2 animate-aurora-fast"
                                style={{
                                    background: 'radial-gradient(ellipse 50% 30% at 40% 40%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)'
                                }}
                            />
                        </div>
                        <div
                            className="absolute inset-0 opacity-[0.015] dark:opacity-[0.015]"
                            style={{
                                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
                            }}
                        />
                    </>
                )}
                {reducedMotion && (
                    <div
                        className="absolute inset-0 opacity-[0.04] dark:opacity-100"
                        style={{
                            background: 'radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 70%)'
                        }}
                    />
                )}
            </div>

            {/* Top controls bar - always visible */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 z-20">
                {/* Progress indicator */}
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="relative">
                        <svg width="48" height="48" className="-rotate-90 md:w-14 md:h-14">
                            <circle
                                cx="24"
                                cy="24"
                                r="19"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="text-muted-foreground/20 dark:text-white/10 md:[cx:28] md:[cy:28] md:[r:22]"
                            />
                            <circle
                                cx="24"
                                cy="24"
                                r="19"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                className="text-primary transition-[stroke-dashoffset] duration-500 md:[cx:28] md:[cy:28] md:[r:22]"
                                strokeDasharray={2 * Math.PI * 19}
                                strokeDashoffset={(2 * Math.PI * 19) - (progress * 2 * Math.PI * 19)}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] md:text-xs font-medium text-foreground">
                            {currentIndex + 1}/{Math.min(cards.length, SESSION_SIZE)}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs md:text-sm text-muted-foreground">
                            {Math.round(progress * 100)}% concluído
                        </span>
                        {/* Streak counter */}
                        {currentStreak >= 2 && (
                            <span className="flex items-center gap-1 text-[10px] md:text-xs text-amber-500 dark:text-amber-400 font-medium animate-in fade-in slide-in-from-left-2 duration-300">
                                <Flame className="h-3 w-3" />
                                {currentStreak} em sequência!
                            </span>
                        )}
                    </div>
                </div>

                {/* Exit button - min 44px touch target */}
                <button
                    onClick={onExit}
                    className="flex items-center justify-center h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Encerrar sessão"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Main content - scrollable */}
            <div className="h-full w-full flex flex-col items-center px-4 md:px-6 relative z-10 pt-20 md:pt-24 pb-6 md:pb-8 overflow-y-auto">
                <div className="w-full max-w-2xl my-auto">
                    {/* Flashcard - single card, no flip */}
                    <div
                        className={cn(
                            'w-full rounded-2xl',
                            'bg-card dark:bg-white/3 backdrop-blur-xl',
                            'border border-border dark:border-white/10',
                            'shadow-xl dark:shadow-2xl dark:shadow-black/20',
                        )}
                    >
                        {/* Question badge */}
                        <div className="flex items-center justify-center pt-6 md:pt-10 px-6 md:px-12">
                            <span className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 dark:bg-primary/20 text-foreground border border-primary/20 dark:border-primary/30">
                                Pergunta
                            </span>
                        </div>

                        {/* Question content */}
                        <div className="px-6 md:px-12 py-4 md:py-6">
                            <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
                                {current.perguntaImagemUrl && (
                                    <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border dark:border-white/10 bg-muted/50 dark:bg-white/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={current.perguntaImagemUrl}
                                            alt="Imagem da pergunta"
                                            className="w-full h-auto object-contain"
                                        />
                                    </div>
                                )}
                                <div className="text-lg md:text-2xl lg:text-3xl font-medium text-center text-foreground leading-relaxed">
                                    <Markdown>
                                        {normalizeMathDelimiters(current.pergunta)}
                                    </Markdown>
                                </div>
                            </div>
                        </div>

                        {/* Reveal button (hidden when answer is shown) */}
                        {!showAnswer && (
                            <div className="pt-6 md:pt-10 pb-6 md:pb-10 px-6 md:px-12 border-t border-border dark:border-white/10 space-y-3">
                                <Button
                                    onClick={handleRevealWithHaptic}
                                    className={cn(
                                        'w-full h-12 md:h-14 text-base md:text-lg font-medium',
                                        'bg-primary hover:bg-primary/90 text-primary-foreground',
                                        'transition-colors duration-200 motion-reduce:transition-none',
                                        'shadow-lg'
                                    )}
                                    autoFocus
                                >
                                    Revelar Resposta
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </Button>
                                <p className="hidden md:block text-center text-xs text-muted-foreground">
                                    ou pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Espaço</kbd>
                                </p>
                            </div>
                        )}

                        {/* Answer section (slides in when revealed) */}
                        {showAnswer && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Divider */}
                                <div className="border-t border-border dark:border-white/10" />

                                {/* Answer badge */}
                                <div className="flex items-center justify-center pt-6 md:pt-10 px-6 md:px-12">
                                    <span className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 dark:bg-primary/20 text-foreground border border-primary/20 dark:border-primary/30">
                                        Resposta
                                    </span>
                                </div>

                                {/* Answer content */}
                                <div className="px-6 md:px-12 py-4 md:py-6">
                                    <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
                                        {current.respostaImagemUrl && (
                                            <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border dark:border-white/10 bg-muted/50 dark:bg-white/5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={current.respostaImagemUrl}
                                                    alt="Imagem da resposta"
                                                    className="w-full h-auto object-contain"
                                                />
                                            </div>
                                        )}
                                        <div className="text-base md:text-xl lg:text-2xl font-medium text-center text-foreground leading-relaxed">
                                            <Markdown>
                                                {normalizeMathDelimiters(current.resposta)}
                                            </Markdown>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback section */}
                                <div className="px-6 md:px-12 pt-6 md:pt-10 pb-6 md:pb-10 border-t border-border dark:border-white/10">
                                    <div className="flex flex-col gap-4 md:gap-6">
                                        <p className="text-center text-sm md:text-base text-muted-foreground font-medium">
                                            Como foi?
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 w-full auto-rows-fr">
                                            <FeedbackButton
                                                onClick={() => handleFeedbackWithHaptic(1)}
                                                icon={<XCircle className="h-5 w-5" />}
                                                label="Errei"
                                                subtitle="Não sabia"
                                                shortcut="1"
                                                colorClass="bg-red-600 hover:bg-red-500 text-white border-red-500/30 shadow-sm shadow-red-500/10"
                                                disabled={isSubmittingFeedback}
                                            />
                                            <FeedbackButton
                                                onClick={() => handleFeedbackWithHaptic(2)}
                                                icon={<CircleMinus className="h-5 w-5" />}
                                                label="Parcial"
                                                subtitle="Acertei em parte"
                                                shortcut="2"
                                                colorClass="bg-amber-600 hover:bg-amber-500 text-white border-amber-500/30 shadow-sm shadow-amber-500/10"
                                                disabled={isSubmittingFeedback}
                                            />
                                            <FeedbackButton
                                                onClick={() => handleFeedbackWithHaptic(3)}
                                                icon={<CircleHelp className="h-5 w-5" />}
                                                label="Inseguro"
                                                subtitle="Acertei com dúvida"
                                                shortcut="3"
                                                colorClass="bg-sky-600 hover:bg-sky-500 text-white border-sky-500/30 shadow-sm shadow-sky-500/10"
                                                disabled={isSubmittingFeedback}
                                            />
                                            <FeedbackButton
                                                onClick={() => handleFeedbackWithHaptic(4)}
                                                icon={<CircleCheck className="h-5 w-5" />}
                                                label="Acertei"
                                                subtitle="Sabia bem"
                                                shortcut="4"
                                                colorClass="bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                                                disabled={isSubmittingFeedback}
                                            />
                                        </div>
                                        {feedbackError && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                                                <p className="text-xs text-destructive">{feedbackError}</p>
                                                {onRetryFeedback && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="mt-2"
                                                        onClick={onRetryFeedback}
                                                        disabled={isSubmittingFeedback}
                                                    >
                                                        {isSubmittingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                        Tentar enviar novamente
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        {/* Swipe hint - mobile only */}
                                        <p className="md:hidden text-center text-[10px] text-muted-foreground">
                                            Deslize para os lados: esquerda = errei, direita = acertei
                                        </p>
                                    </div>
                                </div>

                                {/* Quote section */}
                                <div className="px-6 md:px-12 pt-4 md:pt-6 pb-6 md:pb-10 border-t border-border dark:border-white/10 opacity-50">
                                    <blockquote className="text-center">
                                        <p className="text-xs md:text-sm text-muted-foreground italic leading-relaxed">
                                            &ldquo;{currentQuote.text}&rdquo;
                                        </p>
                                        <footer className="mt-1.5 text-[10px] md:text-xs text-muted-foreground/70">
                                            — {currentQuote.author}
                                        </footer>
                                    </blockquote>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ESC hint - desktop only, inside scroll area (not fixed) */}
                    <p className="hidden md:block mt-6 text-center text-xs text-muted-foreground">
                        Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Esc</kbd> para sair
                    </p>
                </div>
            </div>

            {/* KaTeX color override - inherits from parent text color */}
            <style jsx>{`
                :global(.katex),
                :global(.katex *) {
                    color: inherit !important;
                }
                :global(.katex-error) {
                    color: inherit !important;
                    background-color: transparent !important;
                }
            `}</style>
        </div>
    )
}

// Feedback button component
function FeedbackButton({
    onClick,
    icon,
    label,
    subtitle,
    shortcut,
    colorClass,
    disabled = false,
}: {
    onClick: () => void
    icon: React.ReactNode
    label: string
    subtitle: string
    shortcut: string
    colorClass: string
    disabled?: boolean
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'flex flex-col items-center justify-center gap-1 md:gap-1.5 py-3 md:py-4 px-2 md:px-3 rounded-xl',
                'border transition-colors duration-200 motion-reduce:transition-none',
                'focus:outline-none focus:ring-2 focus:ring-white/20',
                'w-full h-full min-h-16',
                'disabled:cursor-not-allowed disabled:opacity-70',
                colorClass
            )}
        >
            {icon}
            <span className="text-xs md:text-sm font-medium leading-tight">{label}</span>
            <span className="text-[8px] md:text-[9px] leading-tight text-white/70">{subtitle}</span>
            <kbd className="hidden md:inline text-[10px] opacity-60 font-mono">{shortcut}</kbd>
        </button>
    )
}
