"use client"

import * as React from "react"
import type { JSONContent } from "@tiptap/react"
import { Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/app/shared/library/utils"
import { ContentBlockPreview } from "./content-block-preview"
import { QuestaoEditor } from "./questao-editor"
import { blocksToTiptapDoc, tiptapDocToBlocks } from "./content-block-converter"
import { FieldLabel } from "./field-label"

interface ReviewSectionFieldProps {
  label: string
  tooltipKey: string
  blocks: Array<Record<string, unknown>>
  onBlocksChange: (blocks: Array<Record<string, unknown>>) => void
  resolveImageSrc: (storagePath: string) => string
  placeholder?: string
  textClassName?: string
  minEditorHeight?: string
}

export function ReviewSectionField({
  label,
  tooltipKey,
  blocks,
  onBlocksChange,
  resolveImageSrc,
  placeholder = "Clique para editar...",
  textClassName = "text-sm",
  minEditorHeight = "min-h-[80px]",
}: ReviewSectionFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const latestDocRef = React.useRef<JSONContent | null>(null)

  const handleStartEdit = React.useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleFinishEdit = React.useCallback(() => {
    if (latestDocRef.current) {
      const newBlocks = tiptapDocToBlocks(latestDocRef.current)
      onBlocksChange(newBlocks)
      latestDocRef.current = null
    }
    setIsEditing(false)
  }, [onBlocksChange])

  const handleEditorChange = React.useCallback((doc: JSONContent) => {
    latestDocRef.current = doc
  }, [])

  const handleEditorBlur = React.useCallback((doc: JSONContent) => {
    latestDocRef.current = doc
    const newBlocks = tiptapDocToBlocks(doc)
    onBlocksChange(newBlocks)
  }, [onBlocksChange])

  const tiptapDoc = React.useMemo(
    () => isEditing ? blocksToTiptapDoc(blocks, resolveImageSrc) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEditing],
  )

  const hasContent = blocks && blocks.length > 0 && blocks.some(
    (b) => (b.type === "paragraph" && (b.text as string)?.trim()) || b.type === "image" || b.type === "math",
  )

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel label={label} tooltipKey={tooltipKey} />
        {isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs cursor-pointer text-primary hover:text-primary"
            onClick={handleFinishEdit}
          >
            <Check className="h-3.5 w-3.5" />
            Concluir
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={handleStartEdit}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
        )}
      </div>

      {isEditing && tiptapDoc ? (
        <QuestaoEditor
          value={tiptapDoc}
          onChange={handleEditorChange}
          onBlur={handleEditorBlur}
          placeholder={placeholder}
          minHeight={minEditorHeight}
        />
      ) : (
        <div
          className={cn(
            "rounded-lg border p-3 transition-colors duration-200 cursor-pointer",
            hasContent
              ? "border-border/50 bg-muted/10 dark:bg-muted/5"
              : "border-dashed border-border/40 bg-muted/5",
          )}
          onClick={handleStartEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleStartEdit() }}
        >
          {hasContent ? (
            <ContentBlockPreview
              blocks={blocks}
              resolveImageSrc={resolveImageSrc}
              textClassName={textClassName}
            />
          ) : (
            <p className="text-sm text-muted-foreground/60 italic">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  )
}
