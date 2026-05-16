"use client"

import * as React from "react"
import katex from "katex"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/app/shared/library/utils"

export function renderInlineTextFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

export function renderTextWithInlineMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$]+\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      const latex = part.slice(1, -1)
      try {
        const html = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        })
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      } catch {
        return <span key={i}>{latex}</span>
      }
    }
    return <React.Fragment key={i}>{renderInlineTextFormatting(part)}</React.Fragment>
  })
}

export function hasPreviewFormatting(text: string): boolean {
  return text.includes("$") || text.includes("**")
}

export function hasMediaBlocks(blocks: Array<Record<string, unknown>>): boolean {
  return blocks.some((b) => b.type === "image" || b.type === "math")
}

export function hasRichTextPreview(blocks: Array<Record<string, unknown>> | null | undefined): boolean {
  return (blocks ?? []).some((block) => {
    if (block.type !== "paragraph") return block.type === "image" || block.type === "math"
    const text = block.text as string
    return hasPreviewFormatting(text)
  })
}

interface ContentBlockPreviewProps {
  blocks: Array<Record<string, unknown>>
  resolveImageSrc: (storagePath: string) => string
  className?: string
  textClassName?: string
}

export function ContentBlockPreview({
  blocks,
  resolveImageSrc,
  className,
  textClassName = "text-sm",
}: ContentBlockPreviewProps) {
  if (!blocks || blocks.length === 0) return null

  return (
    <div className={cn("space-y-1", className)}>
      {blocks.map((block, bi) => {
        if (block.type === "paragraph") {
          const text = block.text as string
          if (!text) return null
          return (
            <p key={bi} className={cn("whitespace-pre-wrap leading-relaxed", textClassName)}>
              {renderTextWithInlineMath(text)}
            </p>
          )
        }
        if (block.type === "image") {
          const path = block.storagePath as string
          const ext = path.split(".").pop()?.toLowerCase()
          if (ext === "emf" || ext === "wmf") {
            return (
              <div key={bi} className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 my-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Imagem em formato {ext.toUpperCase()} (não suportado pelo navegador). Reimporte o documento salvando as imagens como PNG.
                </span>
              </div>
            )
          }
          const src = resolveImageSrc(path)
          const w = block.width as number | undefined
          const h = block.height as number | undefined
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={bi}
              src={src}
              alt={(block.alt as string) ?? `Imagem ${bi + 1}`}
              className="rounded-md border my-2 object-contain"
              style={{
                maxWidth: "100%",
                width: w ? `${w}px` : undefined,
                height: h && w ? "auto" : undefined,
              }}
            />
          )
        }
        if (block.type === "math") {
          let html: string
          try {
            html = katex.renderToString(block.latex as string, {
              throwOnError: false,
              displayMode: true,
            })
          } catch {
            html = block.latex as string
          }
          return (
            <span
              key={bi}
              className="block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
        return null
      })}
    </div>
  )
}
