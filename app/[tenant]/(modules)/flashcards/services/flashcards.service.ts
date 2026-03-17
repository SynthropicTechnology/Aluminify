import { getDatabaseClient } from "@/app/shared/core/database/database";
// DificuldadePercebida imported but unused - kept for future use
import { cacheService } from "@/app/shared/core/services/cache";
import { calculateNextReview, isValidFeedback } from "./srs-algorithm";
import type { FeedbackValue } from "./srs-algorithm.types";
import type {
  ProgressoFlashcard,
  CursoRow,
  ModuloRow,
  FlashcardRow as _FlashcardRow,
  ModuloComFrenteRow,
  ModuloWithNestedRelations,
} from "./flashcards.query-types";

/**
 * Formata erros do Supabase para facilitar debug
 */
function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const supabaseError = error as Record<string, unknown>;
    const message = supabaseError.message;
    const details = supabaseError.details;
    const hint = supabaseError.hint;
    const code = supabaseError.code;

    const parts: string[] = [];
    if (code) parts.push(`[${code}]`);
    if (message) parts.push(String(message));
    if (details) parts.push(`Detalhes: ${String(details)}`);
    if (hint) parts.push(`Hint: ${String(hint)}`);

    return parts.length > 0 ? parts.join(" - ") : JSON.stringify(error);
  }

  return String(error);
}

function isMissingFlashcardsImageColumnsError(error: unknown): boolean {
  const formatted = formatSupabaseError(error);
  // Postgres undefined_column
  if (formatted.includes("[42703]")) return true;
  return (
    formatted.includes("pergunta_imagem_path") ||
    formatted.includes("resposta_imagem_path")
  );
}

export type FlashcardImportRow = {
  // Formato antigo (compatibilidade)
  disciplina?: string;
  frente?: string;
  moduloNumero?: number;
  // Formato novo (direto com moduloId)
  moduloId?: string;
  moduloNome?: string;
  // Campos obrigatórios
  pergunta: string;
  resposta: string;
};

export type FlashcardImportResult = {
  total: number;
  inserted: number;
  errors: { line: number; message: string }[];
};

export type FlashcardReviewItem = {
  id: string;
  moduloId: string | null;
  pergunta: string;
  resposta: string;
  perguntaImagemUrl?: string | null;
  respostaImagemUrl?: string | null;
  importancia?: string | null;
  dataProximaRevisao?: string | null;
};

export type FlashcardsReviewScope = "all" | "completed";

export type FlashcardAdmin = {
  id: string;
  modulo_id: string;
  pergunta: string;
  resposta: string;
  pergunta_imagem_path?: string | null;
  resposta_imagem_path?: string | null;
  pergunta_imagem_url?: string | null;
  resposta_imagem_url?: string | null;
  created_at: string;
  modulo: {
    id: string;
    nome: string;
    numero_modulo: number | null;
    frente: {
      id: string;
      nome: string;
      disciplina: {
        id: string;
        nome: string;
      };
    };
  };
};

export type CreateFlashcardInput = {
  moduloId: string;
  pergunta: string;
  resposta: string;
};

export type UpdateFlashcardInput = {
  moduloId?: string;
  pergunta?: string;
  resposta?: string;
};

export type ListFlashcardsFilters = {
  disciplinaId?: string;
  frenteId?: string;
  moduloId?: string;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: "created_at" | "pergunta";
  orderDirection?: "asc" | "desc";
};

export class FlashcardsService {
  private client = getDatabaseClient();
  private readonly FLASHCARDS_IMAGES_BUCKET = "flashcards-images";
  private readonly FLASHCARDS_SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 min
  private readonly COMPLETED_AULAS_THRESHOLD = Number(
    process.env.FLASHCARDS_COMPLETED_AULAS_THRESHOLD ?? "0.7",
  );
  private readonly ENABLE_AULAS_COMPLETED =
    process.env.FLASHCARDS_ENABLE_AULAS_COMPLETED !== "false";
  /**
   * Pool máximo de flashcards buscados do banco para montar uma sessão de revisão.
   *
   * Por padrão a sessão retorna 10 cards, mas precisamos buscar um conjunto maior
   * para que os filtros de SRS ("due"), exclusão (`excludeIds`) e distribuição da UTI
   * tenham material suficiente — especialmente quando há muitos cards por módulo.
   *
   * Observação: hoje o total do projeto é baixo (~centenas/1k), então um pool maior
   * é seguro e evita o "efeito amostra" do antigo limit(50).
   */
  private readonly REVIEW_CANDIDATE_POOL = 2000;

  private normalizeName(value?: string | null): string {
    return (value ?? "").trim().toLowerCase();
  }

  private async getAdminContext(userId: string, empresaId?: string) {
    const { data, error } = await this.client
      .from("usuarios_empresas")
      .select("empresa_id, papel_base, is_admin")
      .eq("usuario_id", userId)
      .eq("ativo", true)
      .is("deleted_at", null);

    if (error) {
      throw new Error("Apenas professores ou admins podem realizar esta ação.");
    }

    if (!data || data.length === 0) {
      // Fallback legado: tabela usuarios
      let legacyQuery = this.client
        .from("usuarios")
        .select("id, empresa_id")
        .eq("id", userId);
      if (empresaId) {
        legacyQuery = legacyQuery.eq("empresa_id", empresaId);
      }
      const { data: legacyUser, error: legacyError } = await legacyQuery.maybeSingle();
      if (legacyError || !legacyUser) {
        throw new Error("Apenas professores ou admins podem realizar esta ação.");
      }
      const legacyEmpresaId = (legacyUser as { empresa_id?: string | null }).empresa_id;
      if (!legacyEmpresaId) {
        throw new Error("Usuário sem empresa associada.");
      }
      return { empresaId: legacyEmpresaId };
    }

    const vinculos = data as Array<{
      empresa_id: string | null;
      papel_base: string | null;
      is_admin: boolean | null;
    }>;

    const allowed = vinculos.filter((row) => {
      const papel = row.papel_base ?? "";
      return papel === "professor" || papel === "usuario" || row.is_admin === true;
    });

    if (allowed.length === 0) {
      throw new Error("Apenas professores ou admins podem realizar esta ação.");
    }

    const byTenant = empresaId
      ? allowed.find((row) => row.empresa_id === empresaId)
      : undefined;
    const selected = byTenant ?? allowed[0];
    if (!selected?.empresa_id) {
      throw new Error("Usuário sem empresa associada.");
    }

    return { empresaId: selected.empresa_id };
  }

  /**
   * Invalidar cache de flashcards baseado na hierarquia
   */
  private async invalidateFlashcardCache(
    empresaId: string,
    disciplinaId?: string,
    frenteId?: string,
    moduloId?: string,
  ): Promise<void> {
    const keys: string[] = [];
    const basePrefix = `cache:flashcards:empresa:${empresaId}`;

    // Invalidar todos os caches relacionados
    if (moduloId) {
      // Buscar todas as chaves possíveis para este módulo (diferentes páginas/ordens)
      // Como não podemos fazer pattern matching, vamos invalidar as mais comuns
      keys.push(
        `${basePrefix}:modulo:${moduloId}:page:1:limit:50:order:created_at:desc`,
      );
    }
    if (frenteId) {
      keys.push(
        `${basePrefix}:frente:${frenteId}:page:1:limit:50:order:created_at:desc`,
      );
    }
    if (disciplinaId) {
      keys.push(
        `${basePrefix}:disciplina:${disciplinaId}:page:1:limit:50:order:created_at:desc`,
      );
    }

    // Invalidar cache geral também
    keys.push(`${basePrefix}:page:1:limit:50:order:created_at:desc`);

    await cacheService.delMany(keys);
  }

  private async createSignedImageUrl(
    path?: string | null,
  ): Promise<string | null> {
    const objectPath = path?.trim();
    if (!objectPath) return null;
    try {
      const { data, error } = await this.client.storage
        .from(this.FLASHCARDS_IMAGES_BUCKET)
        .createSignedUrl(objectPath, this.FLASHCARDS_SIGNED_URL_TTL_SECONDS);
      if (error) return null;
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  }

  async importFlashcards(
    rows: FlashcardImportRow[],
    userId: string,
    empresaId?: string,
  ): Promise<FlashcardImportResult> {
    const adminContext = await this.getAdminContext(userId, empresaId);
    const effectiveEmpresaId = adminContext.empresaId;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error("Nenhuma linha recebida para importação.");
    }

    const normalizedRows = rows
      .map((row, idx) => ({
        ...row,
        _index: idx + 1,
        disciplina: row.disciplina?.trim(),
        frente: row.frente?.trim(),
        moduloNumero: row.moduloNumero ? Number(row.moduloNumero) : undefined,
        moduloId: row.moduloId?.trim(),
        moduloNome: row.moduloNome?.trim(),
        pergunta: row.pergunta?.trim(),
        resposta: row.resposta?.trim(),
      }))
      .filter((r) => r.pergunta && r.resposta);

    let inserted = 0;
    const errors: { line: number; message: string }[] = [];

    // Se o formato novo (com moduloId) está sendo usado, processar diretamente
    const isNewFormat = normalizedRows.some((r) => r.moduloId);

    if (isNewFormat) {
      // Formato novo: moduloId já vem do frontend
      for (const row of normalizedRows) {
        if (!row.moduloId) {
          errors.push({
            line: row._index,
            message: `Módulo não especificado`,
          });
          continue;
        }

        // Validar se o módulo existe antes de inserir
        const { data: moduloExists, error: moduloCheckError } =
          await this.client
            .from("modulos")
            .select("id, empresa_id")
            .eq("id", row.moduloId)
            .eq("empresa_id", effectiveEmpresaId)
            .maybeSingle();

        if (moduloCheckError) {
          errors.push({
            line: row._index,
            message: `Erro ao validar módulo: ${moduloCheckError.message}`,
          });
          continue;
        }

        if (!moduloExists) {
          errors.push({
            line: row._index,
            message: `Módulo não encontrado: ${row.moduloId}`,
          });
          continue;
        }

        const moduloEmpresaId =
          (moduloExists as { empresa_id?: string | null }).empresa_id ?? null;
        if (!moduloEmpresaId) {
          errors.push({
            line: row._index,
            message: `Módulo sem empresa_id (dados inconsistentes): ${row.moduloId}`,
          });
          continue;
        }

        const { error: insertError } = await this.client
          .from("flashcards")
          .insert({
            modulo_id: row.moduloId,
            empresa_id: moduloEmpresaId,
            pergunta: row.pergunta,
            resposta: row.resposta,
          });

        if (insertError) {
          errors.push({
            line: row._index,
            message: `Erro ao inserir flashcard: ${insertError.message}`,
          });
          continue;
        }

        inserted += 1;
      }

      return { inserted, errors, total: normalizedRows.length };
    }

    // Formato antigo: buscar disciplina, frente e módulo
    const { data: disciplinas, error: discError } = await this.client
      .from("disciplinas")
      .select("id, nome");
    if (discError) {
      throw new Error(`Erro ao buscar disciplinas: ${discError.message}`);
    }
    const disciplinaMap = new Map<string, { id: string; nome: string }>();
    (disciplinas ?? []).forEach((d) => {
      disciplinaMap.set(this.normalizeName(d.nome), { id: d.id, nome: d.nome });
    });

    for (const row of normalizedRows) {
      const disciplinaKey = this.normalizeName(row.disciplina);
      const disciplina = disciplinaKey
        ? disciplinaMap.get(disciplinaKey)
        : null;
      if (!disciplina) {
        errors.push({
          line: row._index,
          message: `Disciplina não encontrada: ${row.disciplina || "(vazia)"}`,
        });
        continue;
      }

      if (!row.frente) {
        errors.push({
          line: row._index,
          message: `Frente não especificada`,
        });
        continue;
      }

      const { data: frentes, error: frenteError } = await this.client
        .from("frentes")
        .select("id, nome")
        .eq("disciplina_id", disciplina.id)
        .ilike("nome", row.frente);

      if (frenteError) {
        errors.push({
          line: row._index,
          message: `Erro ao buscar frente ${row.frente}: ${frenteError.message}`,
        });
        continue;
      }

      const frente = frentes?.find(
        (f) => this.normalizeName(f.nome) === this.normalizeName(row.frente),
      );
      if (!frente) {
        errors.push({
          line: row._index,
          message: `Frente não encontrada: ${row.frente}`,
        });
        continue;
      }

      const { data: modulo, error: moduloError } = await this.client
        .from("modulos")
        .select("id, empresa_id")
        .eq("frente_id", frente.id)
        .eq("numero_modulo", row.moduloNumero ?? 0)
        .eq("empresa_id", effectiveEmpresaId)
        .maybeSingle();

      if (moduloError) {
        errors.push({
          line: row._index,
          message: `Erro ao buscar módulo ${row.moduloNumero}: ${moduloError.message}`,
        });
        continue;
      }

      if (!modulo) {
        errors.push({
          line: row._index,
          message: `Módulo ${row.moduloNumero} não encontrado para frente ${row.frente}`,
        });
        continue;
      }

      const moduloEmpresaId =
        (modulo as { empresa_id?: string | null }).empresa_id ?? null;
      if (!moduloEmpresaId) {
        errors.push({
          line: row._index,
          message: `Módulo sem empresa_id (dados inconsistentes): ${modulo.id}`,
        });
        continue;
      }

      const { error: insertError } = await this.client
        .from("flashcards")
        .insert({
          modulo_id: modulo.id,
          empresa_id: moduloEmpresaId,
          pergunta: row.pergunta,
          resposta: row.resposta,
        });

      if (insertError) {
        errors.push({
          line: row._index,
          message: `Erro ao inserir flashcard: ${insertError.message}`,
        });
        continue;
      }

      inserted += 1;
    }

    return { inserted, errors, total: normalizedRows.length };
  }

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private async fetchProgressMap(alunoId: string, flashcardIds: string[], empresaId?: string) {
    if (!flashcardIds.length) return new Map<string, ProgressoFlashcard>();
    let progressQuery = this.client
      .from("progresso_flashcards")
      .select("*")
      .eq("usuario_id", alunoId)
      .in("flashcard_id", flashcardIds);
    if (empresaId) {
      progressQuery = progressQuery.eq("empresa_id", empresaId);
    }
    const { data, error } = await progressQuery;
    if (error) {
      console.warn("[flashcards] erro ao buscar progresso", error);
      return new Map<string, ProgressoFlashcard>();
    }
    return new Map(
      (data ?? []).map((p) => [
        p.flashcard_id as string,
        { ...p, aluno_id: p.usuario_id ?? "" } as ProgressoFlashcard,
      ]),
    );
  }

  private async fetchCompletedModuloIdsFromActivities(
    alunoId: string,
    empresaId?: string,
  ): Promise<Set<string>> {
    let query = this.client
      .from("progresso_atividades")
      .select("atividade_id, atividades(modulo_id)")
      .eq("usuario_id", alunoId)
      .eq("status", "Concluido");
    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }
    const { data, error } = await query;

    if (error) {
      console.warn(
        "[flashcards] erro ao buscar módulos concluídos por atividades",
        error,
      );
      return new Set<string>();
    }

    const moduloIds = new Set<string>();
    for (const row of data ?? []) {
      const typedRow = row as unknown as {
        atividade_id: string;
        atividades: { modulo_id: string } | null;
      };
      const moduloId = typedRow.atividades?.modulo_id;
      if (moduloId) moduloIds.add(moduloId);
    }
    return moduloIds;
  }

  private async fetchCompletedModuloIdsFromClasses(
    alunoId: string,
    empresaId?: string,
  ): Promise<Set<string>> {
    if (!this.ENABLE_AULAS_COMPLETED) return new Set<string>();
    let aulasDoneQuery = this.client
      .from("aulas_concluidas")
      .select("aula_id, aulas(modulo_id)")
      .eq("usuario_id", alunoId);
    if (empresaId) {
      aulasDoneQuery = aulasDoneQuery.eq("empresa_id", empresaId);
    }

    const { data: aulasConcluidas, error: aulasConcluidasError } =
      await aulasDoneQuery;
    if (aulasConcluidasError) {
      console.warn(
        "[flashcards] erro ao buscar módulos concluídos por aulas",
        aulasConcluidasError,
      );
      return new Set<string>();
    }

    const concluidasPorModulo = new Map<string, number>();
    for (const row of aulasConcluidas ?? []) {
      const moduloId = (
        row as unknown as {
          aulas?: { modulo_id?: string | null } | null;
        }
      ).aulas?.modulo_id;
      if (!moduloId) continue;
      concluidasPorModulo.set(moduloId, (concluidasPorModulo.get(moduloId) ?? 0) + 1);
    }

    const moduloIds = Array.from(concluidasPorModulo.keys());
    if (moduloIds.length === 0) return new Set<string>();

    const { data: aulasByModulo, error: aulasByModuloError } = await this.client
      .from("aulas")
      .select("id, modulo_id")
      .in("modulo_id", moduloIds);
    if (aulasByModuloError) {
      console.warn(
        "[flashcards] erro ao buscar totais de aulas por módulo",
        aulasByModuloError,
      );
      return new Set<string>();
    }

    const totaisPorModulo = new Map<string, number>();
    for (const row of aulasByModulo ?? []) {
      const moduloId = (row as { modulo_id?: string | null }).modulo_id;
      if (!moduloId) continue;
      totaisPorModulo.set(moduloId, (totaisPorModulo.get(moduloId) ?? 0) + 1);
    }

    const completed = new Set<string>();
    for (const moduloId of moduloIds) {
      const concluidas = concluidasPorModulo.get(moduloId) ?? 0;
      const total = totaisPorModulo.get(moduloId) ?? 0;
      if (total <= 0) continue;
      const ratio = concluidas / total;
      if (ratio >= this.COMPLETED_AULAS_THRESHOLD) {
        completed.add(moduloId);
      }
    }
    return completed;
  }

  /**
   * Resolve módulos concluídos combinando aulas_concluidas (principal) e progresso_atividades (fallback legado).
   */
  private async fetchCompletedModuloIds(
    alunoId: string,
    empresaId?: string,
  ): Promise<Set<string>> {
    const [byClasses, byActivities] = await Promise.all([
      this.fetchCompletedModuloIdsFromClasses(alunoId, empresaId),
      this.fetchCompletedModuloIdsFromActivities(alunoId, empresaId),
    ]);
    return new Set([...Array.from(byClasses), ...Array.from(byActivities)]);
  }

  async getCursos(userId: string, empresaId?: string): Promise<CursoRow[]> {
    // Buscar apenas cursos em que o aluno está matriculado
    const { data, error } = await this.client
      .from("alunos_cursos")
      .select("curso:cursos(id, nome, empresa_id)")
      .eq("usuario_id", userId);

    if (error) throw new Error(error.message);

    // Extrair os cursos do resultado do join
    let cursos = (data || [])
      .map((row: { curso: CursoRow | null }) => row.curso)
      .filter((curso): curso is CursoRow => curso !== null);

    // Filtrar pela empresa ativa (multi-tenant isolation)
    if (empresaId) {
      cursos = cursos.filter((curso) => curso.empresa_id === empresaId);
    }

    return cursos;
  }

  async getDisciplinas(cursoId: string): Promise<{id: string; nome: string}[]> {
    const { data, error } = await this.client
      .from("cursos_disciplinas")
      .select("disciplina:disciplinas(id, nome)")
      .eq("curso_id", cursoId);
      
    if (error) throw new Error(error.message);
    return data?.map((d: { disciplina: { id: string; nome: string } }) => d.disciplina) || [];
  }

  async getFrentes(cursoId: string, disciplinaId: string): Promise<{id: string; nome: string; disciplina_id: string}[]> {
    // Frentes vinculadas à disciplina E ao curso (ou globais se professor?)
    // Simplificação: buscar frentes da disciplina que pertencem ao curso
    const { data, error } = await this.client
      .from("frentes")
      .select("id, nome, disciplina_id")
      .eq("curso_id", cursoId)
      .eq("disciplina_id", disciplinaId);
      
    if (error) throw new Error(error.message);
    return (data || []).map(f => ({
      ...f,
      disciplina_id: f.disciplina_id || "" // Fallback for null
    }));
  }

  async getModulos(cursoId: string, frenteId: string): Promise<{id: string; nome: string; numero_modulo: number | null; frente_id: string}[]> {
    const { data, error } = await this.client
      .from("modulos")
      .select("id, nome, numero_modulo, frente_id")
      .eq("frente_id", frenteId)
      .eq("curso_id", cursoId);
      
    if (error) throw new Error(error.message);
    return (data || []).map(m => ({
      ...m,
      frente_id: m.frente_id || "" // Fallback for null
    }));
  }

  async submitFeedback(cardId: string, feedback: number): Promise<void> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    await this.sendFeedback(user.id, cardId, feedback);
  }

  async listForReview(
    alunoId: string,
    modo: string,
    filters?: { cursoId?: string; frenteId?: string; moduloId?: string; empresaId?: string },
    excludeIds?: string[],
    scope: FlashcardsReviewScope = "all",
    empresaId?: string,
  ): Promise<FlashcardReviewItem[]> {
    const now = new Date();

    // Modo personalizado: usar filtros fornecidos
    if (modo === "personalizado") {
      if (!filters?.moduloId) {
        return []; // Módulo é obrigatório para modo personalizado
      }

      // Validar que o usuário tem acesso ao curso/frente/módulo
      // 1. Verificar se o módulo pertence a uma frente do curso
      const { data: moduloData, error: moduloError } = await this.client
        .from("modulos")
        .select("id, frente_id, curso_id, frentes(id, disciplina_id, curso_id)")
        .eq("id", filters.moduloId)
        .maybeSingle();

      if (moduloError || !moduloData) {
        throw new Error(
          `Módulo não encontrado: ${moduloError?.message || "Módulo inválido"}`,
        );
      }

      // Type assertion needed: Supabase doesn't infer join types automatically
      // The query joins modulos with frentes table to get frente details
      type ModuloWithFrente = {
        id: string;
        frente_id: string;
        curso_id: string;
        frentes: { id: string; disciplina_id: string; curso_id: string } | null;
      };
      const _typedModulo = moduloData as unknown as ModuloWithFrente;

      // 2. Verificar se é professor ou aluno
      const { data: professorData } = await this.client
        .from("usuarios")
        .select("id, empresa_id")
        .eq("id", alunoId)
        .maybeSingle();

      const isProfessor = !!professorData;
      const professorEmpresaIdPersonalizado = professorData?.empresa_id as string | null;

      // 3. Verificar acesso ao curso
      let cursoIds: string[] = [];
      let cursoValido = false;

      if (isProfessor) {
        // Professores: verificar se o curso pertence à empresa do professor
        if (!professorEmpresaIdPersonalizado) {
          throw new Error("Professor sem empresa associada.");
        }
        const frente = moduloData.frentes as ModuloRow["frentes"];
        const cursoIdParaVerificar = frente?.curso_id || moduloData.curso_id;

        if (cursoIdParaVerificar) {
          const { data: cursoData } = await this.client
            .from("cursos")
            .select("id, empresa_id")
            .eq("id", cursoIdParaVerificar)
            .maybeSingle();

          // Professor pode acessar se o curso pertence à sua empresa (isolamento por tenant)
          cursoValido = cursoData?.empresa_id === professorEmpresaIdPersonalizado;
        } else {
          // Módulo sem curso_id (global) - verificar se módulo pertence à empresa
          const { data: moduloEmpresa } = await this.client
            .from("modulos")
            .select("empresa_id")
            .eq("id", filters.moduloId)
            .maybeSingle();
          cursoValido = moduloEmpresa?.empresa_id === professorEmpresaIdPersonalizado;
        }
      } else {
        // Alunos: verificar se estão matriculados no curso
        const { data: alunosCursos, error: alunosCursosError } =
          await this.client
            .from("alunos_cursos")
            .select("curso_id")
            .eq("usuario_id", alunoId);

        if (alunosCursosError) {
          throw new Error(
            `Erro ao buscar cursos do aluno: ${alunosCursosError.message}`,
          );
        }

        cursoIds =
          alunosCursos?.map((ac: { curso_id: string }) => ac.curso_id) || [];
        const frente = moduloData.frentes as ModuloRow["frentes"];

        // Verificar se o módulo pertence a um curso do aluno (via frente ou módulo)
        cursoValido = Boolean(
          (frente?.curso_id && cursoIds.includes(frente.curso_id)) ||
          (moduloData.curso_id && cursoIds.includes(moduloData.curso_id)),
        );
      }

      if (!cursoValido) {
        throw new Error("Você não tem acesso a este módulo");
      }

      // Buscar flashcards do módulo
      let personalQuery = this.client
        .from("flashcards")
        .select(
          "id, modulo_id, pergunta, resposta, pergunta_imagem_path, resposta_imagem_path, modulos(importancia)",
        )
        .eq("modulo_id", filters.moduloId);
      if (empresaId) {
        personalQuery = personalQuery.eq("empresa_id", empresaId);
      }
      const { data: flashcards, error: cardsError } = await personalQuery
        .limit(this.REVIEW_CANDIDATE_POOL);

      if (cardsError) {
        throw new Error(`Erro ao buscar flashcards: ${cardsError.message}`);
      }

      const cards = (flashcards ?? []).map((c) => ({
        id: c.id as string,
        moduloId: c.modulo_id as string,
        pergunta: c.pergunta as string,
        resposta: c.resposta as string,
        perguntaImagemPath:
          (c as unknown as { pergunta_imagem_path?: string | null })
            .pergunta_imagem_path ?? null,
        respostaImagemPath:
          (c as unknown as { resposta_imagem_path?: string | null })
            .resposta_imagem_path ?? null,
        importancia: Array.isArray(c.modulos)
          ? (c.modulos as ModuloRow[])[0]?.importancia
          : (c.modulos as ModuloRow | undefined)?.importancia,
      }));

      const progressMap = await this.fetchProgressMap(
        alunoId,
        cards.map((c) => c.id),
        empresaId,
      );

      const dueCards = cards.filter((card) => {
        // Excluir cards já vistos na sessão
        if (excludeIds && excludeIds.includes(card.id)) {
          return false;
        }
        const progress = progressMap.get(card.id);
        if (!progress) return true;
        const nextDate = progress.data_proxima_revisao
          ? new Date(progress.data_proxima_revisao)
          : null;
        return !nextDate || nextDate <= now;
      });

      const shuffled = this.shuffle(dueCards);
      const sessionCards = shuffled.slice(0, 10).map((c) => {
        const progress = progressMap.get(c.id);
        return {
          ...c,
          importancia:
            c.importancia !== null && c.importancia !== undefined
              ? String(c.importancia)
              : null,
          dataProximaRevisao: progress?.data_proxima_revisao ?? null,
        };
      });
      const signed = await Promise.all(
        sessionCards.map(async (c) => {
          const perguntaImagemUrl = await this.createSignedImageUrl(
            (c as unknown as { perguntaImagemPath?: string | null })
              .perguntaImagemPath ?? null,
          );
          const respostaImagemUrl = await this.createSignedImageUrl(
            (c as unknown as { respostaImagemPath?: string | null })
              .respostaImagemPath ?? null,
          );
          const {
            perguntaImagemPath: _perguntaImagemPath,
            respostaImagemPath: _respostaImagemPath,
            ...rest
          } = c as unknown as {
            perguntaImagemPath?: string | null;
            respostaImagemPath?: string | null;
            [key: string]: unknown;
          };
          return {
            ...(rest as unknown as FlashcardReviewItem),
            perguntaImagemUrl,
            respostaImagemUrl,
          };
        }),
      );
      return signed;
    }

    // Modos automáticos: buscar cursos do aluno ou professor
    // Verificar se é professor ou aluno
    const { data: professorData } = await this.client
      .from("usuarios")
      .select("id, empresa_id")
      .eq("id", alunoId)
      .maybeSingle();

    const isProfessor = !!professorData;
    const professorEmpresaId = professorData?.empresa_id as string | null;
    let cursoIds: string[] = [];

    if (isProfessor) {
      // Professores: buscar cursos da empresa do professor (isolamento por tenant)
      if (!professorEmpresaId) {
        console.error(`[flashcards] Professor sem empresa_id: ${alunoId}`);
        return [];
      }
      console.log(`[flashcards] Usuário é professor da empresa ${professorEmpresaId}, buscando cursos da empresa`);
      const { data: todosCursos, error: cursosError } = await this.client
        .from("cursos")
        .select("id, nome")
        .eq("empresa_id", professorEmpresaId);

      if (cursosError) {
        console.error(
          "[flashcards] Erro ao buscar cursos do professor:",
          cursosError,
        );
        throw new Error(`Erro ao buscar cursos: ${cursosError.message}`);
      }

      cursoIds = (todosCursos ?? []).map((c: CursoRow) => c.id);
      console.log(
        `[flashcards] Professor tem acesso a ${cursoIds.length} cursos da empresa`,
      );
    } else {
      // Alunos: buscar cursos matriculados, filtrados por empresa quando empresaId fornecido
      const empresaIdFilter = filters?.empresaId || empresaId;
      console.log(
        `[flashcards] Usuário é aluno, buscando cursos matriculados${empresaIdFilter ? ` (empresa: ${empresaIdFilter})` : ""}`,
      );

      const cursoIdSet = new Set<string>();

      // 1. alunos_cursos (legacy) -> cursos.empresa_id
      const { data: alunosCursos, error: alunosCursosError } = await this.client
        .from("alunos_cursos")
        .select("curso_id, cursos!inner(empresa_id)")
        .eq("usuario_id", alunoId);

      if (alunosCursosError) {
        throw new Error(
          `Erro ao buscar cursos do aluno: ${alunosCursosError.message}`,
        );
      }

      for (const ac of alunosCursos ?? []) {
        const row = ac as { curso_id: string; cursos?: { empresa_id?: string } };
        const empId = row.cursos?.empresa_id;
        if (!empresaIdFilter || empId === empresaIdFilter) {
          cursoIdSet.add(row.curso_id);
        }
      }

      // 2. matriculas (nova estrutura) - tem empresa_id direto
      const matriculasQuery = this.client
        .from("matriculas")
        .select("curso_id, empresa_id")
        .eq("usuario_id", alunoId)
        .eq("ativo", true);

      const { data: matriculas } = await matriculasQuery;

      for (const m of matriculas ?? []) {
        const row = m as { curso_id?: string; empresa_id?: string };
        if (row.curso_id && (!empresaIdFilter || row.empresa_id === empresaIdFilter)) {
          cursoIdSet.add(row.curso_id);
        }
      }

      cursoIds = Array.from(cursoIdSet);

      if (cursoIds.length === 0) {
        console.warn(
          `[flashcards] Aluno sem cursos matriculados${empresaIdFilter ? " nesta empresa" : ""}`,
        );
        return [];
      }

      console.log(
        `[flashcards] Aluno matriculado em ${cursoIds.length} cursos${empresaIdFilter ? " da empresa ativa" : ""}`,
      );
    }

    if (cursoIds.length === 0) {
      console.warn(`[flashcards] Nenhum curso encontrado para o usuário`);
      return [];
    }

    // 2. Buscar disciplinas dos cursos
    const { data: cursosDisciplinas, error: cdError } = await this.client
      .from("cursos_disciplinas")
      .select("disciplina_id")
      .in("curso_id", cursoIds);

    if (cdError) {
      throw new Error(`Erro ao buscar disciplinas: ${cdError.message}`);
    }

    if (!cursosDisciplinas || cursosDisciplinas.length === 0) {
      return []; // Cursos sem disciplinas
    }

    const disciplinaIds = [
      ...new Set(
        cursosDisciplinas.map(
          (cd: { disciplina_id: string }) => cd.disciplina_id,
        ),
      ),
    ];

    // 3. Buscar frentes das disciplinas (que pertencem aos cursos)
    // Regra importante:
    // - Alunos: SOMENTE frentes vinculadas aos cursos em que estão matriculados (curso_id != null e pertence ao aluno)
    // - Professores/admins: podem ver também frentes "globais" (curso_id is null)
    const { data: frentesData, error: frentesError } = await this.client
      .from("frentes")
      .select("id")
      .in("disciplina_id", disciplinaIds)
      .or(
        isProfessor
          ? cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
              (cursoIds.length > 0 ? "," : "") +
              "curso_id.is.null"
          : cursoIds.map((cid) => `curso_id.eq.${cid}`).join(","),
      );

    if (frentesError) {
      throw new Error(`Erro ao buscar frentes: ${frentesError.message}`);
    }

    if (!frentesData || frentesData.length === 0) {
      return []; // Sem frentes
    }

    const frenteIds = frentesData.map((f: { id: string }) => f.id);

    // 4. Buscar módulos das frentes (considerando curso)
    let moduloIds: string[] = [];

    if (modo === "mais_cobrados") {
      // Para "mais_cobrados", buscar módulos com importancia = 'Alta'
      console.log(
        `[flashcards] Modo "mais_cobrados": buscando módulos com importancia = 'Alta'`,
      );
      console.log(
        `[flashcards] Frente IDs: ${frenteIds.length}, Curso IDs: ${cursoIds.length}`,
      );

      // Buscar todos os módulos das frentes com importancia = 'Alta'
      // Usar uma abordagem mais simples: buscar todos e filtrar no código se necessário
      const { data: todosModulos, error: todosModulosError } = await this.client
        .from("modulos")
        .select("id, importancia, frente_id, curso_id")
        .in("frente_id", frenteIds)
        .eq("importancia", "Alta");

      if (todosModulosError) {
        console.error(
          "[flashcards] Erro ao buscar módulos prioritários:",
          todosModulosError,
        );
        console.error(
          "[flashcards] Detalhes do erro:",
          JSON.stringify(todosModulosError, null, 2),
        );
        throw new Error(
          `Erro ao buscar módulos prioritários: ${todosModulosError.message}`,
        );
      }

      // Filtrar módulos que pertencem aos cursos do usuário.
      // - Alunos: curso_id DEVE pertencer aos cursos do aluno (sem globais)
      // - Professores: permitir também módulos globais (curso_id null)
      const modulosFiltrados = (todosModulos ?? []).filter(
        (m: {
          id: string;
          curso_id: string | null;
          importancia: string | null;
        }) => {
          if (!m.curso_id) return isProfessor; // Módulos globais apenas para professor
          return cursoIds.includes(m.curso_id);
        },
      );

      console.log(
        `[flashcards] Modo "mais_cobrados": encontrados ${modulosFiltrados.length} módulos com importancia = 'Alta' (de ${todosModulos?.length ?? 0} total)`,
      );
      if (modulosFiltrados.length > 0) {
        console.log(
          `[flashcards] Primeiros módulos encontrados:`,
          modulosFiltrados
            .slice(0, 3)
            .map(
              (m: {
                id: string;
                importancia: string | null;
                curso_id: string | null;
              }) => ({
                id: m.id,
                importancia: m.importancia,
                curso_id: m.curso_id,
              }),
            ),
        );
      }
      moduloIds = modulosFiltrados.map((m: { id: string }) => m.id);

      if (moduloIds.length === 0) {
        console.warn(
          '[flashcards] Nenhum módulo com importancia = "Alta" encontrado para os cursos do aluno',
        );
        console.warn(`[flashcards] Frente IDs usados: ${frenteIds.join(", ")}`);
        console.warn(`[flashcards] Curso IDs usados: ${cursoIds.join(", ")}`);
        console.warn(
          `[flashcards] Total de módulos encontrados (antes do filtro): ${todosModulos?.length ?? 0}`,
        );
      }
    } else if (modo === "conteudos_basicos") {
      // Para "conteudos_basicos", buscar módulos com importancia = 'Base'
      console.log(
        `[flashcards] Modo "conteudos_basicos": buscando módulos com importancia = 'Base'`,
      );
      console.log(
        `[flashcards] Frente IDs: ${frenteIds.length}, Curso IDs: ${cursoIds.length}`,
      );

      const { data: todosModulos, error: todosModulosError } = await this.client
        .from("modulos")
        .select("id, importancia, frente_id, curso_id")
        .in("frente_id", frenteIds)
        .eq("importancia", "Base");

      if (todosModulosError) {
        console.error(
          "[flashcards] Erro ao buscar módulos básicos:",
          todosModulosError,
        );
        console.error(
          "[flashcards] Detalhes do erro:",
          JSON.stringify(todosModulosError, null, 2),
        );
        throw new Error(
          `Erro ao buscar módulos básicos: ${todosModulosError.message}`,
        );
      }

      const modulosFiltrados = (todosModulos ?? []).filter(
        (m: { id: string; curso_id: string | null }) => {
          // Alunos: sem globais. Professores: globais ok.
          if (!m.curso_id) return isProfessor;
          return cursoIds.includes(m.curso_id);
        },
      );

      console.log(
        `[flashcards] Modo "conteudos_basicos": encontrados ${modulosFiltrados.length} módulos com importancia = 'Base' (de ${todosModulos?.length ?? 0} total)`,
      );

      moduloIds = modulosFiltrados.map((m: { id: string }) => m.id);

      if (moduloIds.length === 0) {
        console.warn(
          '[flashcards] Nenhum módulo com importancia = "Base" encontrado para os cursos do usuário',
        );
      }
    } else if (modo === "mais_errados") {
      console.log(
        `[flashcards] Modo "mais_errados": buscando flashcards com feedback baixo`,
      );

      // Buscar flashcards com feedback baixo (1 = Errei, 2 = Parcial, 3 = Dificil)
      // Primeiro, buscar todos os módulos das frentes do aluno/professor
      let modulosQuery = this.client
        .from("modulos")
        .select("id, importancia, frente_id, curso_id")
        .in("frente_id", frenteIds);

      // Alunos: apenas módulos dos cursos do aluno (sem globais). Professores: incluir globais.
      if (cursoIds.length > 0) {
        const orCondition = isProfessor
          ? cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
            ",curso_id.is.null"
          : cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",");
        modulosQuery = modulosQuery.or(orCondition);
      }

      const { data: todosModulos, error: modulosError } = await modulosQuery;
      if (modulosError) {
        throw new Error(`Erro ao buscar módulos: ${modulosError.message}`);
      }

      const todosModuloIds = (todosModulos ?? []).map(
        (m: { id: string }) => m.id,
      );
      console.log(
        `[flashcards] Modo "mais_errados": encontrados ${todosModuloIds.length} módulos totais`,
      );

      if (todosModuloIds.length === 0) {
        console.warn(
          `[flashcards] Nenhum módulo encontrado para buscar flashcards`,
        );
        moduloIds = [];
      } else {
        // Buscar flashcards desses módulos que têm feedback baixo
        let maisErradosQuery = this.client
            .from("progresso_flashcards")
            .select("flashcard_id, ultimo_feedback")
            .eq("usuario_id", alunoId)
            .in("ultimo_feedback", [1, 2, 3]); // 1=Errei, 2=Parcial, 3=Dificil
        if (empresaId) {
          maisErradosQuery = maisErradosQuery.eq("empresa_id", empresaId);
        }
        const { data: progressosFlashcards, error: progFlashError } =
          await maisErradosQuery;

        if (progFlashError) {
          console.error(
            "[flashcards] Erro ao buscar progresso de flashcards:",
            progFlashError,
          );
          throw new Error(
            `Erro ao buscar progresso de flashcards: ${progFlashError.message}`,
          );
        }

        const flashcardIdsComErro = (progressosFlashcards ?? [])
          .filter(
            (p) =>
              p.ultimo_feedback === 1 ||
              p.ultimo_feedback === 2 ||
              p.ultimo_feedback === 3,
          )
          .map((p) => p.flashcard_id as string);

        console.log(
          `[flashcards] Modo "mais_errados": encontrados ${flashcardIdsComErro.length} flashcards com feedback baixo`,
        );

        if (flashcardIdsComErro.length > 0) {
          // Buscar módulos desses flashcards
          const { data: flashcards, error: cardsError } = await this.client
            .from("flashcards")
            .select("id, modulo_id")
            .in("id", flashcardIdsComErro);

          if (cardsError) {
            throw new Error(`Erro ao buscar flashcards: ${cardsError.message}`);
          }

          const moduloIdsDosFlashcards = Array.from(
            new Set(
              (flashcards ?? [])
                .map((f: { modulo_id: string | null }) => f.modulo_id)
                .filter((id): id is string => Boolean(id)),
            ),
          );

          // Filtrar apenas módulos que estão nas frentes do aluno/professor
          moduloIds = moduloIdsDosFlashcards.filter((id) =>
            todosModuloIds.includes(id),
          );
          console.log(
            `[flashcards] Modo "mais_errados": ${moduloIds.length} módulos com flashcards com erro`,
          );
        } else {
          // Se não houver flashcards com erro, usar todos os módulos (fallback)
          console.log(
            `[flashcards] Modo "mais_errados": nenhum flashcard com erro encontrado, usando todos os módulos`,
          );
          moduloIds = todosModuloIds;
        }
      }
    } else {
      // Modo revisao_geral ou outros: buscar todos os módulos das frentes do aluno
      let modulosQuery = this.client
        .from("modulos")
        .select("id, importancia, frente_id, curso_id")
        .in("frente_id", frenteIds);

      // Alunos: apenas módulos dos cursos do aluno (sem globais). Professores: incluir globais.
      if (cursoIds.length > 0) {
        const orCondition = isProfessor
          ? cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
            ",curso_id.is.null"
          : cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",");
        modulosQuery = modulosQuery.or(orCondition);
      }

      const { data: modulosData, error: modulosError } = await modulosQuery;
      if (modulosError) {
        throw new Error(`Erro ao buscar módulos: ${modulosError.message}`);
      }
      moduloIds = (modulosData ?? []).map((m: { id: string }) => m.id);

      // Modo revisao_geral: buscar módulos de flashcards já vistos OU módulos com atividades concluídas
      if (modo === "revisao_geral") {
        // 1. Buscar flashcards já vistos
        let revisaoGeralQuery = this.client
          .from("progresso_flashcards")
          .select("flashcard_id")
          .eq("usuario_id", alunoId);
        if (empresaId) {
          revisaoGeralQuery = revisaoGeralQuery.eq("empresa_id", empresaId);
        }
        const { data: progFlash, error: progFlashError } = await revisaoGeralQuery;
        if (progFlashError) {
          console.warn(
            "[flashcards] erro ao buscar progresso para revisao_geral",
            progFlashError,
          );
        }
        const flashcardIdsVistos = (progFlash ?? []).map(
          (p) => p.flashcard_id as string,
        );
        let moduloIdsVisited: string[] = [];
        if (flashcardIdsVistos.length) {
          const { data: cardsVisitados } = await this.client
            .from("flashcards")
            .select("id, modulo_id")
            .in("id", flashcardIdsVistos);
          moduloIdsVisited = Array.from(
            new Set((cardsVisitados ?? []).map((c) => c.modulo_id as string)),
          );
        }

        // 2. Buscar módulos concluídos por aulas (principal) + atividades (fallback)
        const moduloIdsConcluidos = Array.from(
          await this.fetchCompletedModuloIds(alunoId, empresaId),
        );

        // 3. Combinar módulos de flashcards vistos + módulos com atividades concluídas
        const moduloIdsCombinados = Array.from(
          new Set([...moduloIdsVisited, ...moduloIdsConcluidos]),
        );

        // 4. Se houver módulos combinados, filtrar apenas esses. Caso contrário, usar todos os módulos já buscados
        if (moduloIdsCombinados.length > 0) {
          // Filtrar apenas os módulos que estão nas frentes do aluno E foram visitados/concluídos
          moduloIds = moduloIds.filter((id) =>
            moduloIdsCombinados.includes(id),
          );
        }
        // Se moduloIdsCombinados estiver vazio, usar todos os módulos já buscados (moduloIds permanece como está)
      }
    }

    if (!moduloIds.length) {
      console.warn(`[flashcards] Nenhum módulo encontrado para modo "${modo}"`);
      return [];
    }

    // Aplicar filtro por escopo (apenas para alunos; professor não tem noção de "módulo concluído")
    if (scope === "completed" && !isProfessor && modo !== "personalizado") {
      const completed = await this.fetchCompletedModuloIds(alunoId, empresaId);
      if (completed.size === 0) {
        console.log(
          "[flashcards] scope=completed: aluno sem módulos concluídos",
        );
        return [];
      }
      const before = moduloIds.length;
      moduloIds = moduloIds.filter((id) => completed.has(id));
      console.log(
        `[flashcards] scope=completed: módulos filtrados ${before} -> ${moduloIds.length}`,
      );
      if (moduloIds.length === 0) {
        return [];
      }
    }

    console.log(
      `[flashcards] Buscando flashcards para ${moduloIds.length} módulos (modo: ${modo})`,
    );
    let autoModesQuery = this.client
      .from("flashcards")
      .select(
        "id, modulo_id, pergunta, resposta, pergunta_imagem_path, resposta_imagem_path, modulos(importancia)",
      )
      .in("modulo_id", moduloIds);
    if (empresaId) {
      autoModesQuery = autoModesQuery.eq("empresa_id", empresaId);
    }
    const { data: flashcards, error: cardsError } = await autoModesQuery
      .limit(this.REVIEW_CANDIDATE_POOL);

    if (cardsError) {
      console.error("[flashcards] Erro ao buscar flashcards:", cardsError);
      throw new Error(`Erro ao buscar flashcards: ${cardsError.message}`);
    }

    console.log(
      `[flashcards] Encontrados ${flashcards?.length ?? 0} flashcards`,
    );
    const cards = (flashcards ?? []).map((c) => ({
      id: c.id as string,
      moduloId: c.modulo_id as string,
      pergunta: c.pergunta as string,
      resposta: c.resposta as string,
      perguntaImagemPath:
        (c as unknown as { pergunta_imagem_path?: string | null })
          .pergunta_imagem_path ?? null,
      respostaImagemPath:
        (c as unknown as { resposta_imagem_path?: string | null })
          .resposta_imagem_path ?? null,
      importancia: Array.isArray(c.modulos)
        ? (c.modulos as ModuloRow[])[0]?.importancia
        : (c.modulos as ModuloRow | undefined)?.importancia,
    }));

    const progressMap = await this.fetchProgressMap(
      alunoId,
      cards.map((c) => c.id),
      empresaId,
    );

    // Para modo "mais_errados" (UTI), aplicar distribuição ponderada
    if (modo === "mais_errados") {
      // Separar cards por feedback
      const cardsPorFeedback: { [key: number]: typeof cards } = {
        1: [], // Errei
        2: [], // Parcial
        3: [], // Dificil
      };

      cards.forEach((card) => {
        const progress = progressMap.get(card.id);
        if (!progress) return;

        // Excluir cards já vistos na sessão
        if (excludeIds && excludeIds.includes(card.id)) {
          return;
        }

        // Verificar se está due
        const nextDate = progress.data_proxima_revisao
          ? new Date(progress.data_proxima_revisao)
          : null;
        if (nextDate && nextDate > now) {
          return;
        }

        const feedback = progress.ultimo_feedback as number | null;
        if (feedback === 1 || feedback === 2 || feedback === 3) {
          cardsPorFeedback[feedback].push(card);
        }
      });

      // Distribuição: 5 Errei, 3 Parcial, 2 Dificil
      const selecionados: typeof cards = [];

      // Embaralhar cada grupo
      const erreiShuffled = this.shuffle(cardsPorFeedback[1]);
      const parcialShuffled = this.shuffle(cardsPorFeedback[2]);
      const dificilShuffled = this.shuffle(cardsPorFeedback[3]);

      // Adicionar 5 de "Errei"
      selecionados.push(...erreiShuffled.slice(0, 5));

      // Adicionar 3 de "Parcial"
      selecionados.push(...parcialShuffled.slice(0, 3));

      // Adicionar 2 de "Dificil"
      selecionados.push(...dificilShuffled.slice(0, 2));

      // Se não tiver cards suficientes com feedback, buscar cards novos ou sem feedback
      if (selecionados.length < 10) {
        const cardsNovos = cards.filter((card) => {
          if (excludeIds && excludeIds.includes(card.id)) return false;
          const progress = progressMap.get(card.id);
          if (!progress) return true;
          const nextDate = progress.data_proxima_revisao
            ? new Date(progress.data_proxima_revisao)
            : null;
          return !nextDate || nextDate <= now;
        });

        const idsSelecionados = new Set(selecionados.map((c) => c.id));
        const cardsDisponiveis = cardsNovos.filter(
          (c) => !idsSelecionados.has(c.id),
        );
        const shuffledNovos = this.shuffle(cardsDisponiveis);
        selecionados.push(...shuffledNovos.slice(0, 10 - selecionados.length));
      }

      // Embaralhar resultado final e limitar a 10
      const finalShuffled = this.shuffle(selecionados);
      const sessionCards = finalShuffled.slice(0, 10).map((c) => {
        const progress = progressMap.get(c.id);
        return {
          ...c,
          importancia:
            c.importancia !== null && c.importancia !== undefined
              ? String(c.importancia)
              : null,
          dataProximaRevisao: progress?.data_proxima_revisao ?? null,
        };
      });
      const signed = await Promise.all(
        sessionCards.map(async (c) => {
          const perguntaImagemUrl = await this.createSignedImageUrl(
            (c as unknown as { perguntaImagemPath?: string | null })
              .perguntaImagemPath ?? null,
          );
          const respostaImagemUrl = await this.createSignedImageUrl(
            (c as unknown as { respostaImagemPath?: string | null })
              .respostaImagemPath ?? null,
          );
          const {
            perguntaImagemPath: _perguntaImagemPath,
            respostaImagemPath: _respostaImagemPath,
            ...rest
          } = c as unknown as {
            perguntaImagemPath?: string | null;
            respostaImagemPath?: string | null;
            [key: string]: unknown;
          };
          return {
            ...(rest as unknown as FlashcardReviewItem),
            perguntaImagemUrl,
            respostaImagemUrl,
          };
        }),
      );
      return signed;
    }

    // Para outros modos (incluindo "mais_cobrados"), usar lógica padrão
    const dueCards = cards.filter((card) => {
      // Excluir cards já vistos na sessão
      if (excludeIds && excludeIds.includes(card.id)) {
        return false;
      }
      const progress = progressMap.get(card.id);
      // Cards sem progresso são sempre "due" (prontos para revisão)
      if (!progress) return true;
      const nextDate = progress.data_proxima_revisao
        ? new Date(progress.data_proxima_revisao)
        : null;
      return !nextDate || nextDate <= now;
    });

    console.log(
      `[flashcards] Modo "${modo}": ${dueCards.length} flashcards "due" de ${cards.length} total`,
    );
    const shuffled = this.shuffle(dueCards);
    const sessionCards = shuffled.slice(0, 10).map((c) => {
      const progress = progressMap.get(c.id);
      return {
        ...c,
        importancia:
          c.importancia !== null && c.importancia !== undefined
            ? String(c.importancia)
            : null,
        dataProximaRevisao: progress?.data_proxima_revisao ?? null,
      };
    });
    const signed = await Promise.all(
      sessionCards.map(async (c) => {
        const perguntaImagemUrl = await this.createSignedImageUrl(
          (c as unknown as { perguntaImagemPath?: string | null })
            .perguntaImagemPath ?? null,
        );
        const respostaImagemUrl = await this.createSignedImageUrl(
          (c as unknown as { respostaImagemPath?: string | null })
            .respostaImagemPath ?? null,
        );
        const {
          perguntaImagemPath: _p,
          respostaImagemPath: _r,
          ...rest
        } = c as unknown as {
          perguntaImagemPath?: string | null;
          respostaImagemPath?: string | null;
          [key: string]: unknown;
        };
        return {
          ...(rest as unknown as FlashcardReviewItem),
          perguntaImagemUrl,
          respostaImagemUrl,
        };
      }),
    );
    console.log(
      `[flashcards] Retornando ${signed.length} flashcards para revisão`,
    );
    return signed;
  }

  /**
   * Registra feedback do aluno sobre um flashcard
   *
   * Valores de feedback:
   * 1 = Errei o item
   * 2 = Acertei parcialmente
   * 3 = Acertei com dificuldade
   * 4 = Acertei com facilidade
   *
   * Esses feedbacks serão usados para alimentar os algoritmos de:
   * - Mais Cobrados
   * - Revisão Geral
   * - UTI dos Erros
   */
  async sendFeedback(alunoId: string, cardId: string, feedback: number) {
    if (!isValidFeedback(feedback)) {
      throw new Error("Feedback inválido. Use 1, 2, 3 ou 4.");
    }

    // Buscar empresa_id do aluno para garantir isolamento de tenant
    const { data: alunoData, error: alunoError } = await this.client
      .from("usuarios")
      .select("empresa_id")
      .eq("id", alunoId)
      .maybeSingle();

    if (alunoError || !alunoData?.empresa_id) {
      throw new Error("Aluno não encontrado ou sem empresa associada.");
    }

    const empresaId = alunoData.empresa_id;

    // Validar que o flashcard pertence à mesma empresa do aluno
    const { data: flashcardData, error: flashcardError } = await this.client
      .from("flashcards")
      .select("empresa_id")
      .eq("id", cardId)
      .maybeSingle();

    if (flashcardError || !flashcardData) {
      throw new Error("Flashcard não encontrado.");
    }

    if (flashcardData.empresa_id !== empresaId) {
      throw new Error("Flashcard não pertence à sua empresa.");
    }

    const { data: existing, error } = await this.client
      .from("progresso_flashcards")
      .select("*")
      .eq("usuario_id", alunoId)
      .eq("flashcard_id", cardId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Erro ao buscar progresso do flashcard: ${error.message}`,
      );
    }

    // Usar algoritmo SRS para calcular próxima revisão
    const srsResult = calculateNextReview(feedback as FeedbackValue, {
      easeFactor: existing?.nivel_facilidade ?? undefined,
      interval: existing?.dias_intervalo ?? undefined,
      repetitions: existing?.numero_revisoes ?? undefined,
      lastFeedback: existing?.ultimo_feedback ?? null,
    });

    const now = new Date();

    const payload = {
      usuario_id: alunoId,
      flashcard_id: cardId,
      empresa_id: empresaId,
      nivel_facilidade: srsResult.newEaseFactor,
      dias_intervalo: srsResult.newInterval,
      data_proxima_revisao: srsResult.nextReviewDate.toISOString(),
      numero_revisoes: srsResult.newRepetitions,
      ultimo_feedback: feedback,
      updated_at: now.toISOString(),
    };

    const { data: upserted, error: upsertError } = await this.client
      .from("progresso_flashcards")
      .upsert(payload, { onConflict: "usuario_id,flashcard_id" })
      .select("*")
      .maybeSingle();

    if (upsertError) {
      throw new Error(`Erro ao registrar feedback: ${upsertError.message}`);
    }

    return upserted;
  }

  async listAll(
    filters: ListFlashcardsFilters = {},
    userId: string,
    empresaId?: string,
  ): Promise<{
    data: FlashcardAdmin[];
    total: number;
  }> {
    console.log(
      "[flashcards] listAll chamado com filtros:",
      JSON.stringify(filters, null, 2),
    );
    console.log("[flashcards] userId:", userId);

    const adminContext = await this.getAdminContext(userId, empresaId);
    const professorEmpresaIdListAll = adminContext.empresaId;

    // Não cachear se houver busca por texto (resultados podem variar)
    const hasSearch = !!filters.search;

    // Criar chave de cache baseada nos filtros (sem search)
    if (!hasSearch) {
      const cacheKeyParts = [
        "cache:flashcards",
        `empresa:${professorEmpresaIdListAll}`,
      ];
      if (filters.disciplinaId)
        cacheKeyParts.push(`disciplina:${filters.disciplinaId}`);
      if (filters.frenteId) cacheKeyParts.push(`frente:${filters.frenteId}`);
      if (filters.moduloId) cacheKeyParts.push(`modulo:${filters.moduloId}`);
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      cacheKeyParts.push(`page:${page}`, `limit:${limit}`);
      const orderBy = filters.orderBy || "created_at";
      const orderDirection = filters.orderDirection || "desc";
      cacheKeyParts.push(`order:${orderBy}:${orderDirection}`);

      const cacheKey = cacheKeyParts.join(":");

      const cached = await cacheService.get<{
        data: FlashcardAdmin[];
        total: number;
      }>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Primeiro, buscar módulos filtrados se necessário
    let moduloIds: string[] | null = null;

    if (filters.moduloId) {
      moduloIds = [filters.moduloId];
    } else if (filters.frenteId) {
      console.log("[flashcards] Buscando módulos da frente:", filters.frenteId);

      const { data: modulosData, error: modulosError } = await this.client
        .from("modulos")
        .select("id")
        .eq("frente_id", filters.frenteId);

      if (modulosError) {
        console.error(
          "[flashcards] Erro completo ao buscar módulos da frente:",
          JSON.stringify(modulosError, null, 2),
        );
        const errorMsg = formatSupabaseError(modulosError);
        console.error("[flashcards] Erro formatado:", errorMsg);
        throw new Error(`Erro ao buscar módulos da frente: ${errorMsg}`);
      }

      console.log(
        "[flashcards] Módulos encontrados:",
        modulosData?.length || 0,
      );
      moduloIds = modulosData?.map((m) => m.id as string) || [];
      console.log("[flashcards] IDs dos módulos:", moduloIds);

      if (moduloIds.length === 0) {
        // Frente sem módulos - retornar vazio
        console.log("[flashcards] Frente sem módulos, retornando vazio");
        return { data: [], total: 0 };
      }
    } else if (filters.disciplinaId) {
      // Buscar frentes da disciplina
      const { data: frentesData, error: frentesError } = await this.client
        .from("frentes")
        .select("id")
        .eq("disciplina_id", filters.disciplinaId);

      if (frentesError) {
        throw new Error(
          `Erro ao buscar frentes da disciplina: ${frentesError.message}`,
        );
      }

      const frenteIds = frentesData?.map((f) => f.id as string) || [];

      if (frenteIds.length > 0) {
        const { data: modulosData, error: modulosError } = await this.client
          .from("modulos")
          .select("id")
          .in("frente_id", frenteIds);

        if (modulosError) {
          throw new Error(
            `Erro ao buscar módulos das frentes: ${modulosError.message}`,
          );
        }

        moduloIds = modulosData?.map((m) => m.id as string) || [];
      }
    }

    // Construir query de flashcards
    console.log("[flashcards] Construindo query de flashcards");
    console.log("[flashcards] moduloIds:", moduloIds);
    const applyListFilters = <
      T extends {
        in: (column: string, values: string[]) => T;
        or: (filters: string) => T;
        order: (column: string, options: { ascending: boolean }) => T;
        range: (from: number, to: number) => T;
      },
    >(
      baseQuery: T,
    ): T | null => {
      let q = baseQuery;

      if (moduloIds !== null) {
        if (moduloIds.length === 0) {
          // Nenhum módulo encontrado, retornar vazio
          console.log(
            "[flashcards] Nenhum módulo encontrado, retornando vazio",
          );
          return null;
        }
        console.log(
          "[flashcards] Aplicando filtro de módulos:",
          moduloIds.length,
          "módulos",
        );
        q = q.in("modulo_id", moduloIds);
      }

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        console.log("[flashcards] Aplicando busca:", searchTerm);
        q = q.or(
          `pergunta.ilike.${searchTerm},resposta.ilike.${searchTerm}`,
        );
      }

      const orderBy = filters.orderBy || "created_at";
      const orderDirection = filters.orderDirection || "desc";
      q = q.order(orderBy, {
        ascending: orderDirection === "asc",
      });

      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      q = q.range(from, to);

      return q;
    };

    const query = applyListFilters(
      this.client
        .from("flashcards")
        .select(
          "id, modulo_id, pergunta, resposta, pergunta_imagem_path, resposta_imagem_path, created_at",
          { count: "exact" },
        )
        .eq("empresa_id", professorEmpresaIdListAll),
    );

    if (!query) {
      return { data: [], total: 0 };
    }

    console.log("[flashcards] Executando query de flashcards...");
    let { data: flashcardsData, error, count } = await query;

    // Compatibilidade: bancos ainda sem as colunas de imagem
    if (error && isMissingFlashcardsImageColumnsError(error)) {
      console.warn(
        "[flashcards] Colunas pergunta_imagem_path/resposta_imagem_path não existem no banco; refazendo query sem elas.",
      );
      const fallbackQuery = applyListFilters(
        this.client
          .from("flashcards")
          .select("id, modulo_id, pergunta, resposta, created_at", {
            count: "exact",
          })
          .eq("empresa_id", professorEmpresaIdListAll),
      );
      if (!fallbackQuery) {
        return { data: [], total: 0 };
      }
      const fallback = await fallbackQuery;
      flashcardsData = fallback.data?.map((item) => ({
        ...item,
        pergunta_imagem_path: null,
        resposta_imagem_path: null,
      })) ?? null;
      error = fallback.error;
      count = fallback.count;
    }

    if (error) {
      console.error(
        "[flashcards] Erro completo na query de flashcards:",
        JSON.stringify(error, null, 2),
      );
      console.error(
        "[flashcards] Filtros aplicados:",
        JSON.stringify(filters, null, 2),
      );
      console.error("[flashcards] Módulos IDs:", moduloIds);
      const errorMsg = formatSupabaseError(error);
      console.error("[flashcards] Erro formatado:", errorMsg);
      throw new Error(`Erro ao listar flashcards: ${errorMsg}`);
    }

    console.log(
      "[flashcards] Flashcards encontrados:",
      flashcardsData?.length || 0,
    );
    console.log("[flashcards] Total:", count);

    if (!flashcardsData || flashcardsData.length === 0) {
      return { data: [], total: count || 0 };
    }

    // Buscar módulos relacionados
    const flashcardsWithModulo = flashcardsData as Array<{
      modulo_id: string | null;
    }>;
    const moduloIdsFromFlashcards = [
      ...new Set(
        flashcardsWithModulo
          .map((f) => f.modulo_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];

    if (moduloIdsFromFlashcards.length === 0) {
      return { data: [], total: count || 0 };
    }

    console.log(
      "[flashcards] Buscando módulos com relacionamentos para",
      moduloIdsFromFlashcards.length,
      "módulos",
    );
    console.log(
      "[flashcards] IDs dos módulos a buscar:",
      moduloIdsFromFlashcards,
    );

    let modulosData: ModuloComFrenteRow[] | null = null;
    let modulosError: unknown = null;

    try {
      console.log(
        "[flashcards] Executando query de módulos com relacionamentos...",
      );

      const result = await this.client
        .from("modulos")
        .select(
          `
          id,
          nome,
          numero_modulo,
          frente_id,
          frentes!inner(
            id,
            nome,
            disciplina_id,
            disciplinas!inner(
              id,
              nome
            )
          )
        `,
        )
        .in("id", moduloIdsFromFlashcards);

      modulosData = result.data as ModuloComFrenteRow[] | null;
      modulosError = result.error;

      if (modulosError) {
        console.error(
          "[flashcards] Erro na query de módulos:",
          JSON.stringify(modulosError, null, 2),
        );
        console.error("[flashcards] Tipo do erro:", typeof modulosError);
        console.error(
          "[flashcards] Erro é objeto?",
          typeof modulosError === "object",
        );
      } else {
        console.log(
          "[flashcards] Módulos com relacionamentos encontrados:",
          modulosData?.length || 0,
        );
        if (modulosData && modulosData.length > 0) {
          console.log(
            "[flashcards] Primeiro módulo exemplo:",
            JSON.stringify(modulosData[0], null, 2).substring(0, 500),
          );
        }
      }
    } catch (err) {
      console.error("[flashcards] Exceção ao buscar módulos (catch):", err);
      console.error("[flashcards] Tipo da exceção:", typeof err);
      if (err instanceof Error) {
        console.error("[flashcards] Mensagem da exceção:", err.message);
        console.error("[flashcards] Stack da exceção:", err.stack);
      }
      modulosError = err;
    }

    if (modulosError) {
      console.error(
        "[flashcards] Erro completo ao buscar módulos:",
        JSON.stringify(modulosError, null, 2),
      );
      console.error(
        "[flashcards] Módulos IDs buscados:",
        moduloIdsFromFlashcards,
      );

      const errorMsg = formatSupabaseError(modulosError);
      console.error("[flashcards] Erro formatado:", errorMsg);

      // Criar mensagem de erro mais clara
      let finalErrorMessage = `Erro ao buscar módulos: ${errorMsg}`;

      // Se o erro for sobre relacionamentos faltando, dar mensagem mais específica
      if (
        errorMsg.includes("inner") ||
        errorMsg.includes("relation") ||
        errorMsg.includes("foreign key")
      ) {
        finalErrorMessage = `Erro ao buscar relacionamentos dos módulos. Verifique se todos os módulos têm frente e disciplina associadas. Detalhes: ${errorMsg}`;
      }

      throw new Error(finalErrorMessage);
    }

    if (!modulosData || modulosData.length === 0) {
      console.warn(
        "[flashcards] Nenhum módulo encontrado com relacionamentos, mas havia flashcards. Isso pode indicar problema de integridade de dados.",
      );
      // Retornar vazio ao invés de erro, pois pode ser que os módulos foram deletados
      return { data: [], total: count || 0 };
    }

    // Criar map de módulos
    const modulosMap = new Map(
      (modulosData || [])
        .filter((m: ModuloComFrenteRow) => {
          // Verificar se o módulo tem os relacionamentos necessários
          // IMPORTANTE: Verificar se disciplinas foi carregado, não apenas disciplina_id
          const frentes = Array.isArray(m.frentes) ? m.frentes[0] : m.frentes;
          if (!m || !frentes) return false;

          interface FrenteComDisciplina {
            disciplinas?:
              | { id: string; nome: string }
              | { id: string; nome: string }[];
            [key: string]: unknown;
          }
          // Verificar se a disciplina foi realmente carregada (não apenas a foreign key)
          const frentesWithDisciplina =
            frentes as unknown as FrenteComDisciplina;
          const disciplinasData = frentesWithDisciplina?.disciplinas;
          const disciplina = Array.isArray(disciplinasData)
            ? disciplinasData[0]
            : disciplinasData;
          return disciplina && disciplina.id && disciplina.nome;
        })
        .map((m: ModuloComFrenteRow) => {
          const frentes = Array.isArray(m.frentes) ? m.frentes[0]! : m.frentes!;
          // Acessar disciplinas do objeto frentes (estrutura retornada pela query SQL)
          // Supabase pode retornar como objeto único ou array, tratar ambos os casos
          interface FrenteComDisciplina {
            disciplinas?:
              | { id: string; nome: string }
              | { id: string; nome: string }[];
            [key: string]: unknown;
          }
          const frentesWithDisciplina =
            frentes as unknown as FrenteComDisciplina;
          const disciplinasData = frentesWithDisciplina?.disciplinas;
          const disciplina = Array.isArray(disciplinasData)
            ? disciplinasData[0]
            : disciplinasData;

          // Garantir que temos a disciplina carregada (já filtrado acima, mas double-check para type safety)
          if (!disciplina || !disciplina.id || !disciplina.nome) {
            throw new Error(`Disciplina não carregada para módulo ${m.id}`);
          }

          return [
            m.id,
            {
              id: m.id,
              nome: m.nome,
              numero_modulo: m.numero_modulo ?? null,
              frente: {
                id: frentes.id,
                nome: frentes.nome,
                disciplina: {
                  id: disciplina.id,
                  nome: disciplina.nome,
                },
              },
            },
          ];
        }),
    );

    // Montar resposta final
    const flashcards: FlashcardAdmin[] = flashcardsData
      .map(
        (
          item: {
            id: string;
            modulo_id: string | null;
            pergunta: string;
            resposta: string;
            created_at: string | null;
          } & Record<string, unknown>,
        ) => {
        // After migration, modulo_id is guaranteed to be non-null
        const modulo = modulosMap.get(item.modulo_id as string);
        if (!modulo) return null;

        return {
          id: item.id,
          modulo_id: item.modulo_id as string,
          pergunta: item.pergunta,
          pergunta_imagem_path:
            (item as unknown as { pergunta_imagem_path?: string | null })
              .pergunta_imagem_path ?? null,
          resposta: item.resposta,
          resposta_imagem_path:
            (item as unknown as { resposta_imagem_path?: string | null })
              .resposta_imagem_path ?? null,
          created_at: item.created_at as string,
          modulo,
        } as FlashcardAdmin;
      },
      )
      .filter((f: FlashcardAdmin | null): f is FlashcardAdmin => f !== null);

    const result: { data: FlashcardAdmin[]; total: number } = {
      data: flashcards,
      total: count || 0,
    };

    // Armazenar no cache se não houver busca
    if (!hasSearch) {
      const cacheKeyParts = [
        "cache:flashcards",
        `empresa:${professorEmpresaIdListAll}`,
      ];
      if (filters.disciplinaId)
        cacheKeyParts.push(`disciplina:${filters.disciplinaId}`);
      if (filters.frenteId) cacheKeyParts.push(`frente:${filters.frenteId}`);
      if (filters.moduloId) cacheKeyParts.push(`modulo:${filters.moduloId}`);
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      cacheKeyParts.push(`page:${page}`, `limit:${limit}`);
      const orderBy = filters.orderBy || "created_at";
      const orderDirection = filters.orderDirection || "desc";
      cacheKeyParts.push(`order:${orderBy}:${orderDirection}`);

      const cacheKey = cacheKeyParts.join(":");
      await cacheService.set(cacheKey, result, 900); // TTL: 15 minutos
    }

    return result;
  }

  async getById(
    id: string,
    userId: string,
    empresaId?: string,
  ): Promise<FlashcardAdmin | null> {
    const adminContext = await this.getAdminContext(userId, empresaId);
    const professorEmpresaIdGetById = adminContext.empresaId;

    let { data: flashcard, error } = await this.client
      .from("flashcards")
      .select(
        "id, modulo_id, pergunta, resposta, pergunta_imagem_path, resposta_imagem_path, created_at",
      )
      .eq("id", id)
      .eq("empresa_id", professorEmpresaIdGetById)
      .maybeSingle();

    // Compatibilidade: bancos ainda sem as colunas de imagem
    if (error && isMissingFlashcardsImageColumnsError(error)) {
      console.warn(
        "[flashcards] Colunas pergunta_imagem_path/resposta_imagem_path não existem no banco (getById); fazendo fallback.",
      );
      const fallback = await this.client
        .from("flashcards")
        .select("id, modulo_id, pergunta, resposta, created_at")
        .eq("id", id)
        .eq("empresa_id", professorEmpresaIdGetById)
        .maybeSingle();
      flashcard = fallback.data
        ? {
            ...fallback.data,
            pergunta_imagem_path: null,
            resposta_imagem_path: null,
          }
        : null;
      error = fallback.error;
    }

    if (error) {
      throw new Error(`Erro ao buscar flashcard: ${error.message}`);
    }

    if (!flashcard) {
      return null;
    }

    // Buscar módulo com relacionamentos
    const { data: modulo, error: moduloGetError } = await this.client
      .from("modulos")
      .select(
        `
        id,
        nome,
        numero_modulo,
        frentes!inner(
          id,
          nome,
          disciplinas!inner(
            id,
            nome
          )
        )
      `,
      )
      .eq("id", flashcard.modulo_id ?? "")
      .maybeSingle();

    if (moduloGetError || !modulo || !flashcard.modulo_id) {
      throw new Error(
        `Erro ao buscar módulo: ${moduloGetError?.message || "Módulo não encontrado"}`,
      );
    }

    const perguntaPath =
      (flashcard as unknown as { pergunta_imagem_path?: string | null })
        .pergunta_imagem_path ?? null;
    const respostaPath =
      (flashcard as unknown as { resposta_imagem_path?: string | null })
        .resposta_imagem_path ?? null;
    const perguntaUrl = await this.createSignedImageUrl(perguntaPath);
    const respostaUrl = await this.createSignedImageUrl(respostaPath);

    return {
      id: flashcard.id,
      modulo_id: flashcard.modulo_id as string,
      pergunta: flashcard.pergunta,
      resposta: flashcard.resposta,
      pergunta_imagem_path: perguntaPath,
      resposta_imagem_path: respostaPath,
      pergunta_imagem_url: perguntaUrl,
      resposta_imagem_url: respostaUrl,
      created_at: flashcard.created_at as string,
      modulo: {
        id: (modulo as unknown as ModuloWithNestedRelations).id,
        nome: (modulo as unknown as ModuloWithNestedRelations).nome,
        numero_modulo: (modulo as unknown as ModuloWithNestedRelations)
          .numero_modulo,
        frente: {
          id: (modulo as unknown as ModuloWithNestedRelations).frentes.id,
          nome: (modulo as unknown as ModuloWithNestedRelations).frentes.nome,
          disciplina: {
            id: (modulo as unknown as ModuloWithNestedRelations).frentes
              .disciplinas.id,
            nome: (modulo as unknown as ModuloWithNestedRelations).frentes
              .disciplinas.nome,
          },
        },
      },
    };
  }

  async create(
    input: CreateFlashcardInput,
    userId: string,
    empresaId?: string,
  ): Promise<FlashcardAdmin> {
    const adminContext = await this.getAdminContext(userId, empresaId);
    const professorEmpresaIdCreate = adminContext.empresaId;

    if (!input.moduloId || !input.pergunta?.trim() || !input.resposta?.trim()) {
      throw new Error("Módulo, pergunta e resposta são obrigatórios.");
    }

    // Verificar se módulo existe e pertence à empresa do professor
    const { data: moduloCheck, error: moduloCheckError } = await this.client
      .from("modulos")
      .select("id, empresa_id")
      .eq("id", input.moduloId)
      .eq("empresa_id", professorEmpresaIdCreate)
      .maybeSingle();

    if (moduloCheckError || !moduloCheck) {
      throw new Error("Módulo não encontrado ou não pertence à sua empresa.");
    }

    const moduloEmpresaId =
      (moduloCheck as { empresa_id?: string | null }).empresa_id ?? null;
    if (!moduloEmpresaId) {
      throw new Error("Módulo sem empresa_id (dados inconsistentes).");
    }

    const { data: flashcard, error } = await this.client
      .from("flashcards")
      .insert({
        modulo_id: input.moduloId,
        empresa_id: moduloEmpresaId,
        pergunta: input.pergunta.trim(),
        resposta: input.resposta.trim(),
      })
      .select("id, modulo_id, pergunta, resposta, created_at")
      .single();

    if (error) {
      throw new Error(`Erro ao criar flashcard: ${error.message}`);
    }

    // Buscar módulo com relacionamentos
    if (!flashcard.modulo_id) {
      throw new Error("Flashcard sem módulo associado");
    }

    const { data: modulo, error: moduloFetchError } = await this.client
      .from("modulos")
      .select(
        `
        id,
        nome,
        numero_modulo,
        frentes!inner(
          id,
          nome,
          disciplinas!inner(
            id,
            nome
          )
        )
      `,
      )
      .eq("id", flashcard.modulo_id)
      .maybeSingle();

    if (moduloFetchError || !modulo) {
      throw new Error(
        `Erro ao buscar módulo: ${moduloFetchError?.message || "Módulo não encontrado"}`,
      );
    }

    const result: FlashcardAdmin = {
      id: flashcard.id,
      modulo_id: flashcard.modulo_id as string,
      pergunta: flashcard.pergunta,
      resposta: flashcard.resposta,
      created_at: flashcard.created_at as string,
      modulo: {
        id: (modulo as unknown as ModuloWithNestedRelations).id,
        nome: (modulo as unknown as ModuloWithNestedRelations).nome,
        numero_modulo: (modulo as unknown as ModuloWithNestedRelations)
          .numero_modulo,
        frente: {
          id: (modulo as unknown as ModuloWithNestedRelations).frentes.id,
          nome: (modulo as unknown as ModuloWithNestedRelations).frentes.nome,
          disciplina: {
            id: (modulo as unknown as ModuloWithNestedRelations).frentes
              .disciplinas.id,
            nome: (modulo as unknown as ModuloWithNestedRelations).frentes
              .disciplinas.nome,
          },
        },
      },
    };

    // Invalidar cache
    await this.invalidateFlashcardCache(
      professorEmpresaIdCreate,
      (modulo as unknown as ModuloWithNestedRelations).frentes.disciplinas.id,
      (modulo as unknown as ModuloWithNestedRelations).frentes.id,
      flashcard.modulo_id as string,
    );

    return result;
  }

  async update(
    id: string,
    input: UpdateFlashcardInput,
    userId: string,
    empresaId?: string,
  ): Promise<FlashcardAdmin> {
    const adminContext = await this.getAdminContext(userId, empresaId);
    const professorEmpresaIdUpdate = adminContext.empresaId;

    // Verificar se flashcard existe (já verifica empresa via getById)
    const existing = await this.getById(id, userId, professorEmpresaIdUpdate);
    if (!existing) {
      throw new Error("Flashcard não encontrado.");
    }

    const updateData: {
      modulo_id?: string;
      empresa_id?: string;
      pergunta?: string;
      resposta?: string;
    } = {};
    if (input.moduloId !== undefined) {
      // Verificar se novo módulo existe e pertence à empresa do professor
      const { data: moduloCheck, error: moduloCheckError } = await this.client
        .from("modulos")
        .select("id, empresa_id")
        .eq("id", input.moduloId)
        .eq("empresa_id", professorEmpresaIdUpdate)
        .maybeSingle();

      if (moduloCheckError || !moduloCheck) {
        throw new Error("Módulo não encontrado ou não pertence à sua empresa.");
      }
      const moduloEmpresaId =
        (moduloCheck as { empresa_id?: string | null }).empresa_id ?? null;
      if (!moduloEmpresaId) {
        throw new Error("Módulo sem empresa_id (dados inconsistentes).");
      }
      updateData.modulo_id = input.moduloId;
      // Manter empresa_id do flashcard alinhado ao módulo
      updateData.empresa_id = moduloEmpresaId;
    }
    if (input.pergunta !== undefined) {
      if (!input.pergunta.trim()) {
        throw new Error("Pergunta não pode estar vazia.");
      }
      updateData.pergunta = input.pergunta.trim();
    }
    if (input.resposta !== undefined) {
      if (!input.resposta.trim()) {
        throw new Error("Resposta não pode estar vazia.");
      }
      updateData.resposta = input.resposta.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const { data: flashcard, error } = await this.client
      .from("flashcards")
      .update(updateData)
      .eq("id", id)
      .select("id, modulo_id, pergunta, resposta, created_at")
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar flashcard: ${error.message}`);
    }

    // Buscar módulo com relacionamentos
    const { data: modulo, error: moduloFetchError } = await this.client
      .from("modulos")
      .select(
        `
        id,
        nome,
        numero_modulo,
        frentes!inner(
          id,
          nome,
          disciplinas!inner(
            id,
            nome
          )
        )
      `,
      )
      .eq("id", flashcard.modulo_id ?? "")
      .maybeSingle();

    if (moduloFetchError || !modulo || !flashcard.modulo_id) {
      throw new Error(
        `Erro ao buscar módulo: ${moduloFetchError?.message || "Módulo não encontrado"}`,
      );
    }

    const result = {
      id: flashcard.id,
      modulo_id: flashcard.modulo_id,
      pergunta: flashcard.pergunta,
      resposta: flashcard.resposta,
      created_at: flashcard.created_at ?? new Date().toISOString(),
      modulo: {
        id: (modulo as unknown as ModuloWithNestedRelations).id,
        nome: (modulo as unknown as ModuloWithNestedRelations).nome,
        numero_modulo: (modulo as unknown as ModuloWithNestedRelations)
          .numero_modulo,
        frente: {
          id: (modulo as unknown as ModuloWithNestedRelations).frentes.id,
          nome: (modulo as unknown as ModuloWithNestedRelations).frentes.nome,
          disciplina: {
            id: (modulo as unknown as ModuloWithNestedRelations).frentes
              .disciplinas.id,
            nome: (modulo as unknown as ModuloWithNestedRelations).frentes
              .disciplinas.nome,
          },
        },
      },
    };

    // Invalidar cache (tanto do módulo antigo quanto do novo, se mudou)
    await this.invalidateFlashcardCache(
      professorEmpresaIdUpdate,
      (modulo as unknown as ModuloWithNestedRelations).frentes.disciplinas.id,
      (modulo as unknown as ModuloWithNestedRelations).frentes.id,
      flashcard.modulo_id,
    );

    // Se mudou de módulo, invalidar também o módulo antigo
    if (input.moduloId && input.moduloId !== existing.modulo_id) {
      await this.invalidateFlashcardCache(
        professorEmpresaIdUpdate,
        undefined,
        undefined,
        existing.modulo_id,
      );
    }

    return result;
  }

  async delete(id: string, userId: string, empresaId?: string): Promise<void> {
    const adminContext = await this.getAdminContext(userId, empresaId);

    // Verificar se flashcard existe
    const existing = await this.getById(id, userId, adminContext.empresaId);
    if (!existing) {
      throw new Error("Flashcard não encontrado.");
    }

    // Verificar se há progresso associado
    const { data: progresso, error: progressoError } = await this.client
      .from("progresso_flashcards")
      .select("id")
      .eq("flashcard_id", id)
      .limit(1);

    if (progressoError) {
      console.warn("[flashcards] Erro ao verificar progresso:", progressoError);
    }

    if (progresso && progresso.length > 0) {
      // Deletar progresso também (cascade)
      const { error: deleteProgressoError } = await this.client
        .from("progresso_flashcards")
        .delete()
        .eq("flashcard_id", id);

      if (deleteProgressoError) {
        console.warn(
          "[flashcards] Erro ao deletar progresso:",
          deleteProgressoError,
        );
      }
    }

    const { error } = await this.client
      .from("flashcards")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar flashcard: ${error.message}`);
    }

    // Invalidar cache (usar informações do existing que já tem a hierarquia)
    await this.invalidateFlashcardCache(
      adminContext.empresaId,
      existing.modulo.frente.disciplina.id,
      existing.modulo.frente.id,
      existing.modulo_id,
    );
  }
}

// Factory para evitar inicialização do cliente de banco na importação do módulo.
// Isso impede erros em build quando variáveis de ambiente do Supabase não estão configuradas,
// mas ainda garante que em tempo de execução o erro seja lançado se o banco não estiver configurado.
export const createFlashcardsService = () => new FlashcardsService();

// Singleton instance using lazy initialization proxy
let _flashcardsServiceInstance: FlashcardsService | null = null;

function getFlashcardsServiceInstance(): FlashcardsService {
  if (!_flashcardsServiceInstance) {
    _flashcardsServiceInstance = new FlashcardsService();
  }
  return _flashcardsServiceInstance;
}

/**
 * Singleton instance of FlashcardsService.
 * Uses lazy initialization to avoid errors during build when Supabase env vars are not set.
 */
export const flashcardsService = new Proxy({} as FlashcardsService, {
  get(_target, prop) {
    return getFlashcardsServiceInstance()[prop as keyof FlashcardsService];
  },
});
