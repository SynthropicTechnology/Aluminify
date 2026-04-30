import type { ParseContext } from "./types";

type ONode = Record<string, unknown>;

const UNICODE_TO_LATEX: Record<string, string> = {
  "±": "\\pm",
  "×": "\\times",
  "÷": "\\div",
  "∆": "\\Delta",
  "−": "-",
  "–": "-",
  "—": "--",
  "…": "\\ldots",
  "√": "\\sqrt{}",
  "∞": "\\infty",
  "≈": "\\approx",
  "≠": "\\neq",
  "≤": "\\leq",
  "≥": "\\geq",
  "≡": "\\equiv",
  "→": "\\rightarrow",
  "←": "\\leftarrow",
  "⇒": "\\Rightarrow",
  "⇐": "\\Leftarrow",
  "↔": "\\leftrightarrow",
  "∂": "\\partial",
  "∑": "\\sum",
  "∏": "\\prod",
  "∫": "\\int",
  "∩": "\\cap",
  "∪": "\\cup",
  "∈": "\\in",
  "∉": "\\notin",
  "⊂": "\\subset",
  "⊃": "\\supset",
  "⊆": "\\subseteq",
  "⊇": "\\supseteq",
  "∅": "\\emptyset",
  "∀": "\\forall",
  "∃": "\\exists",
  "°": "^{\\circ}",
  "α": "\\alpha",
  "β": "\\beta",
  "γ": "\\gamma",
  "δ": "\\delta",
  "ε": "\\varepsilon",
  "ζ": "\\zeta",
  "η": "\\eta",
  "θ": "\\theta",
  "ι": "\\iota",
  "κ": "\\kappa",
  "λ": "\\lambda",
  "μ": "\\mu",
  "ν": "\\nu",
  "ξ": "\\xi",
  "π": "\\pi",
  "ρ": "\\rho",
  "σ": "\\sigma",
  "τ": "\\tau",
  "υ": "\\upsilon",
  "φ": "\\varphi",
  "χ": "\\chi",
  "ψ": "\\psi",
  "ω": "\\omega",
  "Γ": "\\Gamma",
  "Δ": "\\Delta",
  "Θ": "\\Theta",
  "Λ": "\\Lambda",
  "Ξ": "\\Xi",
  "Π": "\\Pi",
  "Σ": "\\Sigma",
  "Φ": "\\Phi",
  "Ψ": "\\Psi",
  "Ω": "\\Omega",
};

const ACCENT_MAP: Record<string, string> = {
  "̂": "\\hat",
  "̃": "\\tilde",
  "̄": "\\bar",
  "̅": "\\overline",
  "̇": "\\dot",
  "̈": "\\ddot",
  "̌": "\\check",
  "⃗": "\\vec",
  "^": "\\hat",
  "~": "\\tilde",
  "¯": "\\bar",
};

const NARY_MAP: Record<string, string> = {
  "∑": "\\sum",
  "∏": "\\prod",
  "∫": "\\int",
  "∬": "\\iint",
  "∭": "\\iiint",
  "∮": "\\oint",
};

function escapeLatex(text: string): string {
  let result = "";
  for (const ch of text) {
    const mapped = UNICODE_TO_LATEX[ch];
    if (mapped) {
      result += mapped;
    } else {
      result += ch;
    }
  }
  return result;
}

function getChild(node: ONode, key: string): ONode | undefined {
  const val = node[key];
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as ONode;
  }
  if (Array.isArray(val) && val.length > 0) {
    return val[0] as ONode;
  }
  return undefined;
}

function getChildren(node: ONode, key: string): ONode[] {
  const val = node[key];
  if (Array.isArray(val)) return val as ONode[];
  if (val && typeof val === "object") return [val as ONode];
  return [];
}

function getAttr(node: ONode, attr: string): string | undefined {
  const val = node[`@_${attr}`] ?? node[`@_m:${attr}`] ?? node[`@_w:${attr}`];
  return val != null ? String(val) : undefined;
}

function extractText(node: ONode): string {
  if (typeof node === "string") return node;

  let result = "";

  const mt = node["m:t"];
  if (mt != null) {
    if (typeof mt === "string") result += mt;
    else if (typeof mt === "object" && mt !== null) {
      const inner = (mt as ONode)["#text"];
      if (inner != null) result += String(inner);
    }
  }

  for (const key of Object.keys(node)) {
    if (key === "m:t" || key.startsWith("@_")) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (typeof c === "object" && c !== null) result += extractText(c as ONode);
      }
    } else if (typeof child === "object" && child !== null) {
      result += extractText(child as ONode);
    }
  }

  return result;
}

function convertNode(node: ONode, ctx: ParseContext, questaoNum?: number): string {
  if (node["m:r"]) {
    const runs = getChildren(node, "m:r");
    return runs.map((r) => escapeLatex(extractText(r))).join("");
  }

  if (node["m:f"]) {
    const f = getChild(node, "m:f")!;
    const num = convertNode(getChild(f, "m:num") ?? {}, ctx, questaoNum);
    const den = convertNode(getChild(f, "m:den") ?? {}, ctx, questaoNum);
    return `\\frac{${num}}{${den}}`;
  }

  if (node["m:sSup"]) {
    const s = getChild(node, "m:sSup")!;
    const base = convertNode(getChild(s, "m:e") ?? {}, ctx, questaoNum);
    const sup = convertNode(getChild(s, "m:sup") ?? {}, ctx, questaoNum);
    return `{${base}}^{${sup}}`;
  }

  if (node["m:sSub"]) {
    const s = getChild(node, "m:sSub")!;
    const base = convertNode(getChild(s, "m:e") ?? {}, ctx, questaoNum);
    const sub = convertNode(getChild(s, "m:sub") ?? {}, ctx, questaoNum);
    return `{${base}}_{${sub}}`;
  }

  if (node["m:sSubSup"]) {
    const s = getChild(node, "m:sSubSup")!;
    const base = convertNode(getChild(s, "m:e") ?? {}, ctx, questaoNum);
    const sub = convertNode(getChild(s, "m:sub") ?? {}, ctx, questaoNum);
    const sup = convertNode(getChild(s, "m:sup") ?? {}, ctx, questaoNum);
    return `{${base}}_{${sub}}^{${sup}}`;
  }

  if (node["m:rad"]) {
    const r = getChild(node, "m:rad")!;
    const deg = getChild(r, "m:deg");
    const e = convertNode(getChild(r, "m:e") ?? {}, ctx, questaoNum);
    const radPr = getChild(r, "m:radPr");
    const degHide = radPr ? getAttr(getChild(radPr, "m:degHide") ?? {}, "val") : undefined;
    if (deg && degHide !== "1") {
      const degStr = convertNode(deg, ctx, questaoNum);
      if (degStr && degStr.trim()) {
        return `\\sqrt[${degStr}]{${e}}`;
      }
    }
    return `\\sqrt{${e}}`;
  }

  if (node["m:d"]) {
    const d = getChild(node, "m:d")!;
    const dPr = getChild(d, "m:dPr");
    let begChr = "(";
    let endChr = ")";
    if (dPr) {
      begChr = getAttr(getChild(dPr, "m:begChr") ?? {}, "val") ?? "(";
      endChr = getAttr(getChild(dPr, "m:endChr") ?? {}, "val") ?? ")";
    }
    const elements = getChildren(d, "m:e");
    const inner = elements.map((el) => convertNode(el, ctx, questaoNum)).join(", ");
    return `\\left${begChr} ${inner} \\right${endChr}`;
  }

  if (node["m:nary"]) {
    const n = getChild(node, "m:nary")!;
    const nPr = getChild(n, "m:naryPr");
    let sym = "\\sum";
    if (nPr) {
      const chr = getAttr(getChild(nPr, "m:chr") ?? {}, "val");
      if (chr && NARY_MAP[chr]) sym = NARY_MAP[chr];
    }
    const sub = convertNode(getChild(n, "m:sub") ?? {}, ctx, questaoNum);
    const sup = convertNode(getChild(n, "m:sup") ?? {}, ctx, questaoNum);
    const e = convertNode(getChild(n, "m:e") ?? {}, ctx, questaoNum);
    let result = sym;
    if (sub) result += `_{${sub}}`;
    if (sup) result += `^{${sup}}`;
    result += ` ${e}`;
    return result;
  }

  if (node["m:acc"]) {
    const a = getChild(node, "m:acc")!;
    const aPr = getChild(a, "m:accPr");
    const chr = aPr ? getAttr(getChild(aPr, "m:chr") ?? {}, "val") : undefined;
    const cmd = (chr && ACCENT_MAP[chr]) ?? "\\hat";
    const e = convertNode(getChild(a, "m:e") ?? {}, ctx, questaoNum);
    return `${cmd}{${e}}`;
  }

  if (node["m:bar"]) {
    const b = getChild(node, "m:bar")!;
    const bPr = getChild(b, "m:barPr");
    const pos = bPr ? getAttr(getChild(bPr, "m:pos") ?? {}, "val") : undefined;
    const e = convertNode(getChild(b, "m:e") ?? {}, ctx, questaoNum);
    return pos === "bot" ? `\\underline{${e}}` : `\\overline{${e}}`;
  }

  if (node["m:m"]) {
    const m = getChild(node, "m:m")!;
    const rows = getChildren(m, "m:mr");
    const rowStrs = rows.map((row) => {
      const cells = getChildren(row, "m:e");
      return cells.map((c) => convertNode(c, ctx, questaoNum)).join(" & ");
    });
    return `\\begin{pmatrix} ${rowStrs.join(" \\\\ ")} \\end{pmatrix}`;
  }

  if (node["m:eqArr"]) {
    const eq = getChild(node, "m:eqArr")!;
    const elements = getChildren(eq, "m:e");
    const lines = elements.map((el) => convertNode(el, ctx, questaoNum));
    return `\\begin{aligned} ${lines.join(" \\\\ ")} \\end{aligned}`;
  }

  if (node["m:func"]) {
    const f = getChild(node, "m:func")!;
    const fName = extractText(getChild(f, "m:fName") ?? {}).trim();
    const e = convertNode(getChild(f, "m:e") ?? {}, ctx, questaoNum);
    const knownFuncs: Record<string, string> = {
      sin: "\\sin", cos: "\\cos", tan: "\\tan",
      log: "\\log", ln: "\\ln", lim: "\\lim",
      max: "\\max", min: "\\min", sen: "\\operatorname{sen}",
      tg: "\\operatorname{tg}", cotg: "\\operatorname{cotg}",
    };
    const cmd = knownFuncs[fName.toLowerCase()] ?? `\\operatorname{${fName}}`;
    return `${cmd} ${e}`;
  }

  if (node["m:limLow"]) {
    const l = getChild(node, "m:limLow")!;
    const e = convertNode(getChild(l, "m:e") ?? {}, ctx, questaoNum);
    const lim = convertNode(getChild(l, "m:lim") ?? {}, ctx, questaoNum);
    return `${e}_{${lim}}`;
  }

  if (node["m:limUpp"]) {
    const l = getChild(node, "m:limUpp")!;
    const e = convertNode(getChild(l, "m:e") ?? {}, ctx, questaoNum);
    const lim = convertNode(getChild(l, "m:lim") ?? {}, ctx, questaoNum);
    return `${e}^{${lim}}`;
  }

  if (node["m:groupChr"]) {
    const g = getChild(node, "m:groupChr")!;
    const gPr = getChild(g, "m:groupChrPr");
    const pos = gPr ? getAttr(getChild(gPr, "m:pos") ?? {}, "val") : undefined;
    const e = convertNode(getChild(g, "m:e") ?? {}, ctx, questaoNum);
    return pos === "top" ? `\\overbrace{${e}}` : `\\underbrace{${e}}`;
  }

  if (node["m:box"] || node["m:borderBox"]) {
    const key = node["m:box"] ? "m:box" : "m:borderBox";
    const b = getChild(node, key)!;
    return convertNode(getChild(b, "m:e") ?? {}, ctx, questaoNum);
  }

  let parts = "";
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue;
    const children = getChildren(node, key);
    for (const child of children) {
      if (key === "m:r") {
        parts += escapeLatex(extractText(child));
      } else if (key.startsWith("m:")) {
        const wrapper: ONode = { [key]: child };
        parts += convertNode(wrapper, ctx, questaoNum);
      }
    }
  }

  if (!parts) {
    const raw = extractText(node);
    if (raw) {
      ctx.warnings.push({
        questao: questaoNum,
        code: "OMML_FALLBACK",
        message: `Conversao OMML parcial, texto extraido como fallback`,
      });
      return `\\text{${escapeLatex(raw)}}`;
    }
  }

  return parts;
}

export function ommlToLatex(
  ommlNode: Record<string, unknown>,
  ctx: ParseContext,
  questaoNum?: number,
): string {
  return convertNode(ommlNode, ctx, questaoNum).trim();
}
