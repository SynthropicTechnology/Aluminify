import { z } from "zod";

export const updateImportacaoSchema = z.object({
  questoesJson: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        instituicao: z.string().nullable().default(null),
        ano: z.number().int().nullable().default(null),
        dificuldade: z
          .enum(["facil", "medio", "dificil"])
          .nullable()
          .default(null),
        textoBase: z.array(z.record(z.unknown())).default([]),
        fonte: z.array(z.record(z.unknown())).nullable().optional(),
        enunciado: z.array(z.record(z.unknown())),
        alternativas: z.array(
          z.object({
            letra: z.enum(["a", "b", "c", "d", "e"]),
            texto: z.string(),
            imagemPath: z.string().nullable().optional(),
          }),
        ),
        gabarito: z.enum(["A", "B", "C", "D", "E"]),
        resolucao: z.array(z.record(z.unknown())).optional().default([]),
        disciplina: z.string().nullable().optional(),
        moduloConteudo: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        resolucaoVideoUrl: z.string().nullable().optional(),
      }),
    )
    .optional(),
  disciplina: z.string().nullable().optional(),
  disciplinaId: z.string().uuid().nullable().optional(),
  frenteId: z.string().uuid().nullable().optional(),
  moduloId: z.string().uuid().nullable().optional(),
  instituicaoPadrao: z.string().nullable().optional(),
  anoPadrao: z.number().int().nullable().optional(),
  dificuldadePadrao: z.enum(["facil", "medio", "dificil"]).nullable().optional(),
  tagsPadrao: z.array(z.string()).optional(),
});

export const publicarSchema = z.object({
  tipoAtividade: z.string().optional(),
  criarLista: z.boolean().optional().default(true),
  tituloLista: z.string().optional(),
  modosCorrecaoPermitidos: z.enum(["por_questao", "ao_final", "ambos"]).optional(),
});
