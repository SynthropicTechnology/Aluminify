'use client'

import React from 'react'
import { createClient } from '@/app/shared/core/client'
import { useOptionalTenantContext } from '@/app/[tenant]/tenant-context'
import { useStudentOrganizations } from '@/components/providers/student-organizations-provider'
import { PageShell } from '@/components/layout/page-shell'
import { Flashcard, Curso, Disciplina, Frente, Modulo } from './types'
import * as flashcardsService from './actions'
import { ModeSelector } from './components/mode-selector'
import { Filters } from './components/filters'
import { StudySession } from './components/study-session'
import { SessionSummary } from './components/session-summary'

export default function FlashcardsClient() {
    const tenantContext = useOptionalTenantContext()
    const { activeOrganization } = useStudentOrganizations()
    // Tenant da URL é a fonte de verdade; activeOrganization pode estar desatualizado após switch
    const empresaId =
      tenantContext?.empresaId ?? activeOrganization?.id ?? undefined
    const supabase = createClient()

    const [modo, setModo] = React.useState<string | null>(null)
    const [scope, setScope] = React.useState<'all' | 'completed'>('all')
    const [cards, setCards] = React.useState<Flashcard[]>([])
    const [idx, setIdx] = React.useState(0)
    const [showAnswer, setShowAnswer] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const didMountRef = React.useRef(false)

    // Estados para modo personalizado
    const [cursos, setCursos] = React.useState<Curso[]>([])
    const [cursoSelecionado, setCursoSelecionado] = React.useState<string>('')
    const [disciplinas, setDisciplinas] = React.useState<Disciplina[]>([])
    const [disciplinaSelecionada, setDisciplinaSelecionada] = React.useState<string>('')
    const [frentes, setFrentes] = React.useState<Frente[]>([])
    const [frenteSelecionada, setFrenteSelecionada] = React.useState<string>('')
    const [modulos, setModulos] = React.useState<Modulo[]>([])
    const [moduloSelecionado, setModuloSelecionado] = React.useState<string>('')
    const [loadingFiltros, setLoadingFiltros] = React.useState(false)
    const [loadingCursos, setLoadingCursos] = React.useState(true)

    // Estados para rastreamento de sessão
    const [_cardsVistos, setCardsVistos] = React.useState<Set<string>>(new Set())
    const [feedbacks, setFeedbacks] = React.useState<number[]>([])
    const [sessaoCompleta, setSessaoCompleta] = React.useState(false)
    const [feedbackError, setFeedbackError] = React.useState<string | null>(null)
    const [pendingFeedback, setPendingFeedback] = React.useState<number | null>(null)
    const [submittingFeedback, setSubmittingFeedback] = React.useState(false)

    const SESSION_SIZE = 10

    // Compute current streak of consecutive correct answers (feedback === 4)
    const currentStreak = React.useMemo(() => {
        let streak = 0
        for (let i = feedbacks.length - 1; i >= 0; i--) {
            if (feedbacks[i] === 4) streak++
            else break
        }
        return streak
    }, [feedbacks])

    // Reset completo ao trocar de organização (multi-tenant)
    React.useEffect(() => {
        setModo(null)
        setCards([])
        setIdx(0)
        setCardsVistos(new Set())
        setFeedbacks([])
        setSessaoCompleta(false)
        setCursoSelecionado('')
        setDisciplinaSelecionada('')
        setFrenteSelecionada('')
        setModuloSelecionado('')
        setShowAnswer(false)
        setError(null)
        setFeedbackError(null)
        setPendingFeedback(null)
        setSubmittingFeedback(false)
    }, [empresaId])

    const fetchCards = React.useCallback(
        async (
            modoSelecionado: string,
            scopeSelecionado: 'all' | 'completed',
            cursoId?: string,
            frenteId?: string,
            moduloId?: string,
            resetSession = false,
            excludeIds?: string[],
        ) => {
            try {
                setLoading(true)
                setError(null)
                setShowAnswer(false)

                if (resetSession) {
                    setIdx(0)
                    setCardsVistos(new Set())
                    setFeedbacks([])
                    setSessaoCompleta(false)
                    setFeedbackError(null)
                    setPendingFeedback(null)
                    setSubmittingFeedback(false)
                }

                const newCards = await flashcardsService.getFlashcards(
                    modoSelecionado,
                    scopeSelecionado,
                    cursoId,
                    frenteId,
                    moduloId,
                    excludeIds,
                    empresaId,
                )

                setCards(newCards)

                if (resetSession) {
                    setIdx(0)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao carregar flashcards')
            } finally {
                setLoading(false)
            }
        },
        [empresaId],
    )

    // Auto-refresh ao trocar escopo
    React.useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true
            return
        }

        if (!modo || modo === 'personalizado') return
        fetchCards(modo, scope, undefined, undefined, undefined, true)
    }, [scope, modo, fetchCards])

    // Carregar cursos
    React.useEffect(() => {
        const loadCursos = async () => {
            try {
                setLoadingCursos(true)
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const cursosData = await flashcardsService.getCursos(empresaId)
                setCursos(cursosData)
            } catch (err) {
                console.error('Erro ao carregar cursos:', err)
                setError('Erro ao carregar cursos. Tente recarregar a página.')
            } finally {
                setLoadingCursos(false)
            }
        }

        loadCursos()
    }, [supabase, empresaId])

    // Carregar disciplinas
    React.useEffect(() => {
        if (!cursoSelecionado) {
            setDisciplinas([])
            setDisciplinaSelecionada('')
            return
        }

        const loadDisciplinas = async () => {
            try {
                setLoadingFiltros(true)
                const disciplinasData = await flashcardsService.getDisciplinas(cursoSelecionado)
                setDisciplinas(disciplinasData)
            } catch (err) {
                console.error('Erro ao carregar disciplinas:', err)
                setError('Erro ao carregar disciplinas.')
            } finally {
                setLoadingFiltros(false)
            }
        }

        loadDisciplinas()
        setDisciplinaSelecionada('')
        setFrenteSelecionada('')
        setModuloSelecionado('')
    }, [cursoSelecionado])

    // Carregar frentes
    React.useEffect(() => {
        if (!disciplinaSelecionada || !cursoSelecionado) {
            setFrentes([])
            setFrenteSelecionada('')
            return
        }

        const loadFrentes = async () => {
            try {
                setLoadingFiltros(true)
                const frentesData = await flashcardsService.getFrentes(cursoSelecionado, disciplinaSelecionada)
                setFrentes(frentesData)
            } catch (err) {
                console.error('Erro ao carregar frentes:', err)
                setError('Erro ao carregar frentes.')
            } finally {
                setLoadingFiltros(false)
            }
        }

        loadFrentes()
        setFrenteSelecionada('')
        setModuloSelecionado('')
    }, [disciplinaSelecionada, cursoSelecionado])

    // Carregar módulos
    React.useEffect(() => {
        if (!frenteSelecionada || !cursoSelecionado) {
            setModulos([])
            setModuloSelecionado('')
            return
        }

        const loadModulos = async () => {
            try {
                setLoadingFiltros(true)
                const modulosData = await flashcardsService.getModulos(cursoSelecionado, frenteSelecionada)
                setModulos(modulosData)
            } catch (err) {
                console.error('Erro ao carregar módulos:', err)
            } finally {
                setLoadingFiltros(false)
            }
        }

        loadModulos()
        setModuloSelecionado('')
    }, [frenteSelecionada, cursoSelecionado])

    const handleSelectModo = (id: string) => {
        setModo(id)
        if (id !== 'personalizado') {
            fetchCards(id, scope, undefined, undefined, undefined, true)
        } else {
            setCards([])
            setIdx(0)
            setCardsVistos(new Set())
            setFeedbacks([])
            setSessaoCompleta(false)
        }
    }



    // Trigger search when module is selected in personalized mode
    React.useEffect(() => {
        if (modo === 'personalizado' && cursoSelecionado && disciplinaSelecionada && frenteSelecionada && moduloSelecionado) {
            fetchCards('personalizado', scope, cursoSelecionado, frenteSelecionada, moduloSelecionado, true)
        }
    }, [modo, cursoSelecionado, disciplinaSelecionada, frenteSelecionada, moduloSelecionado, scope, fetchCards])


    const handleFeedback = async (feedback: number) => {
        const current = cards[idx]
        if (!current || submittingFeedback) return

        try {
            setSubmittingFeedback(true)
            setFeedbackError(null)
            setPendingFeedback(null)
            await flashcardsService.submitFeedback(current.id, feedback)
            setCardsVistos((prev) => new Set([...prev, current.id]))
            setFeedbacks((prev) => [...prev, feedback])
        } catch (err) {
            console.error('Erro ao enviar feedback', err)
            setFeedbackError('Não foi possível salvar sua resposta. Tente novamente para continuar.')
            setPendingFeedback(feedback)
            setSubmittingFeedback(false)
            return
        } finally {
            setSubmittingFeedback(false)
        }

        const nextIdx = idx + 1
        if (nextIdx >= SESSION_SIZE || nextIdx >= cards.length) {
            setSessaoCompleta(true)
        } else {
            setIdx(nextIdx)
            setShowAnswer(false)
        }
    }

    const handleRetryFeedback = () => {
        if (pendingFeedback !== null) {
            void handleFeedback(pendingFeedback)
        }
    }

    const handleFinishSession = () => {
        setModo(null)
        setCards([])
        setIdx(0)
        setCardsVistos(new Set())
        setFeedbacks([])
        setSessaoCompleta(false)
        setShowAnswer(false)
        setFeedbackError(null)
        setPendingFeedback(null)
        setSubmittingFeedback(false)
    }

    const handleStudyMore = () => {
        if (modo === 'personalizado') {
            // Para personalizado, mantemos o mesmo módulo
            fetchCards('personalizado', scope, cursoSelecionado, frenteSelecionada, moduloSelecionado, true)
        } else if (modo) {
            // Para outros modos, buscamos novos cards (API já deve embaralhar/trazer novos)
            // Passar excludeIds? O endpoint já filtra por review date, mas podemos passar para garantir
            // fetchCards(modo, scope, undefined, undefined, undefined, true, Array.from(cardsVistos))
            // Por simplificação inicial, vamos confiar no backend trazendo os "due"
            fetchCards(modo, scope, undefined, undefined, undefined, true)
        }
    }

    const handleReload = () => {
        if (modo === 'personalizado') {
            fetchCards('personalizado', scope, cursoSelecionado, frenteSelecionada, moduloSelecionado, true)
        } else if (modo) {
            fetchCards(modo, scope, undefined, undefined, undefined, true)
        }
    }

    // Renderização
    if (sessaoCompleta) {
        return (
            <SessionSummary
                feedbacks={feedbacks}
                onFinish={handleFinishSession}
                onStudyMore={handleStudyMore}
            />
        )
    }

    if (modo && cards.length > 0) {
        return (
            <StudySession
                cards={cards}
                currentIndex={idx}
                showAnswer={showAnswer}
                loading={loading}
                error={error}
                feedbackError={feedbackError}
                isSubmittingFeedback={submittingFeedback}
                currentStreak={currentStreak}
                onReveal={() => setShowAnswer(true)}
                onFeedback={handleFeedback}
                onRetryFeedback={handleRetryFeedback}
                onReload={handleReload}
                onExit={handleFinishSession}
            />
        )
    }

    // Se está carregando inicial ou vazio
    if (loading && cards.length === 0) {
        return (
            <PageShell
                title="Flashcards"
                subtitle="Estude de forma inteligente com repetição espaçada"
            >
                <div className="flex h-64 items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Carregando flashcards...</p>
                    </div>
                </div>
            </PageShell>
        )
    }

    return (
        <PageShell
            title="Flashcards"
            subtitle="Estude de forma inteligente com repetição espaçada"
        >
            <ModeSelector
                modo={modo}
                scope={scope}
                onSelectMode={handleSelectModo}
                onScopeChange={setScope}
                isLoading={loading}
            />

            {modo === 'personalizado' && (
                <Filters
                    cursos={cursos}
                    disciplinas={disciplinas}
                    frentes={frentes}
                    modulos={modulos}
                    cursoSelecionado={cursoSelecionado}
                    disciplinaSelecionada={disciplinaSelecionada}
                    frenteSelecionada={frenteSelecionada}
                    moduloSelecionado={moduloSelecionado}
                    onCursoChange={setCursoSelecionado}
                    onDisciplinaChange={setDisciplinaSelecionada}
                    onFrenteChange={setFrenteSelecionada}
                    onModuloChange={setModuloSelecionado}
                    isLoadingCursos={loadingCursos}
                    isLoadingFiltros={loadingFiltros}
                />
            )}

            {error && (
                <div className="flex items-center gap-3 p-4 text-sm rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    {error}
                </div>
            )}
        </PageShell>
    )
}
