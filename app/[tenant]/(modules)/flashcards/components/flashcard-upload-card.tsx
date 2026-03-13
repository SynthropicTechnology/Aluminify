'use client'

import * as React from 'react'
import { createClient } from '@/app/shared/core/client'
import type { Database } from '@/app/shared/core/database.types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/app/shared/components/forms/input'
import { Label } from '@/app/shared/components/forms/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/shared/components/forms/select'
import { FileText, Upload, Loader2, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import Papa from 'papaparse'
import { downloadFile } from '@/shared/library/download-file'

async function loadExcelJS() {
  const mod = await import('exceljs/dist/exceljs.min.js')
  return mod?.default ?? mod
}

// IDs estáveis para evitar erro de hidratação
const CURSO_SELECT_ID = 'flashcard-curso'
const DISCIPLINA_SELECT_ID = 'flashcard-disciplina'
const FRENTE_SELECT_ID = 'flashcard-frente'

type Disciplina = {
  id: string
  nome: string
}

type Curso = {
  id: string
  nome: string
}

type Frente = {
  id: string
  nome: string
  disciplina_id: string
  curso_id?: string | null
}

// Type for frentes query result
type FrenteRow = Database['public']['Tables']['frentes']['Row']

// Type for modulos query result
type ModuloRow = Database['public']['Tables']['modulos']['Row']

type CSVRow = {
  [key: string]: string
}

interface FlashcardUploadCardProps {
  cursos: Curso[]
  onUploadSuccess?: () => void
}

export function FlashcardUploadCard({ cursos, onUploadSuccess }: FlashcardUploadCardProps) {
  const supabase = createClient()
  const [mounted, setMounted] = React.useState(false)
  const [cursoSelecionado, setCursoSelecionado] = React.useState<string>('')
  const [disciplinas, setDisciplinas] = React.useState<Disciplina[]>([])
  const [disciplinaSelecionada, setDisciplinaSelecionada] = React.useState<string>('')
  const [frentes, setFrentes] = React.useState<Frente[]>([])
  const [frenteSelecionada, setFrenteSelecionada] = React.useState<string>('')
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const downloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true)
      setError(null)
      setSuccessMessage(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      await downloadFile({
        url: '/api/flashcards/template',
        fallbackFilename: 'modelo-importacao-flashcards.xlsx',
        init: {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        },
      })
    } catch (err) {
      console.error('Erro ao baixar modelo:', err)
      setError(err instanceof Error ? err.message : 'Erro ao baixar modelo de importação')
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  // Carregar disciplinas ao selecionar curso
  React.useEffect(() => {
    const fetchDisciplinas = async () => {
      setDisciplinas([])
      setDisciplinaSelecionada('')
      setFrentes([])
      setFrenteSelecionada('')

      if (!cursoSelecionado) return

      try {
        const { data, error } = await supabase
          .from('cursos_disciplinas')
          .select('disciplina:disciplina_id ( id, nome )')
          .eq('curso_id', cursoSelecionado)
          .order('disciplina(nome)', { ascending: true })

        if (error) throw error

        const mapped =
          (data ?? [])
            .flatMap((row) => {
              const disciplina = (row as { disciplina?: unknown }).disciplina
              if (!disciplina) return []
              return Array.isArray(disciplina) ? disciplina : [disciplina]
            })
            .map((d) => ({
              id: String((d as { id?: unknown }).id ?? ''),
              nome: String((d as { nome?: unknown }).nome ?? ''),
            }))
            .filter((d) => d.id && d.nome)

        const unique = Array.from(new Map(mapped.map((d) => [d.id, d])).values())
        setDisciplinas(unique)
      } catch (err) {
        console.error('Erro ao carregar disciplinas:', err)
        setError('Erro ao carregar disciplinas')
      }
    }

    fetchDisciplinas()
  }, [supabase, cursoSelecionado])

  // Carregar frentes quando disciplina muda
  React.useEffect(() => {
    const fetchFrentes = async () => {
      if (!disciplinaSelecionada || !cursoSelecionado) {
        setFrentes([])
        setFrenteSelecionada('')
        return
      }

      try {
        // Buscar frentes da disciplina selecionada
        // Note: frentes table doesn't have curso_id - relationship is through disciplina
        const { data, error } = await supabase
          .from('frentes')
          .select('id, nome, disciplina_id')
          .eq('disciplina_id', disciplinaSelecionada)
          .order('nome', { ascending: true })

        if (error) throw error
        
        // Type assertion: Supabase correctly infers the row type from the table
        const frentesData = data as FrenteRow[] | null
        
        if (!frentesData || frentesData.length === 0) {
          setError('Nenhuma frente encontrada para esta disciplina no curso selecionado.')
        } else {
          setError(null)
        }
        
        const filteredFrentes = (frentesData || []).filter((f) => f.disciplina_id !== null).map((f) => ({
          id: f.id,
          nome: f.nome,
          disciplina_id: f.disciplina_id!,
          curso_id: null, // frentes don't have curso_id in schema
        }))
        setFrentes(filteredFrentes)
        setFrenteSelecionada('')
      } catch (err) {
        console.error('Erro ao carregar frentes:', err)
        setError('Erro ao carregar frentes')
      }
    }

    fetchFrentes()
  }, [supabase, disciplinaSelecionada, cursoSelecionado])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.xlsx')) {
        setError('Por favor, selecione um arquivo CSV ou XLSX')
        return
      }
      setArquivo(file)
      setError(null)
      setSuccessMessage(null)
    }
  }

  const parseXLSX = async (file: File): Promise<CSVRow[]> => {
    try {
      const buffer = await file.arrayBuffer()
      const ExcelJS = await loadExcelJS()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        throw new Error('O arquivo XLSX não contém planilhas')
      }

      const headers: string[] = []
      const rows: CSVRow[] = []

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell({ includeEmpty: false }, (cell) => {
            headers.push(String(cell.value ?? '').trim().toLowerCase())
          })
        } else {
          const rowObj: CSVRow = {} as CSVRow
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const header = headers[colNumber - 1]
            if (header) {
              const value = cell.value
              const stringValue = value != null ? String(value).trim() : ''
              ;(rowObj as Record<string, string>)[header] = stringValue
            }
          })
          if (Object.values(rowObj).some(val => val && String(val).trim())) {
            rows.push(rowObj)
          }
        }
      })

      if (rows.length === 0) {
        throw new Error('O arquivo XLSX está vazio')
      }

      return rows
    } catch (error) {
      throw new Error(`Erro ao processar XLSX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const parseCSV = (file: File): Promise<CSVRow[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<CSVRow>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header: string) => {
          return header.trim().toLowerCase()
        },
        transform: (value: string) => {
          return value.trim()
        },
        quoteChar: '"',
        escapeChar: '"',
        delimiter: ';', // Padrão Excel PT-BR
        preview: 0,
        worker: false,
        fastMode: false,
        complete: (results) => {
          if (results.data.length === 0) {
            reject(
              new Error(
                'Nenhum dado válido encontrado no CSV. ' +
                'Verifique se o arquivo contém as colunas necessárias: Módulo, Pergunta, Resposta.'
              )
            )
            return
          }

          if (results.errors.length > 0) {
            console.warn('Avisos ao processar CSV:', results.errors)
          }

          resolve(results.data)
        },
        error: (error) => {
          reject(new Error(`Erro ao ler arquivo: ${error.message}`))
        },
      })
    })
  }

  const getColumnValue = (row: CSVRow, possibleNames: string[]): string => {
    const rowObj = row as Record<string, string | undefined>
    const rowKeys = Object.keys(rowObj)
    
    const normalizedRowKeys = rowKeys.map(k => ({
      original: k,
      normalized: k.toLowerCase().trim().replace(/\s+/g, ' '),
    }))
    
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ')
      
      const exactMatch = normalizedRowKeys.find(
        nk => nk.normalized === normalizedName
      )
      if (exactMatch) {
        const value = rowObj[exactMatch.original]
        if (value != null && String(value).trim()) {
          return String(value).trim()
        }
      }
      
      const partialMatch = normalizedRowKeys.find(
        nk => nk.normalized.includes(normalizedName) || normalizedName.includes(nk.normalized)
      )
      if (partialMatch) {
        const value = rowObj[partialMatch.original]
        if (value != null && String(value).trim()) {
          return String(value).trim()
        }
      }
    }
    
    return ''
  }

  const validateCSV = (rows: CSVRow[]): string | null => {
    if (rows.length === 0) {
      return 'O arquivo está vazio'
    }

    const firstRow = rows[0]
    // Aceitar "Módulo" ou "Número do Módulo" ou "Modulo" (primeira coluna)
    const moduloNumero = getColumnValue(firstRow, [
      'modulo',
      'módulo',
      'Módulo',
      'numero do modulo',
      'número do módulo',
      'Numero do Modulo',
      'Número do Módulo',
      'modulo (numero)',
      'módulo (número)',
    ])
    const pergunta = getColumnValue(firstRow, [
      'pergunta',
      'Pergunta',
    ])
    const resposta = getColumnValue(firstRow, [
      'resposta',
      'Resposta',
    ])

    if (!moduloNumero) {
      return 'O arquivo deve conter uma coluna "Módulo" (número do módulo) na primeira coluna'
    }

    // Validar que é um número
    const numero = Number(moduloNumero)
    if (isNaN(numero) || numero <= 0) {
      return 'A coluna "Módulo" deve conter um número válido (ex: 1, 2, 3)'
    }

    if (!pergunta) {
      return 'O arquivo deve conter uma coluna "Pergunta"'
    }

    if (!resposta) {
      return 'O arquivo deve conter uma coluna "Resposta"'
    }

    return null
  }

  const handleImport = async () => {
    if (!cursoSelecionado) {
      setError('Por favor, selecione um curso')
      return
    }

    if (!disciplinaSelecionada) {
      setError('Por favor, selecione uma disciplina')
      return
    }

    if (!frenteSelecionada) {
      setError('Por favor, selecione uma frente')
      return
    }

    if (!arquivo) {
      setError('Por favor, selecione um arquivo CSV ou XLSX')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccessMessage(null)

      // Detectar tipo de arquivo e fazer parse apropriado
      const isXLSX = arquivo.name.toLowerCase().endsWith('.xlsx')
      
      let csvRows: CSVRow[]
      
      if (isXLSX) {
        csvRows = await parseXLSX(arquivo)
      } else {
        csvRows = await parseCSV(arquivo)
      }

      const validationError = validateCSV(csvRows)
      if (validationError) {
        setError(validationError)
        return
      }

      // Transformar em formato esperado pelo backend
      const rows = csvRows.map((row, index) => {
        // Buscar número do módulo (primeira coluna)
        const moduloNumeroStr = getColumnValue(row, [
          'modulo',
          'módulo',
          'Módulo',
          'numero do modulo',
          'número do módulo',
          'Numero do Modulo',
          'Número do Módulo',
          'modulo (numero)',
          'módulo (número)',
        ])
        const moduloNumero = moduloNumeroStr ? Number(moduloNumeroStr) : null
        const pergunta = getColumnValue(row, ['pergunta', 'Pergunta'])
        const resposta = getColumnValue(row, ['resposta', 'Resposta'])

        return {
          _index: index + 1,
          moduloNumero,
          pergunta,
          resposta,
        }
      }).filter(row => row.moduloNumero !== null && !isNaN(row.moduloNumero) && row.moduloNumero > 0 && row.pergunta && row.resposta)

      if (rows.length === 0) {
        setError('Nenhum dado válido encontrado no arquivo')
        return
      }

      // Buscar módulos da frente selecionada (curso_id obrigatório após migração de consistência)
      const { data: modulosData, error: modulosError } = await supabase
        .from('modulos')
        .select('id, nome, numero_modulo, frente_id, curso_id')
        .eq('frente_id', frenteSelecionada)
        .eq('curso_id', cursoSelecionado)
        .order('numero_modulo', { ascending: true })

      if (modulosError) {
        throw new Error(`Erro ao buscar módulos: ${modulosError.message}`)
      }

      // Type assertion: Supabase correctly infers the row type from the table
      const modulos = modulosData as ModuloRow[] | null

      if (!modulos || modulos.length === 0) {
        setError('Nenhum módulo encontrado para a frente selecionada. Verifique se a frente possui módulos cadastrados.')
        return
      }

      // Validar que todos os módulos pertencem à frente correta
      const modulosInvalidos = modulos.filter(
        m => m.frente_id !== frenteSelecionada
      )
      if (modulosInvalidos.length > 0) {
        console.warn('Módulos com vínculos incorretos detectados:', modulosInvalidos)
      }

      // Criar mapa de números de módulos para IDs
      const moduloMap = new Map<number, { id: string; nome: string; numero: number | null }>()
      modulos.forEach(modulo => {
        // Validar apenas que pertence à frente
        if (modulo.frente_id === frenteSelecionada && modulo.numero_modulo !== null) {
          moduloMap.set(modulo.numero_modulo, {
            id: modulo.id,
            nome: modulo.nome,
            numero: modulo.numero_modulo,
          })
        }
      })

      if (moduloMap.size === 0) {
        setError('Nenhum módulo válido encontrado. Verifique se a frente possui módulos com números cadastrados.')
        return
      }

      // Preparar dados para envio e validar módulos
      const flashcardsData: Array<{
        _index: number
        moduloId: string
        pergunta: string
        resposta: string
      }> = []
      const errors: Array<{ line: number; message: string }> = []

      rows.forEach((row) => {
        const moduloInfo = moduloMap.get(row.moduloNumero!)

        if (!moduloInfo) {
          // Listar módulos disponíveis para ajudar o usuário
          const modulosDisponiveis = Array.from(moduloMap.values())
            .map(m => `Módulo ${m.numero}${m.nome ? `: ${m.nome}` : ''}`)
            .join(', ')
          
          errors.push({
            line: row._index,
            message: `Módulo número ${row.moduloNumero} não encontrado na frente selecionada. Módulos disponíveis: ${modulosDisponiveis || 'nenhum'}`,
          })
          return
        }

        // Validar que o módulo tem os vínculos corretos
        flashcardsData.push({
          _index: row._index,
          moduloId: moduloInfo.id,
          pergunta: row.pergunta,
          resposta: row.resposta,
        })
      })

      if (flashcardsData.length === 0) {
        const errorMessages = errors.map(e => `Linha ${e.line}: ${e.message}`).join('\n')
        setError(`Nenhum flashcard válido encontrado.\nErros:\n${errorMessages}`)
        return
      }

      // Enviar para API
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch('/api/flashcards/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rows: flashcardsData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao importar flashcards')
      }

      const inserted = result.data?.inserted || 0
      const total = result.data?.total || 0
      const backendErrors = result.data?.errors || []

      // Combinar erros do frontend e backend
      const allErrors = [...errors, ...backendErrors]

      if (allErrors.length > 0) {
        const errorMessages = allErrors.map((e: { line: number; message: string }) => `Linha ${e.line}: ${e.message}`).join('\n')
        if (inserted > 0) {
          setError(`Importação parcial: ${inserted}/${total} flashcards importados.\nErros:\n${errorMessages}`)
        } else {
          setError(`Erro na importação:\n${errorMessages}`)
        }
      } else {
        setSuccessMessage(`✅ ${inserted} flashcards importados com sucesso!`)
        setArquivo(null)
        
        // Resetar input de arquivo
        const fileInput = document.getElementById('flashcard-file') as HTMLInputElement
        if (fileInput) {
          fileInput.value = ''
        }

        if (onUploadSuccess) {
          onUploadSuccess()
        }
      }
    } catch (err) {
      console.error('Erro ao importar:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar flashcards'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Renderizar placeholder durante SSR para evitar erro de hidratação
  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flashcards</CardTitle>
          <CardDescription>
            Upload de CSV separado para flashcards (padrão Excel PT-BR com ponto e vírgula). 
            Arquivo CSV: Colunas: Módulo; Pergunta; Resposta — delimitador ; e UTF-8.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={CURSO_SELECT_ID}>Curso</Label>
            <div className="h-9 w-full rounded-md border bg-transparent" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={DISCIPLINA_SELECT_ID}>Disciplina</Label>
            <div className="h-9 w-full rounded-md border bg-transparent" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={FRENTE_SELECT_ID}>Frente</Label>
            <div className="h-9 w-full rounded-md border bg-transparent" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flashcard-file">Arquivo CSV ou XLSX</Label>
            <div className="h-9 w-full rounded-md border bg-transparent" />
          </div>
          <Button disabled className="w-full">
            Importar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flashcards</CardTitle>
        <CardDescription>
          Upload de CSV separado para flashcards (padrão Excel PT-BR com ponto e vírgula). 
          Arquivo CSV: Colunas: Módulo; Pergunta; Resposta — delimitador ; e UTF-8.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          disabled={isDownloadingTemplate}
          className="w-full"
        >
          {isDownloadingTemplate ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Baixando modelo...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Baixar modelo de planilha
            </>
          )}
        </Button>

        <div className="space-y-2">
          <Label htmlFor={CURSO_SELECT_ID}>Curso</Label>
          <Select
            value={cursoSelecionado}
            onValueChange={(value) => {
              setCursoSelecionado(value)
              setDisciplinaSelecionada('')
              setFrenteSelecionada('')
            }}
          >
            <SelectTrigger id={CURSO_SELECT_ID}>
              <SelectValue placeholder="Selecione um curso" />
            </SelectTrigger>
            <SelectContent>
              {cursos.map((curso) => (
                <SelectItem key={curso.id} value={curso.id}>
                  {curso.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {cursoSelecionado && (
          <div className="space-y-2">
            <Label htmlFor={DISCIPLINA_SELECT_ID}>Disciplina</Label>
            <Select
              value={disciplinaSelecionada}
              onValueChange={(value) => {
                setDisciplinaSelecionada(value)
                setFrenteSelecionada('')
              }}
              disabled={disciplinas.length === 0}
            >
              <SelectTrigger id={DISCIPLINA_SELECT_ID}>
                <SelectValue placeholder={disciplinas.length === 0 ? 'Carregando...' : 'Selecione uma disciplina'} />
              </SelectTrigger>
              <SelectContent>
                {disciplinas.map((disciplina) => (
                  <SelectItem key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {disciplinaSelecionada && (
          <div className="space-y-2">
            <Label htmlFor={FRENTE_SELECT_ID}>Frente</Label>
            <Select
              value={frenteSelecionada}
              onValueChange={setFrenteSelecionada}
              disabled={frentes.length === 0}
            >
              <SelectTrigger id={FRENTE_SELECT_ID}>
                <SelectValue placeholder={frentes.length === 0 ? 'Carregando...' : 'Selecione uma frente'} />
              </SelectTrigger>
              <SelectContent>
                {frentes.map((frente) => (
                  <SelectItem key={frente.id} value={frente.id}>
                    {frente.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="flashcard-file">Arquivo CSV ou XLSX</Label>
          <div className="flex items-center gap-2">
            <Input
              id="flashcard-file"
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {arquivo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {arquivo.name}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: CSV (padrão ; e UTF-8) ou XLSX. O arquivo deve conter colunas: 
            <strong> Módulo</strong> (número do módulo), <strong>Pergunta</strong>, <strong>Resposta</strong>.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 text-status-success-text text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={
            isLoading ||
            !cursoSelecionado ||
            !disciplinaSelecionada ||
            !frenteSelecionada ||
            !arquivo
          }
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

