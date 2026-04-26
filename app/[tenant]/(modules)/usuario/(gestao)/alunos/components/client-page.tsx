"use client"

import { useRef, useState, useEffect } from 'react'
import { Plus, Upload, UserPlus, Download, ChevronDown } from 'lucide-react'
import { Student } from '@/app/shared/types/entities/user'
import { StudentFilters } from './student-filters'
import { StudentTable } from './student-table'
import { StudentSheet } from './student-sheet'
import { PaginationMeta } from '@/app/shared/types/dtos/api-responses'
import { useRouter } from 'next/navigation'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/app/shared/components/overlay/dropdown-menu'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/app/shared/components/overlay/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/shared/components/dataviz/table'
import { downloadFile } from '@/shared/library/download-file'
import { Spinner } from '@/app/shared/components/feedback/spinner'

type ImportIssueStatus = 'skipped' | 'linked' | 'failed' | 'rejected'

type ImportIssueRow = {
    rowNumber: number
    email: string
    status: ImportIssueStatus
    message: string
}

type UsageReportPreset = '7' | '14' | '30' | '90' | '365' | 'custom'
type UsageReportStatus = 'all' | 'active' | 'inactive'

function toDateInputValue(date: Date): string {
    return date.toISOString().split('T')[0]
}

function daysAgo(days: number): Date {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function translateStatus(status: ImportIssueStatus): string {
    switch (status) {
        case 'skipped':
            return 'já cadastrado'
        case 'linked':
            return 'vinculado'
        case 'failed':
            return 'erro'
        case 'rejected':
            return 'rejeitado'
        default:
            return status
    }
}

function translateErrorMessage(message: string): string {
    if (!message) return message
    
    let translated = message

    // Traduzir mensagens comuns de erro
    translated = translated.replace(/Failed to create student:/gi, 'Falha ao criar aluno:')
    translated = translated.replace(/Failed to list auth users:/gi, 'Falha ao listar usuários:')
    translated = translated.replace(/Failed to create auth user:/gi, 'Falha ao criar usuário:')
    translated = translated.replace(/Database error finding users/gi, 'Erro no banco de dados ao buscar usuários')
    translated = translated.replace(/Database error creating new user/gi, 'Erro no banco de dados ao criar novo usuário')
    translated = translated.replace(/Erro inesperado ao importar aluno/gi, 'Erro inesperado ao importar aluno')
    
    // Traduzir erros de constraint
    translated = translated.replace(/duplicate key value violates unique constraint/gi, 'valor duplicado viola restrição única')
    translated = translated.replace(/alunos_pkey/gi, 'chave primária de alunos')
    translated = translated.replace(/alunos_numero_matricula_key/gi, 'número de matrícula')
    translated = translated.replace(/alunos_empresa_matricula_unique/gi, 'matrícula única por empresa')
    translated = translated.replace(/alunos_email_key/gi, 'e-mail')
    translated = translated.replace(/alunos_cpf_key/gi, 'CPF')
    
    // Traduzir mensagens de conflito
    translated = translated.replace(/Student with email "([^"]+)"/gi, 'Aluno com e-mail "$1"')
    translated = translated.replace(/Student with CPF "([^"]+)"/gi, 'Aluno com CPF "$1"')
    translated = translated.replace(/Student with enrollment number "([^"]+)"/gi, 'Aluno com número de matrícula "$1"')
    translated = translated.replace(/already exists/gi, 'já existe')
    translated = translated.replace(/in this empresa/gi, 'nesta empresa')
    translated = translated.replace(/Aluno já existe no sistema/gi, 'Aluno já existe no sistema')
    translated = translated.replace(/Conflict:/gi, 'Conflito:')
    translated = translated.replace(/User with email ([^\s]+) exists in Auth but could not be retrieved/gi, 'Usuário com e-mail $1 existe no sistema de autenticação mas não pôde ser recuperado')
    translated = translated.replace(/exists in Auth but could not be retrieved/gi, 'existe no sistema de autenticação mas não pôde ser recuperado')
    
    // Traduzir mensagens de validação
    translated = translated.replace(/Campo obrigatório/gi, 'Campo obrigatório')
    translated = translated.replace(/ausente/gi, 'ausente')
    translated = translated.replace(/CPF deve ter 11 dígitos/gi, 'CPF deve ter 11 dígitos')
    translated = translated.replace(/Informe o CPF ou a senha temporária/gi, 'Informe o CPF ou a senha temporária')
    translated = translated.replace(/Cursos não encontrados:/gi, 'Cursos não encontrados:')
    translated = translated.replace(/Nenhum curso válido encontrado/gi, 'Nenhum curso válido encontrado')
    translated = translated.replace(/A senha temporária deve ter pelo menos 8 caracteres/gi, 'A senha temporária deve ter pelo menos 8 caracteres')
    translated = translated.replace(/Informe pelo menos um curso/gi, 'Informe pelo menos um curso')
    translated = translated.replace(/Nome completo é obrigatório/gi, 'Nome completo é obrigatório')
    translated = translated.replace(/Email é obrigatório/gi, 'E-mail é obrigatório')
    translated = translated.replace(/Número de matrícula é obrigatório/gi, 'Número de matrícula é obrigatório')
    translated = translated.replace(/Senha temporária deve ter pelo menos 8 caracteres/gi, 'Senha temporária deve ter pelo menos 8 caracteres')

    return translated
}

interface AlunosClientPageProps {
    students: Student[]
    meta: PaginationMeta
    courses: { id: string, name: string, usaTurmas: boolean }[]
    totalAll: number
    cronogramaStatusByStudentId: Record<string, boolean>
}

export function AlunosClientPage({
    students,
    meta,
    courses,
    totalAll,
    cronogramaStatusByStudentId,
}: AlunosClientPageProps) {
    const router = useRouter()
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isUsageReportDownloading, setIsUsageReportDownloading] = useState(false)
    const [usageReportPreset, setUsageReportPreset] = useState<UsageReportPreset>('30')
    const [usageReportStatus, setUsageReportStatus] = useState<UsageReportStatus>('active')
    const [usageReportCourseId, setUsageReportCourseId] = useState('all')
    const [usageReportStartDate, setUsageReportStartDate] = useState(() => toDateInputValue(daysAgo(30)))
    const [usageReportEndDate, setUsageReportEndDate] = useState(() => toDateInputValue(new Date()))
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [importReportOpen, setImportReportOpen] = useState(false)
    const [importIssues, setImportIssues] = useState<ImportIssueRow[]>([])
    const [importSummaryText, setImportSummaryText] = useState<string>('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isDatabaseEmpty = totalAll === 0

    const getUsageReportPeriod = () => {
        const today = new Date()
        return {
            periodStart: usageReportPreset === 'custom'
                ? usageReportStartDate
                : toDateInputValue(daysAgo(Number(usageReportPreset))),
            periodEnd: usageReportPreset === 'custom'
                ? usageReportEndDate
                : toDateInputValue(today),
        }
    }

    const handleDownloadTemplate = async () => {
        setIsDownloading(true)
        try {
            await downloadFile({
                url: '/api/usuario/alunos/template',
                fallbackFilename: `modelo-importacao-alunos-${new Date().toISOString().split('T')[0]}.xlsx`,
            })
        } catch (error) {
            console.error('Erro ao baixar template:', error)
            toast.error(
                error instanceof Error ? error.message : 'Erro ao baixar modelo'
            )
        } finally {
            setIsDownloading(false)
        }
    }

    const handleDownloadUsageReport = async () => {
        setIsUsageReportDownloading(true)
        try {
            const params = new URLSearchParams()
            const tenant = window.location.pathname.split('/').filter(Boolean)[0] || 'tenant'
            const { periodStart, periodEnd } = getUsageReportPeriod()

            params.set('tenant', tenant)
            params.set('scope', 'all')
            params.set('usageFilter', 'all')
            params.set('periodStart', periodStart)
            params.set('periodEnd', periodEnd)
            if (usageReportStatus !== 'all') params.set('status', usageReportStatus)
            if (usageReportCourseId !== 'all') params.set('courseId', usageReportCourseId)

            await downloadFile({
                url: `/api/usuario/alunos/usage-report?${params.toString()}`,
                fallbackFilename: `relatorio-uso-alunos-${tenant}-${periodStart}-${periodEnd}.xlsx`,
            })
            toast.success('Relatório de uso gerado com sucesso')
        } catch (error) {
            console.error('Erro ao baixar relatório de uso:', error)
            toast.error(
                error instanceof Error ? error.message : 'Erro ao gerar relatório de uso'
            )
        } finally {
            setIsUsageReportDownloading(false)
        }
    }

    const handlePickImportFile = () => {
        fileInputRef.current?.click()
    }

    const handleImportFileSelected = async (file: File) => {
        setIsImporting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/usuario/alunos/bulk-import', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                let detail = ''
                try {
                    const contentType = response.headers.get('content-type') || ''
                    if (contentType.includes('application/json')) {
                        const data = await response.json().catch(() => null)
                        detail = data?.error ? String(data.error) : ''

                        // Se a API devolver preview de validação, mostrar um resumo das primeiras linhas.
                        // Exemplo de payload: { error, preview: [{ rowNumber, email, errors: string[] }, ...] }
                        if (Array.isArray(data?.preview) && data.preview.length > 0) {
                            const preview = Array.isArray(data?.preview) ? (data.preview as unknown[]) : []
                            const previewLines = preview
                                .slice(0, 3)
                                .map((p: unknown) => {
                                    if (!isRecord(p)) return ''
                                    const row = typeof p.rowNumber === 'number' ? p.rowNumber : '?'
                                    const email = typeof p.email === 'string' ? p.email : ''
                                    const errorsList = Array.isArray(p.errors)
                                        ? p.errors.filter((e): e is string => typeof e === 'string')
                                        : []
                                    const errors = errorsList.join(' | ')
                                    return `Linha ${row}${email ? ` (${email})` : ''}: ${errors}`.trim()
                                })
                                .filter((line): line is string => Boolean(line))
                                .join('\n')

                            detail = `${detail}\n${previewLines}`.trim()
                            console.warn('[import alunos] Preview de erros:', data.preview)
                        }
                    } else {
                        detail = (await response.text().catch(() => '')).slice(0, 200)
                    }
                } catch {
                    // noop
                }
                throw new Error(detail || `Erro ao importar planilha (HTTP ${response.status})`)
            }

            const json = await response.json().catch(() => null)
            const summary = json?.data
            const rejected = typeof json?.rejected === 'number' ? json.rejected : 0
            const rejectedPreview = Array.isArray(json?.rejectedPreview) ? json.rejectedPreview : []

            const created = typeof summary?.created === 'number' ? summary.created : null
            const linked = typeof summary?.linked === 'number' ? summary.linked : null
            const skipped = typeof summary?.skipped === 'number' ? summary.skipped : null
            const failed = typeof summary?.failed === 'number' ? summary.failed : null

            const issues: ImportIssueRow[] = []

            // Linhas processadas pelo import service (created/linked/skipped/failed)
            const rows = Array.isArray(summary?.rows) ? (summary.rows as unknown[]) : []
            rows.forEach((r) => {
                if (!isRecord(r)) return
                const status = typeof r.status === 'string' ? r.status : undefined
                // Mostrar apenas skipped e failed como problemas (linked é sucesso)
                if (status === 'skipped' || status === 'failed') {
                    issues.push({
                        rowNumber: typeof r.rowNumber === 'number' ? r.rowNumber : 0,
                        email: typeof r.email === 'string' ? r.email : '',
                        status,
                        message: typeof r.message === 'string' ? r.message : '',
                    })
                }
            })

            // Linhas rejeitadas na validação antes de chegar no import service
            if (Array.isArray(rejectedPreview) && rejectedPreview.length > 0) {
                rejectedPreview.forEach((p: unknown) => {
                    if (!isRecord(p)) return
                    const errorsList = Array.isArray(p.errors)
                        ? p.errors.filter((e): e is string => typeof e === 'string')
                        : []
                    const errors = errorsList.join(' | ')
                    issues.push({
                        rowNumber: typeof p.rowNumber === 'number' ? p.rowNumber : 0,
                        email: typeof p.email === 'string' ? p.email : '',
                        status: 'rejected',
                        message: errors,
                    })
                })
            }

            if (created === 0 && linked === 0 && (skipped || failed)) {
                toast.warning(
                    `Importação concluída, mas nenhum aluno foi processado (já cadastrados: ${skipped ?? 0}, com erro: ${failed ?? 0}).`
                )
            } else if (created !== null || linked !== null) {
                toast.success(
                    `Importação concluída: ${created ?? 0} criados, ${linked ?? 0} vinculados, ${skipped ?? 0} já cadastrados, ${failed ?? 0} com erro.`
                )
            } else {
                toast.success('Importação concluída com sucesso')
            }

            if (rejected > 0) {
                toast.warning(`Atenção: ${rejected} linhas foram rejeitadas por validação (abra o console para detalhes).`, {
                    duration: 8000,
                })
                console.warn('[import alunos] Linhas rejeitadas (preview):', rejectedPreview)
            }

            if (issues.length > 0) {
                const summaryLine = `Resultado da importação: ${created ?? 0} criados, ${linked ?? 0} vinculados, ${skipped ?? 0} já cadastrados, ${failed ?? 0} com erro, ${rejected ?? 0} rejeitados.`
                // Traduzir mensagens de erro
                const translatedIssues = issues.map(issue => ({
                    ...issue,
                    message: translateErrorMessage(issue.message),
                }))
                setImportSummaryText(summaryLine)
                setImportIssues(translatedIssues.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0)))
                setImportReportOpen(true)
                toast.warning(
                    `Atenção: ${issues.length} linha(s) não foram importadas. Vou mostrar a lista com os motivos.`
                )
            }

            // Atualizar a listagem imediatamente
            router.refresh()
        } catch (error) {
            console.error('Erro ao importar planilha:', error)
            toast.error(error instanceof Error ? error.message : 'Erro ao importar planilha', {
                // Mensagens com múltiplas linhas podem ficar grandes; manter curto na UI.
                // O console já recebe o preview completo (quando existir).
                duration: 8000,
            })
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-4 pb-10 sm:px-6 lg:px-8">
            {/* Loading Overlay durante importação */}
            {isImporting && (
                <Dialog open={isImporting} onOpenChange={() => {}}>
                    <DialogContent className="sm:max-w-md" showCloseIcon={false}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Spinner className="w-5 h-5 text-primary" />
                                Importando alunos...
                            </DialogTitle>
                            <DialogDescription>
                                Por favor, aguarde enquanto processamos sua planilha. Isso pode levar alguns minutos dependendo do tamanho do arquivo.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="relative w-full overflow-hidden rounded-full bg-muted/50 h-2.5">
                                <div 
                                    className="h-full rounded-full bg-primary transition-[transform] duration-500 motion-reduce:transition-none"
                                    style={{
                                        width: '60%',
                                        animation: 'loading 1.5s ease-in-out infinite',
                                    }}
                                />
                            </div>
                            <style dangerouslySetInnerHTML={{__html: `
                                @keyframes loading {
                                    0% { transform: translateX(-100%); }
                                    50% { transform: translateX(200%); }
                                    100% { transform: translateX(-100%); }
                                }
                            `}} />
                            <p className="text-sm text-muted-foreground text-center">
                                Processando arquivo e criando registros...
                            </p>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={importReportOpen} onOpenChange={setImportReportOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Linhas não importadas</DialogTitle>
                        <DialogDescription>
                            {importSummaryText || 'Algumas linhas não foram importadas. Veja abaixo os e-mails e os motivos.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">
                            {importIssues.length} item(ns)
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                const text = importIssues
                                    .map((i) => `Linha ${i.rowNumber} | ${translateStatus(i.status)} | ${i.email} | ${i.message}`)
                                    .join('\n')
                                try {
                                    await navigator.clipboard.writeText(text)
                                    toast.success('Lista copiada para a área de transferência.')
                                } catch {
                                    toast.error('Não foi possível copiar a lista automaticamente.')
                                }
                            }}
                        >
                            Copiar lista
                        </Button>
                    </div>

                    <ScrollArea className="h-105 rounded-md border">
                        <div className="p-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Linha</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Motivo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {importIssues.map((i, idx) => (
                                        <TableRow key={`${i.rowNumber}-${i.email}-${idx}`}>
                                            <TableCell className="font-mono">{i.rowNumber || '-'}</TableCell>
                                            <TableCell className="font-mono">{translateStatus(i.status)}</TableCell>
                                            <TableCell className="font-mono">{i.email || '-'}</TableCell>
                                            <TableCell className="whitespace-normal wrap-break-word">{i.message || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    // permitir selecionar o mesmo arquivo novamente
                    e.target.value = ''
                    if (!file) return
                    void handleImportFileSelected(file)
                }}
            />

            {/* SECTION 1: HEADER & LIST (sempre que a empresa tem alunos) */}
            {!isDatabaseEmpty && (
                <section id="populated-state" className="flex flex-col gap-4 h-full min-h-150">
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                            <h1 className="page-title">Alunos</h1>
                            <p className="page-subtitle">
                                {totalAll} aluno(s) cadastrados na empresa
                                {meta.total !== totalAll ? ` • ${meta.total} encontrado(s) com os filtros` : ''}
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            {mounted ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex h-9 md:h-8 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted hover:shadow-md sm:w-auto">
                                            <Upload className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                            Importar
                                            <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleDownloadTemplate} disabled={isDownloading}>
                                            <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                                            {isDownloading ? 'Baixando...' : 'Baixar Modelo'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handlePickImportFile} disabled={isImporting}>
                                            <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
                                            {isImporting ? 'Importando...' : 'Importar Planilha'}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <button className="flex h-9 md:h-8 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted hover:shadow-md disabled:cursor-not-allowed sm:w-auto" disabled>
                                    <Upload className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                    Importar
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                </button>
                            )}
                            <button
                                onClick={() => setIsSheetOpen(true)}
                                className="flex h-9 md:h-8 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90 hover:shadow-md sm:w-auto"
                            >
                                <Plus className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                Novo Aluno
                            </button>
                        </div>
                    </header>

                    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-1">
                                <h2 className="text-base font-semibold text-foreground">
                                    Relatório de uso dos alunos
                                </h2>
                                <p className="max-w-2xl text-sm text-muted-foreground">
                                    Exporte um XLSX com os indicadores de uso dos alunos. Na tabela abaixo,
                                    mantemos apenas a informação essencial de cronograma para não poluir a página.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={handleDownloadUsageReport}
                                disabled={isUsageReportDownloading}
                                className="w-full whitespace-nowrap lg:w-auto"
                            >
                                {isUsageReportDownloading ? (
                                    <>
                                        <Spinner className="mr-2 h-4 w-4" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        <Download className="mr-2 h-4 w-4" />
                                        Baixar XLSX
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <label className="space-y-1.5 text-sm font-medium">
                                <span>Período de análise</span>
                                <select
                                    value={usageReportPreset}
                                    onChange={(event) => setUsageReportPreset(event.target.value as UsageReportPreset)}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="7">Últimos 7 dias</option>
                                    <option value="14">Últimos 14 dias</option>
                                    <option value="30">Últimos 30 dias</option>
                                    <option value="90">Últimos 90 dias</option>
                                    <option value="365">Últimos 12 meses</option>
                                    <option value="custom">Personalizado</option>
                                </select>
                            </label>

                            <label className="space-y-1.5 text-sm font-medium">
                                <span>Status</span>
                                <select
                                    value={usageReportStatus}
                                    onChange={(event) => setUsageReportStatus(event.target.value as UsageReportStatus)}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="active">Ativos</option>
                                    <option value="inactive">Inativos</option>
                                    <option value="all">Ativos e inativos</option>
                                </select>
                            </label>

                            <label className="space-y-1.5 text-sm font-medium">
                                <span>Curso</span>
                                <select
                                    value={usageReportCourseId}
                                    onChange={(event) => setUsageReportCourseId(event.target.value)}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="all">Todos os cursos</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {usageReportPreset === 'custom' && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1.5 text-sm font-medium">
                                    <span>Data inicial</span>
                                    <input
                                        type="date"
                                        value={usageReportStartDate}
                                        onChange={(event) => setUsageReportStartDate(event.target.value)}
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1.5 text-sm font-medium">
                                    <span>Data final</span>
                                    <input
                                        type="date"
                                        value={usageReportEndDate}
                                        onChange={(event) => setUsageReportEndDate(event.target.value)}
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </label>
                            </div>
                        )}

                    </section>

                    <StudentFilters />

                    <StudentTable
                        students={students}
                        meta={meta}
                        cronogramaStatusByStudentId={cronogramaStatusByStudentId}
                    />
                </section>
            )}

            {/* SECTION 2: EMPTY STATE (Only if truly empty) */}
            {isDatabaseEmpty && (
                <section id="empty-state" className="flex-1 flex flex-col items-center justify-center min-h-100">

                    <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-border">
                        <UserPlus className="w-8 h-8 text-muted-foreground" strokeWidth={1} />
                    </div>

                    <h3 className="empty-state-title mb-2">Base de alunos vazia</h3>
                    <p className="section-subtitle text-center max-w-sm mb-8 leading-relaxed">
                        Sua infraestrutura está pronta. Adicione alunos manualmente para gerar credenciais ou importe em massa.
                    </p>

                    <div className="flex w-full max-w-sm flex-col items-center gap-3 sm:w-auto sm:flex-row">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex h-9 md:h-8 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 text-sm font-medium text-foreground shadow-sm transition-colors duration-200 hover:bg-muted hover:shadow-md sm:w-auto">
                                    <Upload className="w-4 h-4" strokeWidth={1.5} />
                                    Importar Planilha
                                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                                <DropdownMenuItem onClick={handleDownloadTemplate} disabled={isDownloading}>
                                    <Download className="w-4 h-4 mr-2" strokeWidth={1.5} />
                                    {isDownloading ? 'Baixando...' : 'Baixar Modelo'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handlePickImportFile} disabled={isImporting}>
                                    <Upload className="w-4 h-4 mr-2" strokeWidth={1.5} />
                                    {isImporting ? 'Importando...' : 'Importar Planilha'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                            onClick={() => setIsSheetOpen(true)}
                            className="flex h-9 md:h-8 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90 hover:shadow-md sm:w-auto"
                        >
                            <Plus className="w-5 h-5" strokeWidth={1.5} />
                            Adicionar Manualmente
                        </button>
                    </div>
                </section>
            )}

            <StudentSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} courses={courses} />

        </div>
    )
}
