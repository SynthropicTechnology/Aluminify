import { ommlToLatex } from "@/app/shared/library/parser/omml-to-latex";
import { splitQuestions } from "@/app/shared/library/parser/question-splitter";
import { plainText } from "@/app/shared/library/parser/types";
import type { RawParagraph, ParseContext } from "@/app/shared/library/parser/types";

function p(text: string, overrides?: Partial<RawParagraph>): RawParagraph {
  return {
    runs: [{ text }],
    ...overrides,
  };
}

function makeCtx(): ParseContext {
  return {
    warnings: [],
    images: new Map(),
    imageCounter: 0,
  };
}

describe("plainText", () => {
  it("deve concatenar runs de um paragrafo", () => {
    const para: RawParagraph = {
      runs: [
        { text: "Hello " },
        { text: "World" },
      ],
    };
    expect(plainText(para)).toBe("Hello World");
  });
});

describe("ommlToLatex", () => {
  it("deve converter fracao", () => {
    const node = {
      "m:f": {
        "m:num": { "m:r": { "m:t": "1" } },
        "m:den": { "m:r": { "m:t": "2" } },
      },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toBe("\\frac{1}{2}");
  });

  it("deve converter superscript", () => {
    const node = {
      "m:sSup": {
        "m:e": { "m:r": { "m:t": "x" } },
        "m:sup": { "m:r": { "m:t": "2" } },
      },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toBe("{x}^{2}");
  });

  it("deve converter subscript", () => {
    const node = {
      "m:sSub": {
        "m:e": { "m:r": { "m:t": "a" } },
        "m:sub": { "m:r": { "m:t": "n" } },
      },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toBe("{a}_{n}");
  });

  it("deve converter raiz quadrada", () => {
    const node = {
      "m:rad": {
        "m:radPr": { "m:degHide": { "@_val": "1" } },
        "m:e": { "m:r": { "m:t": "x" } },
      },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toBe("\\sqrt{x}");
  });

  it("deve converter raiz com indice", () => {
    const node = {
      "m:rad": {
        "m:deg": { "m:r": { "m:t": "3" } },
        "m:e": { "m:r": { "m:t": "8" } },
      },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toBe("\\sqrt[3]{8}");
  });

  it("deve converter letras gregas unicode", () => {
    const node = {
      "m:r": { "m:t": "α + β" },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toBe("\\alpha + \\beta");
  });

  it("deve emitir warning em fallback", () => {
    const node = {
      "m:unknownTag": { "m:r": { "m:t": "abc" } },
    };
    const ctx = makeCtx();
    const result = ommlToLatex(node, ctx);
    expect(result).toContain("abc");
  });
});

describe("splitQuestions", () => {
  it("deve extrair questoes numeradas com alternativas", () => {
    const paragraphs = [
      p("1. Qual a capital do Brasil?"),
      p("a) Sao Paulo"),
      p("b) Rio de Janeiro"),
      p("c) Brasilia"),
      p("d) Salvador"),
      p("e) Curitiba"),
      p("2. Qual o maior planeta?"),
      p("a) Terra"),
      p("b) Jupiter"),
      p("c) Marte"),
      p("d) Saturno"),
      p("e) Venus"),
      p("GABARITO"),
      p("1 - C"),
      p("2 - B"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(2);
    expect(result[0].numero).toBe(1);
    expect(result[0].alternativas).toHaveLength(5);
    expect(result[0].gabarito).toBe("C");
    expect(result[1].numero).toBe(2);
    expect(result[1].gabarito).toBe("B");
  });

  it("deve emitir warning quando gabarito nao encontrado", () => {
    const paragraphs = [
      p("1. Quanto e 2+2?"),
      p("a) 3"),
      p("b) 4"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].gabarito).toBe("A");
    expect(ctx.warnings.some((w) => w.code === "MISSING_GABARITO")).toBe(true);
  });

  it("deve emitir warning com poucas alternativas", () => {
    const paragraphs = [
      p("1. Pergunta?"),
      p("a) Opcao A"),
      p("b) Opcao B"),
      p("GABARITO"),
      p("1 - A"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(ctx.warnings.some((w) => w.code === "FEW_ALTERNATIVES")).toBe(true);
  });

  it("deve emitir warning sem questoes", () => {
    const ctx = makeCtx();
    const result = splitQuestions([p("Texto qualquer")], new Map(), ctx);

    expect(result).toHaveLength(0);
    expect(ctx.warnings.some((w) => w.code === "NO_QUESTIONS_FOUND")).toBe(true);
  });

  it("deve detectar questoes com QUESTÃO N", () => {
    const paragraphs = [
      p("QUESTÃO 1"),
      p("Qual e a resposta?"),
      p("a) X"),
      p("b) Y"),
      p("c) Z"),
      p("d) W"),
      p("GABARITO"),
      p("1 - B"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].numero).toBe(1);
    expect(result[0].gabarito).toBe("B");
  });

  it("deve detectar secao de resolucao", () => {
    const paragraphs = [
      p("1. Quanto e 1+1?"),
      p("a) 1"),
      p("b) 2"),
      p("c) 3"),
      p("d) 4"),
      p("RESOLUÇÃO"),
      p("1+1 = 2, portanto alternativa B."),
      p("GABARITO"),
      p("1 - B"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].resolucao).toHaveLength(1);
    expect(result[0].resolucao[0]).toEqual({
      type: "paragraph",
      text: "1+1 = 2, portanto alternativa B.",
    });
  });

  it("deve extrair Link de video de resolucao", () => {
    const paragraphs = [
      p("1. (Uerj 2026) Qual a resposta?"),
      p("a) 0,96"),
      p("b) 1,32"),
      p("c) 1,58"),
      p("d) 1,74"),
      p("Resposta: [C]"),
      p("A explicacao e simples."),
      p("Link: https://www.youtube.com/watch?v=mC7UdOoax-g"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].resolucaoVideoUrl).toBe("https://www.youtube.com/watch?v=mC7UdOoax-g");
    expect(result[0].resolucao).toHaveLength(1);
    expect(result[0].resolucao[0]).toEqual({
      type: "paragraph",
      text: "A explicacao e simples.",
    });
  });

  it("deve extrair Dificuldade do documento", () => {
    const paragraphs = [
      p("1. Pergunta simples?"),
      p("a) A"),
      p("b) B"),
      p("c) C"),
      p("d) D"),
      p("Resposta: [A]"),
      p("Resolucao aqui."),
      p("Dificuldade: Fácil"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].dificuldade).toBe("facil");
  });

  it("deve extrair Link e Dificuldade juntos", () => {
    const paragraphs = [
      p("1. (Enem 2024) Pergunta completa?"),
      p("a) Opcao A"),
      p("b) Opcao B"),
      p("c) Opcao C"),
      p("d) Opcao D"),
      p("e) Opcao E"),
      p("Resposta: [B]"),
      p("Explicacao detalhada da resolucao."),
      p("Link: https://youtu.be/abc123"),
      p("Dificuldade: Difícil"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].gabarito).toBe("B");
    expect(result[0].instituicao).toBe("Enem");
    expect(result[0].ano).toBe(2024);
    expect(result[0].resolucaoVideoUrl).toBe("https://youtu.be/abc123");
    expect(result[0].dificuldade).toBe("dificil");
    expect(result[0].resolucao).toHaveLength(1);
  });

  it("deve aceitar Dificuldade Médio", () => {
    const paragraphs = [
      p("1. Pergunta?"),
      p("a) A"),
      p("b) B"),
      p("c) C"),
      p("d) D"),
      p("Resposta: [C]"),
      p("Dificuldade: Médio"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].dificuldade).toBe("medio");
  });

  it("deve manter dificuldade null quando nao informada", () => {
    const paragraphs = [
      p("1. Pergunta?"),
      p("a) A"),
      p("b) B"),
      p("c) C"),
      p("d) D"),
      p("Resposta: [A]"),
    ];

    const ctx = makeCtx();
    const result = splitQuestions(paragraphs, new Map(), ctx);

    expect(result).toHaveLength(1);
    expect(result[0].dificuldade).toBeNull();
    expect(result[0].resolucaoVideoUrl).toBeNull();
  });
});
