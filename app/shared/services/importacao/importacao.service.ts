import type {
  ImportacaoJob,
  UpdateImportacaoInput,
} from "@/app/shared/types/entities/importacao";
import type { ModosCorrecaoPermitidos } from "@/app/shared/types/entities/lista";
import type { CreateQuestaoInput } from "@/app/shared/types/entities/questao";
import type { ImportacaoRepository } from "./importacao.repository";
import type { QuestaoRepository } from "@/app/shared/services/questoes/questao.repository";
import type { ListaRepository } from "@/app/shared/services/listas/lista.repository";
import { parseDocx, DocxParseError } from "@/app/shared/library/parser";
import { ImportacaoNotFoundError, ImportacaoValidationError } from "./errors";
import { SupabaseClient } from "@supabase/supabase-js";

export class ImportacaoService {
  constructor(
    private readonly importacaoRepo: ImportacaoRepository,
    private readonly questaoRepo: QuestaoRepository,
    private readonly listaRepo: ListaRepository,
    private readonly client: SupabaseClient,
  ) {}

  async list(empresaId: string): Promise<ImportacaoJob[]> {
    if (!empresaId) {
      throw new ImportacaoValidationError("empresaId is required");
    }
    return this.importacaoRepo.list(empresaId);
  }

  async getById(id: string, empresaId?: string): Promise<ImportacaoJob> {
    const job = await this.importacaoRepo.findById(id);
    if (!job) throw new ImportacaoNotFoundError(id);
    if (empresaId && job.empresaId !== empresaId) {
      throw new ImportacaoNotFoundError(id);
    }
    return job;
  }

  async upload(
    empresaId: string,
    createdBy: string | null,
    filename: string,
    fileBuffer: Buffer,
  ): Promise<ImportacaoJob> {
    if (!empresaId) {
      throw new ImportacaoValidationError("empresaId is required");
    }
    if (!filename) {
      throw new ImportacaoValidationError("filename is required");
    }

    const storagePath = `importacoes/${empresaId}/${Date.now()}_${filename}`;
    const { error: uploadError } = await this.client.storage
      .from("questoes-assets")
      .upload(storagePath, fileBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const job = await this.importacaoRepo.create({
      empresaId,
      createdBy,
      originalFilename: filename,
      originalStoragePath: storagePath,
    });

    this.processAsync(job.id, fileBuffer).catch((err) => {
      console.error(`[Importacao] Background processing failed for ${job.id}:`, err);
    });

    return job;
  }

  async updateRevisao(
    id: string,
    input: UpdateImportacaoInput,
    empresaId?: string,
  ): Promise<ImportacaoJob> {
    const job = await this.getById(id, empresaId);
    if (job.status !== "revisao") {
      throw new ImportacaoValidationError(
        `Importacao com status '${job.status}' nao pode ser editada`,
      );
    }

    return this.importacaoRepo.updateQuestoesJson(
      id,
      input.questoesJson ?? job.questoesJson ?? [],
      {
        disciplina: input.disciplina,
        disciplinaId: input.disciplinaId,
        frenteId: input.frenteId,
        moduloId: input.moduloId,
        instituicaoPadrao: input.instituicaoPadrao,
        anoPadrao: input.anoPadrao,
        dificuldadePadrao: input.dificuldadePadrao,
        tagsPadrao: input.tagsPadrao,
      },
    );
  }

  async updateMetadata(
    id: string,
    meta: {
      disciplina?: string | null;
      disciplinaId?: string | null;
      frenteId?: string | null;
      moduloId?: string | null;
      instituicaoPadrao?: string | null;
      anoPadrao?: number | null;
      dificuldadePadrao?: string | null;
      tagsPadrao?: string[];
    },
    empresaId?: string,
  ): Promise<ImportacaoJob> {
    const job = await this.getById(id, empresaId);
    return this.importacaoRepo.updateMetadata(job.id, meta);
  }

  async publicar(
    id: string,
    empresaId: string,
    createdBy: string | null,
    options?: {
      tituloLista?: string;
      modosCorrecaoPermitidos?: ModosCorrecaoPermitidos;
    },
  ): Promise<ImportacaoJob> {
    const job = await this.getById(id, empresaId);
    if (job.status !== "revisao") {
      throw new ImportacaoValidationError(
        `Importacao com status '${job.status}' nao pode ser publicada`,
      );
    }

    const questoes = job.questoesJson;
    if (!questoes || questoes.length === 0) {
      throw new ImportacaoValidationError(
        "Nenhuma questao para publicar",
      );
    }

    const questaoIds: string[] = [];

    const resolvePending = (path: string) =>
      path.startsWith("pending:")
        ? `importacoes/images/${id}/${path.replace("pending:", "")}`
        : path;

    const resolveBlocks = (blocks: typeof questoes[0]["enunciado"]) =>
      blocks.map((b) =>
        b.type === "image"
          ? { ...b, storagePath: resolvePending(b.storagePath) }
          : b,
      );

    for (const q of questoes) {
      const tags: string[] = [...(q.tags ?? [])];
      if (q.moduloConteudo) tags.unshift(q.moduloConteudo);

      const input: CreateQuestaoInput = {
        empresaId,
        createdBy,
        numeroOriginal: q.numero,
        instituicao: q.instituicao ?? null,
        ano: q.ano ?? null,
        disciplina: q.disciplina ?? job.disciplina ?? null,
        disciplinaId: job.disciplinaId ?? null,
        frenteId: job.frenteId ?? null,
        moduloId: job.moduloId ?? null,
        dificuldade: q.dificuldade ?? null,
        textoBase: q.textoBase.length > 0 ? resolveBlocks(q.textoBase) : null,
        enunciado: resolveBlocks(q.enunciado),
        gabarito: q.gabarito,
        resolucaoTexto: q.resolucao.length > 0 ? resolveBlocks(q.resolucao) : null,
        resolucaoVideoUrl: q.resolucaoVideoUrl ?? null,
        tags,
        alternativas: q.alternativas.map((alt, idx) => ({
          letra: alt.letra,
          texto: alt.texto,
          imagemPath: alt.imagemPath ? resolvePending(alt.imagemPath) : null,
          ordem: idx,
        })),
        importacaoJobId: id,
      };

      const created = await this.questaoRepo.create(input);
      questaoIds.push(created.id);
    }

    const tituloLista =
      options?.tituloLista ??
      `${job.disciplina ?? "Questões"} - ${new Date().toLocaleDateString("pt-BR")}`;

    const lista = await this.listaRepo.create({
      empresaId,
      createdBy,
      titulo: tituloLista,
      modosCorrecaoPermitidos: options?.modosCorrecaoPermitidos ?? "por_questao",
    });

    await this.listaRepo.addQuestoes(lista.id, questaoIds, empresaId);

    return this.importacaoRepo.updateStatus(id, "publicado", {
      listaId: lista.id,
    });
  }

  async delete(id: string, empresaId?: string): Promise<void> {
    const job = await this.getById(id, empresaId);

    if (job.originalStoragePath) {
      await this.client.storage
        .from("questoes-assets")
        .remove([job.originalStoragePath]);
    }

    const { data: imageFiles } = await this.client.storage
      .from("questoes-assets")
      .list(`importacoes/images/${id}`);
    if (imageFiles && imageFiles.length > 0) {
      const paths = imageFiles.map(
        (f) => `importacoes/images/${id}/${f.name}`,
      );
      await this.client.storage.from("questoes-assets").remove(paths);
    }

    await this.importacaoRepo.delete(id);
  }

  private async processAsync(
    jobId: string,
    fileBuffer: Buffer,
  ): Promise<void> {
    try {
      const result = await parseDocx(fileBuffer);

      await this.importacaoRepo.updateStatus(jobId, "revisao", {
        questoesExtraidas: result.questoes.length,
        questoesJson: result.questoes,
        warnings: result.warnings,
      });

      if (result.images.size > 0) {
        await this.uploadParsedImages(jobId, result.images);
      }
    } catch (err) {
      const msg =
        err instanceof DocxParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erro desconhecido no processamento";

      await this.importacaoRepo.updateStatus(jobId, "erro", {
        errorMessage: msg,
      });
    }
  }

  private async uploadParsedImages(
    jobId: string,
    images: Map<string, Buffer>,
  ): Promise<void> {
    const extToMime: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      webp: "image/webp",
      emf: "image/x-emf",
      wmf: "image/x-wmf",
      tiff: "image/tiff",
      tif: "image/tiff",
    };
    for (const [key, data] of images) {
      if (!key.startsWith("q")) continue;
      const ext = key.split(".").pop()?.toLowerCase() ?? "png";
      const contentType = extToMime[ext] ?? "image/png";
      const storagePath = `importacoes/images/${jobId}/${key}`;
      await this.client.storage
        .from("questoes-assets")
        .upload(storagePath, data, {
          contentType,
          upsert: true,
        });
    }
  }
}
