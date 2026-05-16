import type { ParseContext } from "./types";

type ONode = Record<string, unknown>;
type OrderedMathChild = { key: string; node: ONode };

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
  "∘": "\\circ",
  "△": "\\triangle",
  "▲": "\\blacktriangle",
  "∴": "\\therefore",
  "∵": "\\because",
  "⋅": "\\cdot",
  "⊥": "\\perp",
  "∥": "\\parallel",
  "∠": "\\angle",
  "​": "",
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

// Word uses Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF) for styled
// characters inside math zones. Map them back to plain ASCII/LaTeX equivalents.
function mapMathAlphanumeric(cp: number): string | null {
  // Mathematical Bold Capital A-Z: U+1D400–U+1D419
  if (cp >= 0x1D400 && cp <= 0x1D419) return String.fromCharCode(65 + cp - 0x1D400);
  // Mathematical Bold Small a-z: U+1D41A–U+1D433
  if (cp >= 0x1D41A && cp <= 0x1D433) return String.fromCharCode(97 + cp - 0x1D41A);
  // Mathematical Italic Capital A-Z: U+1D434–U+1D44D
  if (cp >= 0x1D434 && cp <= 0x1D44D) return String.fromCharCode(65 + cp - 0x1D434);
  // Mathematical Italic Small a-z: U+1D44E–U+1D467 (h at U+1D455 is missing in Unicode, mapped to ℎ)
  if (cp >= 0x1D44E && cp <= 0x1D467) return String.fromCharCode(97 + cp - 0x1D44E);
  // Mathematical Bold Italic Capital A-Z: U+1D468–U+1D481
  if (cp >= 0x1D468 && cp <= 0x1D481) return String.fromCharCode(65 + cp - 0x1D468);
  // Mathematical Bold Italic Small a-z: U+1D482–U+1D49B
  if (cp >= 0x1D482 && cp <= 0x1D49B) return String.fromCharCode(97 + cp - 0x1D482);
  // Mathematical Sans-Serif Capital A-Z: U+1D5A0–U+1D5B9
  if (cp >= 0x1D5A0 && cp <= 0x1D5B9) return String.fromCharCode(65 + cp - 0x1D5A0);
  // Mathematical Sans-Serif Small a-z: U+1D5BA–U+1D5D3
  if (cp >= 0x1D5BA && cp <= 0x1D5D3) return String.fromCharCode(97 + cp - 0x1D5BA);
  // Mathematical Bold Greek Capital Α-Ω: U+1D6A8–U+1D6C0
  if (cp >= 0x1D6A8 && cp <= 0x1D6C0) {
    const greekCaps = "\\Alpha\\Beta\\Gamma\\Delta\\Epsilon\\Zeta\\Eta\\Theta\\Iota\\Kappa\\Lambda\\Mu\\Nu\\Xi\\Omicron\\Pi\\Rho\\varTheta\\Sigma\\Tau\\Upsilon\\Phi\\Chi\\Psi\\Omega".split("\\").filter(Boolean);
    const idx = cp - 0x1D6A8;
    return idx < greekCaps.length ? `\\${greekCaps[idx]}` : null;
  }
  // Mathematical Bold Greek Small α-ω: U+1D6C2–U+1D6DA
  if (cp >= 0x1D6C2 && cp <= 0x1D6DA) {
    const greekSmall = "\\alpha\\beta\\gamma\\delta\\varepsilon\\zeta\\eta\\theta\\iota\\kappa\\lambda\\mu\\nu\\xi\\omicron\\pi\\rho\\varsigma\\sigma\\tau\\upsilon\\varphi\\chi\\psi\\omega".split("\\").filter(Boolean);
    const idx = cp - 0x1D6C2;
    return idx < greekSmall.length ? `\\${greekSmall[idx]}` : null;
  }
  // Mathematical Italic Greek Capital Α-Ω: U+1D6E2–U+1D6FA
  if (cp >= 0x1D6E2 && cp <= 0x1D6FA) {
    const greekCaps = "\\Alpha\\Beta\\Gamma\\Delta\\Epsilon\\Zeta\\Eta\\Theta\\Iota\\Kappa\\Lambda\\Mu\\Nu\\Xi\\Omicron\\Pi\\Rho\\varTheta\\Sigma\\Tau\\Upsilon\\Phi\\Chi\\Psi\\Omega".split("\\").filter(Boolean);
    const idx = cp - 0x1D6E2;
    return idx < greekCaps.length ? `\\${greekCaps[idx]}` : null;
  }
  // Mathematical Italic Greek Small α-ω: U+1D6FC–U+1D714
  if (cp >= 0x1D6FC && cp <= 0x1D714) {
    const greekSmall = "\\alpha\\beta\\gamma\\delta\\varepsilon\\zeta\\eta\\theta\\iota\\kappa\\lambda\\mu\\nu\\xi\\omicron\\pi\\rho\\varsigma\\sigma\\tau\\upsilon\\varphi\\chi\\psi\\omega".split("\\").filter(Boolean);
    const idx = cp - 0x1D6FC;
    return idx < greekSmall.length ? `\\${greekSmall[idx]}` : null;
  }
  // Mathematical Bold Digits 0-9: U+1D7CE–U+1D7D7
  if (cp >= 0x1D7CE && cp <= 0x1D7D7) return String(cp - 0x1D7CE);
  // Mathematical Double-Struck Digits 0-9: U+1D7D8–U+1D7E1
  if (cp >= 0x1D7D8 && cp <= 0x1D7E1) return String(cp - 0x1D7D8);
  // Mathematical Sans-Serif Digits 0-9: U+1D7E2–U+1D7EB
  if (cp >= 0x1D7E2 && cp <= 0x1D7EB) return String(cp - 0x1D7E2);
  // Mathematical Monospace Digits 0-9: U+1D7F6–U+1D7FF
  if (cp >= 0x1D7F6 && cp <= 0x1D7FF) return String(cp - 0x1D7F6);
  // ℎ (U+210E) — Planck constant, used as math italic h
  if (cp === 0x210E) return "h";
  return null;
}

function escapeLatex(text: string): string {
  const chars = [...text];
  let result = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    let mapped: string | undefined = UNICODE_TO_LATEX[ch];
    if (mapped === undefined) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined && cp > 0xFFFF) {
        mapped = mapMathAlphanumeric(cp) ?? undefined;
      }
    }
    if (mapped !== undefined) {
      result += mapped;
      if (mapped.startsWith("\\") && /^[a-zA-Z]/.test(mapped.slice(1))) {
        const next = chars[i + 1];
        if (next && /[a-zA-Z]/.test(next)) {
          result += " ";
        }
      }
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

function getOrderedChildren(node: ONode): OrderedMathChild[] {
  const children = node.__children;
  if (!Array.isArray(children)) return [];
  return children.filter((child): child is OrderedMathChild => (
    child != null &&
    typeof child === "object" &&
    "key" in child &&
    "node" in child &&
    typeof (child as OrderedMathChild).key === "string" &&
    (child as OrderedMathChild).node != null &&
    typeof (child as OrderedMathChild).node === "object"
  ));
}

function extractText(node: ONode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);

  let result = "";

  const mt = node["m:t"];
  if (mt != null) {
    if (typeof mt === "string" || typeof mt === "number" || typeof mt === "boolean") {
      result += String(mt);
    } else if (typeof mt === "object" && mt !== null) {
      const inner = (mt as ONode)["#text"];
      if (inner != null) result += String(inner);
    }
  }

  for (const key of Object.keys(node)) {
    if (
      key === "m:t" ||
      key === "__children" ||
      key.startsWith("@_") ||
      key.startsWith("w:")
    ) {
      continue;
    }
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c != null && typeof c === "object") result += extractText(c as ONode);
        else if (c != null) result += String(c);
      }
    } else if (typeof child === "object" && child !== null) {
      result += extractText(child as ONode);
    } else if (child != null && typeof child !== "function") {
      result += String(child);
    }
  }

  return result;
}

const MAX_DEPTH = 20;

const NON_STRUCTURAL_KEYS = new Set([
  "m:rPr", "m:t", "m:ctrlPr", "m:sSubPr", "m:sSupPr", "m:sSubSupPr",
  "m:fPr", "m:radPr", "m:dPr", "m:naryPr", "m:accPr", "m:barPr",
  "m:mPr", "m:eqArrPr", "m:funcPr", "m:limLowPr", "m:limUppPr",
  "m:groupChrPr", "m:boxPr", "m:borderBoxPr", "m:oMathParaPr",
]);

function convertSingleElement(key: string, node: ONode, ctx: ParseContext, questaoNum: number | undefined, depth: number): string | null {
  if (key === "m:oMath" || key === "m:oMathPara") {
    const mathNode = getChild(node, key);
    return mathNode ? convertNode(mathNode, ctx, questaoNum, depth + 1) : "";
  }

  if (key === "m:r") {
    const runs = getChildren(node, "m:r");
    let acc = "";
    for (const r of runs) {
      const fragment = escapeLatex(extractText(r));
      if (fragment && acc && /\\[a-zA-Z]+$/.test(acc) && /^[a-zA-Z]/.test(fragment)) {
        acc += " ";
      }
      acc += fragment;
    }
    return acc;
  }

  if (key === "m:f") {
    const f = getChild(node, "m:f")!;
    const num = convertNode(getChild(f, "m:num") ?? {}, ctx, questaoNum, depth + 1);
    const den = convertNode(getChild(f, "m:den") ?? {}, ctx, questaoNum, depth + 1);
    return `\\frac{${num}}{${den}}`;
  }

  if (key === "m:sSup") {
    const s = getChild(node, "m:sSup")!;
    const base = convertNode(getChild(s, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const sup = convertNode(getChild(s, "m:sup") ?? {}, ctx, questaoNum, depth + 1);
    return `{${base}}^{${sup}}`;
  }

  if (key === "m:sSub") {
    const s = getChild(node, "m:sSub")!;
    const base = convertNode(getChild(s, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const sub = convertNode(getChild(s, "m:sub") ?? {}, ctx, questaoNum, depth + 1);
    return `{${base}}_{${sub}}`;
  }

  if (key === "m:sSubSup") {
    const s = getChild(node, "m:sSubSup")!;
    const base = convertNode(getChild(s, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const sub = convertNode(getChild(s, "m:sub") ?? {}, ctx, questaoNum, depth + 1);
    const sup = convertNode(getChild(s, "m:sup") ?? {}, ctx, questaoNum, depth + 1);
    return `{${base}}_{${sub}}^{${sup}}`;
  }

  if (key === "m:rad") {
    const r = getChild(node, "m:rad")!;
    const deg = getChild(r, "m:deg");
    const e = convertNode(getChild(r, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const radPr = getChild(r, "m:radPr");
    const degHide = radPr ? getAttr(getChild(radPr, "m:degHide") ?? {}, "val") : undefined;
    if (deg && degHide !== "1") {
      const degStr = convertNode(deg, ctx, questaoNum, depth + 1);
      if (degStr && degStr.trim()) {
        return `\\sqrt[${degStr}]{${e}}`;
      }
    }
    return `\\sqrt{${e}}`;
  }

  if (key === "m:d") {
    const d = getChild(node, "m:d")!;
    const dPr = getChild(d, "m:dPr");
    let begChr = "(";
    let endChr = ")";
    if (dPr) {
      begChr = getAttr(getChild(dPr, "m:begChr") ?? {}, "val") ?? "(";
      endChr = getAttr(getChild(dPr, "m:endChr") ?? {}, "val") ?? ")";
    }
    const leftDel = begChr || ".";
    const rightDel = endChr || ".";
    const elements = getChildren(d, "m:e");
    const inner = elements.map((el) => convertNode(el, ctx, questaoNum, depth + 1)).join(", ");
    return `\\left${leftDel} ${inner} \\right${rightDel}`;
  }

  if (key === "m:nary") {
    const n = getChild(node, "m:nary")!;
    const nPr = getChild(n, "m:naryPr");
    let sym = "\\sum";
    if (nPr) {
      const chr = getAttr(getChild(nPr, "m:chr") ?? {}, "val");
      if (chr && NARY_MAP[chr]) sym = NARY_MAP[chr];
    }
    const sub = convertNode(getChild(n, "m:sub") ?? {}, ctx, questaoNum, depth + 1);
    const sup = convertNode(getChild(n, "m:sup") ?? {}, ctx, questaoNum, depth + 1);
    const e = convertNode(getChild(n, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    let result = sym;
    if (sub) result += `_{${sub}}`;
    if (sup) result += `^{${sup}}`;
    result += ` ${e}`;
    return result;
  }

  if (key === "m:acc") {
    const a = getChild(node, "m:acc")!;
    const aPr = getChild(a, "m:accPr");
    const chr = aPr ? getAttr(getChild(aPr, "m:chr") ?? {}, "val") : undefined;
    const cmd = (chr && ACCENT_MAP[chr]) ?? "\\hat";
    const e = convertNode(getChild(a, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    return `${cmd}{${e}}`;
  }

  if (key === "m:bar") {
    const b = getChild(node, "m:bar")!;
    const bPr = getChild(b, "m:barPr");
    const pos = bPr ? getAttr(getChild(bPr, "m:pos") ?? {}, "val") : undefined;
    const e = convertNode(getChild(b, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    return pos === "bot" ? `\\underline{${e}}` : `\\overline{${e}}`;
  }

  if (key === "m:m") {
    const m = getChild(node, "m:m")!;
    const rows = getChildren(m, "m:mr");
    const rowStrs = rows.map((row) => {
      const cells = getChildren(row, "m:e");
      return cells.map((c) => convertNode(c, ctx, questaoNum, depth + 1)).join(" & ");
    });
    return `\\begin{pmatrix} ${rowStrs.join(" \\\\ ")} \\end{pmatrix}`;
  }

  if (key === "m:eqArr") {
    const eq = getChild(node, "m:eqArr")!;
    const elements = getChildren(eq, "m:e");
    const lines = elements.map((el) => convertNode(el, ctx, questaoNum, depth + 1));
    return `\\begin{aligned} ${lines.join(" \\\\ ")} \\end{aligned}`;
  }

  if (key === "m:func") {
    const f = getChild(node, "m:func")!;
    const fName = extractText(getChild(f, "m:fName") ?? {}).trim();
    const e = convertNode(getChild(f, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const knownFuncs: Record<string, string> = {
      sin: "\\sin", cos: "\\cos", tan: "\\tan",
      log: "\\log", ln: "\\ln", lim: "\\lim",
      max: "\\max", min: "\\min", sen: "\\operatorname{sen}",
      tg: "\\operatorname{tg}", cotg: "\\operatorname{cotg}",
    };
    const cmd = knownFuncs[fName.toLowerCase()] ?? `\\operatorname{${fName}}`;
    return `${cmd} ${e}`;
  }

  if (key === "m:limLow") {
    const l = getChild(node, "m:limLow")!;
    const e = convertNode(getChild(l, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const lim = convertNode(getChild(l, "m:lim") ?? {}, ctx, questaoNum, depth + 1);
    return `${e}_{${lim}}`;
  }

  if (key === "m:limUpp") {
    const l = getChild(node, "m:limUpp")!;
    const e = convertNode(getChild(l, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    const lim = convertNode(getChild(l, "m:lim") ?? {}, ctx, questaoNum, depth + 1);
    return `${e}^{${lim}}`;
  }

  if (key === "m:groupChr") {
    const g = getChild(node, "m:groupChr")!;
    const gPr = getChild(g, "m:groupChrPr");
    const pos = gPr ? getAttr(getChild(gPr, "m:pos") ?? {}, "val") : undefined;
    const e = convertNode(getChild(g, "m:e") ?? {}, ctx, questaoNum, depth + 1);
    return pos === "top" ? `\\overbrace{${e}}` : `\\underbrace{${e}}`;
  }

  if (key === "m:box" || key === "m:borderBox") {
    const b = getChild(node, key)!;
    return convertNode(getChild(b, "m:e") ?? {}, ctx, questaoNum, depth + 1);
  }

  return null;
}

function convertNode(node: ONode, ctx: ParseContext, questaoNum?: number, depth = 0): string {
  if (depth > MAX_DEPTH) {
    const raw = extractText(node);
    return raw ? escapeLatex(raw) : "";
  }

  const orderedChildren = getOrderedChildren(node);
  if (orderedChildren.length > 0) {
    let orderedParts = "";
    for (const child of orderedChildren) {
      if (NON_STRUCTURAL_KEYS.has(child.key)) continue;
      let fragment = "";
      if (child.key === "m:r") {
        fragment = escapeLatex(extractText(child.node));
      } else if (child.key.startsWith("m:")) {
        fragment = convertNode({ [child.key]: child.node }, ctx, questaoNum, depth + 1);
      }
      if (fragment && orderedParts && /\\[a-zA-Z]+$/.test(orderedParts) && /^[a-zA-Z]/.test(fragment)) {
        orderedParts += " ";
      }
      orderedParts += fragment;
    }
    if (orderedParts) return orderedParts;
  }

  const structKeys = Object.keys(node).filter(
    (k) => k.startsWith("m:") && !NON_STRUCTURAL_KEYS.has(k),
  );

  if (structKeys.length === 1) {
    const result = convertSingleElement(structKeys[0], node, ctx, questaoNum, depth);
    if (result !== null) return result;
  }

  let parts = "";
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text" || key === "__children") continue;
    if (NON_STRUCTURAL_KEYS.has(key)) continue;
    const children = getChildren(node, key);
    for (const child of children) {
      let fragment = "";
      if (key === "m:r") {
        fragment = escapeLatex(extractText(child));
      } else if (key.startsWith("m:")) {
        const wrapper: ONode = { [key]: child };
        fragment = convertNode(wrapper, ctx, questaoNum, depth + 1);
      }
      if (fragment && parts && /\\[a-zA-Z]+$/.test(parts) && /^[a-zA-Z]/.test(fragment)) {
        parts += " ";
      }
      parts += fragment;
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

function normalizeLatex(latex: string): string {
  return latex
    .replace(/1\{0\}\^\{([^}]+)\}/g, "10^{$1}")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+?)\s+\}/g, "\\frac{$1}{$2}")
    .trim();
}

export function ommlToLatex(
  ommlNode: Record<string, unknown>,
  ctx: ParseContext,
  questaoNum?: number,
): string {
  return normalizeLatex(convertNode(ommlNode, ctx, questaoNum, 0));
}
