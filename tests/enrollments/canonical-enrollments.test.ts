import {
  mergeCanonicalEnrollments,
  type CourseLinkRow,
  type MatriculaRow,
} from "@/app/shared/core/enrollments/canonical-enrollments";

function courseLink(
  usuarioId: string,
  cursoId: string,
  empresaId: string,
): CourseLinkRow {
  return {
    usuario_id: usuarioId,
    curso_id: cursoId,
    cursos: { empresa_id: empresaId },
  };
}

function matricula(params: {
  id: string;
  usuarioId: string;
  cursoId: string;
  empresaId: string;
  ativo?: boolean;
  inicio?: string;
  fim?: string;
}): MatriculaRow {
  return {
    id: params.id,
    usuario_id: params.usuarioId,
    curso_id: params.cursoId,
    empresa_id: params.empresaId,
    ativo: params.ativo ?? true,
    data_inicio_acesso: params.inicio ?? "2026-01-01",
    data_fim_acesso: params.fim ?? "2026-12-31",
  };
}

describe("mergeCanonicalEnrollments", () => {
  it("mantem vinculo legado de alunos_cursos como ativo quando nao ha matricula formal", () => {
    const result = mergeCanonicalEnrollments(
      [courseLink("u1", "c1", "e1")],
      [],
      { dataRef: "2026-05-30" },
    );

    expect(result).toEqual([
      expect.objectContaining({
        usuarioId: "u1",
        cursoId: "c1",
        empresaId: "e1",
        hasAlunosCursos: true,
        hasMatricula: false,
        active: true,
      }),
    ]);
  });

  it("desativa o par quando existe matricula formal inativa para o vinculo operacional", () => {
    const result = mergeCanonicalEnrollments(
      [courseLink("u1", "c1", "e1")],
      [
        matricula({
          id: "m1",
          usuarioId: "u1",
          cursoId: "c1",
          empresaId: "e1",
          ativo: false,
        }),
      ],
      { dataRef: "2026-05-30" },
    );

    expect(result).toHaveLength(0);
  });

  it("inclui matricula ativa sem alunos_cursos para nao perder acesso durante transicao", () => {
    const result = mergeCanonicalEnrollments(
      [],
      [
        matricula({
          id: "m1",
          usuarioId: "u2",
          cursoId: "c2",
          empresaId: "e1",
        }),
      ],
      { dataRef: "2026-05-30" },
    );

    expect(result).toEqual([
      expect.objectContaining({
        usuarioId: "u2",
        cursoId: "c2",
        hasAlunosCursos: false,
        hasMatricula: true,
        active: true,
      }),
    ]);
  });

  it("remove matriculas fora da vigencia no modo ativo", () => {
    const result = mergeCanonicalEnrollments(
      [],
      [
        matricula({
          id: "m1",
          usuarioId: "u2",
          cursoId: "c2",
          empresaId: "e1",
          fim: "2026-04-30",
        }),
      ],
      { dataRef: "2026-05-30" },
    );

    expect(result).toHaveLength(0);
  });
});
