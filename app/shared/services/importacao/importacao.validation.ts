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
      }),
    )
    .optional(),
  disciplina: z.string().nullable().optional(),
  moduloId: z.string().uuid().nullable().optional(),
});

export const publicarSchema = z.object({
  tipoAtividade: z.string().optional(),
  tituloLista: z.string().optional(),
  modoCorrecao: z.enum(["por_questao", "ao_final"]).optional(),
});
