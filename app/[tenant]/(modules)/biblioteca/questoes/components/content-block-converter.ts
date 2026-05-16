import type { JSONContent } from "@tiptap/react"

export interface ContentBlock {
  type: "paragraph" | "image" | "math"
  text?: string
  storagePath?: string
  alt?: string
  width?: number
  height?: number
  latex?: string
}

export function blocksToTiptapDoc(
  blocks: Array<Record<string, unknown>>,
  resolveImageSrc: (storagePath: string) => string,
): JSONContent {
  if (!blocks || blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] }
  }

  const content: JSONContent[] = []

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph": {
        const text = (block.text as string) ?? ""
        content.push({
          type: "paragraph",
          content: text ? parseInlineContent(text) : undefined,
        })
        break
      }
      case "image": {
        const storagePath = block.storagePath as string
        content.push({
          type: "image",
          attrs: {
            src: resolveImageSrc(storagePath),
            alt: (block.alt as string) ?? null,
            width: (block.width as number) ?? null,
            height: (block.height as number) ?? null,
            "data-storage-path": storagePath,
          },
        })
        break
      }
      case "math": {
        content.push({
          type: "codeBlock",
          attrs: { language: "latex" },
          content: [{ type: "text", text: (block.latex as string) ?? "" }],
        })
        break
      }
    }
  }

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  }
}

function parseInlineContent(text: string): JSONContent[] {
  const nodes: JSONContent[] = []
  const boldRegex = /(\*\*[^*]+\*\*)/g
  const segments = text.split(boldRegex)

  for (const segment of segments) {
    if (!segment) continue
    if (segment.startsWith("**") && segment.endsWith("**")) {
      const inner = segment.slice(2, -2)
      if (inner) {
        nodes.push({ type: "text", text: inner, marks: [{ type: "bold" }] })
      }
    } else {
      nodes.push({ type: "text", text: segment })
    }
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text: "" }]
}

export function tiptapDocToBlocks(
  doc: JSONContent,
): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = []

  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "paragraph": {
        const text = extractParagraphText(node)
        if (text !== undefined) {
          blocks.push({ type: "paragraph", text })
        }
        break
      }
      case "image": {
        const storagePath =
          (node.attrs?.["data-storage-path"] as string) ??
          (node.attrs?.src as string) ??
          ""
        blocks.push({
          type: "image",
          storagePath,
          ...(node.attrs?.alt ? { alt: node.attrs.alt as string } : {}),
          ...(node.attrs?.width ? { width: node.attrs.width as number } : {}),
          ...(node.attrs?.height ? { height: node.attrs.height as number } : {}),
        })
        break
      }
      case "codeBlock": {
        if (node.attrs?.language === "latex") {
          const latex = node.content?.[0]?.text ?? ""
          if (latex) {
            blocks.push({ type: "math", latex })
          }
        }
        break
      }
    }
  }

  return blocks
}

function extractParagraphText(node: JSONContent): string | undefined {
  if (!node.content || node.content.length === 0) return ""

  const parts: string[] = []

  for (const child of node.content) {
    if (child.type !== "text" || !child.text) continue
    const hasBold = child.marks?.some((m) => m.type === "bold")
    if (hasBold) {
      parts.push(`**${child.text}**`)
    } else {
      parts.push(child.text)
    }
  }

  return parts.join("")
}
