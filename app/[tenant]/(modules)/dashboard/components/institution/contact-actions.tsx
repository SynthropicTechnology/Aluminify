'use client'

import { useState } from 'react'
import { ChevronDown, Copy, Mail, MessageCircle, PhoneCall, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/shared/components/overlay/dropdown-menu'
import type {
  StudentEngagementContact,
  StudentEngagementContactReason,
  StudentEngagementRow,
} from '@/app/[tenant]/(modules)/dashboard/types'

interface ContactActionsProps {
  student: StudentEngagementRow
  institutionName?: string
  onContactRecorded?: (studentId: string, contact: StudentEngagementContact) => void
  compact?: boolean
}

function onlyDigits(value: string | null): string {
  return (value ?? '').replace(/\D/g, '')
}

function toWhatsappNumber(phone: string | null): string | null {
  const digits = onlyDigits(phone)
  if (!digits) return null
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

function contactReason(student: StudentEngagementRow): StudentEngagementContactReason {
  return student.status === 'engajado' ? 'sem_conclusao' : student.status
}

function buildMessage(student: StudentEngagementRow, institutionName?: string): string {
  const courseContext = institutionName
    ? `do curso "${institutionName}"`
    : 'da sua instituição'
  const firstName = student.name.trim().split(/\s+/)[0] || student.name
  const greeting = `Olá, ${firstName}! Tudo bem?\n\nAqui é do time ${courseContext} e viemos falar do seu acesso à plataforma Aluminify.`
  const closing =
    'Estamos à disposição para te ajudar, viu? É só responder essa mensagem.'

  if (student.status === 'sem_acesso') {
    return `${greeting}\n\nPercebemos que você ainda não acessou a plataforma nos últimos dias. Precisa de ajuda para acessar seus cursos ou começar seus estudos?\n\n${closing}`
  }
  if (student.status === 'acessou_sem_estudo') {
    return `${greeting}\n\nVimos que você acessou a plataforma recentemente, mas ainda não iniciou uma sessão de estudo. Quer ajuda para começar ou montar sua rotina?\n\n${closing}`
  }
  if (student.status === 'sem_cronograma') {
    return `${greeting}\n\nNotamos que você ainda não criou seu cronograma de estudos. Ele pode te ajudar a organizar melhor sua rotina. Precisa de ajuda para configurar?\n\n${closing}`
  }
  if (student.status === 'baixo_engajamento') {
    return `${greeting}\n\nPercebemos pouco tempo de estudo nos últimos dias. Que tal retomar com uma meta curta hoje? Se precisar de ajuda, estamos por aqui.\n\n${closing}`
  }
  return `${greeting}\n\nVimos que você acessou a plataforma, mas ainda há poucas conclusões registradas. Precisa de apoio para avançar nos estudos?\n\n${closing}`
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(successMessage)
  } catch {
    toast.error('Não foi possível copiar automaticamente.')
  }
}

export function ContactActions({
  student,
  institutionName,
  onContactRecorded,
  compact,
}: ContactActionsProps) {
  const [isRecording, setIsRecording] = useState(false)
  const message = buildMessage(student, institutionName)
  const whatsappNumber = toWhatsappNumber(student.telefone)
  const emailSubject = institutionName
    ? `Acompanhamento dos estudos - ${institutionName} | Aluminify`
    : 'Acompanhamento dos estudos - Aluminify'

  const recordContact = async (
    channel: 'whatsapp' | 'email' | 'phone' | 'manual',
  ) => {
    setIsRecording(true)
    try {
      const response = await fetch('/api/dashboard/institution/students/engagement/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          channel,
          reason: contactReason(student),
          messageTemplate: message,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao registrar contato')
      }

      if (payload?.data) {
        onContactRecorded?.(student.id, payload.data as StudentEngagementContact)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar contato')
    } finally {
      setIsRecording(false)
    }
  }

  const handleWhatsapp = () => {
    if (!whatsappNumber) {
      toast.error('Aluno sem telefone válido.')
      return
    }
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    )
    void recordContact('whatsapp')
  }

  const handleEmail = () => {
    if (!student.email) {
      toast.error('Aluno sem e-mail cadastrado.')
      return
    }
    window.location.href = `mailto:${student.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(message)}`
    void recordContact('email')
  }

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
            Ações
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleWhatsapp} disabled={!whatsappNumber}>
            <MessageCircle className="mr-2 h-3.5 w-3.5" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEmail} disabled={!student.email}>
            <Mail className="mr-2 h-3.5 w-3.5" />
            E-mail
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => copyText(student.telefone ?? '', 'Telefone copiado.')}
            disabled={!student.telefone}
          >
            <PhoneCall className="mr-2 h-3.5 w-3.5" />
            Copiar telefone
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyText(message, 'Mensagem copiada.')}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copiar mensagem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => recordContact('manual')} disabled={isRecording}>
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            Contato manual
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2"
        onClick={handleWhatsapp}
        disabled={!whatsappNumber}
      >
        <MessageCircle className="mr-1 h-3.5 w-3.5" />
        WhatsApp
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2"
        onClick={handleEmail}
        disabled={!student.email}
      >
        <Mail className="mr-1 h-3.5 w-3.5" />
        E-mail
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Copiar telefone"
        onClick={() => copyText(student.telefone ?? '', 'Telefone copiado.')}
        disabled={!student.telefone}
      >
        <PhoneCall className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Copiar mensagem"
        onClick={() => copyText(message, 'Mensagem copiada.')}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Marcar contato manual"
        onClick={() => recordContact('manual')}
        disabled={isRecording}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
