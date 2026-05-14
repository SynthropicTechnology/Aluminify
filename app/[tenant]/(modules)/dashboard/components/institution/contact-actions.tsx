'use client'

import { useState } from 'react'
import { Copy, Mail, MessageCircle, PhoneCall, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type {
  StudentEngagementContact,
  StudentEngagementContactReason,
  StudentEngagementRow,
} from '@/app/[tenant]/(modules)/dashboard/types'

interface ContactActionsProps {
  student: StudentEngagementRow
  onContactRecorded?: (studentId: string, contact: StudentEngagementContact) => void
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

function buildMessage(student: StudentEngagementRow): string {
  if (student.status === 'sem_acesso') {
    return `Olá, ${student.name}! Tudo bem?\n\nPercebemos que você ainda não acessou a plataforma neste período. Precisa de ajuda para acessar seus cursos ou começar seus estudos?\n\nEstamos à disposição para te ajudar.`
  }
  if (student.status === 'acessou_sem_estudo') {
    return `Olá, ${student.name}! Tudo bem?\n\nVimos que você acessou a plataforma recentemente, mas ainda não iniciou uma sessão de estudo. Quer ajuda para começar ou montar sua rotina?`
  }
  if (student.status === 'sem_cronograma') {
    return `Olá, ${student.name}! Tudo bem?\n\nNotamos que você ainda não criou seu cronograma de estudos. Ele pode te ajudar a organizar melhor sua rotina. Precisa de ajuda para configurar?`
  }
  if (student.status === 'baixo_engajamento') {
    return `Olá, ${student.name}! Tudo bem?\n\nPercebemos pouco tempo de estudo no período. Que tal retomar com uma meta curta hoje? Se precisar de ajuda, estamos por aqui.`
  }
  return `Olá, ${student.name}! Tudo bem?\n\nVimos que você acessou a plataforma, mas ainda há poucas conclusões registradas. Precisa de apoio para avançar nos estudos?`
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(successMessage)
  } catch {
    toast.error('Não foi possível copiar automaticamente.')
  }
}

export function ContactActions({ student, onContactRecorded }: ContactActionsProps) {
  const [isRecording, setIsRecording] = useState(false)
  const message = buildMessage(student)
  const whatsappNumber = toWhatsappNumber(student.telefone)

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
    window.location.href = `mailto:${student.email}?subject=${encodeURIComponent('Acompanhamento dos estudos')}&body=${encodeURIComponent(message)}`
    void recordContact('email')
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
