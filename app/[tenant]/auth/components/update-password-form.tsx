'use client'

import React from 'react'

import { cn } from '@/shared/library/utils'
import { createClient } from '@/app/shared/core/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/app/shared/components/forms/input'
import { Label } from '@/app/shared/components/forms/label'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    async function ensureRecoverySession() {
      try {
        const code = searchParams?.get('code')
        const tokenHash = searchParams?.get('token_hash')
        const otpType = searchParams?.get('type')

        // Fluxo PKCE: em alguns casos o Supabase redireciona com `?code=...`.
        // Fazemos a troca explicitamente para garantir sessão válida nesta rota.
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            // Fallback para casos de PKCE sem estado válido no navegador.
            if (tokenHash && otpType === 'recovery') {
              const { error: verifyError } = await supabase.auth.verifyOtp({
                type: 'recovery',
                token_hash: tokenHash,
              })
              if (verifyError) {
                setError(verifyError.message)
                setIsSessionReady(false)
                return
              }
            } else {
              const isInvalidFlowState =
                exchangeError.message?.toLowerCase().includes('invalid flow state') ||
                exchangeError.message?.toLowerCase().includes('no valid flow state')

              setError(
                isInvalidFlowState
                  ? 'Sessão de recuperação inválida neste navegador. Solicite um novo link e abra-o no mesmo navegador em que a recuperação foi solicitada.'
                  : exchangeError.message,
              )
              setIsSessionReady(false)
              return
            }
          }
        } else if (tokenHash && otpType === 'recovery') {
          // Fallback para links com token_hash direto.
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          })
          if (verifyError) {
            setError(verifyError.message)
            setIsSessionReady(false)
            return
          }
        }

        // Com `detectSessionInUrl: true`, isso também tenta capturar a sessão
        // do fragmento (#access_token=...) quando o usuário vem do e-mail.
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (!isMounted) return

        if (sessionError) {
          setError(sessionError.message)
          setIsSessionReady(false)
          return
        }

        if (!data.session) {
          setError(
            'Link inválido ou expirado. Solicite a recuperação de senha novamente.',
          )
          setIsSessionReady(false)
          return
        }

        setError(null)
        setIsSessionReady(true)
      } catch (e: unknown) {
        if (!isMounted) return
        setError(e instanceof Error ? e.message : 'Não foi possível validar a sessão de recuperação.')
        setIsSessionReady(false)
      }
    }

    ensureRecoverySession()
    return () => {
      isMounted = false
    }
  }, [supabase, searchParams])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!isSessionReady) {
        throw new Error('Sessão de recuperação ainda não está pronta. Recarregue a página e tente novamente.')
      }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // `/protected` resolve a rota final por role/tenant.
      router.push('/protected')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>Please enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!isSessionReady || isLoading}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || !isSessionReady}>
                {isLoading ? 'Saving...' : 'Save new password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
