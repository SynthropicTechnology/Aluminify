import { z } from "zod";

const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({
    type: z.literal("image"),
    storagePath: z.string(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({ type: z.literal("math"), latex: z.string() }),
]);

const letraAlternativa = z.enum(["a", "b", "c", "d", "e"]);
const letraGabarito = z.enum(["A", "B", "C", "D", "E"]);
const dificuldade = z.enum(["facil", "medio", "dificil"]);

export const createQuestaoSchema = z.object({
  numeroOriginal: z.number().int().nullable().optional(),
  instituicao: z.string().nullable().optional(),
  ano: z.number().int().nullable().optional(),
  disciplina: z.string().nullable().optional(),
  disciplinaId: z.string().uuid().nullable().optional(),
  frenteId: z.string().uuid().nullable().optional(),
  moduloId: z.string().uuid().nullable().optional(),
  dificuldade: dificuldade.nullable().optional(),
  textoBase: z.array(contentBlockSchema).nullable().optional(),
  enunciado: z.array(contentBlockSchema).min(1),
  gabarito: letraGabarito,
  resolucaoTexto: z.array(contentBlockSchema).nullable().optional(),
  resolucaoVideoUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  areaConhecimento: z.string().nullable().optional(),
  competenciasEnem: z.array(z.string()).optional(),
  habilidadesEnem: z.array(z.string()).optional(),
  importacaoJobId: z.string().uuid().nullable().optional(),
  alternativas: z
    .array(
      z.object({
        letra: letraAlternativa,
        texto: z.string(),
        imagemPath: z.string().nullable().optional(),
      }),
    )
    .min(2)
    .max(5),
});

export const updateQuestaoSchema = z.object({
  numeroOriginal: z.number().int().nullable().optional(),
  instituicao: z.string().nullable().optional(),
  ano: z.number().int().nullable().optional(),
  disciplina: z.string().nullable().optional(),
  disciplinaId: z.string().uuid().nullable().optional(),
  frenteId: z.string().uuid().nullable().optional(),
  moduloId: z.string().uuid().nullable().optional(),
  dificuldade: dificuldade.nullable().optional(),
  textoBase: z.array(contentBlockSchema).nullable().optional(),
  enunciado: z.array(contentBlockSchema).min(1).optional(),
  gabarito: letraGabarito.optional(),
  resolucaoTexto: z.array(contentBlockSchema).nullable().optional(),
  resolucaoVideoUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  areaConhecimento: z.string().nullable().optional(),
  competenciasEnem: z.array(z.string()).optional(),
  habilidadesEnem: z.array(z.string()).optional(),
  alternativas: z
    .array(
      z.object({
        letra: letraAlternativa,
        texto: z.string(),
        imagemPath: z.string().nullable().optional(),
      }),
    )
    .min(2)
    .max(5)
    .optional(),
});
