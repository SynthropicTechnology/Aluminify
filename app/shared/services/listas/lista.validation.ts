import { z } from "zod";

export const createListaSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().nullable().optional(),
  tipo: z.enum(["exercicio", "simulado", "outro"]).optional(),
  modosCorrecaoPermitidos: z.enum(["por_questao", "ao_final", "ambos"]).optional(),
  embaralharQuestoes: z.boolean().optional(),
  embaralharAlternativas: z.boolean().optional(),
  atividadeId: z.string().uuid().nullable().optional(),
  questaoIds: z.array(z.string().uuid()).optional(),
});

export const updateListaSchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().nullable().optional(),
  tipo: z.enum(["exercicio", "simulado", "outro"]).optional(),
  modosCorrecaoPermitidos: z.enum(["por_questao", "ao_final", "ambos"]).optional(),
  embaralharQuestoes: z.boolean().optional(),
  embaralharAlternativas: z.boolean().optional(),
  atividadeId: z.string().uuid().nullable().optional(),
});

export const addQuestoesSchema = z.object({
  questaoIds: z.array(z.string().uuid()).min(1),
});

export const reorderQuestoesSchema = z.object({
  ordens: z
    .array(
      z.object({
        questaoId: z.string().uuid(),
        ordem: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const responderSchema = z.object({
  questaoId: z.string().uuid(),
  alternativaEscolhida: z.enum(["a", "b", "c", "d", "e"]),
  tempoRespostaSegundos: z.number().int().min(0).nullable().optional(),
  alternativasRiscadas: z
    .array(z.enum(["a", "b", "c", "d", "e"]))
    .optional(),
  modo: z.enum(["por_questao", "ao_final"]).optional(),
});
