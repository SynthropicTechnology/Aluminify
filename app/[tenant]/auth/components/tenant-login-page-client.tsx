'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useMemo, useRef, useState, useEffect } from 'react'
import { cn } from '@/shared/library/utils'
import { AuthDivider } from './auth-divider'
import { MagicLinkButton } from './magic-link-button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/app/shared/components/forms/checkbox'
import { Input } from '@/app/shared/components/forms/input'
import { Label } from '@/app/shared/components/forms/label'
import { createClient, enableAuthCookieDeletion } from '@/app/shared/core/client'
import { toast } from 'sonner'

interface TenantLoginPageClientProps {
  tenantSlug: string
  empresaId: string
  empresaNome: string
  logoUrl?: string | null
}

function safeNextPath(next: string | null | undefined) {
  if (!next) return null
  return next.startsWith('/') ? next : null
}

export function TenantLoginPageClient({
  tenantSlug,
  empresaId,
  empresaNome,
  logoUrl,
}: TenantLoginPageClientProps) {
  const searchParams = useSearchParams()

  const next = useMemo(() => {
    return safeNextPath(searchParams?.get('next')) ?? '/protected'
  }, [searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberDevice, setRememberDevice] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null)
  const [loadingLogo, setLoadingLogo] = useState(true)
  const [brandingReady, setBrandingReady] = useState(false)
  const submitLockRef = useRef(false)
  const magicLinkLockRef = useRef(false)

  // Load branding for this tenant (unauthenticated)
  useEffect(() => {
    async function loadBranding() {
      try {
        const response = await fetch(`/api/empresa/personalizacao/${empresaId}/public`)
        if (response.ok) {
          const result = await response.json()
            if (result.success && result.data) {
              const branding = result.data

              // Set Logo with fallback (login -> sidebar)
              const resolvedLogo = branding.logos?.login?.logoUrl || branding.logos?.sidebar?.logoUrl
              if (resolvedLogo) {
                setBrandingLogo(resolvedLogo)
              }


            // Apply Colors
            if (branding.colorPalette) {
              const root = document.documentElement
              const p = branding.colorPalette

              root.style.setProperty('--primary', p.primaryColor)
              root.style.setProperty('--primary-foreground', p.primaryForeground)
              root.style.setProperty('--secondary', p.secondaryColor)
              root.style.setProperty('--secondary-foreground', p.secondaryForeground)
              root.style.setProperty('--accent', p.accentColor)
              root.style.setProperty('--accent-foreground', p.accentForeground)
              root.style.setProperty('--muted', p.mutedColor)
              root.style.setProperty('--muted-foreground', p.mutedForeground)
              root.style.setProperty('--background', p.backgroundColor)
              root.style.setProperty('--foreground', p.foregroundColor)
              root.style.setProperty('--card', p.cardColor)
              root.style.setProperty('--card-foreground', p.cardForeground)
              root.style.setProperty('--destructive', p.destructiveColor)
              root.style.setProperty('--destructive-foreground', p.destructiveForeground)
              root.style.setProperty('--sidebar-background', p.sidebarBackground)
              root.style.setProperty('--sidebar-foreground', p.sidebarForeground)
              root.style.setProperty('--sidebar-primary', p.sidebarPrimary)
              root.style.setProperty('--sidebar-primary-foreground', p.sidebarPrimaryForeground)
            }

            // Apply Fonts
            if (branding.fontScheme) {
              const root = document.documentElement
              const f = branding.fontScheme

              if (f.fontSans && f.fontSans.length > 0) {
                root.style.setProperty('--font-sans', f.fontSans.join(', '))
              }
              if (f.fontMono && f.fontMono.length > 0) {
                root.style.setProperty('--font-mono', f.fontMono.join(', '))
              }

              // Load Google Fonts
              if (f.googleFonts && f.googleFonts.length > 0) {
                f.googleFonts.forEach((fontFamily: string) => {
                  const link = document.createElement('link')
                  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`
                  link.rel = 'stylesheet'
                  link.crossOrigin = 'anonymous'
                  document.head.appendChild(link)
                })
              }
            }

            // Apply Custom CSS
            if (branding.tenantBranding?.customCss) {
              const styleId = 'tenant-custom-css'
              let styleElement = document.getElementById(styleId) as HTMLStyleElement
              if (!styleElement) {
                styleElement = document.createElement('style')
                styleElement.id = styleId
                document.head.appendChild(styleElement)
              }
              styleElement.textContent = branding.tenantBranding.customCss
            }
          }
        }
      } catch (error) {
        console.warn('[tenant-login] Failed to load branding:', error)
      } finally {
        setLoadingLogo(false)
        // Give browser a moment to paint CSS variables
        setBrandingReady(true)
      }
    }
    loadBranding()
  }, [empresaId])

  // Determine which logo to use
  const displayLogo = useMemo(() => {
    if (brandingLogo) return brandingLogo
    return logoUrl
  }, [brandingLogo, logoUrl])

  const handleMagicLink = async () => {
    if (magicLinkLockRef.current) return
    if (isLoading) return
    if (!email) {
      toast.error('Email obrigatório', {
        description: 'Informe seu email para receber o magic link.',
      })
      return
    }

    magicLinkLockRef.current = true
    setIsLoading(true)
    try {
      const supabase = createClient()
      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo },
      })

      if (error) {
        toast.error('Não foi possível enviar o link', {
          description: error.message,
        })
        return
      }

      toast.success('Magic link enviado', {
        description: 'Verifique sua caixa de entrada para continuar o login.',
      })
    } catch (error) {
      console.error('[tenant-login] Erro ao enviar magic link:', error)
      toast.error('Erro inesperado', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      })
    } finally {
      setIsLoading(false)
      magicLinkLockRef.current = false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (submitLockRef.current) {
      return
    }

    if (isLoading) {
      return
    }

    if (!email || !password) {
      toast.error('Campos obrigatórios', {
        description: 'Informe email e senha para entrar.',
      })
      return
    }

    submitLockRef.current = true
    setIsLoading(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        let errorDescription = error.message

        if (error.message.includes('Invalid login credentials')) {
          errorDescription = 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.'
        } else if (error.message.includes('Email not confirmed')) {
          errorDescription = 'Seu email ainda não foi confirmado. Verifique sua caixa de entrada.'
        } else if (error.message.includes('Too many requests')) {
          errorDescription = 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
        } else if (
          error.status === 429 ||
          error.message.toLowerCase().includes('rate limit')
        ) {
          errorDescription =
            'Limite de tentativas atingido no provedor de autenticação. Aguarde alguns minutos e tente novamente.'
        }

        toast.error('Não foi possível entrar', {
          description: errorDescription,
        })
        return
      }

      // Garantia: se este navegador ficou com cookie de impersonação (httpOnly) de uma sessão anterior,
      // ao logar novamente o usuário deve voltar para o próprio contexto.
      try {
        const token = data.session?.access_token
        if (token) {
          await fetch('/api/auth/stop-impersonate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }).catch(() => null)
        }
      } catch {
        // noop
      }

      // Validate user belongs to this tenant
      const validateResponse = await fetch('/api/auth/validate-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, source: 'password' }),
      })

      if (!validateResponse.ok) {
        const validateResult = await validateResponse.json()

        // Logout user since they don't belong to this tenant
        enableAuthCookieDeletion()
        await supabase.auth.signOut()

        toast.error('Acesso negado', {
          description: validateResult.message || 'Você não tem acesso a esta instituição.',
        })
        return
      }

      // Identify user roles for this tenant
      const { identifyUserRoleAction } = await import('@/app/shared/core/actions/auth-actions')
      const roleResult = await identifyUserRoleAction(data.user.id)

      let finalNext = next
      if (roleResult.success && roleResult.redirectUrl) {
        const hasExplicitNext = searchParams?.get('next')
        if (!hasExplicitNext || next === '/protected') {
          finalNext = roleResult.redirectUrl
        }
      }

      window.location.href = finalNext
    } catch (error) {
      console.error('Erro inesperado no login:', error)
      toast.error('Erro inesperado', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      })
    } finally {
      setIsLoading(false)
      submitLockRef.current = false
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      {/* ═══════════════════════════════════════════════
          BRAND SHOWCASE PANEL (left on desktop, top on mobile)
          ═══════════════════════════════════════════════ */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-primary px-8 py-16 md:w-1/2 md:min-h-svh md:py-0">
        {/* Neutral overlay — fades out once branding loads */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 bg-slate-900 transition-opacity duration-700 ease-out motion-reduce:transition-none',
            brandingReady ? 'opacity-0' : 'opacity-100'
          )}
        />

        {/* Gradient overlay for depth — uses white tint instead of gray/black */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/0 via-white/3 to-black/10" />

        {/* Radial glow behind logo area */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />

        {/* Decorative circles (staggered entrance) */}
        <div
          className={cn(
            'absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/8',
            'transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none',
            brandingReady ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          )}
        />
        <div
          className={cn(
            'absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-white/6',
            'transition-[opacity,transform] delay-150 duration-1000 ease-out motion-reduce:transition-none',
            brandingReady ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          )}
        />
        <div
          className={cn(
            'absolute left-[10%] top-[30%] h-14 w-14 rounded-full bg-white/10',
            'transition-opacity delay-300 duration-700 ease-out motion-reduce:transition-none',
            brandingReady ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          className={cn(
            'absolute bottom-[28%] right-[14%] h-8 w-8 rounded-full bg-white/8',
            'transition-opacity delay-500 duration-700 ease-out motion-reduce:transition-none',
            brandingReady ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Subtle dot pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Brand content (fades up when ready) */}
        <div
          className={cn(
            'relative z-10 flex flex-col items-center text-center transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none',
            brandingReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          )}
        >
          {/* Logo */}
          {loadingLogo ? (
            <div className="h-20 w-56 animate-pulse rounded-xl bg-white/10" />
          ) : displayLogo ? (
            <div className="relative h-20 w-56 md:h-24 md:w-64">
              <Image
                src={displayLogo}
                alt={`Logo ${empresaNome}`}
                fill
                sizes="(max-width: 768px) 224px, 256px"
                className="object-contain drop-shadow-lg"
                priority
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
              <span className="text-3xl font-bold text-white">
                {empresaNome.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          LOGIN FORM PANEL (right on desktop, bottom on mobile)
          ═══════════════════════════════════════════════ */}
      <div className="flex w-full flex-1 flex-col justify-between bg-background px-6 py-10 md:w-1/2 md:px-12 lg:px-16">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="page-title">
                Bem-vindo de volta
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Informe seus dados para acessar o sistema
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <MagicLinkButton onClick={handleMagicLink} loading={isLoading} disabled={!email} />

              <AuthDivider />

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberDevice}
                    onCheckedChange={(checked) => setRememberDevice(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                    Lembrar dispositivo
                  </Label>
                </div>

                <Link
                  href={`/${tenantSlug}/auth/forgot-password`}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={isLoading || !password}
                title={!password ? 'Digite sua senha para habilitar o botão' : undefined}
              >
                {isLoading ? 'Entrando...' : !password ? 'Digite a senha para entrar' : 'Entrar'}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mx-auto mt-8 w-full max-w-md space-y-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
            <span>Powered by</span>
            <span className="font-semibold tracking-tight">Aluminify</span>
          </div>
        </div>
      </div>
    </div>
  )
}
