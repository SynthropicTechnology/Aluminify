'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { useTenantContext } from '@/app/[tenant]/tenant-context'
import { N8nChatSection } from '@/app/tobias/components/n8n-chat-section'
import { Loader2, AlertCircle } from 'lucide-react'
import type { AIAgentChatConfig } from '@/app/shared/services/ai-agents'

export default function AgentePage() {
  const tenant = useTenantContext()

  // Agent config state
  const [agentConfig, setAgentConfig] = useState<AIAgentChatConfig | null>(null)
  const [agentError, setAgentError] = useState<string | null>(null)

  // Fetch agent configuration
  useEffect(() => {
    const fetchAgentConfig = async () => {
      if (!tenant?.empresaId) return

      setAgentError(null)

      try {
        const response = await fetch(`/api/ai-agents/${tenant.empresaId}?config=chat`)
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          if (response.status === 404) {
            setAgentError('Nenhum assistente configurado para esta empresa.')
            return
          }
          if (response.status === 403) {
            setAgentError('Você não tem acesso ao assistente deste curso.')
            return
          }
          if (response.status === 401) {
            setAgentError('Sua sessão expirou. Faça login novamente.')
            return
          }
          throw new Error(payload?.error || 'Erro ao carregar configuração do agente')
        }

        const data = await response.json()
        if (data.success && data.data) {
          setAgentConfig(data.data)
          return
        }
        setAgentError('Nenhum assistente configurado para esta empresa.')
      } catch (err) {
        console.error('Error fetching agent config:', err)
        setAgentError('Erro ao carregar assistente. Tente novamente.')
      }
    }

    fetchAgentConfig()
  }, [tenant?.empresaId])

  // Show error if no agent configured
  if (agentError) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{agentError}</p>
        </div>
      </div>
    )
  }

  // Show loading while fetching agent config
  if (!agentConfig) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // N8N integration (TobIAs)
  return <N8nChatSection agentConfig={agentConfig} />
}
