"use client"

import * as React from "react"
import type { Content, JSONContent } from "@tiptap/react"
import { EditorContent, useEditor } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Typography } from "@tiptap/extension-typography"
import { Underline } from "@tiptap/extension-underline"
import {
  Image,
  CodeBlockLowlight,
  Selection,
} from "@/app/shared/components/ui/custom/minimal-tiptap/extensions"
import { cn } from "@/app/shared/library/utils"
import { SectionTwo } from "@/app/shared/components/ui/custom/minimal-tiptap/components/section/two"
import "@/app/shared/components/ui/custom/minimal-tiptap/styles/index.css"

const QuestaoImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-storage-path": {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-storage-path"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes["data-storage-path"]) return {}
          return { "data-storage-path": attributes["data-storage-path"] }
        },
      },
    }
  },
})

function createQuestaoExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      horizontalRule: false,
      codeBlock: false,
      heading: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      paragraph: { HTMLAttributes: { class: "text-node" } },
      code: { HTMLAttributes: { class: "inline", spellcheck: "false" } },
      dropcursor: { width: 2, class: "ProseMirror-dropcursor border" },
    }),
    Underline,
    QuestaoImage.configure({
      allowedMimeTypes: ["image/*"],
      maxFileSize: 0,
      allowBase64: false,
    }),
    CodeBlockLowlight,
    Selection,
    Typography,
    Placeholder.configure({ placeholder: () => placeholder }),
  ]
}

interface QuestaoEditorProps {
  value: JSONContent
  onChange?: (doc: JSONContent) => void
  onBlur?: (doc: JSONContent) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

export function QuestaoEditor({
  value,
  onChange,
  onBlur,
  placeholder = "",
  className,
  minHeight = "min-h-[80px]",
}: QuestaoEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createQuestaoExtensions(placeholder),
    content: value,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        class: cn("focus:outline-hidden px-3 py-2", minHeight),
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getJSON())
    },
    onBlur: ({ editor: e }) => {
      onBlur?.(e.getJSON())
    },
  })

  const editorRef = React.useRef(editor)
  editorRef.current = editor

  React.useEffect(() => {
    return () => {
      const e = editorRef.current
      if (e && onBlur) {
        onBlur(e.getJSON())
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editor) return null

  return (
    <div
      className={cn(
        "flex w-full flex-col rounded-md border border-primary/30 bg-background shadow-xs focus-within:border-primary transition-colors duration-200",
        className,
      )}
    >
      <div className="shrink-0 overflow-x-auto border-b border-border p-1.5">
        <div className="flex w-max items-center gap-px">
          <SectionTwo
            editor={editor}
            activeActions={["bold", "italic"]}
            mainActionCount={2}
          />
        </div>
      </div>
      <EditorContent
        editor={editor}
        className="minimal-tiptap-editor flex-1"
      />
    </div>
  )
}

export function getEditorJSON(editorContent: Content): JSONContent {
  if (typeof editorContent === "object" && editorContent !== null && "type" in editorContent) {
    return editorContent as JSONContent
  }
  return { type: "doc", content: [{ type: "paragraph" }] }
}
