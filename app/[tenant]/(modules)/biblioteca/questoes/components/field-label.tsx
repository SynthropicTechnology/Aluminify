"use client"

import { Label } from "@/app/shared/components/forms/label"
import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/app/shared/components/overlay/tooltip"

const FIELD_TOOLTIPS: Record<string, string> = {
  textoBase: "Texto de apoio ou texto motivador que contextualiza a questão. Pode conter trechos de artigos, leis, poemas, etc.",
  fonte: "Referência bibliográfica ou citação da questão. Ex: Disponível em, Acesso em, adaptado de.",
  enunciado: "A pergunta ou comando da questão. É o texto principal que o aluno deve responder.",
  alternativas: "As opções de resposta da questão (A a E). A alternativa correta é marcada em verde.",
  gabarito: "A letra da alternativa correta. Clique para alterar.",
  dificuldade: "Nível de dificuldade da questão: Fácil, Médio ou Difícil.",
  resolucao: "Explicação detalhada da resolução da questão (opcional). Ajuda o aluno a entender o raciocínio.",
  videoResolucao: "Link para um vídeo explicativo da resolução (YouTube, Vimeo, etc.).",
  disciplina: "A disciplina à qual esta questão pertence. Se não definida, herda da configuração da importação.",
  moduloConteudo: "O módulo de conteúdo (tópico) ao qual a questão está associada dentro da disciplina.",
  tags: "Palavras-chave para facilitar a busca e organização das questões.",
}

export function FieldLabel({ label, tooltipKey }: { label: string; tooltipKey: string }) {
  const tip = FIELD_TOOLTIPS[tooltipKey]
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {tip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px]">
            <p>{tip}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
