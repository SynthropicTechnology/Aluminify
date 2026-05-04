"use client"

import * as React from "react"
import { useCurrentUser } from "@/components/providers/user-provider"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/app/shared/components/forms/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/shared/components/forms/select"
import { Label } from "@/app/shared/components/forms/label"
import { Textarea } from "@/app/shared/components/forms/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/shared/components/dataviz/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/shared/components/overlay/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/shared/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  ClipboardList,
  X,
  Pencil,
  ListPlus,
} from "lucide-react"

type TipoLista = "exercicio" | "simulado" | "outro"
type ModosCorrecao = "por_questao" | "ao_final" | "ambos"

type ListaResumo = {
  id: string
  titulo: string
  descricao: string | null
  tipo: TipoLista
  modosCorrecaoPermitidos: ModosCorrecao
  embaralharQuestoes: boolean
  embaralharAlternativas: boolean
  totalQuestoes: number
  createdAt: string
}

export default function ListasAdminClient() {
  const _user = useCurrentUser()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string

  const [listas, setListas] = React.useState<ListaResumo[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [editingLista, setEditingLista] = React.useState<ListaResumo | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)

  const [titulo, setTitulo] = React.useState("")
  const [descricao, setDescricao] = React.useState("")
  const [tipo, setTipo] = React.useState<TipoLista>("exercicio")
  const [modosCorrecao, setModosCorrecao] = React.useState<ModosCorrecao>("por_questao")
  const [embaralharQuestoes, setEmbaralharQuestoes] = React.useState(false)
  const [embaralharAlternativas, setEmbaralharAlternativas] = React.useState(false)

  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)


  const fetchListas = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/listas", {
        headers: { "x-tenant-slug": tenantSlug },
      })
      if (!res.ok) throw new Error("Erro ao buscar listas")
      const json = await res.json()
      setListas(json.data ?? [])
    } catch {
      setListas([])
    } finally {
      setIsLoading(false)
    }
  }, [tenantSlug])

  React.useEffect(() => {
    fetchListas()
  }, [fetchListas])

  function resetForm() {
    setTitulo("")
    setDescricao("")
    setTipo("exercicio")
    setModosCorrecao("por_questao")
    setEmbaralharQuestoes(false)
    setEmbaralharAlternativas(false)
  }

  function openEditDialog(lista: ListaResumo) {
    setEditingLista(lista)
    setTitulo(lista.titulo)
    setDescricao(lista.descricao ?? "")
    setTipo(lista.tipo)
    setModosCorrecao(lista.modosCorrecaoPermitidos)
    setEmbaralharQuestoes(lista.embaralharQuestoes)
    setEmbaralharAlternativas(lista.embaralharAlternativas)
  }

  async function handleCreate() {
    if (!titulo.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch("/api/listas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug,
        },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          tipo,
          modosCorrecaoPermitidos: modosCorrecao,
          embaralharQuestoes,
          embaralharAlternativas,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Erro ao criar lista")
      }
      setCreateDialogOpen(false)
      resetForm()
      fetchListas()
    } catch (err) {
      console.error("[ListasAdmin] Create error:", err)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleEdit() {
    if (!editingLista || !titulo.trim()) return
    setIsEditing(true)
    try {
      const res = await fetch(`/api/listas/${editingLista.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug,
        },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          tipo,
          modosCorrecaoPermitidos: modosCorrecao,
          embaralharQuestoes,
          embaralharAlternativas,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Erro ao atualizar lista")
      }
      setEditingLista(null)
      resetForm()
      fetchListas()
    } catch (err) {
      console.error("[ListasAdmin] Edit error:", err)
    } finally {
      setIsEditing(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/listas/${deleteId}`, {
        method: "DELETE",
        headers: { "x-tenant-slug": tenantSlug },
      })
      if (!res.ok) throw new Error("Erro ao excluir lista")
      setDeleteId(null)
      fetchListas()
    } catch (err) {
      console.error("[ListasAdmin] Delete error:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredListas = React.useMemo(() => {
    if (!search.trim()) return listas
    const term = search.toLowerCase()
    return listas.filter((l) => l.titulo.toLowerCase().includes(term))
  }, [listas, search])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Listas de Exercícios
        </h1>
        <p className="text-sm text-muted-foreground">
          Crie e gerencie listas de exercícios para seus alunos
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Listas Cadastradas</CardTitle>
              <CardDescription>
                {filteredListas.length} lista(s) encontrada(s)
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                resetForm()
                setCreateDialogOpen(true)
              }}
              className="cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Lista
            </Button>
          </div>

          <div className="pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredListas.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <ClipboardList className="h-6 w-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Nenhuma lista encontrada</EmptyTitle>
                <EmptyDescription>
                  Crie sua primeira lista de exercícios para começar.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Título</TableHead>
                    <TableHead className="hidden sm:table-cell">Questões</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Correção</TableHead>
                    <TableHead className="hidden md:table-cell">Criada em</TableHead>
                    <TableHead className="w-32 pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListas.map((lista) => (
                    <TableRow key={lista.id}>
                      <TableCell className="pl-6">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{lista.titulo}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {lista.totalQuestoes} questões ·{" "}
                            {lista.tipo === "simulado" ? "Simulado" : lista.tipo === "outro" ? "Outro" : "Exercício"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary">
                          {lista.totalQuestoes}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary">
                          {lista.tipo === "simulado" ? "Simulado" : lista.tipo === "outro" ? "Outro" : "Exercício"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline">
                          {lista.modosCorrecaoPermitidos === "ambos"
                            ? "Ambos"
                            : lista.modosCorrecaoPermitidos === "por_questao"
                              ? "Por questão"
                              : "Ao final"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(lista.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => router.push(`/${tenantSlug}/biblioteca/listas/${lista.id}/adicionar-questoes`)}
                            title="Adicionar questões"
                          >
                            <ListPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => openEditDialog(lista)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => setDeleteId(lista.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Lista de Exercícios</DialogTitle>
            <DialogDescription>
              Configure os detalhes da lista. Você poderá adicionar questões depois.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-titulo">Título *</Label>
              <Input
                id="create-titulo"
                placeholder="Ex: Lista de Física - Cinemática"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-descricao">Descrição</Label>
              <Textarea
                id="create-descricao"
                placeholder="Descrição opcional da lista..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-tipo">Tipo de Lista</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLista)}>
                <SelectTrigger id="create-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exercicio">Lista de Exercícios</SelectItem>
                  <SelectItem value="simulado">Simulado</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-modos">Modo de Correção</Label>
              <Select value={modosCorrecao} onValueChange={(v) => setModosCorrecao(v as ModosCorrecao)}>
                <SelectTrigger id="create-modos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="por_questao">Feedback imediato (por questão)</SelectItem>
                  <SelectItem value="ao_final">Feedback ao final</SelectItem>
                  <SelectItem value="ambos">Aluno escolhe (ambos disponíveis)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {modosCorrecao === "ambos"
                  ? "O aluno poderá escolher o modo ao iniciar a lista."
                  : modosCorrecao === "por_questao"
                    ? "O aluno verá o gabarito após cada questão."
                    : "O aluno verá o gabarito somente ao finalizar."}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreating}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !titulo.trim()}
              className="cursor-pointer"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingLista} onOpenChange={(open) => { if (!open) { setEditingLista(null); resetForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Lista</DialogTitle>
            <DialogDescription>
              Atualize as configurações da lista de exercícios.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-titulo">Título *</Label>
              <Input
                id="edit-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Textarea
                id="edit-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-tipo">Tipo de Lista</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLista)}>
                <SelectTrigger id="edit-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exercicio">Lista de Exercícios</SelectItem>
                  <SelectItem value="simulado">Simulado</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-modos">Modo de Correção</Label>
              <Select value={modosCorrecao} onValueChange={(v) => setModosCorrecao(v as ModosCorrecao)}>
                <SelectTrigger id="edit-modos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="por_questao">Feedback imediato (por questão)</SelectItem>
                  <SelectItem value="ao_final">Feedback ao final</SelectItem>
                  <SelectItem value="ambos">Aluno escolhe (ambos disponíveis)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {modosCorrecao === "ambos"
                  ? "O aluno poderá escolher o modo ao iniciar a lista."
                  : modosCorrecao === "por_questao"
                    ? "O aluno verá o gabarito após cada questão."
                    : "O aluno verá o gabarito somente ao finalizar."}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => { setEditingLista(null); resetForm() }}
              disabled={isEditing}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isEditing || !titulo.trim()}
              className="cursor-pointer"
            >
              {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A lista e todas as respostas
              associadas serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
