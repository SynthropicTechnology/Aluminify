
"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/shared/components/dataviz/table"
import { Input } from "@/app/shared/components/forms/input"
import { Label } from "@/app/shared/components/forms/label"
import { Checkbox } from "@/app/shared/components/forms/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/shared/components/forms/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/shared/components/overlay/dialog"
import { Badge } from "@/components/ui/badge"
import {
  getRecorrencias,
  createRecorrencia,
  updateRecorrencia,
  deleteRecorrencia,
  getTurmasForSelector,
  getCursosForSelector,
} from "@/app/[tenant]/(modules)/agendamentos/lib/actions"
import type { RecorrenciaWithTurmas } from "@/app/[tenant]/(modules)/agendamentos/types"
import { Loader2, Plus, Pencil, Trash, Calendar, Clock, CalendarDays, List, Users } from "lucide-react"
import { toast } from "@/app/shared/components/feedback/use-toast"
import { TableSkeleton } from "@/app/shared/components/ui/table-skeleton"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/app/shared/library/utils"

const DAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
]

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

// Time slots for the calendar preview (8am to 8pm)
const CALENDAR_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

const SLOT_DURATIONS = [
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 45, label: "45 minutos" },
  { value: 60, label: "60 minutos" },
]

const TIPO_SERVICO_OPTIONS = [
  { value: "plantao", label: "Plantão de Dúvidas" },
]

interface RecorrenciaManagerProps {
  professorId: string
  empresaId: string
}

type RecorrenciaFormData = {
  tipo_servico: "plantao"
  data_inicio: string
  data_fim: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  duracao_slot_minutos: number
  ativo: boolean
}

const defaultFormData: RecorrenciaFormData = {
  tipo_servico: "plantao",
  data_inicio: format(new Date(), "yyyy-MM-dd"),
  data_fim: "",
  dia_semana: 1,
  hora_inicio: "09:00",
  hora_fim: "17:00",
  duracao_slot_minutos: 30,
  ativo: true,
}

type TurmaOption = { id: string; nome: string; cursoNome: string; cursoId: string }
type CursoOption = { id: string; nome: string; turmaIds: string[] }
type CursoAtivoOption = { id: string; nome: string }

export function RecorrenciaManager({ professorId, empresaId }: RecorrenciaManagerProps) {
  const [recorrencias, setRecorrencias] = useState<RecorrenciaWithTurmas[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<RecorrenciaFormData>(defaultFormData)
  const [selectedTurmaIds, setSelectedTurmaIds] = useState<string[]>([])
  const [selectedCursoIds, setSelectedCursoIds] = useState<string[]>([])
  const [turmasOptions, setTurmasOptions] = useState<TurmaOption[]>([])
  const [cursosAtivosOptions, setCursosAtivosOptions] = useState<CursoAtivoOption[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showCalendarPreview, setShowCalendarPreview] = useState(false)
  const cursosOptions = useMemo<CursoOption[]>(() => {
    const cursosMap = new Map<string, CursoOption>()

    for (const curso of cursosAtivosOptions) {
      cursosMap.set(curso.id, {
        id: curso.id,
        nome: curso.nome,
        turmaIds: [],
      })
    }

    for (const turma of turmasOptions) {
      const existing = cursosMap.get(turma.cursoId)
      if (existing) {
        existing.turmaIds.push(turma.id)
        continue
      }
      cursosMap.set(turma.cursoId, {
        id: turma.cursoId,
        nome: turma.cursoNome,
        turmaIds: [turma.id],
      })
    }

    return Array.from(cursosMap.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [turmasOptions, cursosAtivosOptions])

  const fetchRecorrencias = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getRecorrencias(professorId)
      setRecorrencias(data)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Erro ao carregar disponibilidade",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [professorId])

  const fetchTurmas = useCallback(async () => {
    try {
      const turmas = await getTurmasForSelector(empresaId)
      setTurmasOptions(turmas)
    } catch (error) {
      console.error(error)
    }
  }, [empresaId])

  const fetchCursosAtivos = useCallback(async () => {
    try {
      const cursos = await getCursosForSelector(empresaId)
      setCursosAtivosOptions(cursos)
    } catch (error) {
      console.error(error)
    }
  }, [empresaId])

  useEffect(() => {
    fetchRecorrencias()
    fetchTurmas()
    fetchCursosAtivos()
  }, [fetchRecorrencias, fetchTurmas, fetchCursosAtivos])

  const handleOpenDialog = (recorrencia?: RecorrenciaWithTurmas) => {
    if (recorrencia) {
      setEditingId(recorrencia.id || null)
      setFormData({
        tipo_servico: recorrencia.tipo_servico,
        data_inicio: recorrencia.data_inicio,
        data_fim: recorrencia.data_fim || "",
        dia_semana: recorrencia.dia_semana,
        hora_inicio: recorrencia.hora_inicio,
        hora_fim: recorrencia.hora_fim,
        duracao_slot_minutos: recorrencia.duracao_slot_minutos,
        ativo: recorrencia.ativo,
      })
      setSelectedTurmaIds(recorrencia.turmas.map((t) => t.turma_id))
      setSelectedCursoIds(recorrencia.cursos.map((c) => c.curso_id))
    } else {
      setEditingId(null)
      setFormData(defaultFormData)
      setSelectedTurmaIds([])
      setSelectedCursoIds([])
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.data_inicio || !formData.hora_inicio || !formData.hora_fim) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      })
      return
    }

    if (formData.hora_fim <= formData.hora_inicio) {
      toast({
        title: "Erro",
        description: "O horário de fim deve ser maior que o de início",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateRecorrencia(editingId, {
          tipo_servico: formData.tipo_servico,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim || null,
          dia_semana: formData.dia_semana,
          hora_inicio: formData.hora_inicio,
          hora_fim: formData.hora_fim,
          duracao_slot_minutos: formData.duracao_slot_minutos,
          ativo: formData.ativo,
        }, selectedTurmaIds, selectedCursoIds)
        toast({
          title: "Sucesso",
          description: "Disponibilidade atualizada!",
        })
      } else {
        await createRecorrencia({
          professor_id: professorId,
          empresa_id: empresaId,
          tipo_servico: formData.tipo_servico,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim || null,
          dia_semana: formData.dia_semana,
          hora_inicio: formData.hora_inicio,
          hora_fim: formData.hora_fim,
          duracao_slot_minutos: formData.duracao_slot_minutos,
          ativo: formData.ativo,
        }, selectedTurmaIds, selectedCursoIds)
        toast({
          title: "Sucesso",
          description: "Disponibilidade criada!",
        })
      }
      setDialogOpen(false)
      fetchRecorrencias()
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Erro ao salvar disponibilidade",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRecorrencia(id)
      toast({
        title: "Sucesso",
        description: "Disponibilidade removida!",
      })
      setDeleteConfirmId(null)
      fetchRecorrencias()
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Erro ao remover disponibilidade",
        variant: "destructive",
      })
    }
  }

  const handleToggleAtivo = async (recorrencia: RecorrenciaWithTurmas) => {
    try {
      await updateRecorrencia(recorrencia.id!, { ativo: !recorrencia.ativo })
      toast({
        title: "Sucesso",
        description: recorrencia.ativo ? "Disponibilidade desativada" : "Disponibilidade ativada",
      })
      fetchRecorrencias()
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      })
    }
  }

  const handleCursoSelection = (cursoId: string, checked: boolean) => {
    const curso = cursosOptions.find((item) => item.id === cursoId)
    if (!curso) return

    setSelectedCursoIds((prev) =>
      checked
        ? Array.from(new Set([...prev, cursoId]))
        : prev.filter((id) => id !== cursoId),
    )

    setSelectedTurmaIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...curso.turmaIds]))
      }
      return prev.filter((turmaId) => !curso.turmaIds.includes(turmaId))
    })
  }

  const formatDateRange = (inicio: string, fim: string | null) => {
    const dataInicio = new Date(inicio + "T12:00:00")
    if (!fim) {
      return `A partir de ${format(dataInicio, "dd/MM/yyyy", { locale: ptBR })} `
    }
    const dataFim = new Date(fim + "T12:00:00")
    return `${format(dataInicio, "dd/MM/yyyy")} - ${format(dataFim, "dd/MM/yyyy")} `
  }

  const calculateSlots = (inicio: string, fim: string, duracao: number) => {
    const [hI, mI] = inicio.split(":").map(Number)
    const [hF, mF] = fim.split(":").map(Number)
    const totalMinutos = (hF * 60 + mF) - (hI * 60 + mI)
    return Math.floor(totalMinutos / duracao)
  }

  // Check if an hour is covered by active recorrencias for a specific day
  const getRecorrenciasForSlot = (dayIndex: number, hour: number) => {
    return recorrencias.filter((rec) => {
      if (!rec.ativo || rec.dia_semana !== dayIndex) return false
      const [hInicio] = rec.hora_inicio.split(":").map(Number)
      const [hFim] = rec.hora_fim.split(":").map(Number)
      return hour >= hInicio && hour < hFim
    })
  }

  // Get the color for a time slot based on recorrencias
  const getSlotStyle = (dayIndex: number, hour: number) => {
    const recs = getRecorrenciasForSlot(dayIndex, hour)
    if (recs.length === 0) return { bg: "bg-muted/30", text: "" }
    // Todos são plantão agora
    return { bg: "bg-secondary/40", text: "" }
  }

  if (loading) {
    return <TableSkeleton rows={3} columns={6} />
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          fullScreenMobile
          className="sm:max-w-125 md:flex! md:flex-col! md:overflow-hidden!"
        >
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Disponibilidade" : "Nova Disponibilidade"}
            </DialogTitle>
            <DialogDescription>
              Configure o horário de atendimento para um dia da semana
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 flex-1 min-h-0 overflow-y-scroll pr-1 md:max-h-[calc(85vh-11rem)]">
            {/* Tipo de Serviço */}
            <div className="grid gap-2">
              <Label htmlFor="tipo_servico">Tipo de Serviço</Label>
              <Select
                value={formData.tipo_servico}
                onValueChange={(value: "plantao") =>
                  setFormData({ ...formData, tipo_servico: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_SERVICO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dia da Semana */}
            <div className="grid gap-2">
              <Label htmlFor="dia_semana">Dia da Semana</Label>
              <Select
                value={String(formData.dia_semana)}
                onValueChange={(value) =>
                  setFormData({ ...formData, dia_semana: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hora_inicio">Horário Início</Label>
                <Input
                  id="hora_inicio"
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) =>
                    setFormData({ ...formData, hora_inicio: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hora_fim">Horário Fim</Label>
                <Input
                  id="hora_fim"
                  type="time"
                  value={formData.hora_fim}
                  onChange={(e) =>
                    setFormData({ ...formData, hora_fim: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Duração do Slot */}
            <div className="grid gap-2">
              <Label htmlFor="duracao">Duração de cada atendimento</Label>
              <Select
                value={String(formData.duracao_slot_minutos)}
                onValueChange={(value) =>
                  setFormData({ ...formData, duracao_slot_minutos: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_DURATIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.hora_inicio && formData.hora_fim && (
                <p className="text-xs text-muted-foreground">
                  {calculateSlots(formData.hora_inicio, formData.hora_fim, formData.duracao_slot_minutos)} slots disponíveis
                </p>
              )}
            </div>

            {/* Período de Vigência */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="data_inicio">Data Início *</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) =>
                    setFormData({ ...formData, data_inicio: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="data_fim">Data Fim (opcional)</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) =>
                    setFormData({ ...formData, data_fim: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe a data fim vazia para disponibilidade indefinida
            </p>

            {/* Ativo */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, ativo: checked === true })
                }
              />
              <Label htmlFor="ativo">Disponibilidade ativa</Label>
            </div>

            {/* Turma Restriction */}
            <div className="grid gap-2">
              <Label>Restringir por curso (opcional)</Label>
              {cursosOptions.length > 0 ? (
                <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                  {cursosOptions.map((curso) => {
                    return (
                      <div key={curso.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`curso-${curso.id}`}
                          checked={selectedCursoIds.includes(curso.id)}
                          onCheckedChange={(checked) =>
                            handleCursoSelection(curso.id, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`curso-${curso.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {curso.nome}
                          {curso.turmaIds.length === 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              (sem turmas ativas)
                            </span>
                          )}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground border rounded-md p-3">
                  Nenhum curso encontrado para esta empresa.
                </p>
              )}

              <Label>Refinar por turma (opcional)</Label>
              {turmasOptions.length > 0 ? (
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {turmasOptions.map((turma) => (
                    <div key={turma.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`turma-${turma.id}`}
                        checked={selectedTurmaIds.includes(turma.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTurmaIds([...selectedTurmaIds, turma.id])
                          } else {
                            setSelectedTurmaIds(selectedTurmaIds.filter((id) => id !== turma.id))
                          }
                        }}
                      />
                      <Label htmlFor={`turma-${turma.id}`} className="text-sm font-normal cursor-pointer">
                        {turma.nome} <span className="text-muted-foreground">({turma.cursoNome})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground border rounded-md p-3">
                  Cadastre e ative turmas para habilitar a limitação de disponibilidade por curso/turma.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedTurmaIds.length === 0
                  ? "Todos os alunos podem ver esta disponibilidade"
                    : `Apenas alunos das ${selectedTurmaIds.length} turma(s) e ${selectedCursoIds.length} curso(s) selecionado(s) podem ver`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {recorrencias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/50">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma disponibilidade configurada
            </h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Configure seus horários de atendimento para que alunos possam agendar plantões.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Configurar Horários
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCalendarPreview(!showCalendarPreview)}
              >
                {showCalendarPreview ? (
                  <>
                    <List className="mr-2 h-4 w-4" />
                    Lista
                  </>
                ) : (
                  <>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Horário
              </Button>
            </div>

            {showCalendarPreview ? (
              // Calendar Preview
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/40" />
                    <span>Plantão</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-secondary/40" />
                    <span>Plantão</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-muted/30" />
                    <span>Indisponível</span>
                  </div>
                </div>

                {/* Weekly Calendar Grid */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-8 text-sm">
                    {/* Header Row */}
                    <div className="p-2 font-medium bg-muted/50 border-b border-r text-center">
                      Hora
                    </div>
                    {DAYS_SHORT.map((day, i) => (
                      <div
                        key={day}
                        className={cn(
                          "p-2 font-medium bg-muted/50 border-b text-center",
                          i < 6 && "border-r"
                        )}
                      >
                        {day}
                      </div>
                    ))}

                    {/* Time Slots */}
                    {CALENDAR_HOURS.map((hour, hourIdx) => (
                      <>
                        <div
                          key={`hour - ${hour} `}
                          className={cn(
                            "p-2 text-sm text-muted-foreground border-r text-center",
                            hourIdx < CALENDAR_HOURS.length - 1 && "border-b"
                          )}
                        >
                          {hour.toString().padStart(2, "0")}:00
                        </div>
                        {DAYS_SHORT.map((_, dayIdx) => {
                          const slotStyle = getSlotStyle(dayIdx, hour)
                          return (
                            <div
                              key={`slot - ${hour} -${dayIdx} `}
                              className={cn(
                                "p-2 text-xs text-center transition-colors",
                                slotStyle.bg,
                                hourIdx < CALENDAR_HOURS.length - 1 && "border-b",
                                dayIdx < 6 && "border-r"
                              )}
                            >
                              {slotStyle.text}
                            </div>
                          )
                        })}
                      </>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="text-sm text-muted-foreground">
                  {recorrencias.filter(r => r.ativo).length} horário(s) ativo(s) configurado(s)
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Turmas</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-25">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recorrencias.map((rec) => (
                    <TableRow key={rec.id} className={!rec.ativo ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        {DAYS[rec.dia_semana]}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {rec.hora_inicio} - {rec.hora_fim}
                        </div>
                      </TableCell>
                      <TableCell>{rec.duracao_slot_minutos} min</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          Plantão
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rec.turmas.length > 0 ? (
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" />
                            {rec.turmas.length} {rec.turmas.length === 1 ? "turma" : "turmas"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Todas</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateRange(rec.data_inicio, rec.data_fim ?? null)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rec.ativo ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => handleToggleAtivo(rec)}
                        >
                          {rec.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(rec)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Dialog
                            open={deleteConfirmId === rec.id}
                            onOpenChange={(open) => !open && setDeleteConfirmId(null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmId(rec.id!)}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Confirmar exclusão</DialogTitle>
                                <DialogDescription>
                                  Tem certeza que deseja excluir esta disponibilidade?
                                  Esta ação não pode ser desfeita.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(rec.id!)}
                                >
                                  Excluir
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>
    </>
  )
}
